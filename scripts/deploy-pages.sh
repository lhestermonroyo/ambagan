#!/usr/bin/env bash
# deploy-pages.sh
# Commits any pending changes in docs/ and pushes to GitHub Pages (main branch, /docs folder).

set -euo pipefail

BRANCH="main"
REMOTE="origin"
REPO_SLUG="lhestermonroyo/ambagan"
PAGES_URL="https://lhestermonroyo.github.io/ambagan"

# ── 1. Make sure we're on main ──────────────────────────────────────────────
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "❌ You're on branch '$current_branch'. Switch to '$BRANCH' first."
  exit 1
fi

# ── 2. Stage & commit docs/ if there are changes ────────────────────────────
if ! git diff --quiet HEAD -- docs/ || git ls-files --others --exclude-standard -- docs/ | grep -q .; then
  echo "📝 Staging changes in docs/ ..."
  git add docs/
  git commit -m "docs: update GitHub Pages site"
  echo "✅ Committed docs/ changes."
else
  echo "ℹ️  No uncommitted changes in docs/ — nothing to commit."
fi

# ── 3. Push to remote ───────────────────────────────────────────────────────
echo "🚀 Pushing '$BRANCH' to $REMOTE ..."
git push "$REMOTE" "$BRANCH"
echo "✅ Push complete."

# ── 4. Check if GitHub Pages is already configured via API ──────────────────
echo ""
echo "🔍 Checking GitHub Pages configuration ..."

pages_response=$(gh api "repos/$REPO_SLUG/pages" 2>/dev/null || echo "NOT_CONFIGURED")

if echo "$pages_response" | grep -q "NOT_CONFIGURED"; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ⚠️  GitHub Pages is not yet enabled for this repo."
  echo "  Enable it with:"
  echo ""
  echo "    gh api repos/$REPO_SLUG/pages \\"
  echo "      --method POST \\"
  echo "      --field source[branch]=$BRANCH \\"
  echo "      --field source[path]=/docs"
  echo ""
  echo "  Or go to:"
  echo "    https://github.com/$REPO_SLUG/settings/pages"
  echo "    → Source: Deploy from a branch"
  echo "    → Branch: $BRANCH  /docs"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  read -r -p "Enable GitHub Pages now via gh CLI? [y/N] " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    gh api "repos/$REPO_SLUG/pages" \
      --method POST \
      --field "source[branch]=$BRANCH" \
      --field "source[path]=/docs"
    echo "✅ GitHub Pages enabled."
    echo ""
    echo "⏳ It usually takes 1–2 minutes for the site to go live."
  fi
else
  echo "✅ GitHub Pages is already configured."
fi

# ── 5. Done ─────────────────────────────────────────────────────────────────
echo ""
echo "🌐 Site URL:         $PAGES_URL"
echo "🔒 Privacy Policy:  $PAGES_URL/privacy-policy.html"
echo ""
echo "Paste the Privacy Policy URL into App Store Connect → App Privacy → Privacy Policy URL."
