# ordify.me — Domain Model (locked 2026-04-29)

## ER diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌──────────┐                                                      │
│   │  CLIENT  │  natural person — the one who signed/agreed          │
│   └────┬─────┘                                                      │
│        │ 1                                                          │
│        │                                                            │
│        │ N    ┌─────────────┐                                       │
│        ├─────→│   COMPANY   │  legal entity owned by client         │
│        │      │             │  (US LLC, Estonia OU, Cyprus Ltd…)    │
│        │      └──────┬──────┘                                       │
│        │             │ N                                            │
│        │             │                                               │
│        │ N           │ N    ┌─────────────┐                         │
│        ├─────────────┴─────→│   MATTER    │  one piece of work      │
│        │                    │             │  (incorp · NDA · etc)   │
│        │                    └──────┬──────┘                         │
│        │                           │ 1                              │
│        │                           │                                │
│        │                           │ N    ┌─────────────┐           │
│        │                           ├─────→│    TASK     │           │
│        │                           │      └──────┬──────┘           │
│        │                           │             │                  │
│        │                           │             │ N                │
│        │                           │             │                  │
│        │                           │             │     ┌──────────┐ │
│        │                           │             ├────→│ TIMELOG  │ │
│        │                           │             │     └─────┬────┘ │
│        │                           │             │           │ N    │
│        │                           │             │           │      │
│        │                           │ N           │           │      │
│        │                           │     ┌──────────┐        │      │
│        │                           ├────→│ MEETING  │←───────┘      │
│        │                           │     └──────────┘ (a meeting    │
│        │                           │                   may auto-    │
│        │                           │                   create a     │
│        │                           │                   timelog)     │
│        │                           │                               │
│        │                           │      ┌──────────┐              │
│        │                           └─────→│ INVOICE  │← logIds[]    │
│        │                                  └──────────┘              │
│        │                                                            │
│        │ N                                                          │
│        ├─────→ NOTES (free-form per-client memos)                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Entities

### CLIENT
The person who signed the engagement letter / agreed to retainer. Always a natural person, never a company.

```
{
  id, name, email, telegram, notes,
  industry: 'IT' | 'Crypto' | 'B2B-Trade' | 'Other',
  primary_currency: 'EUR' | 'USD' | …,
  created, updated
}
```

### COMPANY
A legal entity owned/controlled by a client. Many companies per client. Used for incorporation, jurisdiction filings, and to attribute matters.

```
{
  id, clientId, name,
  type: 'LLC' | 'AG' | 'OU' | 'Ltd' | 'GmbH' | 'BV' | …,
  jurisdiction: 'US-DE' | 'EE' | 'CY' | 'CH-ZG' | …,
  reg_number?, vat_number?, vat_rate?,
  incorporated_at?,
  status: 'active' | 'dissolving' | 'dissolved',
  notes,
  created, updated
}
```

### MATTER
One concrete piece of work for a client. Has a billing mode. Optionally involves one or more of the client's companies (many-to-many via `companyIds[]`).

```
{
  id, clientId,
  companyIds: string[],          // 0..N — usually 1, sometimes more

  name,                          // "Incorporate Acme US LLC"
  description?,
  industry: inherits from client by default, can override,

  status: 'active' | 'on_hold' | 'completed',

  billing: {
    mode: 'subscription' | 'fixed' | 'hourly',

    // when mode === 'subscription':
    period?: 'monthly' | 'quarterly' | 'annual',
    period_fee?: number,         // €1500/mo
    hours_included?: number,     // 10h/mo, optional
    overage_rate?: number,       // €120/h beyond included
    auto_invoice_on_period_end?: boolean,

    // when mode === 'fixed':
    fixed_amount?: number,       // €2400 total
    deadline?: ISO,              // hard delivery date
    milestones?: { name, due, amount, status: 'pending' | 'done' }[],

    // when mode === 'hourly':
    hourly_rate?: number,        // €150/h
  },

  jurisdiction?, deadline?,
  vat_pct?: number,              // overrides client default
  currency?: 'EUR' | …,

  created, updated
}
```

### TASK
A specific actionable item under a matter. May have subtasks, dependencies, recurrence.

```
{
  id, matterId, clientId,        // matterId required; clientId = matter's client
  title, notes,
  priority: 'urgent' | 'high' | 'medium' | 'low',
  status:   'todo'   | 'in_progress' | 'done',
  deadline?: ISO,
  tags: tagId[],
  parent_id?: taskId,            // subtask
  depends_on: taskId[],          // blockers
  recurrence?: { freq, interval, days?, until? },
  hours_logged: number,          // rolled up from timelogs
  created, updated
}
```

### MEETING
First-class entity (NOT a sub-type of task). Synced two-way with Google Calendar / iCloud in Phase 1.

```
{
  id,
  external_id?,                  // google event id / icloud uid
  external_source?: 'google' | 'icloud',

  matterId?, clientId?,          // optional — meeting may be matter-less
  title, description?,
  starts_at: ISO, ends_at: ISO,
  location?, video_url?,
  attendees: { name, email }[],

  pre_task_minutes?: number,     // auto-create "prep" task X min before
  auto_log_minutes?: boolean,    // auto-log meeting duration as timelog after end

  created, updated
}
```

### TIMELOG
A unit of recorded time. Either created via timer (start/stop), manually, or auto-from-meeting.

```
{
  id, taskId, matterId,          // matterId for fast invoice rollup
  date: ISO,
  hours: number,
  description?,
  source: 'timer' | 'manual' | 'meeting' | 'quick-call',
  meetingId?,                    // if source === 'meeting'
  billable: boolean,             // default true
  invoiceId?,                    // locked once invoiced
  created
}
```

### INVOICE
Bundles charges for one client across one billing period. Mixes line types — subscription period fees + delivered fixed-price milestones + billable-hour rollups.

```
{
  id, clientId,
  number,                        // INV-2026-0042
  status: 'draft' | 'sent' | 'paid',
  issued_at: ISO, due_at: ISO,
  sent_at?, paid_at?,
  currency, vat_pct,

  lines: InvoiceLine[],          // see below

  from: { name, address, vat_id, email }, // snapshotted
  bill_to: { name, address, vat_id, email },
  subtotal, vat_amount, total,
  notes?, footer?
}
```

### InvoiceLine (3 types)
```
type: 'subscription'
  matterId, period_start, period_end,
  description: "April retainer · Acme",
  amount: number

type: 'fixed_milestone'
  matterId, milestoneId,
  description: "US LLC delivered 14.05",
  amount: number

type: 'hourly_bundle'
  matterId, logIds: timelogId[],
  description: "April hours @ €150",
  hours, rate, amount
```

When `INVOICE.status` becomes `draft`, all referenced `logIds` are locked. When invoice is deleted, they unlock.

### TAG
Free-form tags attached to tasks/matters. Used for cross-cutting filters (e.g., "compliance", "EU", "rush").

```
{ id, name, color, system: boolean }
```

`system: true` for industry tags `IT / Crypto / B2B-Trade` — they auto-attach by inheriting from client.industry.

### NOTE
Unstructured per-client notes (history, preferences, key contacts, etc).

```
{ id, clientId, content, created, updated }
```

## Cardinality summary

```
Client     1 ── N  Company        client owns N companies
Client     1 ── N  Matter         client has N matters
Client     1 ── N  Note           free-form
Matter     N ── N  Company        many-to-many (default 1:1)
Matter     1 ── N  Task
Matter     1 ── N  Meeting        meeting may also be matter-less
Matter     1 ── N  Invoice        (an invoice may also span matters of one client)
Task       1 ── N  Timelog
Task       N ── N  Tag
Meeting    1 ── 1  Timelog?       optional, auto-log
Invoice    1 ── N  InvoiceLine
```

## Storage shape (localStorage)

```
ordify-data = {
  clients:   Client[],
  companies: Company[],
  matters:   Matter[],
  tasks:     Task[],
  meetings:  Meeting[],
  timeLogs:  Timelog[],
  invoices:  Invoice[],
  tags:      Tag[],
  notes:     Note[],
  settings:  { theme, lang, model, apiKey?, encryption?, calendarSync? }
}
```

Encryption (Phase 10) wraps the entire blob; Sheets sync (Phase 10) flattens each array to a sheet tab.

---

**Status:** locked. Next: §④ — revise INVENTORY.md and §⑤ — revise FLOWS.md to match this model (subscription/fixed/hourly billing modes, meetings as first-class, log-call quick pattern, multi-line invoices).
