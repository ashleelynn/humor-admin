import Link from "next/link";
import { type AdminUser, count, displayName, formatWhen, requireAdmin } from "@/lib/admin";
import { Shell } from "../shell";

export const dynamic = "force-dynamic";

type Request = {
  id: number;
  created_at: string;
  user_id: string | null;
  generation_id: number | null;
  status: string;
  error: string | null;
  duration_ms: number | null;
  theme: string | null;
  prompt_chains: { name: string } | null;
  llm_models: { name: string } | null;
  llm_responses: { input_tokens: number | null; output_tokens: number | null }[];
};

// READ generation requests: every Claude call the booth or admin made, succeeded or not.
export default async function RequestsPage() {
  const { supabase, user } = await requireAdmin();
  const [rRes, uRes] = await Promise.all([
    supabase
      .from("generation_requests")
      .select("id, created_at, user_id, generation_id, status, error, duration_ms, theme, prompt_chains(name), llm_models(name), llm_responses(input_tokens, output_tokens)")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.rpc("admin_users"),
  ]);
  const requests = (rRes.data ?? []) as unknown as Request[];
  const users = new Map(((uRes.data ?? []) as AdminUser[]).map((u) => [u.id, u]));
  const ok = requests.filter((r) => r.status === "succeeded");
  const avg = ok.length ? ok.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / ok.length / 1000 : null;

  return (
    <Shell
      email={user.email ?? ""}
      title="Generation requests"
      lede={`${count(requests.length, "request")}, ${ok.length} succeeded${avg === null ? "" : `, ${avg.toFixed(1)}s on average`}. Read only.`}
    >
      {rRes.error && <p className="notice is-error">{rRes.error.message}</p>}
      {requests.length === 0 ? (
        <p className="muted">No requests yet. They’re logged from the next photo drop on.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Chain</th>
                <th scope="col">Model</th>
                <th scope="col">Result</th>
                <th scope="col" className="num">Time</th>
                <th scope="col" className="num">Tokens in / out</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const res = r.llm_responses[0];
                return (
                  <tr key={r.id}>
                    <th scope="row">
                      <Link href={`/requests/${r.id}`}>#{r.id}</Link>
                    </th>
                    <td className="nowrap">{formatWhen(r.created_at)}</td>
                    <td>{r.user_id ? displayName(users.get(r.user_id)) : "Deleted user"}</td>
                    <td>{r.prompt_chains?.name ?? "Built-in"}</td>
                    <td>{r.llm_models?.name ?? "–"}</td>
                    <td>
                      <span className={`vote-pill ${r.status === "succeeded" ? "is-up" : "is-down"}`}>{r.status === "succeeded" ? "Succeeded" : "Failed"}</span>
                      {r.generation_id && (
                        <>
                          {" "}
                          <Link href={`/media/${r.generation_id}`} className="small">
                            Drop #{r.generation_id}
                          </Link>
                        </>
                      )}
                    </td>
                    <td className="num">{r.duration_ms === null ? "–" : `${(r.duration_ms / 1000).toFixed(1)}s`}</td>
                    <td className="num nowrap">{res ? `${res.input_tokens ?? "?"} / ${res.output_tokens ?? "?"}` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
