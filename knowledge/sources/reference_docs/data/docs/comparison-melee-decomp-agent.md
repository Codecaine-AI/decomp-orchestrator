# Comparison: melee-decomp-agent vs This Repository

A detailed comparison of the agent tooling between [melee-decomp-agent](../melee-decomp-agent) (standalone tooling repo) and this repository (fork of doldecomp/melee with integrated tooling).

## Repository Architecture

| Aspect | melee-decomp-agent | This Repo (melee fork) |
|--------|-------------------|------------------------|
| **Structure** | Standalone wrapper; clones melee/ as subdirectory | Fork of doldecomp/melee with integrated tooling |
| **Main CLI** | `melee-ai/tools.py` (1,997 lines, monolithic) | `melee-agent` package (modular, 29+ command files) |
| **Skill format** | `.claude-commands/` (single skill file) | `.claude/skills/` (16 specialized skills) |
| **State storage** | JSON cache files in `melee-ai/` | SQLite database (`~/.config/decomp-me/agent_state.db`) |
| **Build integration** | References melee/ subdirectory | Direct integration with source tree |

## Compilation & Iteration

| Aspect | melee-decomp-agent | This Repo |
|--------|-------------------|-----------|
| **Primary workflow** | Local mwcc via `wibo` wrapper | Dual: local (`checkdiff.py`) or remote (decomp.me server) |
| **Context handling** | `context.txt` (1.8MB preprocessed header) | Dynamic context from repo headers via CLI |
| **Fast iteration** | `tools.py scratch <func>` (~0.1s) | `tools/checkdiff.py <func>` (local) or `melee-agent scratch compile` (remote) |
| **Compiler** | mwcc GC/1.2.5n | mwcc GC/1.2.5n (decomp.me ID: mwcc_233_163n) |
| **Authoritative check** | `ninja` + `tools.py verify <func>` (checks report.json) | `python configure.py && ninja` |

### Compilation Flow Comparison

**melee-decomp-agent:**
```bash
# Fast local test (NOT authoritative)
tools.py scratch <func>

# Authoritative verification
ninja && tools.py verify <func>
```

**This repo (local workflow):**
```bash
# Edit source directly
vim src/melee/mn/mnFoo.c

# Fast diff check
python tools/checkdiff.py mnFoo_Bar

# Full build verification
python configure.py && ninja
```

**This repo (remote workflow):**
```bash
# Create scratch on decomp.me server
melee-agent extract get <func> --create-scratch

# Iterate via heredoc
cat << 'EOF' | melee-agent scratch compile <slug> --stdin --diff
void func(s32 arg0) {
    // code
}
EOF
```

## Function Discovery

| Feature | melee-decomp-agent | This Repo |
|---------|-------------------|-----------|
| **Embedding similarity** | Voyage AI embeddings (275MB cache in Git LFS) | Not present |
| **Recommend functions** | `tools.py recommend` (finds funcs with best reference material) | `melee-agent extract list` (filters by match %, module) |
| **Similar function search** | `tools.py similar <func>` (cosine similarity) | `/opseq` skill (opcode sequence patterns) |
| **Template generation** | `tools.py template <func>` (shows similar matched code) | Manual via `/opseq` or `/ghidra` |

### Discovery Philosophy

**melee-decomp-agent:** Uses AI embeddings to find semantically similar functions. Pre-computed vectors enable instant similarity lookups without API calls. Great for finding "functions that do similar things."

**This repo:** Uses opcode sequence matching to find structurally similar functions. Pattern-based approach finds "functions with similar assembly structure" regardless of semantic meaning.

## Knowledge & Pattern Databases

| Aspect | melee-decomp-agent | This Repo |
|--------|-------------------|-----------|
| **Mismatch patterns** | Not present | `/mismatch-db` skill with SQLite full-text search |
| **Discord knowledge** | Not present | 6+ years archive in `docs/discord-knowledge/` |
| **PowerPC reference** | Not present | `/ppc-ref` skill with 3 PDF manuals |
| **Failed function tracking** | `failed_functions.json` | Not present (relies on Git history) |
| **Type inference** | `melee-ai/infer_types.py` (659 lines) | `melee-agent struct offset/show` commands |

## Claude Skills Comparison

### melee-decomp-agent (1 skill)
Single comprehensive skill in `.claude-commands/melee-decompile.md`:
- Integrates all tools.py commands
- 6-phase workflow guidance
- References all key commands with examples

### This Repo (16 skills)
Modular skills in `.claude/skills/`:

| Skill | Purpose |
|-------|---------|
| **decomp** | Primary local workflow (edit files, checkdiff.py) |
| **decomp-remote** | Remote decomp.me server workflow |
| **decomp-fixup** | Fix build issues post-matching |
| **first-pass-decomp** | Generate initial C from assembly via m2c |
| **mismatch-db** | Search known mismatch patterns |
| **opseq** | Find similar functions by opcode sequence |
| **discord-knowledge** | Search Discord knowledge archive |
| **ppc-ref** | PowerPC instruction documentation |
| **ghidra** | Alternative decompiler, cross-refs, type inference |
| **understand** | Document/name functions and structs |
| **melee-debug** | Dolphin emulator debugging (experimental) |
| **item-decomp** | Domain knowledge for item code |
| **collect-for-pr** | Batch worktree commits into PRs |
| **backfill-analysis** | Analyze matched functions for patterns |
| **discord-search** | Search Discord server archives |
| **parsing-sessions** | Analyze Claude Code session history |

## Session & State Management

| Aspect | melee-decomp-agent | This Repo |
|--------|-------------------|-----------|
| **Isolation strategy** | Git worktrees (`git worktree add`) | Subdirectory worktrees (`melee-agent worktree`) |
| **Agent coordination** | None | Claim system (`melee-agent claim add/release`) |
| **Session startup** | Manual | Hook in `.claude/hooks/session-startup.sh` |
| **PR workflow** | Manual | `melee-agent worktree collect --create-pr` |
| **Commit tracking** | None | SQLite per-worktree commit tracking |

## Environment & Remote Support

| Aspect | melee-decomp-agent | This Repo |
|--------|-------------------|-----------|
| **Remote environment** | Not designed for remote | Full remote support with session hooks |
| **Server detection** | N/A | Auto-probes multiple URLs (home, VPN, localhost) |
| **Cloudflare handling** | N/A | Detection in startup hook |
| **Wibo detection** | Assumed present | Runtime detection with fallback |

## Validation & Quality

| Aspect | melee-decomp-agent | This Repo |
|--------|-------------------|-----------|
| **Pre-commit hooks** | None | `melee-agent hook validate` |
| **Style enforcement** | None | Boolean literals, float suffixes, hex case |
| **Verification caching** | None | 30-minute validation cache |
| **CI feedback** | None | `melee-agent pr feedback` parses CI/reviews |

### Pre-commit Validations (this repo only)
- `true`/`false` literals (not TRUE/FALSE)
- Float suffix: `1.0F` not `1.0f`
- Uppercase hex: `0xABCD` not `0xabcd`
- No pointer arithmetic patterns
- No M2C_FIELD leftovers
- clang-format compliance
- symbols.txt consistency
- No implicit function declarations

## Unique Features

### melee-decomp-agent Has (we don't)

1. **Voyage AI Embeddings** - Pre-computed semantic embeddings for all functions enable instant similarity search without API calls
2. **Template Command** - `tools.py template <func>` directly shows reference code from the most similar matched function
3. **Inline Extraction** - Automatic extraction of static inline functions, types, macros for context
4. **Failed Functions Registry** - JSON tracking of functions that failed matching attempts
5. **Batch m2c** - `batch_m2c.py` for mass decompilation with scoring
6. **Type Inference Module** - Dedicated `infer_types.py` for complex type analysis

### This Repo Has (melee-decomp-agent doesn't)

1. **Mismatch Pattern Database** - Searchable SQLite DB of known assembly mismatch patterns and fixes
2. **Discord Knowledge Archive** - 6+ years of consolidated knowledge (2020-2026) with full-text search
3. **PowerPC Reference PDFs** - Built-in instruction documentation
4. **Ghidra Integration** - Alternative decompiler for cross-refs and type inference
5. **Dolphin Debugging** - Runtime debugging via emulator (experimental)
6. **Agent Coordination** - Claim system for multi-agent work
7. **Pre-commit Validation** - Automated quality gates
8. **Remote Environment Support** - Session hooks, server auto-detection
9. **Modular Skill Architecture** - 16 specialized skills vs 1 monolithic command
10. **PR Workflow Automation** - Worktree collection, CI feedback parsing

## Workflow Philosophy

### melee-decomp-agent
- **Leaner, self-contained** - Everything runs locally via Python scripts
- **Embedding-first discovery** - Uses AI embeddings to find semantically similar functions
- **Strict iteration limits** - "5 meaningful attempts max then abandon"
- **Worktree isolation** - Git worktrees prevent accidental master commits
- **No external server** - Fully local compilation and verification

### This Repo
- **Infrastructure-rich** - Self-hosted decomp.me server as source of truth
- **Pattern-first discovery** - Opcode sequences and known mismatch patterns
- **Knowledge accumulation** - Discord archive, mismatch DB build institutional knowledge
- **Multi-agent aware** - Claims, state tracking, coordination support
- **Quality gates** - Pre-commit hooks enforce style consistency

## Command Reference Comparison

### Function Discovery

| Task | melee-decomp-agent | This Repo |
|------|-------------------|-----------|
| Find unmatched functions | `tools.py list` | `melee-agent extract list --max-match 0.50` |
| Find similar functions | `tools.py similar <func>` | `/opseq` skill |
| Get function recommendation | `tools.py recommend` | `melee-agent extract list --module <mod>` |

### Decompilation

| Task | melee-decomp-agent | This Repo |
|------|-------------------|-----------|
| Get m2c output | `tools.py m2c <func>` | `/first-pass-decomp` or `tools/decomp.py` |
| View target assembly | `tools.py asm <func>` | `melee-agent extract get <func>` |
| Fast compile test | `tools.py scratch <func>` | `tools/checkdiff.py <func>` |

### Analysis

| Task | melee-decomp-agent | This Repo |
|------|-------------------|-----------|
| Type inference | `tools.py infer` | `melee-agent struct offset` |
| Search patterns | N/A | `melee-agent mismatch search` |
| Cross-references | N/A | `/ghidra` skill |

## Ideas to Cross-Pollinate

### From melee-decomp-agent to This Repo

1. **Embedding-based similarity** - Voyage AI embeddings would complement opseq for discovering semantically similar functions
2. **Template command** - Quick access to reference code from similar matched functions
3. **Inline extraction** - Automatic context extraction for compilation
4. **Failed functions tracking** - JSON registry to avoid wasting time on unsolvable functions

### From This Repo to melee-decomp-agent

1. **Mismatch pattern DB** - Structured knowledge base of known assembly patterns
2. **Discord knowledge archive** - Searchable historical knowledge
3. **Pre-commit validation** - Quality gates before commit
4. **Modular skill architecture** - Specialized skills for different tasks
5. **Ghidra integration** - Alternative decompiler for stuck functions

## Summary

**melee-decomp-agent** is a **lean, embedding-centric toolkit** optimized for single-agent local work. Its strength is semantic similarity search via Voyage AI embeddings - finding functions that "do similar things" even if structurally different.

**This repository** is an **infrastructure-rich, knowledge-heavy platform** designed for organized multi-agent work. Its strengths are pattern databases, historical knowledge archives, and quality automation.

Both approaches solve the same core problem (LLM-assisted Melee decompilation) but optimize for different constraints:
- **melee-decomp-agent**: Minimal dependencies, local-first, AI-similarity discovery
- **This repo**: Rich tooling, knowledge accumulation, multi-agent coordination
