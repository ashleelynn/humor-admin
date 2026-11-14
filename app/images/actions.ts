"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { MAX_PHOTO_BYTES, PHOTO_BUCKET, PHOTO_TYPES } from "@/lib/photo-booth";

const back = (key: "msg" | "err", text: string): never => redirect(`/images?${key}=${encodeURIComponent(text)}`);
const cleanAlt = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s+/g, " ").trim();

// CREATE: upload a new image to the booth-photos bucket and record it.
export async function uploadImage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const file = formData.get("file");
  const alt = cleanAlt(formData.get("alt_text"));
  if (!(file instanceof File) || file.size === 0) back("err", "Pick an image first.");
  const photo = file as File;
  const extension = PHOTO_TYPES[photo.type];
  if (!extension) back("err", "Images need to be JPG, PNG or WebP.");
  if (photo.size > MAX_PHOTO_BYTES) back("err", "That image is over 5 MB.");
  if (alt.length > 300) back("err", "Keep the alt text under 300 characters.");

  const path = `${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: photo.type });
  if (uploadError) back("err", uploadError.message);

  const { error } = await supabase.from("images").insert({ path, alt_text: alt || null, source: "admin" });
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    back("err", error.message);
  }
  revalidatePath("/images");
  back("msg", "Image uploaded.");
}

// UPDATE an image's alt text.
export async function updateImage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(formData.get("id"));
  const alt = cleanAlt(formData.get("alt_text"));
  if (alt.length > 300) back("err", "Keep the alt text under 300 characters.");
  const { error } = await supabase.from("images").update({ alt_text: alt || null }).eq("id", id);
  if (error) back("err", error.message);
  revalidatePath("/images");
  back("msg", "Alt text saved.");
}

// DELETE an image and its file. Photos that belong to a drop are deleted with the drop instead.
export async function deleteImage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(formData.get("id"));
  const { data: image, error: readError } = await supabase.from("images").select("path").eq("id", id).single();
  if (readError || !image) back("err", readError?.message ?? "Image not found.");

  const { data: uses } = await supabase.rpc("admin_generations");
  const drop = ((uses ?? []) as { id: number; image_path: string }[]).find((g) => g.image_path === image!.path);
  if (drop) back("err", `That photo belongs to drop #${drop.id}. Delete the drop on the Media page instead.`);

  const { error } = await supabase.from("images").delete().eq("id", id);
  if (error) back("err", error.message);
  const { error: fileError } = await supabase.storage.from(PHOTO_BUCKET).remove([image!.path]);
  if (fileError) console.error("Deleting the image file failed", fileError);

  revalidatePath("/images");
  back("msg", "Image deleted.");
}
