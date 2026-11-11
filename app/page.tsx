import Link from "next/link";
import { MOODS, moodFor } from "@/lib/confessions";
import {
  type AdminGeneration,
  type AdminUser,
  type CaptionRow,
  type VoteRow,
  displayName,
  count,
  hourLabel,
  nycDay,
  nycHour,
  requireAdmin,
} from "@/lib/admin";
import { Shell } from "./shell";

export const dynamic = "force-dynamic";

type ConfessionRow = { id: number; created_at: string; body: string; mood: string; same_count: number };

export default async function Overview() {
  const { supabase, user } = await requireAdmin();

  const [confessionsRes, generationsRes, captionsRes, votesRes, usersRes] = await Promise.all([
    supabase.from("confessions").select("id, created_at, body, mood, same_count"),
    supabase.rpc("admin_generations"),
    supabase.from("captions").select("id, generation_id, position, created_at, mood, body, score"),
    supabase.from("caption_votes").select("caption_id, user_id, vote, created_at"),
    supabase.rpc("admin_users"),
  ]);
  const error = [confessionsRes, generationsRes, captionsRes, votesRes, usersRes].find((r) => r.error)?.error;

  const confessions = (confessionsRes.data ?? []) as ConfessionRow[];
  const generations = (generationsRes.data ?? []) as AdminGeneration[];
  const captions = (captionsRes.data ?? []) as CaptionRow[];
  const votes = (votesRes.data ?? []) as VoteRow[];
  const users = (usersRes.data ?? []) as AdminUser[];

  // ---- headline numbers
  const upvotes = votes.filter((v) => v.vote > 0).length;
  const upShare = votes.length ? Math.round((upvotes / votes.length) * 100) : null;
  const totalSames = confessions.reduce((s, c) => s + c.same_count, 0);
  const activeUsers = users.filter((u) => u.confessions + u.drops + u.votes > 0).length;

  // ---- when is the booth busy? every confession, drop and vote, by New York hour
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const row of [...confessions, ...generations, ...votes]) byHour[nycHour(row.created_at)]++;
  const peakHour = byHour.some((n) => n > 0) ? byHour.indexOf(Math.max(...byHour)) : null;
  const lateNight = [22, 23, 0, 1, 2, 3].reduce((s, h) => s + byHour[h], 0);
  const allActivity = byHour.reduce((s, n) => s + n, 0);

  // ---- last 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000);
    return { key: nycDay(d), label: new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(d), n: 0 };
  });
  const dayIndex = new Map(days.map((d, i) => [d.key, i]));
  for (const row of [...confessions, ...generations, ...votes]) {
    const i = dayIndex.get(nycDay(row.created_at));
    if (i !== undefined) days[i].n++;
  }

  // ---- mood ring: what people confess vs what Claude writes vs what the crowd rewards
  const moodStats = MOODS.map((m) => {
    const mine = captions.filter((c) => c.mood === m.id);
    return {
      ...m,
      confessions: confessions.filter((c) => c.mood === m.id).length,
      captions: mine.length,
      avgScore: mine.length ? mine.reduce((s, c) => s + c.score, 0) / mine.length : null,
    };
  });
  const claudeFavorite = [...moodStats].sort((a, b) => b.captions - a.captions)[0];
  const crowdFavorite = [...moodStats].filter((m) => m.avgScore !== null).sort((a, b) => b.avgScore! - a.avgScore!)[0];

  // ---- captions: best, worst, most argued about
  const voteCount = new Map<number, number>();
  for (const v of votes) voteCount.set(v.caption_id, (voteCount.get(v.caption_id) ?? 0) + 1);
  const voted = captions.filter((c) => voteCount.has(c.id));
  const best = [...voted].sort((a, b) => b.score - a.score)[0];
  const worst = [...voted].sort((a, b) => a.score - b.score)[0];
  // Most votes with the closest split: lots of people, no agreement.
  const controversial = [...voted]
    .map((c) => ({ c, n: voteCount.get(c.id)!, split: voteCount.get(c.id)! - Math.abs(c.score) }))
    .filter((x) => x.split > 0)
    .sort((a, b) => b.split - a.split || b.n - a.n)[0];
  const mostSamed = [...confessions].sort((a, b) => b.same_count - a.same_count)[0];

  // ---- themes
  const themeRows = Object.values(
    generations.reduce<Record<string, { theme: string; drops: number; score: number }>>((acc, g) => {
      acc[g.theme] ??= { theme: g.theme, drops: 0, score: 0 };
      acc[g.theme].drops++;
      acc[g.theme].score += captions.filter((c) => c.generation_id === g.id).reduce((s, c) => s + c.score, 0);
      return acc;
    }, {}),
  ).sort((a, b) => b.drops - a.drops);

  // ---- regulars
  const regulars = [...users]
    .map((u) => ({ u, total: u.confessions + u.drops + u.votes }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxHour = Math.max(1, ...byHour);
  const maxDay = Math.max(1, ...days.map((d) => d.n));
  const maxMood = Math.max(1, ...moodStats.map((m) => m.confessions));
  const maxTheme = Math.max(1, ...themeRows.map((t) => t.drops));

  return (
    <Shell email={user.email ?? ""} title="Overview" lede="Everything happening in the booth, live from the database. Times are New York time.">
      {error && <p className="notice is-error">Some data didn’t load: {error.message}</p>}

      <section className="tiles" aria-label="Totals">
        <Tile label="People signed up" value={users.length} note={`${activeUsers} ${activeUsers === 1 ? "has" : "have"} posted, dropped or voted`} />
        <Tile label="Confessions" value={confessions.length} note={`${count(totalSames, "“same”")} given`} />
        <Tile label="Photo drops" value={generations.length} note={`${count(captions.length, "AI caption")} written`} />
        <Tile label="Caption votes" value={votes.length} note={upShare === null ? "No votes yet" : `${upShare}% upvotes`} />
      </section>

      <section className="grid-2">
        <article className="panel">
          <h2>When the booth is busiest</h2>
          <p className="muted small">
            Confessions, drops and votes by hour.{" "}
            {peakHour !== null && (
              <>
                Peak: <strong>{hourLabel(peakHour)}</strong>.{" "}
                {allActivity > 0 && <>{Math.round((lateNight / allActivity) * 100)}% happens between 10pm and 4am.</>}
              </>
            )}
          </p>
          <div className="bars" role="img" aria-label={`Activity by hour; peak at ${peakHour === null ? "none" : hourLabel(peakHour)}`}>
            {byHour.map((n, h) => (
              <div key={h} className="bar-col" title={`${hourLabel(h)}: ${n}`}>
                <div className={`bar${h === peakHour ? " is-peak" : ""}`} style={{ height: `${(n / maxHour) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="bar-axis">
            <span>12am</span>
            <span>6am</span>
            <span>12pm</span>
            <span>6pm</span>
            <span>11pm</span>
          </div>
        </article>

        <article className="panel">
          <h2>Last 14 days</h2>
          <p className="muted small">Confessions, drops and votes per day.</p>
          <div className="bars" role="img" aria-label="Activity per day for the last 14 days">
            {days.map((d, i) => (
              <div key={d.key} className="bar-col" title={`${d.label}: ${d.n}`}>
                <div className={`bar${i === days.length - 1 ? " is-peak" : ""}`} style={{ height: `${(d.n / maxDay) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="bar-axis">
            <span>{days[0].label}</span>
            <span>Today</span>
          </div>
        </article>
      </section>

      <section className="panel">
        <h2>Mood ring</h2>
        <p className="muted small">
          What people confess, what Claude writes, and what the crowd rewards.
          {claudeFavorite?.captions > 0 && (
            <>
              {" "}
              Claude’s go-to mood is <strong>{claudeFavorite.label}</strong>
              {crowdFavorite && (
                <>
                  ; voters like <strong>{crowdFavorite.label}</strong> best
                  {crowdFavorite.id === claudeFavorite.id ? ", so they agree." : "."}
                </>
              )}
            </>
          )}
        </p>
        <table className="table mood-table">
          <thead>
            <tr>
              <th scope="col">Mood</th>
              <th scope="col">Confessions</th>
              <th scope="col" className="num">
                Claude captions
              </th>
              <th scope="col" className="num">
                Avg caption score
              </th>
            </tr>
          </thead>
          <tbody>
            {moodStats.map((m) => (
              <tr key={m.id}>
                <th scope="row">
                  <span className="face">{m.face}</span> {m.label}
                </th>
                <td>
                  <div className="hbar">
                    <span style={{ width: `${(m.confessions / maxMood) * 100}%` }} />
                    <b>{m.confessions}</b>
                  </div>
                </td>
                <td className="num">{m.captions}</td>
                <td className="num">{m.avgScore === null ? "–" : signed(Math.round(m.avgScore * 10) / 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid-3">
        <Quote label="Hall of fame" hint="Highest-scoring caption" caption={best} drops={generations} />
        <Quote label="Hall of shame" hint="Lowest-scoring caption" caption={worst && worst.id !== best?.id ? worst : undefined} drops={generations} />
        <Quote
          label="Most argued about"
          hint={controversial ? `${controversial.n} votes, split almost evenly` : "Most votes with the closest split"}
          caption={controversial?.c}
          drops={generations}
        />
      </section>

      <section className="grid-2">
        <article className="panel">
          <h2>Most relatable confession</h2>
          {mostSamed && mostSamed.same_count > 0 ? (
            <figure className="quote">
              <blockquote>“{mostSamed.body}”</blockquote>
              <figcaption className="muted small">
                {mostSamed.same_count} people said “same” · {moodFor(mostSamed.mood).label}
              </figcaption>
            </figure>
          ) : (
            <p className="muted">Nobody has said “same” yet.</p>
          )}
        </article>

        <article className="panel">
          <h2>Daily themes</h2>
          <p className="muted small">Drops per theme, and the total score of their captions.</p>
          {themeRows.length === 0 ? (
            <p className="muted">No drops yet.</p>
          ) : (
            <ul className="rank">
              {themeRows.map((t) => (
                <li key={t.theme}>
                  <span className="rank-label">{t.theme}</span>
                  <div className="hbar">
                    <span style={{ width: `${(t.drops / maxTheme) * 100}%` }} />
                    <b>{t.drops}</b>
                  </div>
                  <span className="num muted small">{signed(t.score)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Regulars</h2>
        <p className="muted small">The most active people, by confessions + drops + votes.</p>
        {regulars.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col" className="num">Confessions</th>
                <th scope="col" className="num">Drops</th>
                <th scope="col" className="num">Votes</th>
              </tr>
            </thead>
            <tbody>
              {regulars.map(({ u }) => (
                <tr key={u.id}>
                  <th scope="row">
                    <Link href="/users">{displayName(u)}</Link>
                  </th>
                  <td className="num">{u.confessions}</td>
                  <td className="num">{u.drops}</td>
                  <td className="num">{u.votes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Shell>
  );
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

function Tile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="tile">
      <p className="tile-label">{label}</p>
      <p className="tile-value">{value.toLocaleString()}</p>
      <p className="muted small">{note}</p>
    </div>
  );
}

function Quote({ label, hint, caption, drops }: { label: string; hint: string; caption?: CaptionRow; drops: AdminGeneration[] }) {
  const drop = caption && drops.find((g) => g.id === caption.generation_id);
  return (
    <article className="panel">
      <p className="eyebrow">{label}</p>
      {caption ? (
        <figure className="quote">
          <blockquote>“{caption.body}”</blockquote>
          <figcaption className="muted small">
            Score {signed(caption.score)} · {moodFor(caption.mood).label}
            {drop && (
              <>
                {" · "}
                <Link href={`/media/${drop.id}`}>{drop.theme}</Link>
              </>
            )}
          </figcaption>
        </figure>
      ) : (
        <p className="muted">Not enough votes yet.</p>
      )}
      <p className="muted small">{hint}</p>
    </article>
  );
}
