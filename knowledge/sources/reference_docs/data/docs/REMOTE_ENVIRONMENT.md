# Remote Environment Support

This document describes which agent tools work in a remote/containerized environment and how to configure them.

## Overview

The melee-agent tooling was originally designed for local development with a self-hosted decomp.me instance. Some tools require local network access or specific hardware that won't be available in a remote container (e.g., Claude Code running in the cloud).

## Quick Start for Remote Environments

### Step 1: Install melee-agent

The `melee-agent` CLI tool must be installed before use:

```bash
# From the repository root
pip install -e ./tools/melee-agent

# Verify installation
melee-agent --help
```

### Step 2: Set Environment Variables

Set these environment variables before running any melee-agent commands:

```bash
# REQUIRED: Point to a publicly accessible decomp.me instance
export DECOMP_API_BASE=https://your-decomp-me-instance.com

# REQUIRED for PR operations
export GITHUB_TOKEN=ghp_xxxxx

# OPTIONAL: Override auto-detected agent ID
export DECOMP_AGENT_ID=remote-agent-1
```

### Step 3: Check Setup Status

Verify your environment is configured correctly:

```bash
melee-agent setup status
```

This will show:
- Whether main.dol is configured
- Config directory location
- Any missing dependencies

## Tool Compatibility Matrix

| Tool/Command | Remote Support | Notes |
|--------------|----------------|-------|
| `extract list` | ✅ Full | Requires successful build first (report.json) |
| `extract get` | ✅ Full | Requires successful build first (report.json) |
| `scratch create` | ⚠️ Needs Config | Requires `DECOMP_API_BASE` |
| `scratch compile` | ⚠️ Needs Config | Requires `DECOMP_API_BASE` |
| `scratch get` | ⚠️ Needs Config | Requires `DECOMP_API_BASE` |
| `scratch decompile` | ⚠️ Needs Config | Requires `DECOMP_API_BASE` |
| `claim add/release` | ✅ Full | Local SQLite operations |
| `state status` | ✅ Full | Local SQLite operations |
| `commit apply` | ✅ Full | Git operations |
| `hook validate` | ✅ Full | Local file analysis |
| `checkdiff.py` | ✅ Full | Auto-downloads dtk if needed |
| `sync production` | ❌ Not Supported | Requires browser auth for Cloudflare |
| `worktree collect` | ⚠️ Needs Auth | Requires `GITHUB_TOKEN` |
| `pr feedback` | ⚠️ Needs Auth | Requires `GITHUB_TOKEN` |

## Skill Compatibility Matrix

| Skill | Remote Support | Notes |
|-------|----------------|-------|
| `/decomp` | ⚠️ Needs Config | Core workflow; needs `DECOMP_API_BASE` |
| `/decomp-fixup` | ⚠️ Needs Config | Needs `DECOMP_API_BASE` |
| `/mismatch-db` | ✅ Full | Local database lookups |
| `/opseq` | ⚠️ Partial | Search works; synthesis needs MWCC/Wine |
| `/ppc-ref` | ⚠️ Needs Config | Requires PDF bootstrap (see below) |
| `/melee-debug` | ❌ Not Supported | Requires Dolphin emulator |
| `/understand` | ✅ Full | Documentation skill |
| `/item-decomp` | ✅ Full | Documentation skill |
| `/collect-for-pr` | ⚠️ Needs Auth | Requires `GITHUB_TOKEN` |
| `/backfill-analysis` | ✅ Full | Git history analysis |

## Detailed Requirements

### decomp.me Server Access

The default configuration tries these local URLs in order:
1. `http://nzxt-discord.local` (home network)
2. `http://10.200.0.1` (WireGuard VPN)
3. `http://localhost:8000` (local dev)

For remote environments, you MUST set `DECOMP_API_BASE`:

```bash
export DECOMP_API_BASE=https://your-decomp-me-instance.com
```

**Options for decomp.me access:**

1. **Host your own decomp.me** (Recommended)
   - Deploy decomp.me to a cloud server
   - Set `DECOMP_API_BASE` to the public URL

2. **Use production decomp.me** (Limited)
   - `https://decomp.me` is protected by Cloudflare
   - Requires `cf_clearance` cookie from browser auth
   - Not practical for automated/headless environments

3. **Cloudflare Tunnel** (Advanced)
   - Run decomp.me locally
   - Expose via Cloudflare Tunnel
   - Container connects to tunnel URL

### checkdiff.py (Auto-Download Support)

The `checkdiff.py` tool now automatically downloads the required disassembler if not found:

1. First tries to find `powerpc-eabi-objdump` (devkitPPC)
2. Falls back to `dtk` (decomp-toolkit) if objdump not found
3. Auto-downloads `dtk` from GitHub releases if neither is available

Downloaded binaries are cached in `~/.cache/melee-tools/`.

You can also set the `PPC_EABI_OBJDUMP` environment variable to specify a custom objdump path.

### Original Game Files (main.dol)

The build requires `orig/GALE01/sys/main.dol` from the original game. Since this cannot be distributed, use the bootstrap script with a pre-signed URL:

```bash
# Generate a pre-signed URL from your secure storage (S3, R2, etc.)
# URL should be time-limited (1 hour recommended)

# Set the URL (NEVER commit this!)
export MELEE_DOL_URL="https://your-bucket.../main.dol?signature=..."

# Download and verify
python tools/bootstrap_orig.py

# Then build normally
python configure.py && ninja
```

**Security requirements:**
- Store main.dol in private cloud storage (S3, Cloudflare R2, GCS)
- Generate time-limited pre-signed URLs (expire after 1 hour)
- Pass URL via environment variable, NEVER commit to git
- The `.gitignore` already excludes `.env` files and `orig/` contents

The bootstrap script verifies the SHA-1 hash to ensure the correct file.

### PowerPC Reference PDFs (`/ppc-ref`)

The `/ppc-ref` skill requires PDF reference manuals. Use the bootstrap script with pre-signed URLs:

```bash
# Generate pre-signed URLs from your secure storage
export PPC_REF_750CL_URL="https://your-bucket.../ppc_750cl.pdf?signature=..."
export PPC_REF_CWG_URL="https://your-bucket.../powerpc-cwg.pdf?signature=..."
export PPC_REF_MPC5XX_URL="https://your-bucket.../MPC5xxUG.pdf?signature=..."

# Download and verify
python tools/bootstrap_ppc_ref.py

# Test it works
python tools/ppc-ref.py sources
python tools/ppc-ref.py instr lwz
```

**Required PDFs:**

| File | Description | SHA-1 |
|------|-------------|-------|
| `ppc_750cl.pdf` | IBM PowerPC 750CL User's Manual | `0e701abd...` |
| `powerpc-cwg.pdf` | IBM PowerPC Compiler Writer's Guide | `7c5e8412...` |
| `MPC5xxUG.pdf` | CodeWarrior MPC5xx Targeting Manual | `f836aefd...` |

PDFs are installed to `.claude/skills/ppc-ref/` by default. Override with `PPC_REF_DIR`.

### Build Tools

For full functionality (compilation, opseq synthesis), the container needs:

```dockerfile
# Example Dockerfile additions
RUN apt-get update && apt-get install -y \
    wine64 \
    python3-pip \
    ninja-build

# Install devkitPPC (for objdump, assembler)
RUN wget https://github.com/devkitPro/pacman/releases/download/v1.0.2/devkitpro-pacman.amd64.deb \
    && dpkg -i devkitpro-pacman.amd64.deb \
    && dkp-pacman -Sy --noconfirm devkitPPC

# Alternative: Install wibo for faster compilation
RUN wget -O /usr/local/bin/wibo \
    https://github.com/decompals/wibo/releases/latest/download/wibo \
    && chmod +x /usr/local/bin/wibo
```

The melee repo's build system will download compilers automatically:
```bash
python configure.py
ninja  # Downloads MWCC compiler on first run
```

### State Persistence

The agent stores state in `~/.config/decomp-me/`:
- `agent_state.db` - SQLite database (claims, scratches, functions)
- `cookies_*.json` - Session cookies per agent

For persistent state across container restarts, mount this directory:
```bash
docker run -v decomp-state:/root/.config/decomp-me ...
```

### GitHub Authentication

For PR operations (`worktree collect --create-pr`, `pr feedback`):
```bash
export GITHUB_TOKEN=ghp_xxxxx
# Or configure gh CLI
gh auth login
```

## What Cannot Be Made Remote

### 1. Dolphin Emulator Debugging (`/melee-debug`)

Runtime debugging requires:
- Dolphin emulator running locally
- GDB stub connection (port 9090)
- `dolphin-memory-engine` native library
- Game ISO

This cannot be containerized in a practical way.

### 2. Production Sync (`melee-agent sync production`)

Syncing to `https://decomp.me` requires a Cloudflare `cf_clearance` cookie obtained by solving a browser challenge. This cannot be automated.

## Recommended Remote Setup

1. **Deploy decomp.me to cloud** (e.g., AWS, GCP, DigitalOcean)
2. **Create Docker image** with build tools (see above)
3. **Mount state volume** for persistence
4. **Set environment variables**:
   ```bash
   DECOMP_API_BASE=https://your-decomp-me.com
   GITHUB_TOKEN=ghp_xxxxx
   DECOMP_AGENT_ID=remote-agent-1
   ```
5. **Accept limitations**: No runtime debugging, no PPC reference, no production sync

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DECOMP_API_BASE` | Yes (remote) | URL of decomp.me instance |
| `DECOMP_ME_URL` | No | Alias for `DECOMP_API_BASE` |
| `DECOMP_AGENT_ID` | No | Override auto-detected agent ID |
| `DECOMP_COOKIES_FILE` | No | Custom cookies file location |
| `LOCAL_DECOMP_CANDIDATES` | No | Comma-separated list of URLs to probe |
| `GITHUB_TOKEN` | For PRs | GitHub personal access token |
| `CF_CLEARANCE` | For prod sync | Cloudflare cookie (browser auth required) |
| `DECOMP_SESSION_ID` | No | decomp.me session cookie |
| `PPC_EABI_OBJDUMP` | No | Custom path to powerpc-eabi-objdump |
| `MELEE_DOL_URL` | For build | Pre-signed URL to download main.dol (NEVER commit!) |
| `MELEE_ORIG_DIR` | No | Override default orig/ directory |
| `PPC_REF_750CL_URL` | For /ppc-ref | Pre-signed URL for ppc_750cl.pdf |
| `PPC_REF_CWG_URL` | For /ppc-ref | Pre-signed URL for powerpc-cwg.pdf |
| `PPC_REF_MPC5XX_URL` | For /ppc-ref | Pre-signed URL for MPC5xxUG.pdf |
| `PPC_REF_DIR` | No | Override default PDF directory |

## Troubleshooting

### "Could not find local decomp.me server"

Set `DECOMP_API_BASE` to a reachable URL:
```bash
export DECOMP_API_BASE=https://your-server.com
melee-agent scratch create func_name
```

### "Compilation failed" or "mwcc not found"

Ensure build tools are installed:
```bash
# Check for MWCC compiler
ls build/compilers/GC/1.2.5n/mwcceppc.exe

# Check for Wine/wibo
which wine || which wibo

# Rebuild to download tools
python configure.py && ninja
```

### State not persisting

Mount the config directory:
```bash
docker run -v decomp-state:/root/.config/decomp-me your-image
```

### GitHub operations failing

Set up authentication:
```bash
export GITHUB_TOKEN=ghp_xxxxx
# Or
gh auth login --with-token < token.txt
```

### checkdiff.py fails to download dtk

If the auto-download fails (network restrictions, proxy issues), manually download:
```bash
# Download dtk for your platform
curl -L https://github.com/encounter/decomp-toolkit/releases/download/v1.8.0/dtk-linux-x86_64 \
  -o ~/.cache/melee-tools/dtk
chmod +x ~/.cache/melee-tools/dtk
```

Or place dtk in `tools/dtk` within the repo.

### Bootstrap script returns HTTP 503

If `bootstrap_orig.py` or `bootstrap_ppc_ref.py` returns HTTP 503:

1. **Pre-signed URL may have expired** - Generate a new URL from your cloud storage
2. **Storage service temporarily unavailable** - Retry after a few minutes
3. **Network issues** - Check your container's internet connectivity

The bootstrap scripts will show partial success if some files download successfully:
```
Bootstrap Summary:
  Downloaded: 2
  Failed: 1
```

You can re-run the script after fixing the issue - it will skip already-downloaded files.

### "report.json not found" when running extract commands

The `extract list` and `extract get` commands require a successful build:

```bash
# First, ensure main.dol is present
ls orig/GALE01/sys/main.dol

# Then build
python configure.py
ninja

# Now extract commands will work
melee-agent extract list --max-match 0.50
```

### Setup Commands

Use `melee-agent setup` to diagnose configuration issues:

```bash
# Check overall status
melee-agent setup status

# Auto-configure main.dol from worktrees (if available)
melee-agent setup dol --auto

# Or manually specify location
melee-agent setup dol /path/to/main.dol
```
