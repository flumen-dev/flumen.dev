#!/bin/sh
# Skip Preview builds unless PR has label "preview"
if [ "$VERCEL_ENV" = "preview" ]; then
  # No GitHub context (e.g., manual deploy)
  if [ -z "$VERCEL_GIT_PULL_REQUEST_ID" ]; then
    exit 0
  fi

  # Require PR label "preview"
  LABELS_JSON=$(curl -fsS --max-time 5 --retry 2 --retry-delay 1 \
    -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG/issues/$VERCEL_GIT_PULL_REQUEST_ID/labels") \
    || { echo "Failed to fetch PR labels from GitHub; defaulting to build." >&2; exit 1; }
  LABELS=$(printf '%s' "$LABELS_JSON" | grep -o '"name": *"[^"]*"' | cut -d'"' -f4)

  echo "$LABELS" | grep -q "^preview$"
  exit $?
fi

# Non-preview builds run as usual
exit 1