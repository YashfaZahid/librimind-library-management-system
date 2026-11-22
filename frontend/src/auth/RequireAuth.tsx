import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorState } from "../components/ui/ErrorState";
import { useAuth } from "./context";

export function RequireAuth({ allow, children }: { allow: "member" | "admin"; children: ReactNode }) {
  const auth = useAuth();
  if (!auth.configured) return children;
  if (auth.status === "loading") return <LoadingState label="Checking your account" />;
  if (!auth.session) return <Navigate to="/login" replace />;
  if (allow === "admin" && auth.profile?.role !== "admin") {
    return (
      <div className="min-h-dvh bg-paper px-6 py-16 text-ink">
        <div className="mx-auto max-w-lg">
          <ErrorState
            title="The desk is for librarians"
            detail="This account is a student account. Library shelves stay open. The desk does not."
          />
        </div>
      </div>
    );
  }
  return children;
}
