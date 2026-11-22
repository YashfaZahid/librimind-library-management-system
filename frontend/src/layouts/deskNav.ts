import type { NavGroup, NavItem } from "../components/shell/AppShell";

export const deskGroups: NavGroup[] = [
  {
    label: "Today",
    items: [
      { to: "/admin", label: "Desk", end: true, hint: "Start here" },
      { to: "/admin/circulation", label: "Circulation", hint: "Approve, issue, return" },
    ],
  },
  {
    label: "Collection",
    items: [
      { to: "/admin/shelf", label: "Shelf", hint: "Find a book" },
      { to: "/admin/catalogue", label: "Catalogue", hint: "Add or edit a title" },
      { to: "/admin/digital", label: "Digital", hint: "Library PDFs" },
    ],
  },
  {
    label: "People",
    items: [{ to: "/admin/readers", label: "Readers", hint: "Accounts" }],
  },
  {
    label: "Figures",
    items: [
      { to: "/admin/analytics", label: "Analytics", hint: "Counts and stock" },
      { to: "/admin/insights", label: "Insights", hint: "Demand and forecast" },
      { to: "/admin/evaluation", label: "Evaluation", hint: "Compare the agents" },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/admin/assistant", label: "Assistant", hint: "Ask the catalogue" },
      { to: "/admin/sources", label: "Sources", hint: "Outside libraries" },
    ],
  },
];

export const accountGroup: NavGroup = {
  label: "Your account",
  items: [
    { to: "/library/collection", label: "My shelf", hint: "Books and files you saved" },
    { to: "/library/loans", label: "Loans", hint: "What you borrowed" },
    { to: "/library/for-you", label: "For you", hint: "Titles for your interests" },
    { to: "/library/profile", label: "Account", hint: "Name and interests" },
  ],
};

export const deskNav: NavItem[] = deskGroups.flatMap((group) => group.items);

export function deskPath(pathname: string): string | null {
  if (pathname === "/library") return "/admin";
  const direct: Record<string, string> = {
    "/library/shelf": "/admin/shelf",
    "/library/digital": "/admin/digital",
    "/library/assistant": "/admin/assistant",
  };
  if (direct[pathname]) return direct[pathname];
  if (pathname.startsWith("/library/books/")) return `/admin/books/${pathname.slice("/library/books/".length)}`;
  if (pathname.startsWith("/library/digital/")) return `/admin/digital/${pathname.slice("/library/digital/".length)}`;
  return null;
}
