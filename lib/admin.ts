import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PHOTO_BUCKET } from "./photo-booth";

// Every page and server action calls this first, on top of the middleware check.
// The database checks is_superadmin again on every admin query, so this is the third lock, not the only one.
export async function requireAdmin() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");
  if (isSuperadmin !== true) redirect("/denied");

  return { supabase, user };
}

export type AdminUser = {
  id: string;
  email: string | null;
  provider: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  confessions: number;
  drops: number;
  votes: number;
};

export type AdminGeneration = {
  id: number;
  created_at: string;
  user_id: string | null;
  image_path: string;
  theme: string;
  alt_text: string | null;
  context: string | null;
  model: string;
  prompt: string;
};

export type CaptionRow = {
  id: number;
  generation_id: number;
  position: number;
  created_at: string;
  mood: string;
  body: string;
  score: number;
};

export type VoteRow = { caption_id: number; user_id: string; vote: number; created_at: string };

export function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

export function displayName(u: Pick<AdminUser, "first_name" | "last_name" | "email"> | undefined) {
  if (!u) return "Deleted user";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || u.email || "No name";
}

const NYC = "America/New_York";

export function formatWhen(iso: string | null) {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NYC,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function nycHour(iso: string) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: NYC, hour: "numeric", hourCycle: "h23" }).format(new Date(iso)));
}

export function nycDay(iso: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NYC }).format(new Date(iso));
}

export function hourLabel(h: number) {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}
