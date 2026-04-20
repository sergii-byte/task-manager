// Recurrence rules for tasks.
//
// Shape stored on task.recurrence:
//   {
//     freq: 'daily' | 'weekly' | 'monthly' | 'yearly',
//     interval: integer >= 1,           // every N units (1 = every week)
//     until?: 'YYYY-MM-DD',             // optional end date (inclusive)
//   }
//
// Kept small on purpose — byDay/count/bySetPos are out of scope for v1.
// The 90% case for a lawyer: weekly client sync, monthly invoicing,
// yearly compliance filing. We can grow the model later.

const Recurrence = {
    /** Valid frequency keywords. */
    FREQS: ['daily', 'weekly', 'monthly', 'yearly'],

    /**
     * Normalise whatever the AI / form / import dumps at us into either a
     * clean recurrence object or null. Returning null is the "no recurrence"
     * signal — callers should delete the field rather than store null-ish
     * junk on the task.
     */
    normalize(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const freq = String(raw.freq || '').toLowerCase();
        if (!this.FREQS.includes(freq)) return null;
        let interval = parseInt(raw.interval, 10);
        if (!interval || interval < 1) interval = 1;
        if (interval > 999) interval = 999;  // sanity cap
        const out = { freq, interval };
        if (raw.until && /^\d{4}-\d{2}-\d{2}/.test(raw.until)) {
            out.until = raw.until.slice(0, 10);
        }
        return out;
    },

    /**
     * Given a recurrence rule and a Date anchor, return the next Date, or
     * null if we'd pass the `until` boundary.
     *
     * Uses local-time date math so DST doesn't silently shift the day.
     */
    nextDate(rec, anchor) {
        const r = this.normalize(rec);
        if (!r) return null;
        if (!(anchor instanceof Date) || isNaN(anchor)) return null;

        const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
        const n = r.interval;
        if (r.freq === 'daily')   d.setDate(d.getDate() + n);
        if (r.freq === 'weekly')  d.setDate(d.getDate() + 7 * n);
        if (r.freq === 'monthly') d.setMonth(d.getMonth() + n);
        if (r.freq === 'yearly')  d.setFullYear(d.getFullYear() + n);

        if (r.until) {
            const until = Dates.parseLocal(r.until);
            if (until && d > until) return null;
        }
        return d;
    },

    /**
     * Human-readable summary for the UI ("Every week", "Every 2 months, until May 15").
     * Uses I18n if available, falls back to English keywords otherwise.
     */
    describe(rec, lang) {
        const r = this.normalize(rec);
        if (!r) return '';
        const t = (k) => (typeof I18n !== 'undefined' && I18n.t ? I18n.t(k) : k);
        const plural = r.interval > 1;

        // Unit word — singular vs plural driven by i18n keys where available.
        const unitKeyBase = {
            daily:   plural ? 'recurUnitDays'   : 'recurUnitDay',
            weekly:  plural ? 'recurUnitWeeks'  : 'recurUnitWeek',
            monthly: plural ? 'recurUnitMonths' : 'recurUnitMonth',
            yearly:  plural ? 'recurUnitYears'  : 'recurUnitYear',
        }[r.freq];

        const every = t('recurEvery');  // "Every"
        const unit = t(unitKeyBase);
        const head = r.interval === 1
            ? `${every} ${unit}`
            : `${every} ${r.interval} ${unit}`;

        if (!r.until) return head;
        // "until 2026-05-15" — let the app format the date prettily.
        const untilLabel = t('recurUntil');
        return `${head}, ${untilLabel} ${r.until}`;
    },
};
