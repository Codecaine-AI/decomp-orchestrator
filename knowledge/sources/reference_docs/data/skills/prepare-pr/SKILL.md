# Prepare PR Skill

Use this skill when the user wants to prepare decomp work for an upstream PR.

## Trigger Phrases

- "prepare a PR for..."
- "create PR branch for..."
- "package this for upstream"
- "make this ready for PR"

## Procedure

### Step 1: Assess Current State

```bash
./tools/workflow/status.sh
```

Check:
- Are there uncommitted changes? (Commit or stash first)
- Is master behind upstream? (May need to sync first)
- What decomp changes exist?

### Step 2: Identify Changes

```bash
# See all decomp file changes
git diff --name-only master..HEAD -- src/ config/ include/

# See affected modules
git diff --name-only master..HEAD -- src/melee/ | sed 's|src/melee/||' | cut -d'/' -f1 | sort -u

# See the actual diff (to understand what's changing)
git diff --stat master..HEAD -- src/ config/ include/
```

### Step 3: Verify Build

Before creating PR branch, ensure current state builds:

```bash
python configure.py && ninja
```

If build fails, fix issues before proceeding.

### Step 4: Create PR Branch

```bash
./tools/workflow/create-pr.sh <descriptive-name>
```

The script will:
1. Create branch from upstream/master
2. Apply all src/config/include changes
3. Open editor for commit message

### Step 5: Write Good Commit Message

Format:
```
module: concise description of changes

More detailed explanation if needed. Mention:
- What functions were matched/improved
- Any structural changes (renames, type fixes)
- Dependencies or related changes

Functions:
- mnDiagram_InputProc: 84.1% match
- mnDiagram_PopupInputProc: 100% match

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Step 5.5: Write Upstream-Visible PR Text

Do not mention fork-only tooling in upstream PR descriptions. Keep the body
upstream-visible: describe matched/improved functions, source structure, type
fixes, data layout, and verification. Do not mention local attempts DB entries,
attempt ledgers, `melee-agent`, `tools/checkdiff.py`, worktree doctor output,
Discord archive searches, or agent process notes. Translate local process notes
into reviewer-facing facts, for example "some remaining functions are left
unmatched" instead of "remaining functions are documented in the local attempts
DB."

### Step 6: Final Verification

```bash
# Verify build on PR branch
python configure.py && ninja

# Review what will be in the PR
git log -p upstream/master..HEAD

# Check no tooling leaked in
git diff --name-only upstream/master..HEAD | grep -E "^(tools/|\.claude/|docs/)" && echo "WARNING: Tooling files in PR!"
```

### Step 7: Push

```bash
git push origin pr/<name>
```

Report the PR URL to user:
```
https://github.com/doldecomp/melee/compare/master...itsgrimetime:melee:pr/<name>
```

### Step 8: Return to Work

```bash
git checkout master
# Continue working...
```

## Common Issues

### Changes span multiple modules
This is fine! The workflow handles it. Just use a descriptive PR name like `mn-modules-improvements` or list the modules in the commit message.

### Need to include related lb/gm changes
These are automatically included since we capture all of src/, config/, include/.

### User wants to split into multiple PRs
Run create-pr.sh multiple times with different file filters:
```bash
# First, create branch for module A
git checkout -b pr/module-a upstream/master
git diff master..HEAD -- src/melee/mn/mndiagram*.c src/melee/mn/mndiagram*.h | git apply
git add -A && git commit

# Then create branch for module B
git checkout -b pr/module-b upstream/master
git diff master..HEAD -- src/melee/mn/mnvibration*.c src/melee/mn/mnvibration*.h | git apply
git add -A && git commit
```

### Master is behind upstream
Run sync first:
```bash
./tools/workflow/sync-upstream.sh
```
Then re-assess what changes remain.

## Output to User

After successful PR preparation, report:
1. PR branch name
2. Number of commits/files
3. Affected modules
4. Push command
5. PR creation URL
6. Any warnings (tooling files, large changes, etc.)
