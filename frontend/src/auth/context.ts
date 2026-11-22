import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AccountProfile } from "../domain/profile";

export interface AuthValue {
  configured: boolean;
  status: "loading" | "anonymous" | "ready";
  session: Session | null;
  profile: AccountProfile | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  saveProfile: (input: { fullName: string; programme: string; interests: string }) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const disabledAuth: AuthValue = {
  configured: false,
  status: "anonymous",
  session: null,
  profile: null,
  signIn: async () => null,
  signUp: async () => null,
  saveProfile: async () => "Sign-in is not connected yet.",
  signOut: async () => undefined,
};

export const AuthContext = createContext<AuthValue>(disabledAuth);

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
