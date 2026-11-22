import { render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "./context";
import { RequireAuth } from "./RequireAuth";

function renderGuard(role: "student" | "admin" | null, allow: "member" | "admin") {
  const value = {
    configured: true,
    status: "ready" as const,
    session: role ? ({ user: { id: "user-1" } } as Session) : null,
    profile: role
      ? { id: "user-1", email: "a@example.edu", fullName: "Amina", role, programme: "", readingInterests: [] }
      : null,
    signIn: async () => null,
    signUp: async () => null,
    saveProfile: async () => null,
    signOut: async () => undefined,
  };

  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/desk"]}>
        <Routes>
          <Route path="/login" element={<p>Sign in screen</p>} />
          <Route
            path="/desk"
            element={
              <RequireAuth allow={allow}>
                <p>Protected desk</p>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("route protection", () => {
  it("sends an anonymous visitor to sign in", () => {
    renderGuard(null, "member");
    expect(screen.getByText("Sign in screen")).toBeInTheDocument();
  });

  it("keeps a student out of the desk", () => {
    renderGuard("student", "admin");
    expect(screen.getByRole("heading", { name: "The desk is for librarians" })).toBeInTheDocument();
    expect(screen.queryByText("Protected desk")).not.toBeInTheDocument();
  });

  it("lets a librarian open the desk", () => {
    renderGuard("admin", "admin");
    expect(screen.getByText("Protected desk")).toBeInTheDocument();
  });
});
