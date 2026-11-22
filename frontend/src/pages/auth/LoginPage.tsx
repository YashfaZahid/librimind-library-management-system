import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/context";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { SIGN_IN_PENDING, hasErrors, validateSignIn } from "../../domain/accounts";
import { getSupabase, isAuthConfigured } from "../../lib/supabase";
import { usePageTitle } from "../../hooks/usePageTitle";
import { SamplePreviewLinks } from "./SamplePreviewLinks";

export default function LoginPage() {
  usePageTitle("Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ReturnType<typeof validateSignIn>>({});
  const [notice, setNotice] = useState("");
  const auth = useAuth();
  const navigate = useNavigate();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = validateSignIn({ email, password });
    setErrors(next);
    if (hasErrors(next)) {
      setNotice("");
      return;
    }
    if (!isAuthConfigured()) {
      setNotice(SIGN_IN_PENDING);
      return;
    }
    const message = await auth.signIn(email, password);
    if (message) {
      setNotice(message);
      return;
    }
    const client = getSupabase();
    let role: string | null = null;
    if (client) {
      const userId = (await client.auth.getSession()).data.session?.user.id;
      if (userId) {
        const { data } = await client.from("profiles").select("role").eq("id", userId).maybeSingle();
        role = data?.role ?? null;
      }
    }
    navigate(role === "admin" ? "/admin" : "/library");
  }

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-brass">Account</p>
      <h2 className="mt-2 font-serif text-4xl tracking-tight">Sign in</h2>
      <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            setNotice("");
          }}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setNotice("");
          }}
        />
        <Button type="submit" className="mt-2">
          Sign in
        </Button>
        {notice ? (
          <p role="status" className="border-l-2 border-brass pl-3 text-sm leading-relaxed text-ink">
            {notice}
          </p>
        ) : null}
      </form>
      <p className="mt-8 text-sm text-ink-soft">
        New to the library?{" "}
        <Link to="/register" className="border-b border-brass text-ink">
          Create an account
        </Link>
      </p>
      <SamplePreviewLinks />
    </>
  );
}
