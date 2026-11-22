import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { coverImage, coverTone } from "../books/coverTone";
import type { ShelfRow } from "./layout";

const BOOK_W = 0.2;
const BOOK_H = 0.78;
const BOOK_D = 0.5;
const GAP = 0.06;
const ROW_GAP = 1.2;

export default function RoomShelf({
  rows,
  selectedId,
  onSelect,
}: {
  rows: ShelfRow[];
  selectedId: string | null;
  onSelect: (bookId: string) => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.15, 5.2], fov: 38 }}
      gl={{ antialias: true, powerPreference: "default" }}
      onPointerMissed={() => onSelect("")}
    >
      <color attach="background" args={["#2C1B1A"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.15} color="#fff4e5" />
      <group position={[0, ((rows.length - 1) * ROW_GAP) / 2, 0]}>
        {rows.map((row, index) => (
          <ShelfRowMesh key={row.id} row={row} index={index} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={8}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

function ShelfRowMesh({
  row,
  index,
  selectedId,
  onSelect,
}: {
  row: ShelfRow;
  index: number;
  selectedId: string | null;
  onSelect: (bookId: string) => void;
}) {
  const width = Math.max(row.books.length, 3) * (BOOK_W + GAP) + 0.7;
  const y = -index * ROW_GAP;
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -BOOK_H / 2 - 0.04, 0]}>
        <boxGeometry args={[width, 0.06, BOOK_D + 0.28]} />
        <meshStandardMaterial color="#4A2C2A" roughness={0.85} />
      </mesh>
      {row.books.map((slot) => (
        <BookMesh
          key={slot.book.id}
          title={slot.book.title}
          author={slot.book.authors[0] ?? ""}
          coverUrl={coverImage(slot.book)}
          toneId={slot.book.id}
          category={row.categoryName}
          x={(slot.column - (slot.rowSize - 1) / 2) * (BOOK_W + GAP)}
          selected={slot.book.id === selectedId}
          onSelect={() => onSelect(slot.book.id)}
        />
      ))}
    </group>
  );
}

function BookMesh({
  title,
  author,
  coverUrl,
  toneId,
  category,
  x,
  selected,
  onSelect,
}: {
  title: string;
  author: string;
  coverUrl: string;
  toneId: string;
  category: string;
  x: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const hovered = useRef(false);
  const materials = useCoverMaterials(title, author, coverUrl, toneId, category);

  useEffect(
    () => () =>
      materials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      }),
    [materials],
  );

  useFrame((state, delta) => {
    const current = mesh.current;
    if (!current) return;
    const delay = Math.abs(x) * 0.45;
    const progress = Math.min(1, Math.max(0, (state.clock.elapsedTime - delay) / 0.9));
    const settle = 1 - (1 - progress) ** 3;
    current.position.y = (1 - settle) * 1.15;
    const target = hovered.current || selected ? 0.42 : 0;
    current.position.z = THREE.MathUtils.damp(current.position.z, target * settle, 7, delta);
  });

  return (
    <mesh
      ref={mesh}
      position={[x, 0, 0]}
      material={materials}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        hovered.current = true;
      }}
      onPointerOut={() => {
        hovered.current = false;
      }}
    >
      <boxGeometry args={[BOOK_W, BOOK_H, BOOK_D]} />
    </mesh>
  );
}

function useCoverMaterials(title: string, author: string, coverUrl: string, toneId: string, category: string) {
  const tone = coverTone(toneId);
  const [photo, setPhoto] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!coverUrl) return;
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(coverUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      if (alive) setPhoto(texture);
    });
    return () => {
      alive = false;
    };
  }, [coverUrl]);

  return useMemo(() => {
    const map = photo ?? coverCanvas(title, author, category, tone);
    const cover = new THREE.MeshStandardMaterial({ map, roughness: 0.72 });
    const side = new THREE.MeshStandardMaterial({ color: tone.cloth, roughness: 0.8 });
    const spine = new THREE.MeshStandardMaterial({ color: tone.rule, roughness: 0.6 });
    return [side, spine, side, side, cover, side];
  }, [author, category, photo, title, tone]);
}

function coverCanvas(
  title: string,
  author: string,
  category: string,
  tone: ReturnType<typeof coverTone>,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = tone.cloth;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(0,0,0,0.28)";
  context.fillRect(0, 0, 18, canvas.height);
  context.fillStyle = tone.rule;
  context.fillRect(22, 36, 150, 3);
  context.fillStyle = tone.ink;
  context.font = "600 34px Georgia, serif";
  wrapText(context, title, 36, 92, 190, 40);
  context.font = "22px Georgia, serif";
  context.fillStyle = tone.rule;
  context.fillText(category, 36, 330, 190);
  context.fillStyle = tone.ink;
  context.font = "20px Georgia, serif";
  context.fillText(author, 36, 300, 190);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cursor = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else {
      line = next;
    }
  }
  context.fillText(line, x, cursor);
}
