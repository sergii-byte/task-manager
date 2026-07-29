# ordify v3 — where this stands

A rewrite of `taskmanager-v2/`, built alongside it. **v2 is what is in
production** (`ordifyme.netlify.app`) and is not touched by anything here.

Run it: `.claude/launch.json` → `ordify-v3` (port 8790).
`index.html` is the app, `test.html` is the suite.

---

## Why a rewrite

v2 works and is used daily, but it grew one request at a time and carries
three structural problems that cannot be patched out:

1. **Storage is one blob.** The whole practice is serialised and written
   whole on every change, so two devices overwrite each other, last writer
   winning, silently.
2. **No tests.** Its two worst shipped bugs were exactly what a test catches
   in a second — a date built through UTC that made "today" wrong every
   evening, and two different calculations of what a client owed that
   disagreed by €2,000.
3. **Three tables for one shape.** Clients, projects and tasks each needed
   their own move, render, drag and search. Four operations written three
   times.

## The model

Everything you organise is a **node** with a `type` and a `parentId`:

```
client → project → project → … → task
```

Any depth. A task can hang off a client directly. One `move`, one tree walk,
one search over all of it.

Time entries and invoices are separate facts *about* nodes, not nodes.

- `core.js` — the model and all the arithmetic. No DOM, no network. This is
  the part worth testing and it is fully tested.
- `store.js` — one document per record, merged field by field. A rename on
  one device and a due date on another both survive, and the result does not
  depend on the order they arrive in.
- `ai.js` — Gemini transcribes, Claude understands. Never the other way
  round: in v2 dictation reached different conclusions from typing the same
  sentence because a second engine was thinking with the first one's prompt.
- `capture.js` — turns proposals into nodes. The only place creation happens.
- `sheet.js` — where proposals are confirmed. Header / scrolling list /
  **pinned** correction row.
- `ui.js` — three screens and a search.

## Rules that came from v2's mistakes

- **Dates are local.** Never `toISOString().slice(0,10)` for a calendar date.
- **Seven days means seven days**, not "the rest of the calendar week".
- **Nothing is drawn twice.** The hero answers "what now" and is excluded
  from the list below it.
- **How you are looking at the data is not the data.** Expanded branches,
  scroll and the caret survive every re-render.
- **Deleting marks, never erases.** The bin restores.
- **What a screen says is owed is what an invoice would charge** — both ask
  the same function.
- **Money has one meaning per colour.** Moss is action, crimson is a date
  that has passed, "done" reads by form so colour stays reserved.

## Tests

`test.html`. Run them before and after any change to `core.js` or
`store.js`.

They are proven by mutation, not by passing: reintroduce a real v2 bug —
money computed per entry, a project droppable into its own descendant, a
calendar week, blob-style last-write-wins — and the suite goes red in the
right places.

The harness records a throw inside a group as a failure rather than aborting
the run, and groups may be async (an earlier synchronous-only harness had
four assertions passing by accident).

## Not built yet

Sign-in and Firestore (data is in `localStorage`), the client portal,
invoices as documents, drag to rearrange, the tamper-evident history chain.
v2 has all of these if you need to see how they behaved.
