import Link from "next/link";
import { notFound } from "next/navigation";
import { type AdminUser, displayName, formatWhen, requireAdmin } from "@/lib/admin";
import { Shell } from "../../shell";

export const dynamic = "force-dynamic";

type Detail = {
  id: number;
  created_at: string;
  user_id: string | null;
  generation_id: number | null;
  theme: string | null;
  context: string | null;
  prompt: string;
  status: string;
  error: string | null;
  duration_ms: number | null;
  prompt_chains: { name: string } | null;
  llm_models: { name: string; api_model_id: string } | null;
  llm_responses: { id: number; model: string | null; stop_reason: string | null; input_tokens: number | null; output_tokens: number | null; raw_text: string | null }[];
};

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [rRes, uRes] = await Promise.all([
    supabase
      .from("generation_requests")
      .select("*, prompt_chains(name), llm_models(name, api_model_id), llm_responses(id, model, stop_reason, input_tokens, output_tokens, raw_text)")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("admin_users"),
  ]);
  const r = rRes.data as unknown as Detail | null;
  if (!r) notFound();
  const who = ((uRes.data ?? []) as AdminUser[]).find((u) => u.id === r.user_id);

  return (
    <Shell email={user.email ?? ""} title={`Request #${r.id}`} lede={<Link href="/requests">← All requests</Link>}>
      <div className="grid-2 drop-detail">
        <section className="panel">
          <h2>Request</h2>
          <dl className="facts">
            <dt>Status</dt>
            <dd>
              <span className={`vote-pill ${r.status === "succeeded" ? "is-up" : "is-down"}`}>{r.status}</span>
            </dd>
            {r.error && (
              <>
                <dt>Error shown</dt>
                <dd>{r.error}</dd>
              </>
            )}
            <dt>When</dt>
            <dd>{formatWhen(r.created_at)}</dd>
            <dt>Who</dt>
            <dd>{r.user_id ? displayName(who) : "Deleted user"}</dd>
            <dt>Chain</dt>
            <dd>{r.prompt_chains?.name ?? "Built-in fallback"}</dd>
            <dt>Model</dt>
            <dd>{r.llm_models ? `${r.llm_models.name} (${r.llm_models.api_model_id})` : "–"}</dd>
            <dt>Theme</dt>
            <dd>{r.theme ?? "–"}</dd>
            <dt>Context</dt>
            <dd>{r.context ?? <span className="muted">None</span>}</dd>
            <dt>Time</dt>
            <dd>{r.duration_ms === null ? "–" : `${(r.duration_ms / 1000).toFixed(1)}s`}</dd>
            <dt>Drop</dt>
            <dd>{r.generation_id ? <Link href={`/media/${r.generation_id}`}>#{r.generation_id}</Link> : "None saved"}</dd>
          </dl>
          <details>
            <summary>Prompt sent</summary>
            <pre className="prompt">{r.prompt}</pre>
          </details>
        </section>

        <section className="panel">
          <h2>LLM response</h2>
          {r.llm_responses.length === 0 ? (
            <p className="muted">Claude didn’t answer this request (a timeout or connection error).</p>
          ) : (
            r.llm_responses.map((res) => (
              <div key={res.id} className="stack">
                <dl className="facts">
                  <dt>Model that answered</dt>
                  <dd>{res.model ?? "–"}</dd>
                  <dt>Stop reason</dt>
                  <dd>{res.stop_reason ?? "–"}</dd>
                  <dt>Tokens</dt>
                  <dd>
                    {res.input_tokens ?? "?"} in, {res.output_tokens ?? "?"} out
                  </dd>
                </dl>
                <pre className="prompt">{prettyJson(res.raw_text)}</pre>
              </div>
            ))
          )}
        </section>
      </div>
    </Shell>
  );
}

function prettyJson(text: string | null) {
  if (!text) return "(empty)";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
