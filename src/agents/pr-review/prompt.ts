import { fileURLToPath } from "node:url";
import type { PiPromptBundle } from "../../types/index.js";
import { globalStandardsContext } from "../../knowledge/decomp-context.js";
import { readTemplate, stableJson } from "../runtime/index.js";

export interface PrReviewPromptOptions {
  prContext: unknown;
}

function templatePath(name: "system" | "initial_user"): string {
  return fileURLToPath(new URL(`./templates/${name}.md`, import.meta.url));
}

export function prReviewPrompt(options: PrReviewPromptOptions): PiPromptBundle {
  const systemTemplatePath = templatePath("system");
  const userTemplatePath = templatePath("initial_user");
  const userTemplate = readTemplate(userTemplatePath);
  const standardsContext = globalStandardsContext();
  return {
    systemPrompt: `${readTemplate(systemTemplatePath)}\n\n<global_decomp_standards>\n${stableJson(standardsContext)}\n</global_decomp_standards>`,
    userPrompt: userTemplate.replace("{pr_context_json}", stableJson(options.prContext)),
    systemTemplatePath,
    userTemplatePath,
  };
}
