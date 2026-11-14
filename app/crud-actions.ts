"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { type Field, RESOURCES } from "@/lib/resources";

const back = (slug: string, key: "msg" | "err", text: string): never => redirect(`/${slug}?${key}=${encodeURIComponent(text)}`);

function resourceFrom(formData: FormData) {
  const resource = RESOURCES[String(formData.get("_resource"))];
  if (!resource) throw new Error("Unknown resource");
  return resource;
}

// Turns form input into column values using the resource's field list (and nothing else).
function parse(fields: Field[], formData: FormData, slug: string) {
  const values: Record<string, string | number | boolean | null> = {};
  for (const f of fields) {
    if (f.type === "checkbox") {
      values[f.name] = formData.get(f.name) === "on";
      continue;
    }
    let raw = String(formData.get(f.name) ?? "").trim();
    if (f.type !== "textarea") raw = raw.replace(/\s+/g, " ");
    if (f.lowercase) raw = raw.toLowerCase();
    if (!raw) {
      if (f.required) back(slug, "err", `${f.label} is required.`);
      values[f.name] = null;
      continue;
    }
    if (f.type === "number" || (f.type === "select" && f.options !== "moods")) {
      const n = Number(raw);
      if (!Number.isInteger(n)) back(slug, "err", `${f.label} must be a whole number.`);
      if (f.type === "number" && ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max))) {
        back(slug, "err", `${f.label} must be between ${f.min} and ${f.max}.`);
      }
      values[f.name] = n;
      continue;
    }
    if (f.max && raw.length > f.max) back(slug, "err", `${f.label} can be at most ${f.max} characters.`);
    values[f.name] = raw;
  }
  return values;
}

// Postgres errors, in words an admin can act on.
function explain(message: string, code?: string) {
  if (code === "23505") return "That already exists.";
  if (code === "23503") return "Something else still uses this. Remove or reassign that first.";
  if (code === "23514") return "One of the values isn’t in the allowed format.";
  if (code === "42501") return "Only superadmins can do that.";
  return message;
}

export async function saveRow(formData: FormData) {
  const { supabase } = await requireAdmin();
  const resource = resourceFrom(formData);
  const id = Number(formData.get("_id")) || null;
  const values = parse(resource.fields, formData, resource.slug);

  // Only one default model: clear the old default first.
  if (resource.table === "llm_models" && values.is_default === true) {
    const clear = supabase.from("llm_models").update({ is_default: false }).eq("is_default", true);
    const { error } = id ? await clear.neq("id", id) : await clear;
    if (error) back(resource.slug, "err", explain(error.message, error.code));
  }

  const { error } = id
    ? await supabase.from(resource.table).update(values).eq("id", id)
    : await supabase.from(resource.table).insert(values);
  if (error) back(resource.slug, "err", explain(error.message, error.code));

  revalidatePath(`/${resource.slug}`);
  back(resource.slug, "msg", id ? `Saved the ${resource.singular}.` : `Added the ${resource.singular}.`);
}

export async function deleteRow(formData: FormData) {
  const { supabase } = await requireAdmin();
  const resource = resourceFrom(formData);
  const id = Number(formData.get("_id"));
  const { error } = await supabase.from(resource.table).delete().eq("id", id);
  if (error) back(resource.slug, "err", explain(error.message, error.code));
  revalidatePath(`/${resource.slug}`);
  back(resource.slug, "msg", `Deleted the ${resource.singular}.`);
}
