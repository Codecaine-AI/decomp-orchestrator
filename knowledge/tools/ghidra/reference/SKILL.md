---
name: ghidra
description: Use cached Ghidra-derived xrefs and string lookups (fast SQLite queries) for cross-reference discovery and string-based naming. Also offers live Ghidra decompile as a heavy fallback. Use when finding callers across the whole binary or naming functions from debug strings.
---

# Ghidra Integration (cache-backed)

Two ways agents use Ghidra data, distinguished by cost:

| Need | Command | Cost |
|------|---------|------|
| Who calls this function (anywhere in the binary)? | `melee-agent ghidra xrefs 0x80<addr>` | <1ms (cache) |
| What does this function call? | `melee-agent ghidra xrefs 0x80<addr> --dir from` | <1ms |
| What strings does this function reference? | `melee-agent ghidra strings 0x80<addr>` | <1ms |
| Find functions that reference a string pattern. | `melee-agent ghidra strings --pattern XYZ` | <1ms |
| Function metadata (name, size, caller/callee counts). | `melee-agent ghidra func 0x80<addr>` | <1ms |
| Second-opinion decompilation. | `melee-agent ghidra decompile 0x80<addr>` | ~20s (JVM) |

The fast commands query a SQLite cache at `~/.config/decomp-me/ghidra.db`. The heavy `decompile` command boots a real Ghidra instance.

## Setup (one-time)

```bash
melee-agent ghidra status         # check what's missing
melee-agent ghidra setup          # guided GUI import (~5-10 min)
melee-agent ghidra cache-build    # populate the cache (~minutes)
```

After this, agent-loop commands work without further setup.

## When to use vs other tools

| Task | Preferred |
|------|-----------|
| Matching code → assembly | m2c + `tools/checkdiff.py` |
| Finding callers (whole binary) | `ghidra xrefs --dir to` |
| Finding callees | `ghidra xrefs --dir from` |
| Naming an unknown function | `ghidra strings` (debug strings) + `/understand` |
| Complex control flow, m2c output unclear | `ghidra decompile` (heavy) |
| Patterns / register tricks | `/mismatch-db`, `/discord-knowledge` |

## Limitations

- **Decompile is slow** — JVM startup is ~20s per call. Use sparingly.
- **Cache is built once** — rebuild manually if the Ghidra project gets re-analyzed.
- **Ghidra function names ≠ project symbol names** — the cache stores Ghidra's names; if our `symbols.txt` has renamed a function, look up by address, not by name.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Cache not built" | `melee-agent ghidra cache-build` |
| "Project is not populated" | `melee-agent ghidra setup` (manual GUI step) |
| "Ghidra install not found" | `brew install ghidra` |
| "pyghidra not installed" | `pip install pyghidra` |
