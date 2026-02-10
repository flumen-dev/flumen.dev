#!/bin/sh
# Skip Preview builds unless PR has label "preview"
if [ "$VERCEL_ENV" = "preview" ]; then
  # No GitHub context (e.g., manual deploy)
  if [ -z "$VERCEL_GIT_PULL_REQUEST_ID" ]; then
    exit 0
  fi

  # Require PR label "preview"
  LABELS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG/issues/$VERCEL_GIT_PULL_REQUEST_ID/labels" \
    | grep -o '"name": *"[^"]*"' | cut -d'"' -f4)

  if echo "$LABELS" | grep -q "^preview$"; then
    # Label present: allow build to proceed
    exit 1
  fi
  # Label absent: skip preview build
  exit 0
fi

# Non-preview builds run as usual
exit 1