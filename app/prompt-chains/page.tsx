import { requireAdmin } from "@/lib/admin";
import { Shell } from "../shell";
import { updateMix } from "./actions";

export const dynamic = "force-dynamic";

type Chain = { id: number; name: string; description: string | null; is_active: boolean };
type Step = { id: number; chain_id: number; position: number; title: string; template: string };
type Mix = { chain_id: number; weight: number; updated_at: string };

// READ chains and their steps; READ/UPDATE the mix.
export default async function PromptChainsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const { msg, err } = await searchParams;
  const [cRes, sRes, mRes, rRes] = await Promise.all([
    supabase.from("prompt_chains").select("id, name, description, is_active").order("id"),
    supabase.from("prompt_chain_steps").select("id, chain_id, position, title, template").order("position"),
    supabase.from("prompt_chain_mix").select("chain_id, weight, updated_at"),
    supabase.from("generation_requests").select("chain_id"),
  ]);
  const chains = (cRes.data ?? []) as Chain[];
  const steps = (sRes.data ?? []) as Step[];
  const mix = new Map(((mRes.data ?? []) as Mix[]).map((m) => [m.chain_id, m]));
  const used = new Map<number, number>();
  for (const r of (rRes.data ?? []) as { chain_id: number | null }[]) if (r.chain_id) used.set(r.chain_id, (used.get(r.chain_id) ?? 0) + 1);
  const total = chains.filter((c) => c.is_active).reduce((s, c) => s + (mix.get(c.id)?.weight ?? 0), 0);
  const error = err ?? cRes.error?.message ?? sRes.error?.message ?? mRes.error?.message;

  return (
    <Shell
      email={user.email ?? ""}
      title="Prompt chains"
      lede="Each drop picks one active chain at random, weighted by the mix, and joins its steps into the prompt Claude gets."
    >
      {msg && <p className="notice">{msg}</p>}
      {error && <p className="notice is-error">{error}</p>}

      <form action={updateMix} className="panel form-grid">
        <h2>Prompt chain mix</h2>
        <p className="muted small">Weights are relative: 70 and 30 means about 70% and 30% of drops. 0 turns a chain off.</p>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Chain</th>
              <th scope="col">Weight (0–100)</th>
              <th scope="col" className="num">Share of drops</th>
              <th scope="col" className="num">Requests so far</th>
            </tr>
          </thead>
          <tbody>
            {chains.map((c) => {
              const w = mix.get(c.id)?.weight ?? 0;
              return (
                <tr key={c.id}>
                  <th scope="row">
                    {c.name} {!c.is_active && <span className="muted small">(inactive)</span>}
                  </th>
                  <td>
                    <input className="field weight" type="number" name={`weight_${c.id}`} min={0} max={100} defaultValue={w} aria-label={`Weight for ${c.name}`} />
                  </td>
                  <td className="num">{c.is_active && total > 0 ? `${Math.round((w / total) * 100)}%` : "–"}</td>
                  <td className="num">{used.get(c.id) ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="btn small" type="submit">
          Save mix
        </button>
      </form>

      {chains.map((c) => (
        <section key={c.id} className="panel">
          <p className="eyebrow">
            Chain #{c.id} · {c.is_active ? "Active" : "Inactive"}
          </p>
          <h2>{c.name}</h2>
          {c.description && <p className="muted">{c.description}</p>}
          <ol className="steps">
            {steps
              .filter((s) => s.chain_id === c.id)
              .map((s) => (
                <li key={s.id}>
                  <p className="step-title">
                    Step {s.position}: {s.title}
                  </p>
                  <pre className="prompt">{s.template}</pre>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </Shell>
  );
}
