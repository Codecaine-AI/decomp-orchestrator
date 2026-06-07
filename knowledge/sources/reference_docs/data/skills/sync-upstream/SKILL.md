# Sync Upstream Skill

Use this skill when the user wants to sync their fork with the upstream doldecomp/melee repository.

## Trigger Phrases

- "sync with upstream"
- "update from upstream"
- "pull upstream changes"
- "master is behind"
- "rebase on upstream"

## Important

**Never use `git rebase master upstream/master`** for syncing. This causes merge conflicts when squashed PRs are involved.

Instead, use the reset-based workflow via `sync-upstream.sh`.

## Procedure

### Step 1: Check Current State

```bash
./tools/workflow/status.sh
```

Verify:
- How many commits is master behind upstream?
- Are there uncommitted changes? (Must commit/stash first)
- Are there decomp changes that need to be preserved?

### Step 2: Preview the Sync

```bash
./tools/workflow/sync-upstream.sh --dry-run
```

This shows what will happen without making changes.

### Step 3: Perform the Sync

```bash
./tools/workflow/sync-upstream.sh
```

The script will:
1. Save any WIP decomp work as a patch
2. Create a backup branch
3. Reset master to upstream/master
4. Re-apply the tooling overlay
5. Report the saved patch location

### Step 4: Verify

```bash
# Check master is now synced
git log --oneline -5

# Verify build
python configure.py && ninja

# Check tooling works
ls .claude/skills/
```

### Step 5: Handle WIP Work

If the script saved a WIP patch:

```bash
# View the patch
cat /tmp/melee-wip-*.patch

# Apply it
git apply /tmp/melee-wip-*.patch
git add -A
git commit -m "WIP: continuing work on..."
```

Or if you want to start fresh, just ignore the patch.

### Step 6: Update Worktrees (if any)

```bash
# Check worktree status
git worktree list

# Update each worktree
cd /path/to/worktree
git fetch origin
git reset --hard origin/master
```

## What Gets Preserved

**Automatically preserved:**
- All tooling (tools/, .claude/, docs/, etc.)
- configure.py customizations
- .gitignore additions
- Fork-specific workflows

**Saved as patch (if present):**
- Uncommitted src/ changes
- Committed src/ changes not yet in a PR

**Not preserved:**
- PR branches (they're independent)
- Backup branches (they remain as-is)

## Common Scenarios

### "My PR was just merged upstream"
Perfect time to sync! The script will cleanly incorporate your merged changes.

### "Someone else's PR was merged and I need it"
Run sync-upstream.sh. Your WIP work will be saved and can be re-applied.

### "I have conflicts after sync"
This shouldn't happen with the reset workflow. If it does:
1. Check if you're on the right branch
2. Ensure you ran sync-upstream.sh (not manual rebase)
3. Look for the backup branch to recover

### "I lost work after sync"
Check these locations:
1. Backup branch: `git branch --list backup/*`
2. Patch file: `ls /tmp/melee-wip-*.patch`
3. Git reflog: `git reflog | head -20`

## Output to User

After successful sync, report:
1. New upstream commits incorporated
2. Current master status
3. Location of any saved WIP patches
4. Backup branch name
5. Build verification status
