// Builds the booth's prompt from the database: a prompt chain picked by the mix, its steps, the active
// terms and examples, and the default LLM model. The admin area edits all of these.
import type { SupabaseClient } from "@supabase/supabase-js";
import { MOODS } from "./confessions";
import { CAPTIONS_PER_DROP, captionPrompt } from "./photo-booth";

export type BoothModel = { id: number | null; apiModelId: string; maxTokens: number };
export type BoothPrompt = { prompt: string; chainId: number | null; model: BoothModel };

// Used only if the settings tables are empty or unreadable, so the booth never goes down over config.
const FALLBACK_MODEL: BoothModel = { id: null, apiModelId: process.env.ANTHROPIC_MODEL || "claude-opus-5-5", maxTokens: 16000 };

type Step = { chain_id: number; position: number; template: string };

export async function buildBoothPrompt(supabase: SupabaseClient, { theme, context }: { theme: string; context: string }): Promise<BoothPrompt> {
  const [chainsRes, mixRes, stepsRes, termsRes, examplesRes, modelsRes] = await Promise.all([
    supabase.from("prompt_chains").select("id").eq("is_active", true),
    supabase.from("prompt_chain_mix").select("chain_id, weight"),
    supabase.from("prompt_chain_steps").select("chain_id, position, template").order("position"),
    supabase.from("terms").select("term, definition").eq("is_active", true).order("term"),
    supabase.from("generation_examples").select("chain_id, scene, mood, caption").eq("is_active", true),
    supabase.from("llm_models").select("id, api_model_id, max_tokens, is_default, llm_providers!inner(slug, is_active)").eq("is_active", true),
  ]);

  const model = pickModel(modelsRes.data ?? []);
  const active = new Set((chainsRes.data ?? []).map((c) => c.id as number));
  const steps = ((stepsRes.data ?? []) as Step[]).filter((s) => active.has(s.chain_id));
  const chainId = pickChain(
    (mixRes.data ?? []).filter((m) => active.has(m.chain_id) && steps.some((s) => s.chain_id === m.chain_id)),
  );
  if (chainId === null) return { prompt: captionPrompt({ theme, context }), chainId: null, model };

  const terms = (termsRes.data ?? []).map((t) => `- ${t.term}: ${t.definition}`).join("\n");
  const examples = (examplesRes.data ?? [])
    .filter((e) => e.chain_id === null || e.chain_id === chainId)
    .slice(0, 5)
    .map((e) => `- Photo: ${e.scene} (${e.mood}) → "${e.caption}"`)
    .join("\n");

  const values: Record<string, string> = {
    count: String(CAPTIONS_PER_DROP),
    moods: MOODS.map((m) => m.id).join(", "),
    theme,
    context,
    terms,
    examples,
  };
  // A step that needs an empty optional value is left out entirely.
  const optional = ["context", "terms", "examples"];
  const prompt = steps
    .filter((s) => s.chain_id === chainId)
    .filter((s) => !optional.some((key) => s.template.includes(`{{${key}}}`) && !values[key]))
    .map((s) => s.template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? ""))
    .join("\n\n");

  return { prompt, chainId, model };
}

// Weighted random pick: weights 70 and 30 mean the first chain is used about 70% of the time.
function pickChain(mix: { chain_id: number; weight: number }[]) {
  const total = mix.reduce((s, m) => s + Math.max(0, m.weight), 0);
  if (total <= 0) return mix[0]?.chain_id ?? null;
  let roll = Math.random() * total;
  for (const m of mix) {
    roll -= Math.max(0, m.weight);
    if (roll < 0) return m.chain_id;
  }
  return mix[mix.length - 1].chain_id;
}

type ModelRow = { id: number; api_model_id: string; max_tokens: number; is_default: boolean; llm_providers: unknown };

// The booth talks to Anthropic, so only Anthropic models with an active provider count.
function pickModel(rows: ModelRow[]): BoothModel {
  const usable = rows.filter((m) => {
    const p = (Array.isArray(m.llm_providers) ? m.llm_providers[0] : m.llm_providers) as { slug?: string; is_active?: boolean } | null;
    return p?.slug === "anthropic" && p.is_active;
  });
  const chosen = usable.find((m) => m.is_default) ?? usable[0];
  return chosen ? { id: chosen.id, apiModelId: chosen.api_model_id, maxTokens: chosen.max_tokens } : FALLBACK_MODEL;
}

// One row in generation_requests (and llm_responses when Claude answered) per Claude call.
export async function logGenerationRequest(
  supabase: SupabaseClient,
  entry: {
    chainId: number | null;
    modelId: number | null;
    generationId: number | null;
    theme: string;
    context: string;
    prompt: string;
    status: "succeeded" | "failed";
    error: string | null;
    durationMs: number;
    response: { model: string; stop_reason: string | null; input_tokens: number; output_tokens: number; raw_text: string } | null;
  },
) {
  const { error } = await supabase.rpc("record_generation_request", {
    p_chain_id: entry.chainId,
    p_model_id: entry.modelId,
    p_generation_id: entry.generationId,
    p_theme: entry.theme,
    p_context: entry.context || null,
    p_prompt: entry.prompt,
    p_status: entry.status,
    p_error: entry.error,
    p_duration_ms: entry.durationMs,
    p_response: entry.response,
  });
  // Logging must never break a drop.
  if (error) console.error("Logging the generation request failed", error);
}
