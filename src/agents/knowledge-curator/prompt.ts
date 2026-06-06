import { fileURLToPath } from "node:url";
import type { PiPromptBundle } from "../../types/index.js";
import { readTemplate, stableJson } from "../runtime/index.js";

export interface KnowledgeCuratorPromptOptions {
  curatorContext: unknown;
}

function templatePath(name: "system" | "initial_user"): string {
  return fileURLToPath(new URL(`./templates/${name}.md`, import.meta.url));
}

export function knowledgeCuratorPrompt(options: KnowledgeCuratorPromptOptions): PiPromptBundle {
  const systemTemplatePath = templatePath("system");
  const userTemplatePath = templatePath("initial_user");
  const userTemplate = readTemplate(userTemplatePath);
  return {
    systemPrompt: readTemplate(systemTemplatePath),
    userPrompt: userTemplate.replace("{curator_context_json}", stableJson(options.curatorContext)),
    systemTemplatePath,
    userTemplatePath,
  };
}
