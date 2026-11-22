import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/context";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { REGISTER_PENDING, hasErrors, validateRegister } from "../../domain/accounts";
import { isAuthConfigured } from "../../lib/supabase";
import { usePageTitle } from "../../hooks/usePageTitle";
import { SamplePreviewLinks } from "./SamplePreviewLinks";

export default function RegisterPage() {
  usePageTitle("Create an account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<ReturnType<typeof validateRegister>>({});
  const [notice, setNotice] = useState("");
  const auth = useAuth();
  const navigate = useNavigate();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = validateRegister({ name, email, password, confirm });
    setErrors(next);
    if (hasErrors(next)) {
      setNotice("");
      return;
    }
    if (!isAuthConfigured()) {
      setNotice(REGISTER_PENDING);
      return;
    }
    const message = await auth.signUp(name, email, password);
    if (message) {
      setNotice(message);
      return;
    }
    navigate("/library");
  }

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-brass">Account</p>
      <h2 className="mt-2 font-serif text-4xl tracking-tight">Create an account</h2>
      <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
        <TextField
          label="Name"
          autoComplete="name"
          value={name}
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value);
            setNotice("");
          }}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
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
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setNotice("");
          }}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            setNotice("");
          }}
        />
        <Button type="submit" className="mt-2">
          Create account
        </Button>
        {notice ? (
          <p role="status" className="border-l-2 border-brass pl-3 text-sm leading-relaxed text-ink">
            {notice}
          </p>
        ) : null}
      </form>
      <p className="mt-8 text-sm text-ink-soft">
        Already registered?{" "}
        <Link to="/login" className="border-b border-brass text-ink">
          Sign in
        </Link>
      </p>
      <SamplePreviewLinks />
    </>
  );
}
