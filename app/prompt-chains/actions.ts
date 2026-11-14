"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

// UPDATE the prompt chain mix: one weight per chain.
export async function updateMix(formData: FormData) {
  const { supabase } = await requireAdmin();
  const updates: { chainId: number; weight: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^weight_(\d+)$/.exec(key);
    if (!match) continue;
    const weight = Number(value);
    if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
      redirect(`/prompt-chains?err=${encodeURIComponent("Weights must be whole numbers from 0 to 100.")}`);
    }
    updates.push({ chainId: Number(match[1]), weight });
  }

  for (const u of updates) {
    const { error } = await supabase
      .from("prompt_chain_mix")
      .update({ weight: u.weight, updated_at: new Date().toISOString() })
      .eq("chain_id", u.chainId);
    if (error) redirect(`/prompt-chains?err=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/prompt-chains");
  redirect(`/prompt-chains?msg=${encodeURIComponent("Mix saved. The next drop uses it.")}`);
}
