import type { ReactNode } from "react";
import { AdminNav } from "./admin-nav";

export function Shell({ email, title, lede, children }: { email: string; title: string; lede?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <AdminNav email={email} />
      <main>
        <div className="page-head">
          <h1>{title}</h1>
          {lede && <p className="muted">{lede}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
