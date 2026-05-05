# ordify · migration guide

How to get your data **out** of ordify and into other tools — or just keep it
as a backup that survives if ordify ever stops working.

## What you have

- **Self-hosted localStorage app** — no backend, all data on your device
- **Multiple export paths** — JSON, CSV, plain Google Sheets
- **Open source code** — vanilla HTML / CSS / JS, no compilation, no obfuscation

## Backups (do these regularly)

### Monthly: JSON snapshot
1. **Settings → Data → ⤓ Export JSON**
2. File `ordify-export-YYYY-MM-DD.json` saves to Downloads
3. Move it to Dropbox / iCloud / Drive — your offline copy
4. To restore: same screen → ⤒ Import JSON

### Live: Google Sheets sync (B-mode plain rows)
1. **Settings → Integrations → Connect Sheets** (one-time OAuth)
2. **↑ Push** — overwrites 5 tabs in your private Sheet with current state
3. Open the Sheet to view / edit data directly in Google
4. **↓ Pull** — replaces local data with Sheet contents

The Sheet lives in **your** Drive. ordify doesn't have a server — only your
browser's localStorage and your Sheet are involved.

### Per-entity CSV
**Settings → Data → ⤓ Export CSV** downloads 5 files:
- `clients-YYYY-MM-DD.csv`
- `matters-YYYY-MM-DD.csv`
- `tasks-YYYY-MM-DD.csv`
- `timelogs-YYYY-MM-DD.csv`
- `invoices-YYYY-MM-DD.csv`

CSVs include both ID and human-readable joined columns (`clientName`,
`matterName`, `taskTitle`) — open in Excel / Numbers / Google Sheets directly.

## Migration to another tool

### → Notion / Airtable / Coda
1. Export CSV (above)
2. Create a database with matching columns
3. Import each CSV as a separate table
4. Re-create relations using the joined-name columns

### → Clio / PracticePanther / MyCase
These are commercial legal practice managers. They typically import CSV with
predefined column mapping. To prepare:
1. Export CSV
2. Re-arrange columns to match the target's import template
3. Map ordify's `billing_mode` → Clio's `Matter Type` etc.

There's no automated converter — each commercial tool has its own schema.
Budget half a day for a one-time migration.

### → Excel / Google Sheets (just for reading)
- Either import the CSV files directly
- Or use the Sheets B-mode sync (Settings → Push) — gives you a live workbook

### → Plain markdown / personal wiki
- Open the JSON in any editor
- Each `tasks[]` entry, `matters[]` entry, `clients[]` entry has all fields
- Write a quick script (Python, Node, Bash) to format as markdown

Example Python:
```python
import json
with open('ordify-export-2026-05-05.json') as f:
    d = json.load(f)
for c in d['clients']:
    print(f"# {c['name']}")
    matters = [m for m in d['matters'] if m['clientId'] == c['id']]
    for m in matters:
        print(f"## {m['name']}")
        tasks = [t for t in d['tasks'] if t['matterId'] == m['id']]
        for t in tasks:
            print(f"- {t['title']} ({t['status']}, due {t.get('deadline','')})")
```

## Self-hosting ordify after end-of-life

If ordify development stops or you want full ownership:

1. **Copy the entire `taskmanager-v2/` folder** somewhere you control
2. Run `python -m http.server 8767` in that folder
3. Open `http://localhost:8767/` in any browser
4. Your data continues to live in localStorage of that browser

To deploy on a server:
- Upload the folder to any static host (Netlify, Vercel, Cloudflare Pages,
  GitHub Pages, your own nginx)
- Update Google OAuth Client ID `Authorised JavaScript origins` to include
  the new domain

## Data shape reference

**Clients** — `id, name, email, industry, primary_currency, notes, created, updated, deletedAt`

**Matters** — `id, clientId, name, status, billing.{mode, period_fee, hours_included, overage_rate, fixed_amount, hourly_rate, deadline}, excludeFromAi, notes, completed_at, created, updated, deletedAt`

**Tasks** — `id, clientId, matterId, title, deadline, priority, status, tags[], notes, recurrence.{freq, interval}, attachmentIds[], created, updated, deletedAt`

**TimeLogs** — `id, taskId, matterId, date, hours, billable, source, note, invoiceId`

**Invoices** — `id, clientId, number, status, issued_at, due_at, sent_at, paid_at, currency, vat_pct, lines[{type, matterId, description, hours, rate, amount}], subtotal, vat_amount, total`

**Attachments** (metadata only — blobs in IndexedDB) — `id, name, mime, size, ownerType, ownerId, transcript?, transcript_summary?, created`

## License

Static client-side code — copy, fork, modify freely.
