#!/usr/bin/env bash
#
# Deploy Supabase Edge Functions for a given environment.
#
# All functions share ONE Supabase project; the environment is encoded in the
# function NAME (see the dev/prod schema split):
#   prod → <name>       e.g. scan-receipt      → shared handler targets `public`
#   dev  → <name>-dev   e.g. scan-receipt-dev  → shared handler targets `dev`
# Both are backed by the same code in supabase/functions/_shared/*, so this
# script just chooses which deployments to push.
#
# Usage:
#   scripts/deploy-functions.sh dev                 # all *-dev functions
#   scripts/deploy-functions.sh prod                # all prod functions (confirms first)
#   scripts/deploy-functions.sh all                 # both
#   scripts/deploy-functions.sh dev scan-receipt    # one function (suffix auto-added)
#   scripts/deploy-functions.sh prod send-push -y   # skip the prod confirmation
#   scripts/deploy-functions.sh all --dry-run       # print the plan, deploy nothing
#
# Flags:
#   -y, --yes       Skip the confirmation prompt for prod deploys.
#   -n, --dry-run   Print what would deploy and exit without deploying.

# Note: no `set -u` — macOS ships bash 3.2, where expanding an empty array
# under `set -u` errors ("unbound variable"). pipefail is enough here.
set -o pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTIONS_DIR="$PROJECT_ROOT/supabase/functions"
SUPABASE=(npx supabase)

# ---- parse args -------------------------------------------------------------
ENV="${1:-}"
TARGET=""
ASSUME_YES=false
DRY_RUN=false
shift || true
for arg in "$@"; do
  case "$arg" in
    -y|--yes)     ASSUME_YES=true ;;
    -n|--dry-run) DRY_RUN=true ;;
    -*) echo "Unknown flag: $arg" >&2; exit 1 ;;
    *)  TARGET="$arg" ;;
  esac
done

if [[ "$ENV" != "dev" && "$ENV" != "prod" && "$ENV" != "all" ]]; then
  echo "Usage: scripts/deploy-functions.sh <dev|prod|all> [function] [-y]" >&2
  exit 1
fi

# ---- discover deployable function directories -------------------------------
# A directory is a deployable function iff it contains index.ts and its name
# does not start with '_' (e.g. _shared) or '.' (e.g. .temp).
all_functions() {
  find "$FUNCTIONS_DIR" -maxdepth 2 -name index.ts -print0 \
    | while IFS= read -r -d '' f; do basename "$(dirname "$f")"; done \
    | grep -Ev '^[._]' \
    | sort
}

is_dev()  { [[ "$1" == *-dev ]]; }

# Build the deploy list based on env (+ optional single target).
build_list() {
  local names=() name
  while IFS= read -r name; do names+=("$name"); done < <(all_functions)

  local out=()
  for name in "${names[@]}"; do
    case "$ENV" in
      dev)  is_dev "$name"  && out+=("$name") ;;
      prod) is_dev "$name"  || out+=("$name") ;;
      all)  out+=("$name") ;;
    esac
  done

  # Narrow to a single function if one was named (normalize its suffix).
  if [[ -n "$TARGET" ]]; then
    local base="${TARGET%-dev}" want=()
    case "$ENV" in
      dev)  want=("${base}-dev") ;;
      prod) want=("$base") ;;
      all)  want=("$base" "${base}-dev") ;;
    esac
    local filtered=() w n
    for w in "${want[@]}"; do
      for n in "${out[@]}"; do [[ "$n" == "$w" ]] && filtered+=("$n"); done
    done
    out=("${filtered[@]}")
  fi

  printf '%s\n' "${out[@]}"
}

# (bash 3.2 has no `mapfile`, so read the list into an array manually)
DEPLOY=()
while IFS= read -r line; do
  [[ -n "$line" ]] && DEPLOY+=("$line")
done < <(build_list)

if [[ ${#DEPLOY[@]} -eq 0 ]]; then
  echo "No matching functions to deploy for env='$ENV'${TARGET:+ target='$TARGET'}." >&2
  exit 1
fi

# ---- confirm prod deploys ---------------------------------------------------
touches_prod=false
for name in "${DEPLOY[@]}"; do is_dev "$name" || touches_prod=true; done

echo "Will deploy (${ENV}):"
printf '  - %s\n' "${DEPLOY[@]}"

if $DRY_RUN; then
  echo
  echo "(dry run — nothing deployed)"
  exit 0
fi

if $touches_prod && ! $ASSUME_YES; then
  echo
  read -r -p "This deploys to PRODUCTION. Continue? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

# ---- deploy -----------------------------------------------------------------
cd "$PROJECT_ROOT"
failed=()
for name in "${DEPLOY[@]}"; do
  echo
  echo "==> deploying $name"
  if ! "${SUPABASE[@]}" functions deploy "$name"; then
    failed+=("$name")
  fi
done

echo
if [[ ${#failed[@]} -eq 0 ]]; then
  echo "✓ Deployed ${#DEPLOY[@]} function(s)."
else
  echo "✗ ${#failed[@]} failed: ${failed[*]}" >&2
  exit 1
fi
