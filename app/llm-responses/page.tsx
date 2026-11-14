import Link from "next/link";
import { count, formatWhen, requireAdmin } from "@/lib/admin";
import { Shell } from "../shell";

export const dynamic = "force-dynamic";

type Response = {
  id: number;
  request_id: number;
  created_at: string;
  model: string | null;
  stop_reason: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  raw_text: string | null;
};

// READ LLM responses: exactly what Claude sent back for each request.
export default async function ResponsesPage() {
  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("llm_responses")
    .select("id, request_id, created_at, model, stop_reason, input_tokens, output_tokens, raw_text")
    .order("created_at", { ascending: false })
    .limit(300);
  const responses = (data ?? []) as Response[];
  const tokensOut = responses.reduce((s, r) => s + (r.output_tokens ?? 0), 0);

  return (
    <Shell email={user.email ?? ""} title="LLM responses" lede={`${count(responses.length, "response")}, ${tokensOut.toLocaleString()} output tokens in all. Read only.`}>
      {error && <p className="notice is-error">{error.message}</p>}
      {responses.length === 0 ? (
        <p className="muted">No responses yet. They’re logged from the next photo drop on.</p>
      ) : (
        <ul className="crud-list">
          {responses.map((r) => (
            <li key={r.id} className="crud-row">
              <div className="crud-summary">
                <p className="eyebrow">
                  Response #{r.id} · <Link href={`/requests/${r.request_id}`}>Request #{r.request_id}</Link> · {formatWhen(r.created_at)}
                </p>
                <dl className="crud-facts">
                  <div>
                    <dt>Model</dt>
                    <dd>{r.model ?? "–"}</dd>
                  </div>
                  <div>
                    <dt>Stop reason</dt>
                    <dd>{r.stop_reason ?? "–"}</dd>
                  </div>
                  <div>
                    <dt>Tokens in / out</dt>
                    <dd>
                      {r.input_tokens ?? "?"} / {r.output_tokens ?? "?"}
                    </dd>
                  </div>
                </dl>
              </div>
              <details className="crud-edit">
                <summary>Raw text</summary>
                <pre className="prompt">{r.raw_text || "(empty)"}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
