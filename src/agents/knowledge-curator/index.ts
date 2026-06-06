export { knowledgeCuratorPrompt, type KnowledgeCuratorPromptOptions } from "./prompt.js";

export const knowledgeCuratorAgent = {
  id: "knowledge-curator",
  role: "knowledge-curator",
  schemaPath: "src/agents/knowledge-curator/schema.json",
  purpose: "Review worker and PR indexing outputs, then propose graph-safe curated lessons and source update proposals.",
} as const;
