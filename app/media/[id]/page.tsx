import Link from "next/link";
import { notFound } from "next/navigation";
import { MOODS } from "@/lib/confessions";
import { CAPTIONS_PER_DROP } from "@/lib/photo-booth";
import { type AdminGeneration, type AdminUser, type CaptionRow, displayName, formatWhen, photoUrl, requireAdmin } from "@/lib/admin";
import { Shell } from "../../shell";
import { addCaption, deleteCaption, deleteDrop, updateCaption, updateDrop } from "../actions";
import { ConfirmButton } from "./confirm-button";

export const dynamic = "force-dynamic";

export default async function DropPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const { id } = await params;
  const { msg } = await searchParams;
  const dropId = Number(id);
  if (!Number.isInteger(dropId)) notFound();

  const [gRes, cRes, uRes] = await Promise.all([
    supabase.rpc("admin_generations"),
    supabase.from("captions").select("id, generation_id, position, created_at, mood, body, score").eq("generation_id", dropId).order("position"),
    supabase.rpc("admin_users"),
  ]);
  const drop = ((gRes.data ?? []) as AdminGeneration[]).find((g) => g.id === dropId);
  if (!drop) notFound();
  const captions = (cRes.data ?? []) as CaptionRow[];
  const owner = ((uRes.data ?? []) as AdminUser[]).find((u) => u.id === drop.user_id);
  const used = new Set(captions.map((c) => c.position));
  const freeSlot = Array.from({ length: CAPTIONS_PER_DROP }, (_, i) => i + 1).find((p) => !used.has(p));

  return (
    <Shell email={user.email ?? ""} title={`Drop #${drop.id}`} lede={<Link href="/media">← All media</Link>}>
      {msg && <p className="notice">{msg}</p>}

      <div className="grid-2 drop-detail">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="drop-photo" src={photoUrl(drop.image_path)} alt={drop.alt_text ?? ""} />
          <dl className="facts">
            <dt>Dropped by</dt>
            <dd>{drop.user_id ? `${displayName(owner)}${owner?.email ? ` (${owner.email})` : ""}` : "Deleted user"}</dd>
            <dt>When</dt>
            <dd>{formatWhen(drop.created_at)}</dd>
            <dt>Model</dt>
            <dd>{drop.model}</dd>
            <dt>Their context</dt>
            <dd>{drop.context ?? <span className="muted">None</span>}</dd>
          </dl>
        </div>

        <div className="stack">
          <form action={updateDrop} className="panel form-grid">
            <h2>Details</h2>
            <input type="hidden" name="id" value={drop.id} />
            <label>
              Theme
              <input className="field" name="theme" defaultValue={drop.theme} maxLength={80} required />
            </label>
            <label>
              Alt text
              <textarea className="field" name="alt_text" defaultValue={drop.alt_text ?? ""} maxLength={300} rows={3} />
            </label>
            <button className="btn small" type="submit">
              Save details
            </button>
          </form>

          <section className="panel">
            <h2>Captions</h2>
            {captions.map((c) => (
              <div key={c.id} className="caption-edit">
                <form action={updateCaption} className="form-grid">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="generation_id" value={drop.id} />
                  <div className="row">
                    <span className="eyebrow">
                      #{c.position} · score {c.score > 0 ? `+${c.score}` : c.score}
                    </span>
                    <MoodSelect value={c.mood} />
                  </div>
                  <textarea className="field" name="body" defaultValue={c.body} maxLength={280} rows={2} required aria-label={`Caption ${c.position}`} />
                  <div className="row">
                    <button className="btn small" type="submit">
                      Save
                    </button>
                  </div>
                </form>
                <form action={deleteCaption} className="inline-delete">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="generation_id" value={drop.id} />
                  <ConfirmButton message="Delete this caption and its votes?">Delete caption</ConfirmButton>
                </form>
              </div>
            ))}

            {freeSlot && (
              <form action={addCaption} className="form-grid caption-edit">
                <input type="hidden" name="generation_id" value={drop.id} />
                <input type="hidden" name="position" value={freeSlot} />
                <div className="row">
                  <span className="eyebrow">Add caption #{freeSlot}</span>
                  <MoodSelect value="unhinged" />
                </div>
                <textarea className="field" name="body" maxLength={280} rows={2} required aria-label="New caption" />
                <div className="row">
                  <button className="btn small" type="submit">
                    Add caption
                  </button>
                </div>
              </form>
            )}
          </section>

          <details className="panel">
            <summary>The prompt Claude got</summary>
            <pre className="prompt">{drop.prompt}</pre>
          </details>

          <form action={deleteDrop} className="panel danger">
            <input type="hidden" name="id" value={drop.id} />
            <h2>Delete this drop</h2>
            <p className="muted small">Removes the photo, its captions and every vote on them. This can’t be undone.</p>
            <ConfirmButton message={`Delete drop #${drop.id} for good?`}>Delete drop</ConfirmButton>
          </form>
        </div>
      </div>
    </Shell>
  );
}

function MoodSelect({ value }: { value: string }) {
  return (
    <select className="field select" name="mood" defaultValue={value} aria-label="Mood">
      {MOODS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
