# Git Quick Reference Guide - SFAF Plotter

A quick guide for common Git operations for the SFAF Plotter project.

## Table of Contents
- [Daily Workflow](#daily-workflow)
- [Checking Status](#checking-status)
- [Making Changes](#making-changes)
- [Branching](#branching)
- [Syncing with Remote](#syncing-with-remote)
- [Undoing Changes](#undoing-changes)
- [Useful Tips](#useful-tips)

---

## Daily Workflow

### Start of Day - Get Latest Code
```bash
# Make sure you're in the right directory
cd "z:\DriveBackup\Nerdery\SFAF Plotter\GoPlotter"

# Pull latest changes from remote
git pull origin wip

# Or if on main branch
git pull origin main
```

### End of Day - Save Your Work
```bash
# Check what changed
git status

# Add all changes
git add .

# Commit with a descriptive message
git commit -m "Brief description of what you did"

# Push to remote repository
git push origin wip
```

---

## Checking Status

### See What Changed
```bash
# View status of all files
git status

# View detailed changes in files
git diff

# View changes that are staged
git diff --staged

# View commit history
git log --oneline
```

### See Which Branch You're On
```bash
# List all branches (* shows current)
git branch

# Show current branch only
git branch --show-current
```

---

## Making Changes

### Stage Files for Commit
```bash
# Add all changed files
git add .

# Add specific file
git add path/to/file.go

# Add specific folder
git add models/

# Add files matching pattern
git add *.go
```

### Commit Changes
```bash
# Simple commit
git commit -m "Add pool assignment matching logic"

# Multi-line commit message
git commit -m "Add pool assignment feature

- Implement matching algorithm
- Add data structures
- Update documentation"

# Commit with our standard format
git commit -m "$(cat <<'EOF'
Your commit message here

🤖 Generated with Claude Code https://claude.com/claude-code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

### Amend Last Commit (Before Pushing)
```bash
# Fix the last commit (add forgotten files or fix message)
git add forgotten-file.go
git commit --amend

# Just change the commit message
git commit --amend -m "Better commit message"
```

**⚠️ WARNING:** Only amend commits that haven't been pushed yet!

---

## Branching

### Create New Branch
```bash
# Create and switch to new branch
git checkout -b feature/pool-assignments

# Just create branch (don't switch)
git branch feature/pool-assignments
```

### Switch Branches
```bash
# Switch to existing branch
git checkout wip

# Switch to main
git checkout main
```

### Merge Branches
```bash
# Switch to target branch first
git checkout main

# Merge feature branch into main
git merge feature/pool-assignments

# Push merged changes
git push origin main
```

### Delete Branch
```bash
# Delete local branch (after merging)
git branch -d feature/pool-assignments

# Force delete (if not merged)
git branch -D feature/pool-assignments

# Delete remote branch
git push origin --delete feature/pool-assignments
```

---

## Syncing with Remote

### Push Changes
```bash
# Push current branch to remote
git push

# Push specific branch
git push origin wip

# Push new branch and set upstream
git push -u origin feature/new-feature

# Force push (DANGEROUS - use with caution)
git push --force origin wip
```

### Pull Changes
```bash
# Pull and merge changes
git pull origin wip

# Pull and rebase instead of merge
git pull --rebase origin wip
```

### View Remote Info
```bash
# List remote repositories
git remote -v

# Show details about origin
git remote show origin
```

---

## Undoing Changes

### Discard Uncommitted Changes
```bash
# Discard changes in specific file
git restore path/to/file.go

# Discard all uncommitted changes
git restore .

# Old way (still works)
git checkout -- path/to/file.go
```

### Unstage Files (Keep Changes)
```bash
# Unstage specific file
git restore --staged path/to/file.go

# Unstage all files
git restore --staged .

# Old way (still works)
git reset HEAD path/to/file.go
```

### Undo Last Commit (Keep Changes)
```bash
# Undo commit but keep changes staged
git reset --soft HEAD~1

# Undo commit and unstage changes
git reset HEAD~1

# Undo last 2 commits
git reset HEAD~2
```

### Completely Remove Last Commit
```bash
# DANGEROUS - permanently delete last commit
git reset --hard HEAD~1
```

**⚠️ WARNING:** `--hard` flag permanently deletes changes!

### Revert a Pushed Commit
```bash
# Create new commit that undoes changes
git revert HEAD

# Revert specific commit by hash
git revert abc1234
```

---

## Useful Tips

### .gitignore Not Working?
```bash
# If files are already tracked, remove them from git cache
git rm -r --cached .
git add .
git commit -m "Update gitignore"
```

### View File from Another Branch
```bash
# View file without switching branches
git show main:path/to/file.go
```

### Stash Changes Temporarily
```bash
# Save current changes without committing
git stash

# See list of stashes
git stash list

# Apply most recent stash
git stash pop

# Apply specific stash
git stash apply stash@{0}

# Clear all stashes
git stash clear
```

### Search Commit History
```bash
# Search commits by message
git log --grep="pool assignment"

# See commits by specific author
git log --author="YourName"

# See commits affecting specific file
git log path/to/file.go

# See changes in each commit
git log -p
```

### Compare Branches
```bash
# See commits in wip not in main
git log main..wip

# See file differences between branches
git diff main..wip

# See just file names that differ
git diff --name-only main..wip
```

### Clean Untracked Files
```bash
# Show what would be deleted (dry run)
git clean -n

# Delete untracked files
git clean -f

# Delete untracked files and directories
git clean -fd
```

---

## Common Scenarios

### Scenario 1: Start New Feature
```bash
git checkout wip
git pull origin wip
git checkout -b feature/frequency-nomination
# ... make changes ...
git add .
git commit -m "Add frequency nomination feature"
git push -u origin feature/frequency-nomination
```

### Scenario 2: Fix Merge Conflict
```bash
git pull origin wip
# CONFLICT message appears

# Open conflicted files and resolve
# Look for markers: <<<<<<< HEAD, =======, >>>>>>>

# After fixing conflicts
git add .
git commit -m "Resolve merge conflicts"
git push
```

### Scenario 3: Made Changes on Wrong Branch
```bash
# You're on main but should be on feature branch
git stash                          # Save changes
git checkout feature-branch        # Switch to correct branch
git stash pop                      # Apply changes
git add .
git commit -m "Your changes"
```

### Scenario 4: Need to Switch Branches Mid-Work
```bash
# Save current work
git stash save "Work in progress on pool matching"

# Switch branches and do urgent fix
git checkout main
# ... make urgent fix ...
git add .
git commit -m "Urgent fix"
git push

# Return to your work
git checkout feature-branch
git stash pop
```

---

## Project-Specific Notes

### Repository Structure
```
SFAF Plotter/
├── GoPlotter/          ← This is your git repository
│   ├── .git/
│   ├── .gitignore
│   ├── main.go
│   └── ...
```

### Main Branches
- **main** - Production-ready code
- **wip** - Work in progress / development branch

### Ignored Files (Won't Be Committed)
Per `.gitignore`:
- `.env` files (sensitive)
- `*.exe`, `*.dll` (build artifacts)
- `.backup/`, `Backup/` (old code)
- AWS deployment files (until ready)
- `*.pem`, `*.pdf`, `*.xlsm` (personal/sensitive)
- `.claude/` (AI workspace)

### Before Committing
1. ✅ Check `git status` to see what will be committed
2. ✅ Review changes with `git diff`
3. ✅ Ensure no sensitive data (passwords, keys)
4. ✅ Write clear commit message
5. ✅ Test your code still works

---

## Getting Help

### Git Built-in Help
```bash
# General help
git help

# Help for specific command
git help commit
git help branch
git help merge
```

### Quick Command Reference
```bash
# See all git commands
git --help -a
```

---

## Troubleshooting

### "Dubious Ownership" Error
```bash
# Add directory to safe list
git config --global --add safe.directory '//10.0.30.5/data/DriveBackup/Nerdery/SFAF Plotter'
```

### Line Ending Warnings (LF/CRLF)
```bash
# Configure git to handle line endings (Windows)
git config --global core.autocrlf true

# Or set per repository
git config core.autocrlf true
```

### Can't Push - Rejected
```bash
# Pull latest changes first
git pull origin wip

# If conflicts, resolve them
# Then push again
git push origin wip
```

### Accidentally Committed Sensitive File
```bash
# Remove from git but keep locally
git rm --cached sensitive-file.txt
echo "sensitive-file.txt" >> .gitignore
git add .gitignore
git commit -m "Remove sensitive file from git"

# If already pushed, notify team and rotate credentials
```

---

## Aliases (Make Git Easier)

Add these to your `.gitconfig` file:

```bash
# Create aliases
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage 'restore --staged'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual 'log --oneline --graph --all'

# Now use shortcuts
git st           # instead of git status
git co main      # instead of git checkout main
git br           # instead of git branch
git unstage .    # instead of git restore --staged .
git visual       # pretty commit graph
```

---

## Resources

- Official Git Documentation: https://git-scm.com/doc
- GitHub Git Cheat Sheet: https://training.github.com/downloads/github-git-cheat-sheet/
- Interactive Git Tutorial: https://learngitbranching.js.org/
- Visual Git Reference: https://marklodato.github.io/visual-git-guide/index-en.html

---

## Remember

- 💡 Commit early, commit often
- 💡 Pull before you push
- 💡 Write clear commit messages
- 💡 Don't commit sensitive data
- 💡 Create branches for features
- 💡 Review changes before committing
- 💡 When in doubt, `git status`
