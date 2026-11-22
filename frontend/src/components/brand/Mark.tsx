export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="3" fill="#2C1B1A" />
      <rect x="6" y="8" width="3.5" height="16" fill="#F3EEE4" />
      <rect x="11" y="6" width="3.5" height="18" fill="#C4A574" />
      <rect x="16" y="9" width="3.5" height="15" fill="#F7F1E6" />
      <rect x="21.5" y="7" width="3.5" height="17" fill="#8C6A3D" />
    </svg>
  );
}
