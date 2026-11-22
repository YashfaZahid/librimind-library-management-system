import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../auth/context";
import type { AccountProfile } from "../../domain/profile";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function ProfilePage() {
  usePageTitle("Profile");
  const auth = useAuth();
  const profile = auth.profile;

  if (!auth.configured) {
    return (
      <PageHeader
        kicker="Account"
        title="Profile"
        lede="Add the Supabase URL and anon key, run supabase/schema.sql, then this page saves to your account."
      />
    );
  }

  if (auth.status === "loading") return null;

  if (!profile) {
    return (
      <PageHeader
        kicker="Account"
        title="Profile"
        lede="This sign-in has no profile row yet. Run supabase/schema.sql so new accounts create one, then sign in again."
      />
    );
  }

  return <ProfileForm key={profile.id} profile={profile} onSave={auth.saveProfile} />;
}

function ProfileForm({
  profile,
  onSave,
}: {
  profile: AccountProfile;
  onSave: (input: { fullName: string; programme: string; interests: string }) => Promise<string | null>;
}) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [programme, setProgramme] = useState(profile.programme);
  const [interests, setInterests] = useState(profile.readingInterests.join(", "));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (fullName.trim().length < 2) {
      setError("Enter the name you use at the library.");
      return;
    }
    const message = await onSave({ fullName, programme, interests });
    if (message) setError(message);
    else setNotice("Profile saved.");
  }

  return (
    <div>
      <PageHeader kicker={profile.role === "admin" ? "Librarian" : "Student"} title="Profile" />
      <dl className="mt-8 max-w-xl text-sm">
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-t border-rule py-2">
          <dt className="text-ink-soft">Email</dt>
          <dd>{profile.email}</dd>
        </div>
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-t border-rule py-2">
          <dt className="text-ink-soft">Role</dt>
          <dd>{profile.role === "admin" ? "Librarian" : "Student"}</dd>
        </div>
      </dl>
      <form className="mt-8 max-w-xl space-y-4" onSubmit={onSubmit}>
        <TextField label="Name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <TextField label="Programme" value={programme} onChange={(event) => setProgramme(event.target.value)} />
        <TextField
          label="Reading interests"
          value={interests}
          onChange={(event) => setInterests(event.target.value)}
          placeholder="Literature, History"
        />
        <p className="-mt-2 text-sm text-ink-soft">Separate subjects with commas. For you uses these.</p>
        <Button type="submit">Save profile</Button>
        {error ? (
          <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="border-l-2 border-brass pl-3 text-sm text-ink">
            {notice}
          </p>
        ) : null}
      </form>
    </div>
  );
}
