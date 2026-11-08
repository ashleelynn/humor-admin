import Link from "next/link";
import { moodFor } from "@/lib/confessions";
import { THEMES, themeFor } from "@/lib/photo-booth";
import { type AdminGeneration, type AdminUser, type CaptionRow, displayName, formatWhen, photoUrl, requireAdmin } from "@/lib/admin";
import { Shell } from "../shell";
import { CreateForm } from "./create-form";

export const dynamic = "force-dynamic";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const { msg } = await searchParams;

  const [gRes, cRes, uRes] = await Promise.all([
    supabase.rpc("admin_generations"),
    supabase.from("captions").select("id, generation_id, position, created_at, mood, body, score"),
    supabase.rpc("admin_users"),
  ]);
  const generations = (gRes.data ?? []) as AdminGeneration[];
  const captions = (cRes.data ?? []) as CaptionRow[];
  const users = new Map(((uRes.data ?? []) as AdminUser[]).map((u) => [u.id, u]));
  const error = gRes.error ?? cRes.error ?? uRes.error;

  return (
    <Shell email={user.email ?? ""} title="AI generated media" lede={`${generations.length} photo drops and ${captions.length} Claude captions. Open one to edit or delete it.`}>
      {msg && <p className="notice">{msg}</p>}
      {error && <p className="notice is-error">{error.message}</p>}

      <CreateForm themes={THEMES} today={themeFor()} />

      {generations.length === 0 ? (
        <p className="muted">No drops yet.</p>
      ) : (
        <ul className="drops">
          {generations.map((g) => {
            const mine = captions.filter((c) => c.generation_id === g.id).sort((a, b) => a.position - b.position);
            return (
              <li key={g.id}>
                <Link href={`/media/${g.id}`} className="drop-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl(g.image_path)} alt={g.alt_text ?? ""} loading="lazy" />
                  <div className="drop-body">
                    <p className="eyebrow">
                      #{g.id} · {g.theme}
                    </p>
                    <ul className="caption-list">
                      {mine.map((c) => (
                        <li key={c.id}>
                          <span className="score">{c.score > 0 ? `+${c.score}` : c.score}</span>
                          <span>
                            {c.body} <span className="muted small">({moodFor(c.mood).label})</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="muted small">
                      {g.user_id ? displayName(users.get(g.user_id)) : "Deleted user"} · {formatWhen(g.created_at)} · {g.model}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}
