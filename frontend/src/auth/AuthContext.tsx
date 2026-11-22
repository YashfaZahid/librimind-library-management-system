import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { ApiError, apiPublic } from "../lib/api";
import { getSupabase, isAuthConfigured } from "../lib/supabase";
import type { AccountProfile } from "../domain/profile";
import { profileWrite } from "../domain/profile";
import { AuthContext, type AuthValue } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isAuthConfigured();
  const [status, setStatus] = useState<AuthValue["status"]>(configured ? "loading" : "anonymous");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let active = true;

    function apply(nextSession: Session | null, nextProfile: AccountProfile | null) {
      if (!active) return;
      setSession(nextSession);
      setProfile(nextProfile);
      setStatus(nextSession ? "ready" : "anonymous");
    }

    async function load(nextSession: Session | null, supabase: SupabaseClient) {
      if (!nextSession) {
        apply(null, null);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, programme, reading_interests")
        .eq("id", nextSession.user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !data || (data.role !== "student" && data.role !== "admin")) {
        apply(nextSession, null);
        return;
      }
      apply(nextSession, {
        id: data.id,
        email: data.email ?? nextSession.user.email ?? "",
        fullName: data.full_name ?? "",
        role: data.role,
        programme: data.programme ?? "",
        readingInterests: data.reading_interests ?? [],
      });
    }

    void client.auth.getSession().then(({ data }) => load(data.session, client));
    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      void load(nextSession, client);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(() => {
    return {
      configured,
      status,
      session,
      profile,
      async signIn(email, password) {
        const client = getSupabase();
        if (!client) return null;
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        return error ? error.message : null;
      },
      async signUp(name, email, password) {
        const client = getSupabase();
        if (!client) return null;
        try {
          await apiPublic("/api/v1/register", { name: name.trim(), email: email.trim(), password });
        } catch (caught) {
          return caught instanceof ApiError ? caught.message : "The account was not created.";
        }
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        return error ? error.message : null;
      },
      async saveProfile(input) {
        const client = getSupabase();
        if (!client || !profile) return "Sign-in is not connected yet.";
        const written = profileWrite(input);
        const { error } = await client.from("profiles").update(written).eq("id", profile.id);
        if (error) return error.message;
        setProfile({
          ...profile,
          fullName: String(written.full_name),
          programme: written.programme ?? "",
          readingInterests: written.reading_interests,
        });
        return null;
      },
      async signOut() {
        const client = getSupabase();
        if (!client) return;
        await client.auth.signOut();
      },
    };
  }, [configured, profile, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
