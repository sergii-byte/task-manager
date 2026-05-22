# ordify — Product Brief (locked 2026-05-22)

The single source of truth for the rebuild. Supersedes all prior design docs.
If a feature is not traceable to a Job below, it does not get built.

---

## 1. The user

Sergiy — international lawyer, based in Spain. Practice: IT / Crypto / Corporate /
B2B-Trade / Compliance, multi-jurisdictional. Works as a **hub with a small team**:
he assigns tasks, the team executes their own; clients, matters and billing stay
with him.

His day today: arrive → check calendar → try to gather scattered tasks across
projects → scroll Telegram → scroll Slack (several client channels) → check email
→ triage urgent/important → work while answering chats → Google Meet calls.
Core anxiety: **dropping something**, because intake channels are fragmented.
He does not log time (friction, "lazy") — currently rough marks in a mobile app,
transferred to invoices manually at month-end.

> "мне нужен организатор моего хаоса" — I need an organizer for my chaos.

---

## 2. Jobs to be done

1. **Catch it in 2 seconds.** Voice/text capture, UA/RU/EN, no forms.
   "Syndicode half an hour" → ordify asks which task → done. Nothing is lost.
2. **One list instead of five apps.** Morning view = calendar + every task in
   one place. Email + calendar pulled automatically. No fearful scrolling.
3. **Time logged in passing.** Tracked through the same capture flow, no separate
   ritual — so it actually happens.
4. **Invoice builds itself.** Month-end: logged time per client → finished
   document. No manual transfer.
5. **Hand tasks to the team.** Assign → they see only their tasks and close them
   → the hub sees status.

---

## 3. Scope — IN

- Omni-capture (voice + text, UA/RU/EN) as the primary entry point.
- Today view: calendar + aggregated tasks + triage (minimal design `min-today`).
- Time tracking via capture; one-tap timer as the alternative.
- Invoice generation from accumulated time per client (`min-invoice`).
- Task assignment to team members (hub model).
- Cloud sync across the hub's devices and the team.
- Email + calendar auto-read (Gmail API + Calendar API).
- Telegram / Slack: manual capture (forward / paste / dictate into ordify).

## 4. Scope — OUT (cut from the current v5 app)

Removed — does not serve any Job:

- Snapshots (IndexedDB) — backend backs up.
- History / Audit as a navigation section.
- Trash as a visible section (soft-delete kept silently under the hood).
- The mandatory ritual "create client → matter → task" — replaced by capture.
- Matter as a required step — becomes optional grouping.
- Drag-drop file attachments on every page — keep only voice notes (audio).
- Google Sheets export.
- The hi-fi design direction — the design package marks minimal as primary.

---

## 5. Architecture — "everything in Google" (Firebase)

| Layer            | Implementation                                  | Cost          |
|------------------|-------------------------------------------------|---------------|
| Auth / accounts  | Firebase Auth → Sign in with Google             | free          |
| Database         | Cloud Firestore (realtime sync)                 | free (Spark)  |
| Files / audio    | Google Drive (`drive.file` scope, already set)  | free          |
| Email / calendar | Gmail API + Calendar API (already wired)        | free          |
| Frontend hosting | Netlify (unchanged)                             | free          |

- Firebase is added to the **existing** GCP project `LegalFlow` (legalflow-493214).
- Firestore region: **europe-west** (EU data residency, GDPR).
- Security rules: team members read/update only tasks assigned to them;
  clients / matters / invoices / billing are hub-only.
- Firebase config keys are public by design — safe in the frontend; access is
  governed by Auth + security rules, not by hiding keys.
- Trade-off accepted: Firestore is NoSQL (document store), not SQL. Fine at
  this scale.

---

## 6. Design direction

Minimal direction from the Claude Design handoff (`/design/`). Primary screens:
`min-today` (home), `min-invoice`, `min-client`, `min-matter`, `min-capture`.
Editorial / lowercase voice, plum accent `#6a1b9a`. Hi-fi direction = reference
only, not built.

---

## 7. Phased delivery plan

Each phase ends deployable and testable.

- **Phase 0 — Firebase foundation.** Add Firebase to `LegalFlow`, enable
  Firestore (europe-west) + Auth (Google provider), wire SDK + config, gate the
  app behind Google sign-in.
- **Phase 1 — Data layer.** Replace localStorage Store with Firestore. Schema:
  users, clients, matters, tasks, logs, invoices. One-time import of existing
  localStorage data. Single user, multi-device sync working.
- **Phase 2 — Omni-capture core.** Rebuild capture as THE entry point. Voice
  "client + duration" → ask task → log. Kill the create-client-first ritual.
- **Phase 3 — Today view.** Implement `min-today`: calendar pull + aggregated
  tasks + triage.
- **Phase 4 — Time → Invoice.** Frictionless time logging; month-end invoice
  from accumulated time (`min-invoice`).
- **Phase 5 — Team.** Team sign-in; assign tasks; Firestore security rules for
  scoped access.
- **Phase 6 — Cut & polish.** Remove dead features (section 4); apply minimal
  design throughout.

---

## 8. User actions required

- Phase 0: a few clicks in the Firebase console (add Firebase to `LegalFlow`,
  create Firestore database, enable Google auth provider). Step-by-step provided
  when Phase 0 starts.
- Everything else is implementation — no further setup from the user.
