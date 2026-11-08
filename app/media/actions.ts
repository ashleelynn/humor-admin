"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { BoothAIError, writeCaptions } from "@/lib/claude";
import { isMood, MAX_LENGTH } from "@/lib/confessions";
import { MAX_CONTEXT, MAX_PHOTO_BYTES, PHOTO_BUCKET, PHOTO_TYPES, captionPrompt, themeFor } from "@/lib/photo-booth";

export type CreateState = { error: string | null };

const clean = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s+/g, " ").trim();
const back = (id: number, msg: string) => redirect(`/media/${id}?msg=${encodeURIComponent(msg)}`);

// CREATE: the same flow as the booth, minus the five-a-day limit (the database allows that for superadmins only).
export async function createDrop(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const { supabase } = await requireAdmin();

  const photo = formData.get("photo");
  const context = clean(formData.get("context"));
  const theme = clean(formData.get("theme")) || themeFor();

  if (!(photo instanceof File) || photo.size === 0) return { error: "Pick a photo first." };
  const extension = PHOTO_TYPES[photo.type];
  if (!extension) return { error: "Photos need to be JPG, PNG or WebP." };
  if (photo.size > MAX_PHOTO_BYTES) return { error: "That photo is over 5 MB." };
  if (context.length > MAX_CONTEXT) return { error: `Keep the context under ${MAX_CONTEXT} characters.` };
  if (theme.length > 80) return { error: "Keep the theme under 80 characters." };

  const prompt = captionPrompt({ theme, context });
  let result: Awaited<ReturnType<typeof writeCaptions>>;
  try {
    result = await writeCaptions({ image: await photo.arrayBuffer(), mimeType: photo.type, prompt });
  } catch (e) {
    if (e instanceof BoothAIError) return { error: e.message };
    console.error("Writing captions failed", e);
    return { error: "Claude tripped. Try again." };
  }

  const imagePath = `${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(imagePath, photo, { contentType: photo.type });
  if (uploadError) return { error: uploadError.message };

  const { data: generation, error } = await supabase
    .from("generations")
    .insert({ image_path: imagePath, theme, alt_text: result.altText, context: context || null, model: result.model, prompt })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: captionsError } = await supabase
    .from("captions")
    .insert(result.captions.map((c, i) => ({ generation_id: generation.id, position: i + 1, mood: c.mood, body: c.body })));
  if (captionsError) return { error: captionsError.message };

  revalidatePath("/media");
  redirect(`/media/${generation.id}?msg=${encodeURIComponent("Drop created.")}`);
}

// UPDATE the drop's theme and alt text.
export async function updateDrop(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(formData.get("id"));
  const theme = clean(formData.get("theme"));
  const altText = clean(formData.get("alt_text"));
  if (!theme || theme.length > 80) back(id, "The theme needs 1–80 characters.");
  if (altText.length > 300) back(id, "Keep the alt text under 300 characters.");

  const { error } = await supabase.from("generations").update({ theme, alt_text: altText || null }).eq("id", id);
  revalidatePath("/media");
  back(id, error ? error.message : "Drop saved.");
}

// UPDATE one caption's text and mood.
export async function updateCaption(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(formData.get("id"));
  const dropId = Number(formData.get("generation_id"));
  const mood = String(formData.get("mood"));
  const body = clean(formData.get("body"));
  if (!isMood(mood)) back(dropId, "Pick a mood.");
  if (!body || body.length > MAX_LENGTH) back(dropId, `Captions need 1–${MAX_LENGTH} characters.`);

  const { error } = await supabase.from("captions").update({ mood, body }).eq("id", id);
  revalidatePath("/media");
  back(dropId, error ? error.message : "Caption saved.");
}

// CREATE a caption by hand in an empty slot (a drop holds three).
export async function addCaption(formData: FormData) {
  const { supabase } = await requireAdmin();
  const dropId = Number(formData.get("generation_id"));
  const position = Number(formData.get("position"));
  const mood = String(formData.get("mood"));
  const body = clean(formData.get("body"));
  if (!isMood(mood)) back(dropId, "Pick a mood.");
  if (!body || body.length > MAX_LENGTH) back(dropId, `Captions need 1–${MAX_LENGTH} characters.`);

  const { error } = await supabase.from("captions").insert({ generation_id: dropId, position, mood, body });
  revalidatePath("/media");
  back(dropId, error ? error.message : "Caption added.");
}

// DELETE one caption (its votes go with it).
export async function deleteCaption(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(formData.get("id"));
  const dropId = Number(formData.get("generation_id"));
  const { error } = await supabase.from("captions").delete().eq("id", id);
  revalidatePath("/media");
  back(dropId, error ? error.message : "Caption deleted.");
}

// DELETE the whole drop: the photo file, the row, and (by cascade) its captions and votes.
export async function deleteDrop(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(formData.get("id"));
  const { data: drop, error: readError } = await supabase.from("generations").select("image_path").eq("id", id).single();
  if (readError) back(id, readError.message);

  const { error } = await supabase.from("generations").delete().eq("id", id);
  if (error) back(id, error.message);

  const { error: fileError } = await supabase.storage.from(PHOTO_BUCKET).remove([drop!.image_path]);
  if (fileError) console.error("Deleting the photo file failed", fileError);

  revalidatePath("/media");
  redirect(`/media?msg=${encodeURIComponent(`Drop #${id} deleted.`)}`);
}
