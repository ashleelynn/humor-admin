import { type AdminUser, count, displayName, formatWhen, requireAdmin } from "@/lib/admin";
import { Shell } from "../shell";

export const dynamic = "force-dynamic";

// READ only: profiles are managed by their owners and by the sign-up trigger.
export default async function UsersPage() {
  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_users");
  const users = (data ?? []) as AdminUser[];

  return (
    <Shell email={user.email ?? ""} title="Users" lede={`${count(users.length, "account")}. Read only.`}>
      {error && <p className="notice is-error">{error.message}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Signed in with</th>
              <th scope="col">Joined</th>
              <th scope="col">Last seen</th>
              <th scope="col" className="num">Confessions</th>
              <th scope="col" className="num">Drops</th>
              <th scope="col" className="num">Votes</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <th scope="row">
                  <div className="person">
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="avatar-blank" aria-hidden="true">
                        {displayName(u).slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <span>
                        {displayName(u)} {u.is_superadmin && <span className="badge">Superadmin</span>}
                      </span>
                      <span className="muted small">{u.email}</span>
                    </div>
                  </div>
                </th>
                <td className="cap">{u.provider}</td>
                <td>{formatWhen(u.created_at)}</td>
                <td>{formatWhen(u.last_sign_in_at)}</td>
                <td className="num">{u.confessions}</td>
                <td className="num">{u.drops}</td>
                <td className="num">{u.votes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
