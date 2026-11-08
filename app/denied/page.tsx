import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "../actions";

export const metadata = { title: "No access · Booth Admin" };

export default async function DeniedPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="gate">
      <div className="gate-card">
        <p className="eyebrow">No access</p>
        <h1>This door is staff only</h1>
        <p className="muted">
          You’re signed in as <strong>{user.email}</strong>, but that account isn’t a superadmin.
        </p>
        <form action={signOut}>
          <button className="btn ghost block" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
