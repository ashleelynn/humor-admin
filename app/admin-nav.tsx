"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "./actions";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/media", label: "Media" },
  { href: "/users", label: "Users" },
  { href: "/votes", label: "Votes" },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        Booth <em>Admin</em>
      </Link>
      <nav className="tabs" aria-label="Admin sections">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className="tab" aria-current={active ? "page" : undefined}>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <form action={signOut} className="whoami">
        <span className="muted small">{email}</span>
        <button className="btn ghost small" type="submit">
          Sign out
        </button>
      </form>
    </header>
  );
}
