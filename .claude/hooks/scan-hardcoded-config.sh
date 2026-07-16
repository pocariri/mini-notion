#!/usr/bin/env bash
# Stop: scan files changed in this working tree for hardcoded config/secret values.
# When something looks hardcoded, block the stop and hand the findings back to Claude
# so it can move the value into process.env and document the key in .env.example.
set -uo pipefail

input=$(cat)

# Already re-woken by this hook once — let the turn end so we can't loop.
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-}"
[ -n "$project_dir" ] || project_dir=$(printf '%s' "$input" | jq -r '.cwd // empty')
[ -n "$project_dir" ] || project_dir="$PWD"
cd "$project_dir" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

globs=('*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs')
files=$(
  {
    git diff --name-only HEAD -- "${globs[@]}"
    git ls-files --others --exclude-standard -- "${globs[@]}"
  } 2>/dev/null | sort -u
)
[ -z "$files" ] && exit 0

Q="[\"']"
patterns=(
  'sb_(publishable|secret)_[A-Za-z0-9_-]{8,}'
  'eyJhbGciOi[A-Za-z0-9._-]{10,}'
  'sk-[A-Za-z0-9]{20,}'
  'AKIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9]{20,}'
  'https://[a-z0-9-]{6,}\.supabase\.(co|in)'
  "(api[_-]?key|secret|token|passwd|password|client[_-]?secret|access[_-]?key|database[_-]?url)$Q?[[:space:]]*[:=][[:space:]]*$Q[^\"']{8,}$Q"
)
regex=$(IFS='|'; printf '%s' "${patterns[*]}")

hits=$(printf '%s\n' "$files" | while IFS= read -r f; do
  [ -f "$f" ] || continue
  grep -inE "$regex" -- "$f" 2>/dev/null | cut -c1-180 | sed "s|^|$f:|"
done | head -30)

[ -z "$hits" ] && exit 0

jq -n --arg hits "$hits" '{
  decision: "block",
  reason: ("A project hook scanned the files you changed and found values that look like hardcoded configuration or secrets:\n\n" + $hits + "\n\nTriage each hit before you stop:\n1. Real config/secret -> replace the literal with a process.env.<KEY> read, and add <KEY>=<placeholder> to .env.example. Never put the real value in .env.example.\n2. Test fixture, dummy data, or a genuinely public constant -> leave it alone.\nYou cannot read or edit .env.local; if a key needs a real value there, ask the user to set it. Report your triage to the user in one or two sentences, then stop.")
}'

exit 0
