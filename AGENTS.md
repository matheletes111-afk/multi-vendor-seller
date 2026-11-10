# Agent Guidelines & Workflow Rules

## Execution Speed & Tool Policy (Strict)
- **Always use native file tools**: Always use `read_file`, `edit_file`, and `write_file` for inspecting, modifying, and creating code.
- **No file-editing scratch scripts**: Never create scratch scripts (e.g. `.mjs`, `.js`, `.py`) or run inline `node -e` commands for inspecting or editing files.
- **Fast Execution**: Keep all executions fast, direct, and non-blocking. Avoid unnecessary terminal commands that interrupt the user with permission prompts.
- **Targeted Verification**: Keep verification lean and targeted so that tasks and cross-checks complete within 10–15 minutes.

