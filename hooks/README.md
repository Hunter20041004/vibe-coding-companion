# Hook Setup Examples

These examples connect Claude Code or Codex hook events to the local companion
event endpoint.

Start the prototype first:

```bash
npm run dev:all
```

Then install one provider into this project:

```bash
npm run setup:hooks -- claude-code
npm run setup:hooks -- codex
```

The setup command writes:

- Claude Code: `.claude/settings.local.json`
- Codex: `.codex/hooks.json`

Generated local hook configs are ignored by git. If a destination file already
exists, setup stops instead of overwriting it.

After installing:

- In Claude Code, run `/hooks` and confirm the configured hooks.
- In Codex, run `/hooks` and trust the project-local hooks if prompted.

The hook command reads the tool payload from stdin and posts a normalized event
to `EVENT_URL` or `http://127.0.0.1:5174/events`.

To capture raw payloads during a live session, start the agent with:

```bash
HOOK_CAPTURE_FILE="$PWD/artifacts/hook-payloads/live.jsonl"
```

Any hook routed through `scripts/emit-hook.js` appends the provider, raw payload,
and normalized event to that JSONL file.

For the guided flow, use:

```bash
npm run live:codex
npm run live:claude
```

These commands ensure the local hook config exists, set `HOOK_CAPTURE_FILE`, and
launch the selected agent. Use `npm run live:codex -- --print` to inspect the
launch plan without starting Codex.

If `codex` is not on your shell `PATH`, use:

```bash
CODEX_BIN=/Applications/Codex.app/Contents/Resources/codex npm run live:codex
```
