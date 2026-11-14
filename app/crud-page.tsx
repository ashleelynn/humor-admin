import { formatWhen, requireAdmin } from "@/lib/admin";
import { type Field, MOOD_OPTIONS, RESOURCES } from "@/lib/resources";
import { deleteRow, saveRow } from "./crud-actions";
import { ConfirmButton } from "./media/[id]/confirm-button";
import { Shell } from "./shell";

type Row = Record<string, unknown> & { id: number; created_at?: string };
type Option = { value: string; label: string };

// One page for every simple table: list, add, edit and delete.
export async function CrudPage({ slug, searchParams }: { slug: string; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const resource = RESOURCES[slug];
  const { msg, err } = await searchParams;

  const needs = new Set(resource.fields.map((f) => f.options).filter(Boolean));
  const [rowsRes, chainsRes, providersRes] = await Promise.all([
    supabase.from(resource.table).select("*").order(resource.order.column, { ascending: resource.order.ascending }),
    needs.has("chains") ? supabase.from("prompt_chains").select("id, name").order("id") : Promise.resolve({ data: [] }),
    needs.has("providers") ? supabase.from("llm_providers").select("id, name").order("name") : Promise.resolve({ data: [] }),
  ]);
  const rows = (rowsRes.data ?? []) as Row[];
  const options: Record<string, Option[]> = {
    moods: MOOD_OPTIONS,
    chains: ((chainsRes.data ?? []) as { id: number; name: string }[]).map((c) => ({ value: String(c.id), label: c.name })),
    providers: ((providersRes.data ?? []) as { id: number; name: string }[]).map((p) => ({ value: String(p.id), label: p.name })),
  };

  const display = (f: Field, value: unknown) => {
    if (f.type === "checkbox") return value ? "Yes" : "No";
    if (value === null || value === undefined || value === "") return f.emptyLabel ?? "–";
    if (f.options) return options[f.options].find((o) => o.value === String(value))?.label ?? String(value);
    return String(value);
  };
  const shown = resource.fields.filter((f) => f.name !== resource.headline);
  const headline = resource.fields.find((f) => f.name === resource.headline)!;
  const a = /^[aeiou]/i.test(resource.singular) ? "an" : "a";

  return (
    <Shell email={user.email ?? ""} title={resource.title} lede={resource.lede}>
      {msg && <p className="notice">{msg}</p>}
      {(err || rowsRes.error) && <p className="notice is-error">{err ?? rowsRes.error?.message}</p>}

      <details className="panel add-panel" open={rows.length === 0}>
        <summary>
          Add {a} {resource.singular}
        </summary>
        <RowForm slug={slug} fields={resource.fields} options={options} submit={`Add ${resource.singular}`} />
      </details>

      <p className="muted small count-line">
        {rows.length} {rows.length === 1 ? resource.singular : `${resource.singular}s`}
      </p>
      <ul className="crud-list">
        {rows.map((row) => (
          <li key={row.id} className="crud-row">
            <div className="crud-summary">
              <p className="crud-headline">{display(headline, row[headline.name])}</p>
              <dl className="crud-facts">
                {shown.map((f) => (
                  <div key={f.name}>
                    <dt>{f.label}</dt>
                    <dd>{display(f, row[f.name])}</dd>
                  </div>
                ))}
                {row.created_at && (
                  <div>
                    <dt>Added</dt>
                    <dd>{formatWhen(row.created_at)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <details className="crud-edit">
              <summary>Edit</summary>
              <RowForm slug={slug} fields={resource.fields} options={options} row={row} submit="Save" />
              <form action={deleteRow} className="inline-delete">
                <input type="hidden" name="_resource" value={slug} />
                <input type="hidden" name="_id" value={row.id} />
                <ConfirmButton message={`Delete this ${resource.singular}?`}>Delete {resource.singular}</ConfirmButton>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function RowForm({ slug, fields, options, row, submit }: { slug: string; fields: Field[]; options: Record<string, Option[]>; row?: Row; submit: string }) {
  return (
    <form action={saveRow} className="form-grid">
      <input type="hidden" name="_resource" value={slug} />
      {row && <input type="hidden" name="_id" value={row.id} />}
      {fields.map((f) => {
        const value = row ? row[f.name] : f.defaultValue;
        if (f.type === "checkbox") {
          return (
            <label key={f.name} className="check">
              <input type="checkbox" name={f.name} defaultChecked={Boolean(value)} /> {f.label}
            </label>
          );
        }
        return (
          <label key={f.name}>
            {f.label}
            {f.type === "textarea" ? (
              <textarea className="field" name={f.name} defaultValue={value == null ? "" : String(value)} maxLength={f.max} required={f.required} rows={3} />
            ) : f.type === "select" ? (
              <select className="field" name={f.name} defaultValue={value == null ? "" : String(value)} required={f.required}>
                {!f.required && <option value="">{f.emptyLabel ?? "None"}</option>}
                {f.required && !row && <option value="">Choose…</option>}
                {options[f.options!].map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="field"
                name={f.name}
                type={f.type === "number" ? "number" : "text"}
                defaultValue={value == null ? "" : String(value)}
                maxLength={f.type === "number" ? undefined : f.max}
                min={f.min}
                max={f.type === "number" ? f.max : undefined}
                required={f.required}
                placeholder={f.placeholder}
              />
            )}
            {f.help && <span className="muted small">{f.help}</span>}
          </label>
        );
      })}
      <button className="btn small" type="submit">
        {submit}
      </button>
    </form>
  );
}
