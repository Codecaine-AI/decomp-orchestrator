export { prReviewPrompt, type PrReviewPromptOptions } from "./prompt.js";

export const prReviewAgent = {
  id: "pr-review",
  role: "pr-review",
  schemaPath: "packages/agents/src/pr-review/schema.json",
  purpose: "Turn one GitHub PR dump slice into a compact searchable decomp knowledge record.",
} as const;
