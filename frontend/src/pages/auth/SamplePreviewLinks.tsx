import { Link } from "react-router-dom";

export function SamplePreviewLinks() {
  return (
    <div className="mt-10 border-t border-rule pt-6">
      <p className="text-sm leading-relaxed text-ink-soft">Preview the interface with the sample catalogue.</p>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link to="/library" className="border-b border-brass text-ink">
          Sample library
        </Link>
        <Link to="/admin" className="border-b border-brass text-ink">
          Sample desk
        </Link>
      </p>
    </div>
  );
}
