# ordify.me — Jobs-to-be-done

Format: **When [situation], I want to [action/outcome], so that [actual goal].**

Ranked by frequency × pain × impact. Top 3 drive the design; 4-7 are secondary.

---

## J-01 · Capture (5-15×/day) — TOP PRIORITY

**When** I get a fragment (email · telegram · voice memo · call note) related to a client / matter,
**I want** to dump it into ordify in under 10 seconds and have AI structure it correctly into client + matter + task with deadline,
**so that** nothing slips and I'm not the one doing data entry.

**Implication:** capture surface must be on every screen, one keystroke away (`⌘N`), accept text + voice, AI parse must be correct on first try (>90%) — because the whole value is "I don't have to fix the parse".

---

## J-02 · Morning triage (1×/day) — HIGH PRIORITY

**When** I open the laptop in the morning,
**I want** to see what's burning (overdue tasks + procedural deadlines + today's hard cut-offs) before anything else,
**so that** I act on the highest-stakes work first, not on whatever is loud in my inbox.

**Implication:** Today view's top section is "ON FIRE" — overdue + procedural + meetings-in-next-2h. Visual weight massive. Other tasks pushed below the fold if needed.

---

## J-03 · Log a short client call (3-8×/day) — HIGHEST $ LEAK

**When** I just finished a 5-15 min call with a subscription/billable client,
**I want** to log the call as time + a small task in 5 seconds with no form ceremony,
**so that** my billable hours don't leak and the client's subscription-scope tracking is accurate.

**Implication:** dedicated one-click "log call" pattern — global keystroke, opens a tiny pop-over: client picker + 1-line description + duration (auto-suggest "12 min" based on call timestamp) + "log". No mandatory fields. No matter picker needed (auto-pick last matter for that client).

---

## J-04 · Answer a subscription client's question (3-6×/day) — HIGH FREQ

**When** a subscription client asks a quick question (telegram · email),
**I want** to answer it fast AND have ordify silently log it as a small task on that client's subscription,
**so that** I track interaction volume and don't burn through subscription scope without noticing.

**Implication:** capture from telegram/email → AI infers it's a subscription client → creates `task` linked to subscription + `timeLog` (estimated minutes from message length / response length). Per-subscription "scope used / scope budget" gauge visible somewhere.

---

## J-05 · Fixed-price project on deadline (2-5 active at any time) — DELIVERY-CRITICAL

**When** I'm delivering a fixed-price service like "incorporate a US LLC by 15 May",
**I want** to see milestone progress and time-to-deadline at a glance, NOT track hours,
**so that** I deliver on time. Hours are irrelevant — fixed price was agreed.

**Implication:** matter has a `billing.mode` field. If `fixed`, the matter view shows milestone-checklist + deadline-countdown, NOT timer / hourly rate. Different visual treatment.

---

## J-06 · Issue an invoice (1-2×/week) — REVENUE GATE

**When** the billing period ends or a fixed-price milestone is delivered,
**I want** to bundle everything that client owes me — subscription fee + fixed-price milestones delivered + billable hours logged — into one invoice in <60 sec,
**so that** I get paid without spending half a day on it.

**Implication:** invoice flow has THREE components, can mix:
- subscription line: `April retainer · €X` (fixed line item)
- fixed-price line(s): `US LLC incorp. delivered 14.05 · €X`
- hourly line(s): grouped time logs

---

## J-07 · Deadline approaching (daily) — DON'T MISS

**When** any task has a deadline in the next 24h,
**I want** the app to surface it as `DUE SOON` (vermillion outline badge) everywhere I look — sidebar, today, calendar, AI rail morning briefing,
**so that** I act before it slips into OVERDUE.

**Implication:** `due_soon` is COMPUTED from `deadline` (within 24h of now, status != done), not a manual flag. No separate PROCEDURAL category — was over-engineered for litigation use cases that don't apply here. Priority `urgent` (P0) + `due_soon` together = strongest visual class in the ON FIRE band.

---

## J-08 · Client meeting today (1-3×/day) — TIME-BLOCKING

**When** I have a scheduled meeting with a client at a specific time,
**I want** that meeting visible on the day timeline AND auto-create a "prep" task X minutes before AND auto-log the meeting time after,
**so that** meetings don't ambush me and don't leak unbilled minutes.

**Implication:** meetings are first-class entities (not just task-with-deadline). Calendar sync (CalDAV / Google) optional. Meeting block on day shows time + client + matter context.

---

## J-09 · Cross-practice review (weekly) — STRATEGIC

**When** I want to see "how am I doing" across all my practices (IT / crypto / B2B trade),
**I want** a weekly digest — billable hours per industry, subscription scope usage, fixed-price delivery health, revenue projected vs collected,
**so that** I notice if one practice is leaking time or revenue.

**Implication:** "Practice health" view (weekly only — not for daily use). Group by industry tag. Stat cards per practice.

---

## What this changes vs. earlier design

| Earlier assumption | Reality |
|---|---|
| Capture is 50+/day, must be insanely fast | 5-15/day, must be **insanely correct** |
| Today view = full task list with time-block dividers | Today view = **"ON FIRE" hero band** + everything else |
| Time tracking = always-on running clock | **One-click "log call I just had"** pattern matters more |
| Invoices = roll up billable hours | **3-mode invoice**: subscription + fixed + hourly, mixed |
| Calendar = task deadlines | **Meetings as first-class entities** + task deadlines |
| Matters all the same | Matters have `billing.mode`: subscription / fixed / hourly — different views per mode |
| Tags = colour palette | Tags also encode **industry** (IT / Crypto / B2B Trade) for filtering |

## Top-3 jobs drive the design

If only 3 jobs land Phase 1:

1. **J-01 Capture** — the surface, the AI parse, the preview modal.
2. **J-02 Morning triage** — Today view's "ON FIRE" hero, procedural rendering everywhere, AI morning briefing.
3. **J-03 Log a short call** — global one-click pattern, attached to billable subscription/matter.

Everything else (J-04 to J-09) is built on top once these 3 work.
