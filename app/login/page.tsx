import { signInWithGoogle } from "../actions";

export const metadata = { title: "Sign in · Booth Admin" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="gate">
      <div className="gate-card">
        <p className="eyebrow">The Confession Booth</p>
        <h1>Back office</h1>
        <p className="muted">Superadmins only. Sign in with the Google account that has admin access.</p>
        <form action={signInWithGoogle}>
          <button className="btn block" type="submit">
            Continue with Google
          </button>
        </form>
        {error && (
          <p className="notice is-error" role="alert">
            Google sign-in didn’t go through. Try again.
          </p>
        )}
      </div>
    </main>
  );
}
