#!/usr/bin/env bash
# PreToolUse: deny any tool access to .env files (read / write / delete / shell).
# .env.example, .env.sample and .env.template stay allowed — they hold placeholders only.
set -uo pipefail

input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // ""')

if [ "$tool" = "Bash" ]; then
  target=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
else
  target=$(printf '%s' "$input" | jq -r '
    [.tool_input.file_path?, .tool_input.path?, .tool_input.notebook_path?]
    | map(select(type == "string")) | join(" ")')
fi

[ -z "$target" ] && exit 0

# Remove things that merely mention env but leak nothing, so they don't trip the match:
# placeholder templates, and code references like process.env.FOO / import.meta.env.FOO.
scrubbed=$(printf '%s' "$target" | sed -E \
  -e 's/\.env\.(example|sample|template)//g' \
  -e 's/(process|import\.meta)\\?\.env//g')

if printf '%s' "$scrubbed" | grep -qE '\.env([^A-Za-z0-9_-]|$)'; then
  jq -n --arg tool "$tool" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("\($tool) on a .env file is blocked by a project hook. These files hold real secrets and must not be read, edited, or deleted. Use .env.example for placeholder keys, and ask the user to change .env.local themselves.")
    }
  }'
fi

exit 0
