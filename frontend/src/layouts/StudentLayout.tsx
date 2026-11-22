import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/context";
import { AppShell } from "../components/shell/AppShell";
import { useCatalogue } from "../data/catalogue";
import { CatalogueProvider } from "../data/CatalogueProvider";
import { DigitalProvider } from "../data/DigitalProvider";
import { readerById } from "../domain/library";
import { deskNav, deskPath } from "./deskNav";

const baseItems = [
  { to: "/library", label: "Home", end: true },
  { to: "/library/shelf", label: "Shelf" },
  { to: "/library/digital", label: "Digital" },
  { to: "/library/collection", label: "My shelf" },
  { to: "/library/loans", label: "Loans" },
  { to: "/library/assistant", label: "Assistant" },
  { to: "/library/for-you", label: "For you" },
];

export function StudentLayout() {
  return (
    <CatalogueProvider>
      <DigitalProvider>
        <StudentFrame />
      </DigitalProvider>
    </CatalogueProvider>
  );
}

function StudentFrame() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const catalogue = useCatalogue();
  const library = catalogue.library;
  const reader = library ? readerById(library.readers, library.sessionReaderId) : undefined;
  const librarian = auth.profile?.role === "admin";
  const desk = librarian ? deskPath(location.pathname) : null;
  if (desk) return <Navigate to={`${desk}${location.search}`} replace />;
  const items = librarian
    ? [
        ...deskNav,
        { to: "/library/collection", label: "My shelf" },
        { to: "/library/loans", label: "Loans" },
        { to: "/library/for-you", label: "For you" },
        { to: "/library/profile", label: "Account" },
      ]
    : auth.session
      ? [...baseItems, { to: "/library/profile", label: "Profile" }]
      : baseItems;
  const identity = auth.profile
    ? {
        name: auth.profile.fullName || auth.profile.email,
        meta: auth.profile.role === "admin" ? "Librarian" : "Student",
      }
    : { name: reader?.name ?? "Reader", meta: "Sample reader" };

  return (
    <AppShell
      items={items}
      navLabel={librarian ? "Desk" : "Library"}
      identity={identity}
      sampleNote={catalogue.source === "sample"}
      exitLabel={auth.session ? "Sign out" : "Leave preview"}
      onExit={
        auth.session
          ? () => {
              void auth.signOut().then(() => navigate("/login"));
            }
          : undefined
      }
    >
      <Outlet />
    </AppShell>
  );
}
