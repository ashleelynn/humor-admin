// The admin area's create/read/update/delete tables, described once. The generic page and
// server actions only ever touch the tables and columns listed here; RLS does the rest.
import { MOODS } from "./confessions";

export type FieldType = "text" | "textarea" | "number" | "checkbox" | "select";
export type OptionSource = "chains" | "providers" | "moods";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  max?: number;
  min?: number;
  placeholder?: string;
  help?: string;
  lowercase?: boolean;
  options?: OptionSource;
  // For selects: what an empty choice means, if allowed.
  emptyLabel?: string;
  defaultValue?: string | number | boolean;
};

export type Resource = {
  slug: string;
  table: string;
  title: string;
  singular: string;
  lede: string;
  order: { column: string; ascending: boolean };
  // Which field is the row's headline in the list.
  headline: string;
  fields: Field[];
};

export const RESOURCES: Record<string, Resource> = {
  terms: {
    slug: "terms",
    table: "terms",
    title: "Terms",
    singular: "term",
    lede: "Campus and city vocabulary. Active terms are added to every prompt chain step that uses {{terms}}.",
    order: { column: "term", ascending: true },
    headline: "term",
    fields: [
      { name: "term", label: "Term", type: "text", required: true, max: 60, placeholder: "Butler" },
      { name: "definition", label: "Definition", type: "textarea", required: true, max: 280 },
      { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
    ],
  },
  examples: {
    slug: "examples",
    table: "generation_examples",
    title: "AI generation examples",
    singular: "example",
    lede: "Few-shot examples of the booth’s voice. Up to five active ones go into each prompt, for their chain or for every chain.",
    order: { column: "created_at", ascending: false },
    headline: "caption",
    fields: [
      { name: "scene", label: "What’s in the photo", type: "text", required: true, max: 200, placeholder: "A cat asleep on bodega cereal boxes" },
      { name: "caption", label: "Caption", type: "textarea", required: true, max: 280 },
      { name: "mood", label: "Mood", type: "select", required: true, options: "moods" },
      { name: "chain_id", label: "Prompt chain", type: "select", options: "chains", emptyLabel: "Every chain" },
      { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
    ],
  },
  "llm-providers": {
    slug: "llm-providers",
    table: "llm_providers",
    title: "LLM providers",
    singular: "provider",
    lede: "Companies whose models the booth can call. The booth currently speaks to providers with the slug “anthropic”.",
    order: { column: "name", ascending: true },
    headline: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 60, placeholder: "Anthropic" },
      { name: "slug", label: "Slug", type: "text", required: true, max: 40, lowercase: true, placeholder: "anthropic", help: "Lowercase letters, numbers and dashes." },
      { name: "website", label: "Website", type: "text", max: 200, placeholder: "https://…" },
      { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
    ],
  },
  "llm-models": {
    slug: "llm-models",
    table: "llm_models",
    title: "LLM models",
    singular: "model",
    lede: "The booth uses the default model. Turning a model off or making another one default takes effect on the next drop.",
    order: { column: "created_at", ascending: true },
    headline: "name",
    fields: [
      { name: "name", label: "Display name", type: "text", required: true, max: 80, placeholder: "Claude Opus 5.5" },
      { name: "api_model_id", label: "API model ID", type: "text", required: true, max: 100, placeholder: "claude-opus-5-5" },
      { name: "provider_id", label: "Provider", type: "select", required: true, options: "providers" },
      { name: "max_tokens", label: "Max output tokens", type: "number", required: true, min: 256, max: 128000, defaultValue: 16000 },
      { name: "is_default", label: "Default model", type: "checkbox", defaultValue: false },
      { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
    ],
  },
  "signup-domains": {
    slug: "signup-domains",
    table: "allowed_signup_domains",
    title: "Allowed signup domains",
    singular: "domain",
    lede: "New accounts must use one of these email domains (or a subdomain of one) unless the address is whitelisted. With both lists empty, anyone can sign up. Existing accounts are never affected.",
    order: { column: "domain", ascending: true },
    headline: "domain",
    fields: [
      { name: "domain", label: "Domain", type: "text", required: true, max: 100, lowercase: true, placeholder: "columbia.edu" },
      { name: "note", label: "Note", type: "text", max: 200 },
    ],
  },
  "whitelisted-emails": {
    slug: "whitelisted-emails",
    table: "whitelisted_emails",
    title: "Whitelisted email addresses",
    singular: "email",
    lede: "These exact addresses can sign up even when their domain isn’t allowed.",
    order: { column: "email", ascending: true },
    headline: "email",
    fields: [
      { name: "email", label: "Email", type: "text", required: true, max: 200, lowercase: true, placeholder: "friend@gmail.com" },
      { name: "note", label: "Note", type: "text", max: 200 },
    ],
  },
};

export const MOOD_OPTIONS = MOODS.map((m) => ({ value: m.id, label: m.label }));
