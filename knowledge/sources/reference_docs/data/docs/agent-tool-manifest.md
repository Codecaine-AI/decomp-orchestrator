# Agent Tool Manifest

Canonical commands for this fork. Prefer these names over remembered aliases or
older paths.

## Bootstrap And Health

```bash
python tools/worktree-doctor.py --fix
python tools/worktree-doctor.py
```

The doctor checks fork tooling, `tools/checkdiff.py`, workflow scripts,
`orig/GALE01/sys/main.dol`, stale build state, `melee-agent`, `table-typer`,
`discord-search`, and optional `GHIDRA_INSTALL_DIR`. Use `--fix` for fresh
matching worktrees so safe local repairs happen before choosing targets.

## Repo-Local Skill

Canonical skill path:

```text
.claude/skills/decomp/SKILL.md
```

Codex should see the same skills through:

```text
.codex/skills
```

## Diff And Build

```bash
python tools/checkdiff.py <function>
python configure.py && ninja
```

Use `tools/checkdiff.py` or repo wrappers, not direct `objdiff-cli`, `wine`, or
`wibo` calls.

## Source Shape Tools

```bash
tools/symbol-layout-analyzer.py <symbol-or-address>
melee-agent patterns inlines <source-file>
melee-agent patterns wrappers "gobj->user_data"
melee-agent patterns anti-patterns list
```

Singular forms also work: `melee-agent patterns wrapper` and
`melee-agent patterns anti-pattern`.

## Attempt Tracking

```bash
melee-agent attempts record <func> --match <pct> --outcome improved
melee-agent attempts show <func>
melee-agent attempts list
```

Use `--classification register-allocation`, `--blocker`, and `--retained` to
preserve useful state after experiments.

## Tool Issue Reporting

```bash
melee-agent issue report "short summary" --tool mwcc-debug --kind bug --function <func>
melee-agent issue list --status open
melee-agent issue show <id>
melee-agent issue resolve <id> --note "fixed by <summary-or-commit>"
```

Use this for tooling bugs, hangs, feature requests, papercuts, and blockers.
`issue report` auto-records the reporting agent, Codex/Claude session when
available, current worktree, and branch. If a tool hangs, interrupt it and
report the command plus last visible output in `--body`.

## Common Setup Paths

- Base DOL: `orig/GALE01/sys/main.dol`
- Shared base DOL: `~/.config/decomp-me/orig/GALE01/main.dol`
- State DB: `~/.config/decomp-me/agent_state.db`
- Discord archive CLI: `/Users/mike/code/discord-archive-mcp/.venv/bin/discord-search`
- Ghidra: set `GHIDRA_INSTALL_DIR`
- Table typer: `tools/table-typer/table-typer`
