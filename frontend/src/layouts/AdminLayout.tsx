import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/context";
import { AppShell } from "../components/shell/AppShell";
import { useCatalogue } from "../data/catalogue";
import { CatalogueProvider } from "../data/CatalogueProvider";
import { DigitalProvider } from "../data/DigitalProvider";
import { accountGroup, deskGroups } from "./deskNav";

export function AdminLayout() {
  return (
    <CatalogueProvider>
      <DigitalProvider>
        <AdminFrame />
      </DigitalProvider>
    </CatalogueProvider>
  );
}

function AdminFrame() {
  const auth = useAuth();
  const navigate = useNavigate();
  const catalogue = useCatalogue();
  const groups = auth.session ? [...deskGroups, accountGroup] : deskGroups;
  const items = groups.flatMap((group) => group.items);
  const identity = auth.profile
    ? { name: auth.profile.fullName || auth.profile.email, meta: "Librarian" }
    : { name: "Duty desk", meta: "Sample session" };

  return (
    <AppShell
      items={items}
      groups={groups}
      navLabel="Desk"
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
