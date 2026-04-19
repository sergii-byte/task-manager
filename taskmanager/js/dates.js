// Date utilities — pure functions, no DOM, no app state.
//
// Why a dedicated module: every "deadline" / "today" comparison hits a
// timezone or DST edge case eventually. Centralising the parsers means the
// same bug doesn't have to be fixed twice.

const Dates = {
    /**
     * Parse "YYYY-MM-DD" as LOCAL midnight.
     *
     * `new Date("2026-04-18")` parses as UTC midnight, which shifts by the
     * timezone offset and causes same-day tasks to appear "overdue" (or
     * next-day tasks to land on the wrong calendar cell).
     *
     * For full ISO timestamps with time + zone info, falls back to the
     * native Date parser (which handles those correctly).
     */
    parseLocal(s) {
        if (!s) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
        if (!m) return new Date(s);
        return new Date(+m[1], +m[2] - 1, +m[3]);
    },

    /** Today at local midnight. Useful as a comparison anchor. */
    todayLocal() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    },

    /** "YYYY-MM-DD" key for the given Date in LOCAL timezone. */
    toLocalKey(d) {
        if (!d) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    /**
     * Days between two dates, ignoring time-of-day. Positive = b is later.
     * Uses local midnight to avoid DST drift on multi-month spans.
     */
    daysBetween(a, b) {
        const ma = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
        const mb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
        return Math.round((mb - ma) / 86400000);
    },

    /** Add N calendar days to a date (returns a new Date, doesn't mutate). */
    addDays(d, n) {
        const out = new Date(d.getTime());
        out.setDate(out.getDate() + n);
        return out;
    },
};

// Back-compat: existing top-level callers used dlDate() — keep the alias
// so we can migrate incrementally without breaking sort comparators.
function dlDate(s) { return Dates.parseLocal(s); }
