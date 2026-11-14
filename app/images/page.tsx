import Link from "next/link";
import { type AdminGeneration, type AdminUser, count, displayName, formatWhen, photoUrl, requireAdmin } from "@/lib/admin";
import { ConfirmButton } from "../media/[id]/confirm-button";
import { Shell } from "../shell";
import { deleteImage, updateImage, uploadImage } from "./actions";

export const dynamic = "force-dynamic";

type ImageRow = { id: number; created_at: string; path: string; alt_text: string | null; uploaded_by: string | null; source: string };

// CREATE/READ/UPDATE/DELETE images, including uploading new ones.
export default async function ImagesPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const { msg, err } = await searchParams;
  const [iRes, gRes, uRes] = await Promise.all([
    supabase.from("images").select("id, created_at, path, alt_text, uploaded_by, source").order("created_at", { ascending: false }),
    supabase.rpc("admin_generations"),
    supabase.rpc("admin_users"),
  ]);
  const images = (iRes.data ?? []) as ImageRow[];
  const dropFor = new Map(((gRes.data ?? []) as AdminGeneration[]).map((g) => [g.image_path, g.id]));
  const users = new Map(((uRes.data ?? []) as AdminUser[]).map((u) => [u.id, u]));

  return (
    <Shell email={user.email ?? ""} title="Images" lede={`${count(images.length, "image")} in the booth-photos bucket. Booth drops are added automatically.`}>
      {msg && <p className="notice">{msg}</p>}
      {(err || iRes.error) && <p className="notice is-error">{err ?? iRes.error?.message}</p>}

      <form action={uploadImage} className="panel form-grid">
        <h2>Upload an image</h2>
        <label>
          Image <span className="muted small">(JPG, PNG or WebP, up to 5 MB)</span>
          <input className="field" type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
        </label>
        <label>
          Alt text
          <input className="field" name="alt_text" maxLength={300} placeholder="One plain sentence describing the image" />
        </label>
        <button className="btn small" type="submit">
          Upload
        </button>
      </form>

      <ul className="image-grid">
        {images.map((img) => {
          const dropId = dropFor.get(img.path);
          return (
            <li key={img.id} className="panel image-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(img.path)} alt={img.alt_text ?? ""} loading="lazy" />
              <p className="muted small">
                #{img.id} · {img.source === "booth" ? "Booth drop" : "Admin upload"} · {img.uploaded_by ? displayName(users.get(img.uploaded_by)) : "Unknown"} ·{" "}
                {formatWhen(img.created_at)}
                {dropId && (
                  <>
                    {" · "}
                    <Link href={`/media/${dropId}`}>Drop #{dropId}</Link>
                  </>
                )}
              </p>
              <form action={updateImage} className="form-grid">
                <input type="hidden" name="id" value={img.id} />
                <label>
                  Alt text
                  <textarea className="field" name="alt_text" defaultValue={img.alt_text ?? ""} maxLength={300} rows={2} />
                </label>
                <button className="btn small" type="submit">
                  Save
                </button>
              </form>
              {!dropId && (
                <form action={deleteImage} className="inline-delete">
                  <input type="hidden" name="id" value={img.id} />
                  <ConfirmButton message="Delete this image for good?">Delete image</ConfirmButton>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
