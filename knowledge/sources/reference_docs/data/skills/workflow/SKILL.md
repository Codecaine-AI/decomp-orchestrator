# Workflow Management Skill

Use this skill to manage git branches and prepare changes for upstream PRs.

## When to Use

- When asked to "prepare a PR" or "create a PR branch"
- When asked to "sync with upstream" or "update from upstream"
- When asked about "workflow status" or "what's ready for PR"
- When organizing work across branches
- Before/after major decomp work sessions

## Workflow Overview

```
upstream/master ────────────────────────► (canonical repo)
      │
      └── master (upstream + tooling)
              │
              └── wip/* or HEAD (active work)
                        │
                        └── pr/* (clean PR branches)
```

**Key Principles:**
1. Master = upstream/master + single tooling commit
2. Decomp work happens on master or wip/* branches
3. PR branches are created fresh from upstream/master
4. After PR merges, reset master (don't rebase)

## Commands

### Check Status
```bash
./tools/workflow/status.sh
```
Shows: current branch, upstream sync status, pending changes, PR branches.

### Sync with Upstream
```bash
./tools/workflow/sync-upstream.sh [--dry-run]
```
Resets master to upstream/master and re-applies tooling. Saves any WIP work as a patch.

### Create PR Branch
```bash
./tools/workflow/create-pr.sh <branch-name> [--from <source>]
```
Creates a clean PR branch from upstream/master with only the src/config/include changes.

### Update Existing PR Branch
```bash
./tools/workflow/update-pr.sh <pr-branch> [--amend]
```
Applies changes from current branch (master) to a PR branch without switching.
Use `--amend` to amend the last commit instead of creating a new one.

### Create PR Worktree (for longer iteration)
```bash
./tools/workflow/pr-worktree.sh create <pr-branch>  # Create worktree with tooling
./tools/workflow/pr-worktree.sh status              # Check worktree status
./tools/workflow/pr-worktree.sh delete              # Remove worktree
```
Creates a separate worktree at `../melee-pr` with symlinked tooling for PR iteration.

Examples:
```bash
# Create new PR
./tools/workflow/create-pr.sh mndiagram-improvements

# Quick iteration on PR (stay on master)
./tools/workflow/update-pr.sh pr/mndiagram-improvements

# Longer PR iteration (dedicated worktree)
./tools/workflow/pr-worktree.sh create pr/mndiagram-improvements
cd ../melee-pr
# ... work with full tooling ...
```

## Workflow Procedures

### Starting New Decomp Work

1. Check status: `./tools/workflow/status.sh`
2. If master is behind upstream: `./tools/workflow/sync-upstream.sh`
3. Work directly on master (or create `wip/module-name` branch)
4. Make commits as needed - don't worry about squashing yet

### Preparing a PR

1. Check what's changed: `./tools/workflow/status.sh`
2. Create PR branch: `./tools/workflow/create-pr.sh <name>`
3. Review the changes: `git log -p upstream/master..HEAD`
4. Build and test: `python configure.py && ninja`
5. Push: `git push origin pr/<name>`
6. Return to work: `git checkout master`

### After PR is Merged Upstream

1. Sync master: `./tools/workflow/sync-upstream.sh`
2. Delete PR branch: `git branch -D pr/<name>`
3. If WIP was saved, restore: `git apply /tmp/melee-wip-*.patch`

### Handling Cross-Module Changes

When decomp work touches multiple modules (common):
- symbols.txt changes: Included automatically
- lb/gm module changes: Included automatically
- Header changes: Included automatically

The `create-pr.sh` script captures ALL changes in src/, config/, and include/.

## For Agents

When helping with workflow:

1. **Always check status first**: Run `./tools/workflow/status.sh` to understand current state

2. **Before creating PR branches**:
   - Verify the build passes
   - Check which files will be included
   - Use `--dry-run` if available

3. **When conflicts occur**:
   - Don't try to rebase master onto upstream
   - Use the sync-upstream.sh script instead
   - WIP work is automatically saved as a patch

4. **Commit message format for PRs**:
   ```
   module: brief description

   Detailed explanation of changes.

   Functions matched/improved:
   - func_name: XX% match

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   ```

5. **If asked to organize messy branches**:
   - Use status.sh to understand the situation
   - Save any valuable work as patches
   - Reset to clean state with sync-upstream.sh
   - Re-apply work incrementally

## Troubleshooting

### "Master has diverged from upstream"
This is expected after local commits. Use `sync-upstream.sh` to reset.

### "PR branch has conflicts"
The PR branch should be created fresh from upstream. If it has conflicts:
1. Delete the PR branch
2. Run sync-upstream.sh
3. Re-create the PR branch

### "Lost my work after sync"
Check for:
- Backup branches: `git branch --list backup/*`
- Saved patches: `ls /tmp/melee-wip-*.patch`
- Git reflog: `git reflog`
