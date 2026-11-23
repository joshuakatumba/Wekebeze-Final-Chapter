#!/usr/bin/env bash
# Automated safe GitHub commit & push script for Wekebeze
# Guarantees NO .env files and NO .md files (except root README.md) are ever pushed.
#
# Usage:
#   ./auto-push.sh "Your commit message"
#   ./auto-push.sh                        # Uses automatic timestamped commit message
#   ./auto-push.sh --branch main "msg"    # Push to a specific branch

set -euo pipefail

BRANCH=""
COMMIT_MSG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--branch)
      BRANCH="$2"
      shift 2
      ;;
    *)
      COMMIT_MSG="${COMMIT_MSG:+$COMMIT_MSG }$1"
      shift
      ;;
  esac
done

# Ensure we are inside a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: Not inside a git repository. Initialize first with:"
  echo "  git init && git remote add origin <your-github-repo-url>"
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Verify remote 'origin' exists
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Error: Git remote 'origin' is not configured."
  echo "Run: git remote add origin https://github.com/<user>/<repo>.git"
  exit 1
fi

CURRENT_BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
if [[ "$CURRENT_BRANCH" == "HEAD" ]]; then
  CURRENT_BRANCH="main"
fi

# Remove any previously tracked forbidden files from index (without deleting local files)
FORBIDDEN_TRACKED=$(git ls-files | grep -E '(^|/)\.env(\.|$)|\.env$|(\.md|\.MD)$' | grep -v '^README\.md$' || true)
if [[ -n "$FORBIDDEN_TRACKED" ]]; then
  echo "Removing previously tracked forbidden files from git index:"
  echo "$FORBIDDEN_TRACKED"
  while IFS= read -r f; do
    [[ -n "$f" ]] && git rm --cached --quiet "$f" || true
  done <<< "$FORBIDDEN_TRACKED"
fi

# Stage all allowed changes (respects .gitignore)
git add -A

# Hard safety gate: verify NO .env files and NO .md files (except root README.md) are staged
STAGED_FILES=$(git diff --cached --name-only)
if [[ -z "$STAGED_FILES" ]]; then
  echo "No changes to commit on branch '$CURRENT_BRANCH'."
  exit 0
fi

BAD_ENV=$(echo "$STAGED_FILES" | grep -E '(^|/)\.env(\.|$)|\.env$' || true)
BAD_MD=$(echo "$STAGED_FILES" | grep -E '\.(md|MD)$' | grep -v '^README\.md$' || true)

if [[ -n "$BAD_ENV" || -n "$BAD_MD" ]]; then
  echo "BLOCKED: Forbidden files detected in staged changes!"
  [[ -n "$BAD_ENV" ]] && echo "  Env files:" && echo "$BAD_ENV"
  [[ -n "$BAD_MD" ]] && echo "  Markdown files:" && echo "$BAD_MD"
  git reset --quiet
  exit 1
fi

if [[ -z "$COMMIT_MSG" ]]; then
  COMMIT_MSG="chore: auto-sync $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo "Staging verified clean. Committing to '$CURRENT_BRANCH'..."
git commit -m "$COMMIT_MSG"

echo "Pushing to origin/$CURRENT_BRANCH..."
git push -u origin "$CURRENT_BRANCH"
echo "Done! Pushed safely to GitHub (origin/$CURRENT_BRANCH)."
