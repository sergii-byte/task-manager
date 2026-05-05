# ordify.me — Vision (locked 2026-04-29)

## 1. User profile

Sergiy — **international lawyer based in Spain**, solo or with a small team.

**Industries served (very different from each other):**
- IT (classic services + product)
- Crypto
- B2B trade (aircraft engines)

**Recurring task types within those industries:**
- Corporate (incorporation, ongoing maintenance)
- Crypto licensing
- Compliance
- Contracts

**Revenue mix (in order of weight):**
1. **Subscription** — large monthly retainer per client (the bulk of income)
2. **Fixed-price services** — e.g. "incorporate a US LLC in 14 days for €X" — a project with a delivery deadline and a fixed amount, no hourly rate
3. **Billable hours** — some projects (minority of revenue)

**What must never be missed:**
- Procedural deadlines (court, registrar, legal hard cut-offs)
- Promised action deadlines (e.g. "company registered by 15.05")
- Client meetings (calendar)

**Constraints:**
- Multiple unrelated clients across very different industries — need clean isolation
- Spanish + Ukrainian + English working languages
- Confidentiality — encryption at rest, no third-party data ingest

## 2. Primary pain (the one we solve first)

**Capture & structuring.**

User receives 50+ fragments per day — emails, voice notes, calls, meeting transcripts. Each fragment carries a task / deadline / client-context implicitly. Today: structuring this by hand takes hours.

Everything else (time tracking, invoicing, calendar) is **second-tier**. We get capture right first; the rest is built around the structured data capture produces.

## 3. Product pitch

> AI-first task & matter manager for an international lawyer — turns 50 daily fragments into structured matters, never lets a procedural deadline slip, and (when needed) rolls billable time into a 30-second invoice.

## 4. Success metrics (3 months in)

- **Capture latency** ≤ 10 sec — from thought to a saved, structured task
- **Procedural miss rate = 0** — across all clients, no procedural deadline slips
- **+20% billable hours captured / month** — because logging is so fast, more billable work actually gets recorded (was leaking before)

## 5. Implications for the build (revisions from my earlier draft)

| Was | Now |
|---|---|
| Country: UA | **ES** |
| Revenue model: billable-hours-driven | **Subscription + fixed-price-driven; billable is minority** |
| Time tracker = central feature | **Tracker is secondary — only used for billable subset** |
| Invoices = roll up billable hours | **Invoices have 3 modes: subscription period · fixed-price milestone · billable-hours roll-up** |
| Calendar = task deadlines only | **Calendar = task deadlines + client meetings** (meetings are first-class entities) |
| Tags = colour palette | **Tags also encode client industry (IT / Crypto / B2B Trade) — used for filtering and visual identity** |
| "Project" entity | **"Matter" — and matters have a billing-mode field: `subscription` / `fixed` / `hourly`** |

## 6. What we're explicitly NOT building (yet)

- Multi-user / firm-wide collaboration
- Client portal
- Document management / file storage
- E-signature
- Court-form auto-fill
- Email integration (mail-to-task)

These can come later. Phase 1-12 in SPEC.md focuses on solo-lawyer capture-first workflow.

---

**Status:** locked. Next: §② Jobs-to-be-done.
