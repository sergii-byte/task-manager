// ordify.me — storage (Phase 1)
//
// localStorage['ordify-data'] = JSON of the full domain blob:
//   { clients, companies, matters, tasks, meetings, timeLogs, invoices,
//     tags, notes, settings }
//
// See DOMAIN.md for the entity shapes. Encryption (WebCrypto) and
// Sheets sync are added in later phases per SPEC §6. Phase 1 reads
// and writes plaintext.

const Store = {
    KEY: 'ordify-data',

    _empty() {
        return {
            clients:   [],
            companies: [],
            matters:   [],
            tasks:     [],
            meetings:  [],
            timeLogs:  [],
            invoices:  [],
            tags:      [],
            notes:     [],
            audit:     [],   // append-only change log; capped at AUDIT_MAX entries
            timer:     null,  // { running, taskId, matterId, started_at, note }
            settings: {
                theme: 'light',
                lang: 'en',
                model: 'claude-sonnet-4-5',
                seeded: false,
            },
        };
    },

    _data: null,

    init() {
        try {
            const raw = localStorage.getItem(this.KEY);
            this._data = raw ? this._normalize(JSON.parse(raw)) : this._empty();
        } catch (e) {
            console.warn('Store init failed, starting empty', e);
            this._data = this._empty();
        }
        // Seed once on first boot — gives the app a realistic Today on day-zero
        if (!this._data.settings.seeded) {
            this._seed();
            this._data.settings.seeded = true;
            this.flush();
        }
        // Migration: invoices arrived after first seed for some users — re-seed if empty.
        if (this._data.invoices.length === 0 && this._data.matters.length > 0) {
            this._seedInvoicesOnly();
            this.flush();
        }
    },

    _seedInvoicesOnly() {
        const now = new Date();
        const issued = (days) => { const d = new Date(now); d.setDate(d.getDate() - days); return d.toISOString(); };
        const due    = (days) => { const d = new Date(now); d.setDate(d.getDate() + days); return d.toISOString(); };
        this._data.invoices.push(
            {
                id: 'inv-1', clientId: 'cl-2',
                number: 'INV-2026-0041', status: 'paid',
                issued_at: issued(38), due_at: issued(8),
                sent_at: issued(36), paid_at: issued(5),
                currency: 'EUR', vat_pct: 0,
                lines: [
                    { type: 'subscription', matterId: 'm-2', description: 'March retainer · Acme', amount: 1500 },
                    { type: 'hourly_bundle', matterId: 'm-2', description: 'March overage @ €140/h', hours: 1.5, rate: 140, amount: 210 },
                ],
                subtotal: 1710, vat_amount: 0, total: 1710,
            },
            {
                id: 'inv-2', clientId: 'cl-2',
                number: 'INV-2026-0042', status: 'sent',
                issued_at: issued(7), due_at: due(23),
                sent_at: issued(7),
                currency: 'EUR', vat_pct: 0,
                lines: [
                    { type: 'subscription', matterId: 'm-2', description: 'April retainer · Acme', amount: 1500 },
                    { type: 'fixed_milestone', matterId: 'm-3', description: 'US LLC formation · delivered', amount: 2400 },
                ],
                subtotal: 3900, vat_amount: 0, total: 3900,
            },
            {
                id: 'inv-3', clientId: 'cl-1',
                number: 'INV-2026-0043', status: 'draft',
                issued_at: issued(0), due_at: due(30),
                currency: 'EUR', vat_pct: 0,
                lines: [
                    { type: 'hourly_bundle', matterId: 'm-1', description: 'April hours · Token offering @ €140/h', hours: 14.5, rate: 140, amount: 2030 },
                ],
                subtotal: 2030, vat_amount: 0, total: 2030,
            },
        );
    },

    _normalize(d) {
        const empty = this._empty();
        for (const k of Object.keys(empty)) {
            if (!(k in d)) d[k] = empty[k];
        }
        return d;
    },

    flush() {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(this._data));
        } catch (e) {
            console.warn('Store flush failed', e);
        }
        this._scheduleAutoSync();
        if (typeof Snapshots !== 'undefined') Snapshots.maybeTake();
    },

    /** Debounced auto-push to Sheets (30s after the last write).
       Default OFF in plain-rows mode — auto-push would clobber any edits the
       user makes directly in Google Sheets. Enable explicitly in Settings if
       you only edit in ordify and want auto-backup. */
    _autoSyncTimer: null,
    _scheduleAutoSync() {
        if (typeof Sheets === 'undefined') return;
        if (this._data.settings.auto_sync !== true) return;            // explicit opt-in only
        if (!this._data.settings.sheets_spreadsheet_id) return;
        if (!Sheets.isConnected()) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        clearTimeout(this._autoSyncTimer);
        this._autoSyncTimer = setTimeout(() => {
            Sheets.push().then(ts => {
                this._data.settings.sheets_last_sync = ts;
                this._data.settings.sheets_last_seen_remote = ts;
                // Don't recurse: bypass _scheduleAutoSync by writing direct
                try { localStorage.setItem(this.KEY, JSON.stringify(this._data)); } catch (_) {}
            }).catch(() => {});
        }, 30_000);
    },

    /** Approximate localStorage usage of the ordify blob in bytes. */
    storageSize() {
        try {
            const raw = localStorage.getItem(this.KEY) || '';
            return new Blob([raw]).size;
        } catch (_) { return 0; }
    },

    storageQuota() { return 5 * 1024 * 1024; },   // conservative ~5MB

    storagePct() { return Math.round((this.storageSize() / this.storageQuota()) * 100); },

    id() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    AUDIT_MAX: 500,
    /** Append a change-log entry. Captured fields are intentionally minimal —
       enough to know "who saw what, when" without bloating localStorage.
       op: 'create' | 'update' | 'delete' | 'restore' | 'sync-push' | 'sync-pull' | 'note' */
    _audit(op, entity, id, summary = '', details = null) {
        if (!this._data.audit) this._data.audit = [];
        this._data.audit.push({
            ts: new Date().toISOString(),
            op,
            entity,
            id: id || null,
            summary,
            details,
        });
        if (this._data.audit.length > this.AUDIT_MAX) {
            this._data.audit = this._data.audit.slice(-this.AUDIT_MAX);
        }
    },

    /** Diff two objects → array of { key, before, after } for changed keys.
       Used by update*() helpers to record meaningful field-level changes. */
    _diffPatch(prev, patch) {
        const out = [];
        for (const k of Object.keys(patch)) {
            if (k === 'updated') continue;
            const before = prev[k];
            const after = patch[k];
            const sameRef = before === after;
            const sameJson = !sameRef && JSON.stringify(before) === JSON.stringify(after);
            if (!sameRef && !sameJson) out.push({ key: k, before, after });
        }
        return out;
    },

    // ============================================================
    // SEED — populate a realistic morning of an international lawyer
    // ============================================================
    _seed() {
        // Start clean — discard any stale data from earlier sessions
        this._data.clients = [];
        this._data.companies = [];
        this._data.matters = [];
        this._data.tasks = [];
        this._data.meetings = [];
        this._data.timeLogs = [];
        this._data.invoices = [];
        this._data.tags = [];
        this._data.notes = [];

        const now = new Date();
        const today = (h, m = 0) => {
            const d = new Date(now); d.setHours(h, m, 0, 0); return d.toISOString();
        };
        const yesterday = (h, m = 0) => {
            const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(h, m, 0, 0);
            return d.toISOString();
        };

        // Clients
        const clMaria   = { id: 'cl-1', name: 'Maria Soto',         email: 'maria@solanapay.io', industry: 'Crypto',     primary_currency: 'EUR' };
        const clAcme    = { id: 'cl-2', name: 'Acme Tech',          email: 'ops@acme.tech',      industry: 'IT',         primary_currency: 'EUR' };
        const clMaersk  = { id: 'cl-3', name: 'Maersk-flag',        email: 'sam@maerskflag.com', industry: 'B2B-Trade',  primary_currency: 'EUR' };
        const clVas     = { id: 'cl-4', name: 'Vasylenko (private)', email: '',                 industry: 'Other',      primary_currency: 'EUR' };
        this._data.clients.push(clMaria, clAcme, clMaersk, clVas);

        // Companies (only those that own legal entities)
        this._data.companies.push(
            { id: 'co-1', clientId: 'cl-1', name: 'SolanaPay Foundation Ltd',  type: 'Ltd', jurisdiction: 'CY' },
            { id: 'co-2', clientId: 'cl-2', name: 'Acme Tech US LLC',          type: 'LLC', jurisdiction: 'US-DE' },
            { id: 'co-3', clientId: 'cl-2', name: 'Acme Tech Estonia OU',      type: 'OU',  jurisdiction: 'EE' },
            { id: 'co-4', clientId: 'cl-3', name: 'Maersk-flag Logistics SA',  type: 'SA',  jurisdiction: 'ES' },
        );

        // Matters — one of each billing mode for variety
        this._data.matters.push(
            // SUBSCRIPTION — SolanaPay token offering
            {
                id: 'm-1', clientId: 'cl-1', companyIds: ['co-1'],
                name: 'Token offering · USDC rails Q2',
                industry: 'Crypto',
                status: 'active',
                billing: {
                    mode: 'subscription',
                    period: 'monthly', period_fee: 1500,
                    hours_included: 10, overage_rate: 120,
                    auto_invoice_on_period_end: true,
                },
            },
            // FIXED — Acme Series B prep (delivery 14.05)
            {
                id: 'm-2', clientId: 'cl-2', companyIds: ['co-2'],
                name: 'Series B prep · shareholder consents',
                industry: 'IT',
                status: 'active',
                deadline: today(14, 0), // procedural deadline today 14:00
                billing: {
                    mode: 'fixed',
                    fixed_amount: 2400,
                    deadline: today(14, 0),
                },
            },
            // SUBSCRIPTION — Acme ongoing IT/corporate retainer
            {
                id: 'm-3', clientId: 'cl-2', companyIds: ['co-2', 'co-3'],
                name: 'Ongoing corporate retainer',
                industry: 'IT',
                status: 'active',
                billing: {
                    mode: 'subscription',
                    period: 'monthly', period_fee: 1500,
                    hours_included: 10, overage_rate: 120,
                    auto_invoice_on_period_end: true,
                },
            },
            // HOURLY — Maersk-flag intro project
            {
                id: 'm-4', clientId: 'cl-3', companyIds: ['co-4'],
                name: 'LATAM expansion · advisory',
                industry: 'B2B-Trade',
                status: 'active',
                billing: { mode: 'hourly', hourly_rate: 150 },
            },
            // FIXED — Vasylenko trust restructure
            {
                id: 'm-5', clientId: 'cl-4', companyIds: [],
                name: 'Family trust restructure',
                industry: 'Other',
                status: 'active',
                billing: { mode: 'fixed', fixed_amount: 1500 },
            },
        );

        // Tasks — today's slate (10), with overdue/due-soon/morning/afternoon/done mix
        this._data.tasks.push(
            // OVERDUE — SolanaPay OFAC memo, was due yesterday 18:00
            { id: 't-0142', matterId: 'm-1', clientId: 'cl-1',
              title: 'File OFAC compliance memo · SolanaPay stablecoin',
              priority: 'urgent', status: 'todo',
              deadline: yesterday(18, 0), tags: ['crypto', 'billable'] },

            // DUE SOON — Acme procedural deadline today 14:00
            { id: 't-0146', matterId: 'm-2', clientId: 'cl-2',
              title: 'File shareholder consent · Acme Series B',
              priority: 'urgent', status: 'todo',
              deadline: today(14, 0), tags: ['corporate'] },

            // MORNING
            { id: 't-0143', matterId: 'm-2', clientId: 'cl-2',
              title: 'Review Acme NDA red-lines from counter-party',
              priority: 'high', status: 'todo',
              deadline: today(10, 30), tags: ['corporate', 'billable'] },

            { id: 't-0144', matterId: 'm-1', clientId: 'cl-1',
              title: 'Prep · Maria call (BVI/Cayman comparison memo)',
              priority: 'high', status: 'todo',
              deadline: today(10, 45), tags: ['research'] },

            { id: 't-0145', matterId: 'm-5', clientId: 'cl-4',
              title: 'Draft engagement letter · Vasylenko trust',
              priority: 'medium', status: 'todo',
              deadline: today(11, 45), tags: ['legal'] },

            // AFTERNOON
            { id: 't-0147', matterId: 'm-3', clientId: 'cl-2',
              title: 'Send INV-2026-0042 · Acme · April retainer + LLC milestone',
              priority: 'high', status: 'todo',
              deadline: today(15, 30), tags: ['billable'] },

            { id: 't-0148', matterId: null, clientId: null,
              title: 'Research · MiCA registration timeline (EU clients)',
              priority: 'medium', status: 'todo',
              deadline: today(16, 0), tags: ['research'] },

            { id: 't-0149', matterId: null, clientId: 'cl-4',
              title: 'Pick up notarised PoA · Vasylenko',
              priority: 'low', status: 'todo',
              deadline: today(17, 30), tags: ['personal'] },

            // DONE EARLIER TODAY
            { id: 't-0140', matterId: null, clientId: null,
              title: 'Standup · internal team',
              priority: 'medium', status: 'done',
              deadline: today(9, 30), tags: [] },

            { id: 't-0141', matterId: null, clientId: null,
              title: 'Inbox triage · 14 items',
              priority: 'low', status: 'done',
              deadline: today(8, 50), tags: [] },
        );

        // Meeting — Maria call 11:00 (linked to SolanaPay token offering matter)
        this._data.meetings.push(
            { id: 'm-15', matterId: 'm-1', clientId: 'cl-1',
              title: 'Maria call · BVI vs Cayman jurisdiction',
              starts_at: today(11, 0), ends_at: today(11, 30),
              attendees: [{ name: 'Maria Soto' }], video_url: 'https://meet.example/maria' },

            { id: 'm-16', matterId: 'm-4', clientId: 'cl-3',
              title: 'Maersk-flag intro · LATAM expansion',
              starts_at: today(17, 0), ends_at: today(17, 45),
              attendees: [{ name: 'Sam Garcia' }], video_url: '' },
        );

        // Tags (system + custom)
        this._data.tags.push(
            { id: 'tag-corp',     name: 'Corporate', color: '#1a3dd8' },
            { id: 'tag-research', name: 'Research',  color: '#f5b700' },
            { id: 'tag-crypto',   name: 'Crypto',    color: '#0a0a0a' },
            { id: 'tag-legal',    name: 'Legal',     color: '#6a1b9a' },
            { id: 'tag-personal', name: 'Personal',  color: '#ff2e93' },
            { id: 'tag-billable', name: 'Billable',  color: '#e63312' },
        );

        // A couple of timelogs already on Acme matter (for subscription scope)
        const periodStart = new Date(now); periodStart.setDate(1);
        const ago = (days) => {
            const d = new Date(now); d.setDate(d.getDate() - days);
            return d.toISOString();
        };
        this._data.timeLogs.push(
            { id: 'tl-1', taskId: 't-0143', matterId: 'm-3', date: ago(2),
              hours: 2.5, billable: true, source: 'timer' },
            { id: 'tl-2', taskId: 't-0143', matterId: 'm-3', date: ago(5),
              hours: 3.7, billable: true, source: 'timer' },
            { id: 'tl-3', taskId: 't-0148', matterId: 'm-3', date: ago(8),
              hours: 1.2, billable: true, source: 'manual' },
        );

        // Seed invoices — mixed line types to showcase the domain
        const issued = (days) => { const d = new Date(now); d.setDate(d.getDate() - days); return d.toISOString(); };
        const due    = (days) => { const d = new Date(now); d.setDate(d.getDate() + days); return d.toISOString(); };
        this._data.invoices.push(
            {
                id: 'inv-1',
                clientId: 'cl-2',  // Acme Tech
                number: 'INV-2026-0041',
                status: 'paid',
                issued_at: issued(38), due_at: issued(8),
                sent_at: issued(36), paid_at: issued(5),
                currency: 'EUR', vat_pct: 0,
                lines: [
                    { type: 'subscription', matterId: 'm-2', description: 'March retainer · Acme', amount: 1500 },
                    { type: 'hourly_bundle', matterId: 'm-2', description: 'March overage @ €140/h', hours: 1.5, rate: 140, amount: 210 },
                ],
                subtotal: 1710, vat_amount: 0, total: 1710,
            },
            {
                id: 'inv-2',
                clientId: 'cl-2',  // Acme Tech
                number: 'INV-2026-0042',
                status: 'sent',
                issued_at: issued(7), due_at: due(23),
                sent_at: issued(7),
                currency: 'EUR', vat_pct: 0,
                lines: [
                    { type: 'subscription', matterId: 'm-2', description: 'April retainer · Acme', amount: 1500 },
                    { type: 'fixed_milestone', matterId: 'm-3', description: 'US LLC formation · delivered', amount: 2400 },
                ],
                subtotal: 3900, vat_amount: 0, total: 3900,
            },
            {
                id: 'inv-3',
                clientId: 'cl-1',  // Maria / SolanaPay
                number: 'INV-2026-0043',
                status: 'draft',
                issued_at: issued(0), due_at: due(30),
                currency: 'EUR', vat_pct: 0,
                lines: [
                    { type: 'hourly_bundle', matterId: 'm-1', description: 'April hours · Token offering @ €140/h', hours: 14.5, rate: 140, amount: 2030 },
                ],
                subtotal: 2030, vat_amount: 0, total: 2030,
            },
        );
    },

    // ============================================================
    // READ API
    // ============================================================
    /** All read methods filter out soft-deleted records by default. */
    getClients(opts = {}) {
        const all = this._data.clients;
        return opts.includeDeleted ? all.slice() : all.filter(c => !c.deletedAt);
    },
    getClient(id) { return this._data.clients.find(c => c.id === id) || null; },

    getCompanies(clientId) {
        const cs = this._data.companies;
        return clientId ? cs.filter(c => c.clientId === clientId) : cs.slice();
    },
    getCompany(id) { return this._data.companies.find(c => c.id === id) || null; },

    /** Read matters. Skips soft-deleted by default. Done matters are included
       so reports / time-rollups stay accurate; callers that want active-only
       (e.g. dropdowns) should filter `m.status !== 'done'` themselves. */
    getMatters(clientId, opts = {}) {
        let ms = this._data.matters;
        if (!opts.includeDeleted) ms = ms.filter(m => !m.deletedAt);
        return clientId ? ms.filter(m => m.clientId === clientId) : ms.slice();
    },
    /** Active (non-done) matters — convenience for Edit dropdowns, capture-context. */
    getActiveMatters(clientId) {
        return this.getMatters(clientId).filter(m => m.status !== 'done');
    },
    getMatter(id) { return this._data.matters.find(m => m.id === id) || null; },

    getTasks(matterId, opts = {}) {
        let ts = this._data.tasks;
        if (!opts.includeDeleted) ts = ts.filter(t => !t.deletedAt);
        return matterId ? ts.filter(t => t.matterId === matterId) : ts.slice();
    },
    getTask(id) { return this._data.tasks.find(t => t.id === id) || null; },

    getMeetings(matterId, opts = {}) {
        let ms = this._data.meetings;
        if (!opts.includeDeleted) ms = ms.filter(m => !m.deletedAt);
        return matterId ? ms.filter(m => m.matterId === matterId) : ms.slice();
    },
    getMeeting(id) { return this._data.meetings.find(m => m.id === id) || null; },

    getTimeLogs(taskId) {
        const ls = this._data.timeLogs;
        return taskId ? ls.filter(l => l.taskId === taskId) : ls.slice();
    },
    getTimeLogsForMatter(matterId) {
        return this._data.timeLogs.filter(l => l.matterId === matterId);
    },

    getInvoices(clientId, opts = {}) {
        let is = this._data.invoices;
        if (!opts.includeDeleted) is = is.filter(i => !i.deletedAt);
        return clientId ? is.filter(i => i.clientId === clientId) : is.slice();
    },
    getInvoice(id) { return this._data.invoices.find(i => i.id === id) || null; },

    getTags() { return this._data.tags.slice(); },
    getTag(id) { return this._data.tags.find(t => t.id === id) || null; },

    // ============================================================
    // COMPUTED HELPERS
    // ============================================================

    /**
     * Tasks that need to surface in the "ON FIRE" band of the Today view.
     * Returns { overdue: Task[], dueSoon: Task[], imminentMeetings: Meeting[] }
     *
     * Rules:
     *   overdue  = deadline < now AND status != 'done'
     *   dueSoon  = deadline in next 24h AND status != 'done' AND not overdue
     *   imminent = meeting starting within next 2h
     */
    getOnFire() {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        const twoHours = 2 * 60 * 60 * 1000;

        const overdue = [];
        const dueSoon = [];
        for (const t of this._data.tasks) {
            if (t.status === 'done' || !t.deadline) continue;
            const dl = new Date(t.deadline).getTime();
            if (dl < now)              overdue.push(t);
            else if (dl - now <= day)  dueSoon.push(t);
        }
        const imminentMeetings = this._data.meetings.filter(m => {
            const s = new Date(m.starts_at).getTime();
            return s >= now && s - now <= twoHours;
        });
        return { overdue, dueSoon, imminentMeetings };
    },

    /** Today's tasks (deadline is today, any status) — for the schedule list. */
    getTodaysTasks() {
        const now = new Date();
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end   = new Date(now); end.setHours(23, 59, 59, 999);
        const startMs = start.getTime();
        const endMs = end.getTime();
        return this._data.tasks.filter(t => {
            if (!t.deadline) return false;
            const dl = new Date(t.deadline).getTime();
            return dl >= startMs && dl <= endMs;
        });
    },

    /** Today's meetings. */
    getTodaysMeetings() {
        const now = new Date();
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end   = new Date(now); end.setHours(23, 59, 59, 999);
        const startMs = start.getTime();
        const endMs = end.getTime();
        return this._data.meetings.filter(m => {
            const s = new Date(m.starts_at).getTime();
            return s >= startMs && s <= endMs;
        });
    },

    /** Subscription scope: hours used vs included for current period. */
    getSubscriptionScope(matterId) {
        const m = this.getMatter(matterId);
        if (!m || m.billing?.mode !== 'subscription') return null;
        const periodStart = new Date(); periodStart.setDate(1); periodStart.setHours(0,0,0,0);
        const startMs = periodStart.getTime();
        const used = this._data.timeLogs
            .filter(l => l.matterId === matterId && new Date(l.date).getTime() >= startMs)
            .reduce((s, l) => s + (l.hours || 0), 0);
        return { used, included: m.billing.hours_included || 0 };
    },

    // ============================================================
    // WRITE API
    // ============================================================
    addClient(data) {
        const now = new Date().toISOString();
        const c = { id: 'cl-' + this.id(), created: now, updated: now, ...data };
        this._data.clients.push(c);
        this._audit('create', 'client', c.id, c.name || '');
        this.flush();
        return c;
    },
    updateClient(id, patch) {
        const c = this.getClient(id);
        if (!c) return null;
        const diff = this._diffPatch(c, patch);
        Object.assign(c, patch, { updated: new Date().toISOString() });
        if (diff.length) this._audit('update', 'client', id, c.name || '', diff);
        this.flush();
        return c;
    },

    addTask(data) {
        const now = new Date().toISOString();
        const t = {
            id: 't-' + this.id(),
            created: now, updated: now,
            priority: 'medium', status: 'todo',
            tags: [],
            ...data,
        };
        this._data.tasks.push(t);
        this._audit('create', 'task', t.id, t.title || '');
        this.flush();
        return t;
    },
    updateTask(id, patch) {
        const t = this.getTask(id);
        if (!t) return null;
        const wasDone = t.status === 'done';
        const diff = this._diffPatch(t, patch);
        Object.assign(t, patch, { updated: new Date().toISOString() });
        if (diff.length) this._audit('update', 'task', id, t.title || '', diff);
        if (!wasDone && t.status === 'done' && t.recurrence?.freq && t.deadline) {
            const next = this._spawnRecurrence(t);
            if (next) {
                this._data.tasks.push(next);
                this._audit('create', 'task', next.id, next.title + ' (auto-recurrence)');
            }
        }
        this.flush();
        return t;
    },

    /** Compute next occurrence of a recurring task. Returns a new task or null. */
    _spawnRecurrence(t) {
        const { freq, interval } = t.recurrence;
        const step = Math.max(1, interval || 1);
        const dl = new Date(t.deadline);
        if (freq === 'daily')   dl.setDate(dl.getDate() + step);
        else if (freq === 'weekly')  dl.setDate(dl.getDate() + 7 * step);
        else if (freq === 'monthly') dl.setMonth(dl.getMonth() + step);
        else return null;
        const now = new Date().toISOString();
        return {
            id: 't-' + this.id(),
            created: now, updated: now,
            title: t.title,
            clientId: t.clientId || null,
            matterId: t.matterId || null,
            deadline: dl.toISOString(),
            priority: t.priority || 'medium',
            status: 'todo',
            tags: (t.tags || []).slice(),
            recurrence: { ...t.recurrence },
        };
    },
    /** Soft-delete: mark deletedAt instead of removing. Items can be restored
       within TRASH_RETENTION_DAYS, then permanently purged. */
    TRASH_RETENTION_DAYS: 30,

    deleteTask(id, { permanent = false } = {}) {
        const t = this.getTask(id);
        const summary = t?.title || id;
        if (permanent) {
            this._data.tasks = this._data.tasks.filter(t => t.id !== id);
            this._audit('delete', 'task', id, summary + ' (permanent)');
        } else {
            if (t) {
                t.deletedAt = new Date().toISOString();
                this._audit('delete', 'task', id, summary);
            }
        }
        this.flush();
    },
    deleteMatter(id, { permanent = false } = {}) {
        const m = this.getMatter(id);
        const summary = m?.name || id;
        if (permanent) {
            this._data.matters = this._data.matters.filter(m => m.id !== id);
            this._audit('delete', 'matter', id, summary + ' (permanent)');
        } else {
            if (m) {
                m.deletedAt = new Date().toISOString();
                this._audit('delete', 'matter', id, summary);
            }
        }
        this.flush();
    },
    deleteClient(id, { permanent = false } = {}) {
        const c = this.getClient(id);
        const summary = c?.name || id;
        if (permanent) {
            this._data.clients = this._data.clients.filter(c => c.id !== id);
            this._audit('delete', 'client', id, summary + ' (permanent)');
        } else {
            if (c) {
                c.deletedAt = new Date().toISOString();
                this._audit('delete', 'client', id, summary);
            }
        }
        this.flush();
    },
    deleteMeeting(id, { permanent = false } = {}) {
        const m = this.getMeeting(id);
        const summary = m?.title || id;
        if (permanent) {
            this._data.meetings = this._data.meetings.filter(m => m.id !== id);
            this._audit('delete', 'meeting', id, summary + ' (permanent)');
        } else {
            if (m) {
                m.deletedAt = new Date().toISOString();
                this._audit('delete', 'meeting', id, summary);
            }
        }
        this.flush();
    },
    deleteInvoice(id, { permanent = false } = {}) {
        const inv = this.getInvoice(id);
        const summary = inv?.number || id;
        if (permanent) {
            this._data.invoices = this._data.invoices.filter(i => i.id !== id);
            this._audit('delete', 'invoice', id, summary + ' (permanent)');
        } else {
            if (inv) {
                inv.deletedAt = new Date().toISOString();
                this._audit('delete', 'invoice', id, summary);
            }
        }
        this.flush();
    },

    /** Restore a soft-deleted record by id (any entity type). */
    restoreEntity(type, id) {
        const arr = this._data[type] || [];
        const e = arr.find(x => x.id === id);
        if (e) {
            delete e.deletedAt;
            const ent = type.replace(/s$/, '');   // 'tasks' → 'task'
            this._audit('restore', ent, id, e.title || e.name || e.number || id);
            this.flush();
            return e;
        }
        return null;
    },

    /** All soft-deleted records across entity types — for the Trash view. */
    listTrash() {
        const out = [];
        const horizon = Date.now() - this.TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
        for (const type of ['tasks', 'matters', 'clients', 'meetings', 'invoices']) {
            for (const e of this._data[type] || []) {
                if (!e.deletedAt) continue;
                const ts = new Date(e.deletedAt).getTime();
                if (ts < horizon) continue;
                out.push({ type, entity: e, deletedAt: e.deletedAt });
            }
        }
        return out.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
    },

    /** Permanently remove anything past the retention window. Call from init. */
    purgeOldTrash() {
        const horizon = Date.now() - this.TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
        let removed = 0;
        for (const type of ['tasks', 'matters', 'clients', 'meetings', 'invoices']) {
            const before = this._data[type].length;
            this._data[type] = this._data[type].filter(e => {
                if (!e.deletedAt) return true;
                return new Date(e.deletedAt).getTime() >= horizon;
            });
            removed += before - this._data[type].length;
        }
        if (removed) this.flush();
        return removed;
    },

    addMatter(data) {
        const now = new Date().toISOString();
        const m = {
            id: 'm-' + this.id(),
            created: now, updated: now,
            status: 'active',
            companyIds: [],
            ...data,
        };
        this._data.matters.push(m);
        this._audit('create', 'matter', m.id, m.name || '');
        this.flush();
        return m;
    },

    addMeetingAudit() {/* placeholder for symmetry */},
    addInvoice(data) {
        const now = new Date().toISOString();
        const inv = {
            id: 'inv-' + this.id(),
            created: now, updated: now,
            status: 'draft',
            currency: 'EUR',
            vat_pct: 0,
            issued_at: now,
            ...data,
        };
        // Auto-compute totals from lines if missing
        if (!inv.subtotal && inv.lines) {
            inv.subtotal = inv.lines.reduce((s, l) => s + (l.amount || 0), 0);
        }
        if (!inv.vat_amount) inv.vat_amount = (inv.subtotal || 0) * (inv.vat_pct || 0) / 100;
        if (!inv.total) inv.total = (inv.subtotal || 0) + (inv.vat_amount || 0);
        // Auto-number: INV-YYYY-NNNN
        if (!inv.number) {
            const year = new Date().getFullYear();
            const existing = this._data.invoices.filter(i => i.number?.startsWith(`INV-${year}-`));
            const next = String(existing.length + 1).padStart(4, '0');
            inv.number = `INV-${year}-${next}`;
        }
        this._data.invoices.push(inv);
        this._audit('create', 'invoice', inv.id, inv.number);
        this.flush();
        return inv;
    },

    /**
     * Generate a draft invoice for a matter from its unbilled timelogs.
     * Builds line types per matter.billing.mode:
     *   subscription → subscription line + overage hourly_bundle if used > included
     *   fixed        → fixed_milestone line for the matter total
     *   hourly       → hourly_bundle line summing all unbilled logs at the matter rate
     */
    generateInvoiceFromMatter(matterId) {
        const m = this.getMatter(matterId);
        if (!m) return null;
        const mode = m.billing?.mode || 'hourly';
        const logs = this.getTimeLogsForMatter(matterId).filter(l => !l.invoiceId);
        const totalHours = logs.reduce((s, l) => s + (l.hours || 0), 0);

        const lines = [];
        if (mode === 'subscription') {
            const fee = m.billing.period_fee || 0;
            const incl = m.billing.hours_included || 0;
            const overRate = m.billing.overage_rate || 0;
            const overHours = Math.max(0, totalHours - incl);
            lines.push({
                type: 'subscription',
                matterId,
                description: `${m.name} · period retainer`,
                amount: fee,
            });
            if (overHours > 0 && overRate > 0) {
                lines.push({
                    type: 'hourly_bundle',
                    matterId,
                    description: `${m.name} · overage @ €${overRate}/h`,
                    hours: Math.round(overHours * 100) / 100,
                    rate: overRate,
                    amount: Math.round(overHours * overRate * 100) / 100,
                    logIds: logs.map(l => l.id),
                });
            }
        } else if (mode === 'fixed') {
            lines.push({
                type: 'fixed_milestone',
                matterId,
                description: `${m.name} · delivered`,
                amount: m.billing.fixed_amount || 0,
            });
        } else {
            // hourly
            const rate = m.billing.hourly_rate || 0;
            const amount = Math.round(totalHours * rate * 100) / 100;
            lines.push({
                type: 'hourly_bundle',
                matterId,
                description: `${m.name} · ${totalHours.toFixed(2)}h @ €${rate}/h`,
                hours: Math.round(totalHours * 100) / 100,
                rate,
                amount,
                logIds: logs.map(l => l.id),
            });
        }

        // Lock referenced logs to this draft (set invoiceId once we have one)
        const inv = this.addInvoice({
            clientId: m.clientId,
            lines,
            due_at: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString(); })(),
        });
        for (const l of logs) {
            if (lines.some(line => line.logIds?.includes(l.id))) {
                l.invoiceId = inv.id;
            }
        }
        this.flush();
        return inv;
    },

    addMeeting(data) {
        const now = new Date().toISOString();
        const m = {
            id: 'm-' + this.id(),
            created: now, updated: now,
            ...data,
        };
        this._data.meetings.push(m);
        this._audit('create', 'meeting', m.id, m.title || '');
        this.flush();
        return m;
    },

    addTimeLog(data) {
        const now = new Date().toISOString();
        const l = {
            id: 'tl-' + this.id(),
            date: now,
            billable: true,
            source: 'manual',
            ...data,
        };
        this._data.timeLogs.push(l);
        const matter = l.matterId ? this.getMatter(l.matterId) : null;
        this._audit('create', 'timelog', l.id, `${l.hours}h${matter ? ' · ' + matter.name : ''} (${l.source})`);
        this.flush();
        return l;
    },

    // ============================================================
    // TIMER — single global running timer
    // ============================================================
    /**
     * Start a timer. Either bind to a task (taskId given — matterId derived),
     * to a matter only, or unassigned. Stops any prior running timer first
     * (auto-logging it).
     */
    startTimer({ taskId = null, matterId = null, note = '' } = {}) {
        // If a timer is already running, stop it first (auto-log).
        if (this._data.timer && this._data.timer.running) {
            this.stopTimer();
        }
        // Derive matterId from task if missing
        if (taskId && !matterId) {
            const t = this.getTask(taskId);
            if (t) matterId = t.matterId || null;
        }
        this._data.timer = {
            running: true,
            taskId, matterId, note,
            started_at: new Date().toISOString(),
        };
        this.flush();
        return this._data.timer;
    },

    /** Stop the running timer. Creates a TimeLog if duration ≥ 1 minute. */
    stopTimer({ note = '' } = {}) {
        const t = this._data.timer;
        if (!t || !t.running) return null;
        const startMs = new Date(t.started_at).getTime();
        const elapsedMs = Date.now() - startMs;
        const hours = elapsedMs / 3_600_000;
        let log = null;
        if (hours >= 1 / 60) {  // ≥ 1 minute → log it
            log = this.addTimeLog({
                taskId: t.taskId,
                matterId: t.matterId,
                hours: Math.round(hours * 100) / 100,  // 2 decimals
                billable: true,
                source: 'timer',
                note: note || t.note || '',
                date: t.started_at,
            });
        }
        this._data.timer = null;
        this.flush();
        return log;
    },

    /** Late-attach a running unassigned timer to a task. */
    assignTimer(taskId) {
        const t = this._data.timer;
        if (!t || !t.running) return null;
        const task = this.getTask(taskId);
        if (!task) return null;
        t.taskId = taskId;
        t.matterId = task.matterId || t.matterId || null;
        this.flush();
        return t;
    },

    /** Returns the current timer state (or null when nothing is running). */
    getTimer() {
        const t = this._data.timer;
        return (t && t.running) ? t : null;
    },

    // Settings
    getSetting(key)        { return this._data.settings[key]; },
    setSetting(key, value) {
        this._data.settings[key] = value;
        this.flush();
    },

    // Hard reset for dev — clears localStorage and reseeds with sample data
    reset() {
        localStorage.removeItem(this.KEY);
        this._data = this._empty();
        this._seed();
        this._data.settings.seeded = true;
        this.flush();
    },

    /**
     * Clear all data (clients, matters, tasks, logs, invoices, attachments)
     * but PRESERVE settings (API keys, profile, OAuth, passphrase).
     * Sets seeded=true so first-boot seed doesn't run on next init.
     */
    clearAllData() {
        const settings = { ...this._data.settings, seeded: true };
        this._data = this._empty();
        this._data.settings = settings;
        // Wipe IndexedDB stores too — attachments + recording chunks + snapshots
        try {
            indexedDB.deleteDatabase('ordify-files');
            indexedDB.deleteDatabase('ordify-rec-chunks');
            indexedDB.deleteDatabase('ordify-snapshots');
        } catch (_) {}
        this.flush();
    },
};

window.Store = Store;
