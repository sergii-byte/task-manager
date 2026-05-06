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
    },

    id() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
    },

    // ============================================================
    // READ API
    // ============================================================
    getClients()  { return this._data.clients.slice(); },
    getClient(id) { return this._data.clients.find(c => c.id === id) || null; },

    getCompanies(clientId) {
        const cs = this._data.companies;
        return clientId ? cs.filter(c => c.clientId === clientId) : cs.slice();
    },
    getCompany(id) { return this._data.companies.find(c => c.id === id) || null; },

    getMatters(clientId) {
        const ms = this._data.matters;
        return clientId ? ms.filter(m => m.clientId === clientId) : ms.slice();
    },
    getMatter(id) { return this._data.matters.find(m => m.id === id) || null; },

    getTasks(matterId) {
        const ts = this._data.tasks;
        return matterId ? ts.filter(t => t.matterId === matterId) : ts.slice();
    },
    getTask(id) { return this._data.tasks.find(t => t.id === id) || null; },

    getMeetings(matterId) {
        const ms = this._data.meetings;
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

    getInvoices(clientId) {
        const is = this._data.invoices;
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
        this.flush();
        return c;
    },
    updateClient(id, patch) {
        const c = this.getClient(id);
        if (!c) return null;
        Object.assign(c, patch, { updated: new Date().toISOString() });
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
        this.flush();
        return t;
    },
    updateTask(id, patch) {
        const t = this.getTask(id);
        if (!t) return null;
        Object.assign(t, patch, { updated: new Date().toISOString() });
        this.flush();
        return t;
    },
    deleteTask(id) {
        this._data.tasks = this._data.tasks.filter(t => t.id !== id);
        this.flush();
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
        this.flush();
        return l;
    },

    // Settings
    getSetting(key)        { return this._data.settings[key]; },
    setSetting(key, value) {
        this._data.settings[key] = value;
        this.flush();
    },

    // Hard reset for dev — clears localStorage and reseeds
    reset() {
        localStorage.removeItem(this.KEY);
        this._data = this._empty();
        this._seed();
        this._data.settings.seeded = true;
        this.flush();
    },
};

window.Store = Store;
