# Booth Admin

The back office for [The Confession Booth](https://github.com/ashleelynn/Humor-Project-week1). It shares that app's Supabase database.

| Page | What it does |
| --- | --- |
| **Overview** (`/`) | Live statistics: totals, the busiest hour (and how much happens after 10pm), the last 14 days, a mood ring comparing what people confess with what Claude writes and what voters reward, the hall of fame/shame, the most argued-about caption, the most relatable confession, daily themes and the regulars. |
| **Media** (`/media`) | **Create** a drop (upload a photo and Claude writes three captions), **read** every drop with its prompt, model and uploader, **update** the theme, alt text and captions, and **delete** captions or whole drops. |
| **Users** (`/users`) | **Read** every account: name, email, sign-in method, when they joined and last signed in, and how active they are. |
| **Votes** (`/votes`) | **Read** every upvote and downvote: who, when, and on which caption. |

## Who can get in

Every route except `/login` and `/auth/callback` requires a Google sign-in **and** `profiles.is_superadmin = true`. That is checked in three places:

1. `middleware.ts` runs on every request and sends strangers to `/login` and non-admins to `/denied`.
2. Every page and server action calls `requireAdmin()` again before touching data.
3. The database itself only lets superadmins through. The admin queries are Postgres functions and row level security policies that check `is_superadmin()`, so a normal user's session gets nothing extra even if they call the API directly. The app never uses a service-role key.

### "Won't I be locked out?"

No. `is_superadmin` defaults to false, and users can only update their own name and avatar, so nobody can promote themselves through the API, including the admin app. But the owner of the Supabase project can run SQL in the dashboard's SQL Editor, where queries run as the database owner and row level security doesn't apply. That is how the first superadmin is made:

```sql
update public.profiles set is_superadmin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Sign in with Google once first (on either app), so the account and its profile row exist.

## Setup

1. In the Supabase SQL Editor, run `supabase/admin.sql`, then the `update` above with your email.
2. In Supabase → Authentication → URL Configuration, add these to **Redirect URLs**: `http://localhost:3001/auth/callback` and `https://<your-vercel-domain>/auth/callback`.
3. Copy `.env.example` to `.env.local` and fill it in with the same values as the main app.
4. `npm install`, then `npm run dev` and open http://localhost:3001.

On Vercel, set the same three environment variables and turn off Deployment Protection.
