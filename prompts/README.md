# Orchestrator Prompt Templates

Pi sessions use separate system and initial user prompts:

```text
prompts/
+-- director/
|   +-- system.md
|   +-- initial_user.md
+-- worker/
    +-- system.md
    +-- initial_user.md
```

The system prompt defines the role, authority boundary, safety rules, and output
contract. The initial user prompt carries the current run state, files to read,
resources, budgets, and the concrete task packet for that session.

Agent workflow knowledge is selected from `../knowledge/manifest.json` and
rendered as `selected_knowledge_packs` plus resource-map entries. The prompts do
not rely on Codex skill loading; the runner points Pi agents at the
orchestrator-owned knowledge packs they need for the current role/capabilities.

Templates are rendered by `src/prompts.ts`. Dynamic values use `{{NAME}}`
placeholders and are written into dry-run artifacts beside each Pi output as
`*.system.md` and `*.user.md`.
