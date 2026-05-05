# ordify

A private, single-user practice manager for an international lawyer.
Spreadsheet-first, AI-assisted capture, time tracking, editorial invoices —
all client-side, your data stays with you.

## Quick start

1. **Serve the folder** locally:
   ```bash
   python -m http.server 8767
   ```
   Then open <http://localhost:8767/>.

2. **Or deploy as static** to Netlify / Vercel / Cloudflare Pages / GitHub
   Pages — the whole app is plain HTML/CSS/JS, no build step.

## What's inside

- **Today** — fire band, morning/afternoon, running timer, AI inbox-scan
- **Tasks** — sortable table, list, board, by-matter / by-client groups
- **Calendar** — Day / Week / Month, Google Calendar sync
- **Time** — by-task / by-matter rollups, manual + auto logs
- **Invoices** — editorial document, logo + payment block, print as PDF
- **Reports** — Day / Week / Month / Quarter / Year stats
- **Audit log** — append-only change history with field-level diffs
- **Trash** — 30-day soft-delete recovery
- **Settings** — profile, API keys, integrations, snapshots, data ops

## Integrations (optional · BYOK)

- **Anthropic** for ⌘K AI parser, ?ask queries, email-to-task extraction
- **OpenAI Whisper** for transcribing voice/meeting recordings
- **Google Calendar** for two-way meeting sync
- **Gmail** for AI extraction of action items from inbox
- **Google Sheets** for plain-rows backup (visible/editable in Google Sheets)

All keys stay in your browser. The app has no backend.

## Data

Stored in `localStorage` + `IndexedDB`:
- localStorage: `ordify-data` (clients, matters, tasks, timelogs, invoices,
  settings, audit)
- IndexedDB: `ordify-files` (attachments), `ordify-rec-chunks` (in-flight
  recordings), `ordify-snapshots` (7-day daily backups)

Export anytime via Settings → Data:
- **⤓ Export JSON** — full state as JSON
- **⤓ Export CSV** — 5 CSV files (per entity)

See [`MIGRATION.md`](MIGRATION.md) for moving data to other tools.

## Hotkeys

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Fullscreen capture (AI parse) |
| `j` / `k` | Cursor down / up through tasks |
| `x` | Mark task done / undone |
| `t` | Start / stop timer on cursor task |
| `e` | Edit cursor task |
| `g` then `g/i/c/t/v/r/w/s/a` | Jump to Today / Inbox / Calendar / Time / Invoices / Reports / Digest / Settings / Audit |
| `?` | Show keyboard help |
| `#` | Trash |

## Privacy

- No telemetry, no remote backend
- AI calls go directly from your browser to Anthropic with **your** API key
- Per-matter `excludeFromAi` flag keeps privileged work out of AI context
- Encrypted Sheets backup (mode A) available via WebCrypto + your passphrase

## License

MIT-style — copy, fork, modify freely.
