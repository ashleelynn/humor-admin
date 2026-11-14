"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "./actions";

const GROUPS = [
  {
    label: "Booth",
    links: [
      { href: "/", label: "Overview" },
      { href: "/media", label: "Media" },
      { href: "/images", label: "Images" },
      { href: "/users", label: "Users" },
      { href: "/votes", label: "Votes" },
    ],
  },
  {
    label: "AI",
    links: [
      { href: "/prompt-chains", label: "Prompt chains" },
      { href: "/terms", label: "Terms" },
      { href: "/examples", label: "Examples" },
      { href: "/llm-models", label: "Models" },
      { href: "/llm-providers", label: "Providers" },
      { href: "/requests", label: "Requests" },
      { href: "/llm-responses", label: "Responses" },
    ],
  },
  {
    label: "Access",
    links: [
      { href: "/signup-domains", label: "Signup domains" },
      { href: "/whitelisted-emails", label: "Whitelist" },
    ],
  },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="topbar-row">
        <Link href="/" className="wordmark">
          Booth <em>Admin</em>
        </Link>
        <form action={signOut} className="whoami">
          <span className="muted small">{email}</span>
          <button className="btn ghost small" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <nav className="nav-groups" aria-label="Admin sections">
        {GROUPS.map((g) => (
          <div key={g.label} className="nav-group">
            <span className="nav-group-label">{g.label}</span>
            <div className="tabs">
              {g.links.map((l) => {
                const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <Link key={l.href} href={l.href} className="tab" aria-current={active ? "page" : undefined}>
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </header>
  );
}
