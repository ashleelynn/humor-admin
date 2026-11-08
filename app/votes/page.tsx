import Link from "next/link";
import { type AdminUser, type VoteRow, displayName, formatWhen, requireAdmin } from "@/lib/admin";
import { Shell } from "../shell";

export const dynamic = "force-dynamic";

type VoteWithCaption = VoteRow & { captions: { body: string; generation_id: number; score: number } | null };

// READ only: votes belong to the people who cast them.
export default async function VotesPage() {
  const { supabase, user } = await requireAdmin();
  const [vRes, uRes] = await Promise.all([
    supabase
      .from("caption_votes")
      .select("caption_id, user_id, vote, created_at, captions(body, generation_id, score)")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.rpc("admin_users"),
  ]);
  const votes = (vRes.data ?? []) as unknown as VoteWithCaption[];
  const users = new Map(((uRes.data ?? []) as AdminUser[]).map((u) => [u.id, u]));
  const up = votes.filter((v) => v.vote > 0).length;
  const error = vRes.error ?? uRes.error;

  return (
    <Shell email={user.email ?? ""} title="Votes" lede={`${votes.length} votes: ${up} up, ${votes.length - up} down. Read only, newest first.`}>
      {error && <p className="notice is-error">{error.message}</p>}
      {votes.length === 0 ? (
        <p className="muted">No votes yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Voter</th>
                <th scope="col">Vote</th>
                <th scope="col">Caption</th>
                <th scope="col" className="num">Caption score</th>
              </tr>
            </thead>
            <tbody>
              {votes.map((v) => (
                <tr key={`${v.caption_id}-${v.user_id}`}>
                  <td className="nowrap">{formatWhen(v.created_at)}</td>
                  <td>{displayName(users.get(v.user_id))}</td>
                  <td>
                    <span className={`vote-pill ${v.vote > 0 ? "is-up" : "is-down"}`}>{v.vote > 0 ? "▲ Up" : "▼ Down"}</span>
                  </td>
                  <td>{v.captions ? <Link href={`/media/${v.captions.generation_id}`}>{v.captions.body}</Link> : <span className="muted">Deleted</span>}</td>
                  <td className="num">{v.captions ? (v.captions.score > 0 ? `+${v.captions.score}` : v.captions.score) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
