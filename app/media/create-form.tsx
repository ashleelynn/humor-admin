"use client";

import { useActionState } from "react";
import { createDrop, type CreateState } from "./actions";

export function CreateForm({ themes, today }: { themes: string[]; today: string }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createDrop, { error: null });
  return (
    <form action={action} className="panel form-grid">
      <h2>Create a drop</h2>
      <p className="muted small">Upload a photo and Claude writes three captions, just like the booth. No daily limit for admins.</p>
      <label>
        Photo
        <input className="field" type="file" name="photo" accept="image/jpeg,image/png,image/webp" required />
      </label>
      <label>
        Theme
        <input className="field" name="theme" defaultValue={today} maxLength={80} list="themes" />
        <datalist id="themes">
          {themes.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label>
        Context <span className="muted small">(optional)</span>
        <input className="field" name="context" maxLength={120} placeholder="What’s going on in the photo?" />
      </label>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Claude is writing…" : "Create drop"}
      </button>
      {state.error && (
        <p className="notice is-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
