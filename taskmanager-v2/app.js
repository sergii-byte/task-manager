/* ordify · clean rebuild
 * Single-file vanilla JS practice manager.
 * Storage: localStorage key `ordify-v2-data`.
 * Routing: hash-based (#/clients, #/matters/abc123, etc.).
 */
'use strict';

/* =========================================================================
 * 1. HELPERS
 * ========================================================================= */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const uuid = () => 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
};

const fmtDateInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const fmtMoney = (amount, currency = 'EUR') => {
    const n = Number(amount) || 0;
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
    } catch (e) {
        return n.toFixed(2) + ' ' + currency;
    }
};

const fmtMinutes = (mins) => {
    const m = Math.max(0, Math.round(Number(mins) || 0));
    const h = Math.floor(m / 60);
    const r = m % 60;
    return h ? `${h}h ${String(r).padStart(2,'0')}m` : `${r}m`;
};

const fmtClock = (ms) => {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const isPastDate = (iso) => iso && iso < todayISO();

const debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

/* =========================================================================
 * 1a. ICONS — one visual language for the whole app.
 * Line icons, 24px grid, stroke inherits currentColor. The emoji that used
 * to stand in for icons rendered differently on every OS and clashed with
 * the editorial tone.
 * ========================================================================= */

const ICONS = {
    circle:   '<circle cx="12" cy="12" r="9"/>',
    mail:     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    users:    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 010 7"/><path d="M21 20c0-2.6-1.6-4.8-4-5.7"/>',
    folder:   '<path d="M3 7a2 2 0 012-2h4l2 3h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    receipt:  '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    sliders:  '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>',
    paperclip:'<path d="M21 12.5l-8.5 8.5a5 5 0 01-7-7L14 5.5a3.5 3.5 0 015 5L10.5 19a2 2 0 01-3-3L15 8.5"/>',
    mic:      '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    spark:    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    play:     '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    alert:    '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>',
    flag:     '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    banknote: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>',
    grid:     '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    chat:     '<path d="M4 5h16v11H8l-4 4z"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    check:    '<path d="M5 13l4 4 10-10"/>',
    video:    '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 11l6-3v8l-6-3z"/>',
    checklist:'<path d="M4 7l2 2 3-3"/><path d="M4 17l2 2 3-3"/><path d="M13 8h7M13 18h7"/>'
};

const icon = (name, size = 16) =>
    `<svg class="ic-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* =========================================================================
 * 2. STORE
 * ========================================================================= */

const STORE_KEY = 'ordify-v2-data';

const defaultState = () => ({
    v: 8,
    profile: {
        name: '', email: '', address: '', taxId: '',
        currency: 'EUR', rate: 150,
        invoiceNumberPrefix: 'INV-', invoiceNumberCounter: 1,
        iban: '', paymentTerms: '',
        bankAccounts: [],   // [{ id, currency, iban, swift, bankName, holder }]
        anthropicKey: '',
        anthropicModel: 'claude-opus-4-8',
        geminiKey: '',
        geminiModel: 'gemini-2.0-flash',
        dictationLang: 'auto',
        googleClientId: ''
    },
    clients: [],
    matters: [],
    tasks: [],            // mirror of the /tasks collection (owned by the Tasks module)
    logs: [],
    invoices: [],
    attachments: [],
    history: [],          // tamper-evident chain of what happened — see History
    historyAnchor: '',    // hash of the last trimmed entry, so the chain still verifies
    emailHandled: [],     // Gmail message ids already turned into tasks / dismissed
    tasksMigrated: false, // set true once blob tasks moved into /tasks
    timer: null           // { taskId, matterId, clientId, label, startedAt }
});

let state = defaultState();

/* Firestore-backed store (Phase 1).
 * The whole `state` object is stored as a JSON string in a single document
 * /userdata/{uid}. A realtime listener keeps every signed-in device in sync.
 * localStorage is kept as an offline mirror / fallback.
 */
const Store = {
    docRef: null,
    _unsub: null,
    _saveTimer: null,
    _lastWritten: null,   // JSON string of the last state we serialized

    async init(uid) {
        if (!uid || typeof fbDb === 'undefined' || !fbDb) {
            console.warn('Firestore unavailable — using localStorage only');
            Store._loadLocal();
            return;
        }
        Store.docRef = fbDb.collection('userdata').doc(uid);

        let snap = null;
        try {
            snap = await Store.docRef.get();
        } catch (e) {
            console.error('Firestore read failed — falling back to localStorage', e);
            Store._loadLocal();
            toast('Offline — working from local copy', 'error');
            return;
        }

        if (snap && snap.exists && snap.data() && typeof snap.data().state === 'string') {
            // Existing cloud data
            try {
                state = Store._normalize(Object.assign(defaultState(), JSON.parse(snap.data().state)));
            } catch (e) {
                console.error('cloud state parse failed', e);
                state = defaultState();
            }
            Store._lastWritten = JSON.stringify(state);
            Store._migrateLegacyKeys();
        } else {
            // No cloud doc yet — one-time import from localStorage, then seed it
            const legacy = localStorage.getItem(STORE_KEY);
            let initial = defaultState();
            if (legacy) {
                try { initial = Object.assign(defaultState(), JSON.parse(legacy)); }
                catch (e) { console.warn('legacy data unreadable', e); }
            }
            state = Store._normalize(initial);
            Store._migrateLegacyKeys();
            const json = JSON.stringify(state);
            Store._lastWritten = json;
            try {
                await Store.docRef.set({ state: json, updatedAt: Date.now() });
            } catch (e) {
                console.error('initial cloud seed failed', e);
            }
        }

        // Realtime sync — changes from other devices land here
        Store._unsub = Store.docRef.onSnapshot(
            (doc) => {
                if (!doc.exists) return;
                const data = doc.data();
                if (!data || typeof data.state !== 'string') return;
                if (data.state === Store._serialize()) return;  // no real change
                try {
                    const keepTasks = state.tasks;  // tasks are owned by the Tasks module
                    state = Store._normalize(Object.assign(defaultState(), JSON.parse(data.state)));
                    state.tasks = Array.isArray(keepTasks) ? keepTasks : [];
                    Store._lastWritten = data.state;
                    render();
                } catch (e) { console.error('snapshot parse failed', e); }
            },
            (err) => console.error('Firestore snapshot error', err)
        );
    },

    /* The blob never carries tasks — those live in the /tasks collection. */
    _serialize() {
        return JSON.stringify(Object.assign({}, state, { tasks: [] }));
    },

    _normalize(s) {
        ['clients','matters','tasks','logs','invoices','attachments','emailHandled'].forEach(k => {
            if (!Array.isArray(s[k])) s[k] = [];
        });
        s.profile = Object.assign(defaultState().profile, s.profile || {});
        if (!Array.isArray(s.profile.bankAccounts)) s.profile.bankAccounts = [];
        // migrate the legacy single IBAN into one bank account
        if (s.profile.iban && !s.profile.bankAccounts.length) {
            s.profile.bankAccounts.push({
                id: uuid(),
                currency: s.profile.currency || 'EUR',
                iban: s.profile.iban,
                swift: '', bankName: '',
                holder: s.profile.name || ''
            });
            s.profile.iban = '';
        }
        return s;
    },

    _loadLocal() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            state = raw
                ? Store._normalize(Object.assign(defaultState(), JSON.parse(raw)))
                : defaultState();
        } catch (e) {
            console.error('local load failed', e);
            state = defaultState();
        }
        Store._migrateLegacyKeys();
    },

    _migrateLegacyKeys() {
        const map = [
            ['taskflow_claude_key',     'anthropicKey'],
            ['taskflow_gapi_client_id', 'googleClientId'],
            ['taskflow_ai_model',       'anthropicModel']
        ];
        let migrated = 0;
        for (const [legacyKey, profileField] of map) {
            const v = localStorage.getItem(legacyKey);
            if (v && !state.profile[profileField]) {
                state.profile[profileField] = v;
                migrated++;
            }
        }
        if (migrated > 0) {
            Store.save();
            setTimeout(() => toast(`Imported ${migrated} setting${migrated===1?'':'s'} from your first project`), 600);
        }
    },

    save() {
        // localStorage mirror — offline safety net
        try { localStorage.setItem(STORE_KEY, Store._serialize()); } catch (e) {}
        Share.schedule();   // keep client portals fresh (no-op if none enabled)
        if (!Store.docRef) return;
        clearTimeout(Store._saveTimer);
        Store._saveTimer = setTimeout(() => {
            const json = Store._serialize();
            if (json === Store._lastWritten) return;   // nothing changed
            Store._lastWritten = json;
            Store.docRef.set({ state: json, updatedAt: Date.now() })
                .catch((e) => {
                    console.error('cloud save failed', e);
                    toast('Sync failed — saved locally', 'error');
                });
        }, 500);
    },

    export() {
        return JSON.stringify(state, null, 2);
    },

    import(json) {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid data');
        state = Store._normalize(Object.assign(defaultState(), parsed));
        Store.save();
    },

    reset() {
        if (confirm('Wipe all data and start fresh? This cannot be undone.')) {
            state = defaultState();
            Store.save();
            location.hash = '#/today';
            render();
            toast('All data cleared.');
        }
    }
};

/* =========================================================================
 * 2a. TASKS — granular Firestore collection (Phase 5, team support)
 *
 * Tasks live in their own /tasks collection (one document each) so that
 * teammates can see the tasks assigned to them without gaining access to
 * the hub's clients / matters / billing (which stay in the blob).
 *
 * Each task document carries ownerId (the hub) + assigneeEmail, plus
 * denormalized clientName / matterName so an assignee can read context
 * without the hub's blob.
 * ========================================================================= */

const Tasks = {
    coll: null,
    uid: null,
    email: null,
    _unsubOwn: null,
    _unsubAssigned: null,
    _own: [],
    _assigned: [],

    async init(user) {
        if (typeof fbDb === 'undefined' || !fbDb || !user) {
            // no backend — tasks stay in the blob (state.tasks from Store)
            return;
        }
        Tasks.coll = fbDb.collection('tasks');
        Tasks.uid = user.uid;
        Tasks.email = (user.email || '').toLowerCase();

        await Tasks._migrateIfNeeded();

        Tasks._unsubOwn = Tasks.coll.where('ownerId', '==', Tasks.uid).onSnapshot(
            (snap) => { Tasks._own = snap.docs.map(d => d.data()); Tasks._merge(); },
            (err) => console.error('tasks(own) snapshot error', err)
        );
        if (Tasks.email) {
            Tasks._unsubAssigned = Tasks.coll.where('assigneeEmail', '==', Tasks.email).onSnapshot(
                (snap) => { Tasks._assigned = snap.docs.map(d => d.data()); Tasks._merge(); },
                (err) => console.error('tasks(assigned) snapshot error', err)
            );
        }
    },

    /* merge own + assigned, dedupe by id, push into state.tasks */
    _merge() {
        const byId = {};
        Tasks._own.forEach(t => { byId[t.id] = t; });
        Tasks._assigned.forEach(t => { byId[t.id] = t; });
        state.tasks = Object.values(byId);
        Share.schedule();
        render();
    },

    /* one-time move of blob tasks into the /tasks collection */
    async _migrateIfNeeded() {
        if (state.tasksMigrated) return;
        const blobTasks = Array.isArray(state.tasks) ? state.tasks : [];
        if (blobTasks.length) {
            try {
                const batch = fbDb.batch();
                blobTasks.forEach(t => {
                    const doc = Tasks._toDoc(t);
                    batch.set(Tasks.coll.doc(doc.id), doc);
                });
                await batch.commit();
            } catch (e) {
                console.error('task migration failed', e);
                return;   // try again next load
            }
        }
        state.tasksMigrated = true;
        state.tasks = [];
        Store.save();
    },

    /* normalize an in-memory task into a Firestore document */
    _toDoc(t) {
        const m = t.matterId ? matterById(t.matterId) : null;
        const c = (t.clientId && clientById(t.clientId)) || (m && clientById(m.clientId)) || null;
        return {
            id: t.id,
            ownerId: t.ownerId || Tasks.uid,
            ownerEmail: t.ownerEmail || Tasks.email,
            assigneeEmail: (t.assigneeEmail || '').toLowerCase() || null,
            title: t.title || '',
            matterId: t.matterId || null,
            clientId: t.clientId || (m ? m.clientId : null),
            matterName: m ? m.title : (t.matterName || null),
            clientName: c ? c.name : (t.clientName || null),
            due: t.due || null,
            priority: t.priority || 'normal',
            blockedReason: t.blockedReason || null,
            notes: t.notes || '',
            status: t.status || 'todo',
            createdAt: t.createdAt || new Date().toISOString(),
            completedAt: t.completedAt || null,
            deletedAt: t.deletedAt || null
        };
    },

    /* upsert one task (also covers soft-delete: a put with deletedAt set) */
    put(t) {
        if (!Tasks.coll) {
            const i = state.tasks.findIndex(x => x.id === t.id);
            if (i >= 0) state.tasks[i] = t; else state.tasks.push(t);
            Store.save();
            return;
        }
        const doc = Tasks._toDoc(t);
        Tasks.coll.doc(doc.id).set(doc).catch((e) => {
            console.error('task save failed', e);
            toast('Task sync failed: ' + e.message, 'error');
        });
        Share.schedule();
    },

    /* permanently delete one task */
    remove(id) {
        if (!Tasks.coll) {
            state.tasks = state.tasks.filter(x => x.id !== id);
            Store.save();
            return;
        }
        Tasks.coll.doc(id).delete().catch((e) => console.error('task delete failed', e));
    }
};

/* =========================================================================
 * 2a½. SHARE — client status pages (/shares collection)
 *
 * A client with sharing enabled gets a stable secret link
 * (share.html#<token>) showing a sanitized live snapshot of their matters
 * and tasks: titles, status, priority, deadlines, logged time and "stuck"
 * reasons — never rates, amounts, invoices, internal notes or teammate
 * emails. The snapshot republishes automatically (debounced) whenever
 * data changes; the share page listens to the doc in realtime.
 * ========================================================================= */

const Share = {
    _timer: null,
    _last: {},          // shareId -> last published JSON, to skip no-op writes

    token() {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    },

    url(c) {
        const base = location.origin + location.pathname.replace(/[^/]*$/, '');
        return base + 'share.html#' + c.shareId;
    },

    enable(clientId) {
        const c = clientById(clientId);
        if (!c) return;
        if (!c.shareId) c.shareId = Share.token();
        c.shareEnabled = true;
        if (c.shareComments === undefined) c.shareComments = true;
        Store.save();
        Share._publishNow();
        Comments.sync();
        render();
    },

    disable(clientId) {
        const c = clientById(clientId);
        if (!c) return;
        const id = c.shareId;
        c.shareEnabled = false;
        c.shareId = null;          // re-enabling mints a fresh token
        delete Share._last[id];
        Store.save();
        if (fbDb && id) {
            fbDb.collection('shares').doc(id).delete()
                .catch((e) => console.error('share delete failed', e));
        }
        Comments.sync();
        render();
    },

    /* Sanitized snapshot — the ONLY data that ever reaches the client.
     * Excluded on purpose: rates, unbilled amounts, invoices, task/client
     * notes, assignee emails, attachments. */
    /* How far back completed tasks are published (days). Configurable per
     * client on the portal, 7…365. Defaults to 30. */
    doneDays(c) {
        const n = Number(c.shareDoneDays);
        return (n >= 1 && n <= 365) ? n : 30;
    },

    payload(c) {
        const matters = mattersForClient(c.id).map(m => ({
            title: m.title || '',
            status: m.status || 'open',
            minutes: logsForMatter(m.id).reduce((s, l) => s + l.minutes, 0)
        }));
        const days = Share.doneDays(c);
        const doneCutoff = new Date(Date.now() - days * 86400000).toISOString();
        const tasks = tasksForClient(c.id)
            .filter(t => t.status !== 'done' || (t.completedAt || t.createdAt || '') >= doneCutoff)
            .map(t => ({
                id: t.id,                     // opaque uuid — lets the portal thread comments per task
                title: t.title || '',
                status: t.status === 'done' ? 'done' : 'open',
                overdue: taskStatus(t) === 'overdue',
                priority: t.priority || 'normal',
                due: t.due || null,
                stuck: (t.status !== 'done' && t.blockedReason) ? t.blockedReason : null,
                matter: (matterById(t.matterId) || {}).title || null,
                minutes: logsForTask(t.id).reduce((s, l) => s + l.minutes, 0),
                completedAt: t.completedAt || null,
                createdAt: t.createdAt || null
            }));
        return { client: c.name || '', from: state.profile.name || '', doneDays: days, matters, tasks };
    },

    setDoneDays(clientId, days) {
        const c = clientById(clientId);
        if (!c) return;
        c.shareDoneDays = Number(days) || 30;
        Store.save();          // triggers Share.schedule() → republish
        Share._publishNow();
    },

    /* Debounced republish of every enabled share. Called from Store.save()
     * and Tasks.put()/Tasks._merge() — cheap, because unchanged payloads
     * are skipped before any network write. */
    schedule() {
        if (!fbDb) return;
        clearTimeout(Share._timer);
        Share._timer = setTimeout(() => Share._publishNow(), 1500);
    },

    _publishNow() {
        if (!fbDb || !fbAuth || !fbAuth.currentUser) return;
        const uid = fbAuth.currentUser.uid;
        liveClients().filter(c => c.shareEnabled && c.shareId).forEach(c => {
            const json = JSON.stringify(Share.payload(c));
            const flag = c.shareComments !== false;
            const stamp = json + '|' + flag;
            if (Share._last[c.shareId] === stamp) return;
            fbDb.collection('shares').doc(c.shareId)
                .set({ ownerId: uid, state: json, commentsEnabled: flag, updatedAt: Date.now() })
                .then(() => { Share._last[c.shareId] = stamp; })
                .catch((e) => console.error('share publish failed', e));
        });
    }
};

/* =========================================================================
 * 2a¾. COMMENTS — the two-way thread on each client portal
 *
 * Messages live in /shares/{shareId}/comments, so the same unguessable
 * token that unlocks the status page unlocks its thread. The hub keeps a
 * listener open per enabled share; the client page keeps one on its own.
 * ========================================================================= */

const Comments = {
    _unsubs: {},        // shareId -> unsubscribe fn
    _byShare: {},       // shareId -> [ {id, taskId, author, text, createdAt} ]

    /* Reconcile listeners with the set of currently shared clients. */
    sync() {
        if (!fbDb) return;
        const want = {};
        liveClients().filter(c => c.shareEnabled && c.shareId).forEach(c => { want[c.shareId] = true; });

        Object.keys(Comments._unsubs).forEach(sid => {
            if (want[sid]) return;
            Comments._unsubs[sid]();
            delete Comments._unsubs[sid];
            delete Comments._byShare[sid];
        });

        Object.keys(want).forEach(sid => {
            if (Comments._unsubs[sid]) return;
            Comments._unsubs[sid] = fbDb.collection('shares').doc(sid).collection('comments')
                .orderBy('createdAt')
                .onSnapshot(
                    (snap) => {
                        Comments._byShare[sid] = snap.docs.map(d => {
                            const v = d.data();
                            return {
                                id: d.id,
                                taskId: v.taskId || null,
                                author: v.author || 'client',
                                text: v.text || '',
                                createdAt: v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : 0
                            };
                        });
                        render();
                    },
                    (err) => console.error('comments snapshot error', err)
                );
        });
    },

    forClient(c) {
        return (c && c.shareId && Comments._byShare[c.shareId]) || [];
    },

    /* Unread = client messages newer than the last time this thread was opened. */
    _seenKey: (sid) => 'ordify-thread-seen-' + sid,

    unread(c) {
        if (!c || !c.shareId) return 0;
        const seen = Number(localStorage.getItem(Comments._seenKey(c.shareId)) || 0);
        return Comments.forClient(c).filter(m => m.author === 'client' && m.createdAt > seen).length;
    },

    markSeen(c) {
        if (!c || !c.shareId) return;
        localStorage.setItem(Comments._seenKey(c.shareId), String(Date.now()));
    },

    post(clientId, taskId, text) {
        const c = clientById(clientId);
        const body = (text || '').trim();
        if (!c || !c.shareId || !body) return;
        if (body.length > 2000) { toast('Message is too long (2000 characters max)', 'error'); return; }
        fbDb.collection('shares').doc(c.shareId).collection('comments').add({
            taskId: taskId || null,
            author: 'hub',
            text: body,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => toast('Reply sent'))
          .catch((e) => {
              console.error('comment post failed', e);
              toast('Could not send: ' + e.message, 'error');
          });
    }
};

/* =========================================================================
 * 2b. AUDIT LOG
 * ========================================================================= */

/* =========================================================================
 * 3. SELECTORS / DERIVED
 * ========================================================================= */

/* =========================================================================
 * 4b. HISTORY — a tamper-evident record of what happened, and when.
 *
 * The shape is borrowed from the audit log in Block's Buzz: entries carry a
 * monotonic sequence number, and each one holds the SHA-256 of the entry
 * before it, with the owner's id folded into the hash so a row cannot be
 * moved between accounts without breaking the chain. Alter or remove a row
 * and every later hash stops matching — which is the whole point.
 *
 * For a practice this is provenance: evidence that a matter's record was not
 * quietly rewritten after the fact. Actions are a closed set of plain names,
 * with the detail kept in separate fields, so the log stays readable.
 * ========================================================================= */

const HISTORY_LABEL = {
    clientCreated:  'Client created',
    clientUpdated:  'Client updated',
    matterCreated:  'Project created',
    matterUpdated:  'Project updated',
    matterDeleted:  'Project deleted',
    taskCreated:    'Task created',
    taskUpdated:    'Task updated',
    taskCompleted:  'Task completed',
    taskReopened:   'Task reopened',
    taskDeleted:    'Task deleted',
    timeLogged:     'Time logged',
    invoiceCreated: 'Invoice created',
    portalShared:   'Client portal shared',
    portalDisabled: 'Client portal disabled'
};

const History = {
    MAX: 2000,
    _queue: Promise.resolve(),

    /* Callers stay synchronous; appends are serialised so the chain keeps its
     * order even when several things happen at once. */
    record(action, entity, entityId, summary = '') {
        History._queue = History._queue
            .then(() => History._append(action, entity, entityId, summary))
            .catch(e => console.warn('history append failed', e));
        return History._queue;
    },

    async _append(action, entity, entityId, summary) {
        if (!HISTORY_LABEL[action]) return;
        state.history = state.history || [];
        const prev = state.history[state.history.length - 1];
        const entry = {
            seq: prev ? prev.seq + 1 : 1,
            at: new Date().toISOString(),
            owner: (typeof Tasks !== 'undefined' && Tasks.uid) || '',
            action, entity,
            entityId: entityId || '',
            summary: String(summary || '').slice(0, 200),
            prevHash: prev ? prev.hash : (state.historyAnchor || '')
        };
        entry.hash = await History._hash(History._payload(entry));
        state.history.push(entry);
        // Keep the stored blob bounded without making the chain unverifiable:
        // the hash of the last trimmed entry becomes the anchor the remainder
        // verifies from.
        if (state.history.length > History.MAX) {
            const cut = state.history.length - History.MAX;
            state.historyAnchor = state.history[cut - 1].hash;
            state.history = state.history.slice(cut);
        }
        Store.save();
    },

    _payload(e) {
        return [e.owner, e.seq, e.at, e.action, e.entity, e.entityId, e.summary, e.prevHash].join('|');
    },

    async _hash(str) {
        const buf = new TextEncoder().encode(str);
        const digest = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(digest))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    },

    forEntity(entity, id) {
        return (state.history || [])
            .filter(e => e.entity === entity && e.entityId === id)
            .slice().reverse();
    },

    /* Walk the chain and name the first entry that no longer adds up. */
    async verify() {
        const h = state.history || [];
        let expected = state.historyAnchor || '';
        for (const e of h) {
            if (e.prevHash !== expected) return { ok: false, seq: e.seq, reason: 'chain broken' };
            if (await History._hash(History._payload(e)) !== e.hash) {
                return { ok: false, seq: e.seq, reason: 'entry altered' };
            }
            expected = e.hash;
        }
        return { ok: true, count: h.length };
    }
};

const byId = (list, id) => list.find(x => x.id === id);
// byId returns even soft-deleted items (so restore works)
const clientById = (id) => byId(state.clients, id);
const matterById = (id) => byId(state.matters, id);
const taskById   = (id) => byId(state.tasks, id);
const invoiceById = (id) => byId(state.invoices, id);

// list selectors filter out soft-deleted by default
const live = (list) => list.filter(x => !x.deletedAt);
const liveClients = () => live(state.clients);
const liveMatters = () => live(state.matters);
const liveTasks = () => live(state.tasks);
const liveLogs = () => live(state.logs);
const liveInvoices = () => live(state.invoices);

const mattersForClient = (cid) => state.matters.filter(m => m.clientId === cid && !m.deletedAt);
const tasksForMatter = (mid) => ordered(state.tasks.filter(t => t.matterId === mid && !t.deletedAt));
const tasksForClient = (cid) => state.tasks.filter(t => t.clientId === cid && !t.deletedAt);
const logsForMatter = (mid) => state.logs.filter(l => l.matterId === mid && !l.deletedAt);
const logsForTask = (tid) => state.logs.filter(l => l.taskId === tid && !l.deletedAt);
const logsForClient = (cid) => state.logs.filter(l => l.clientId === cid && !l.deletedAt);

/* ---- project tree ----
   A project with no parentId is top-level under its client; with one, it is a
   subproject. The field is optional, so every existing project reads as
   top-level — no migration. */
const matterParent = (m) => (m && m.parentId ? matterById(m.parentId) : null);
const childMatters = (mid) => ordered(state.matters.filter(m => m.parentId === mid && !m.deletedAt));
const topMattersForClient = (cid) =>
    ordered(state.matters.filter(m => m.clientId === cid && !m.parentId && !m.deletedAt));
/* Tasks that hang directly off the client, not under any project — the
   standalone tasks the client page needs a home for. */
const standaloneTasksForClient = (cid) =>
    state.tasks.filter(t => t.clientId === cid && !t.matterId && !t.deletedAt);
/* Guard against a cycle a bad edit could introduce (A parent of B, B parent
   of A) so tree walks can't loop forever. */
/* ---- manual order ----
   Anything never dragged has no `order` and keeps its natural position at the
   end; dragging assigns positions to that list only. Sparse numbering means a
   single move rewrites one row, not the whole list. */
const ordered = (list) => list.slice().sort((a, b) => {
    const ao = a.order == null ? Infinity : a.order;
    const bo = b.order == null ? Infinity : b.order;
    return ao - bo;
});

/* Put `moved` next to `target` inside `siblings`, and renumber that group. */
function placeBeside(siblings, moved, targetId, before) {
    const rest = ordered(siblings).filter(x => x.id !== moved.id);
    const at = rest.findIndex(x => x.id === targetId);
    const idx = at < 0 ? rest.length : (before ? at : at + 1);
    rest.splice(idx, 0, moved);
    rest.forEach((x, i) => { x.order = i * 10; });
    return rest;
}

const matterDescendantIds = (mid, seen = new Set()) => {
    childMatters(mid).forEach(c => {
        if (!seen.has(c.id)) { seen.add(c.id); matterDescendantIds(c.id, seen); }
    });
    return seen;
};

/* ---- billing ----
   Type lives on the project and is inherited by subprojects that don't set
   their own. Pro bono and partnership are non-billable: their time is still
   logged (for the record) but never counted as unbilled or invoiced. */
const BILLING_LABEL = { hourly: 'Hourly', fixed: 'Fixed fee', probono: 'Pro bono', partnership: 'Partnership' };
const matterBillingType = (m) => {
    let cur = m, guard = 0;
    while (cur && guard++ < 20) { if (cur.billingType) return cur.billingType; cur = matterParent(cur); }
    return 'hourly';
};
const isBillable = (m) => {
    const b = matterBillingType(m);
    return b === 'hourly' || b === 'fixed';
};

const taskStatus = (t) => {
    if (t.status === 'done') return 'done';
    if (t.due && isPastDate(t.due)) return 'overdue';
    return 'todo';
};

const matterRate = (m) => Number(m?.rate) || Number(state.profile.rate) || 0;
const profileCurrency = () => state.profile.currency || 'EUR';

const totalUnbilledForClient = (cid) => {
    return state.logs
        .filter(l => l.clientId === cid && !l.invoiceId && !l.deletedAt)
        .reduce((sum, l) => {
            const m = matterById(l.matterId);
            // pro bono / partnership time is logged but never owed
            if (m && !isBillable(m)) return sum;
            const rate = matterRate(m);
            return sum + (l.minutes / 60) * rate;
        }, 0);
};

/* A folder/link affordance — the thing you click to go do the work. Opens in
   a new tab; data-stop keeps a click inside a task row from also opening the
   task editor. Empty string when there is no link, so it drops out cleanly. */
function driveLink(url, label = 'Open') {
    if (!url) return '';
    const safe = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    return `<a class="drive-link" href="${esc(safe)}" target="_blank" rel="noopener" data-stop
        title="${esc(safe)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>${label ? `<span>${esc(label)}</span>` : ''}</a>`;
}

/* =========================================================================
 * 4. TOAST
 * ========================================================================= */

let _toastTimer = null;
/* `undo` turns the toast into the only route back from a delete — there is
 * no Trash section by design, so it stays up longer than a plain message. */
function toast(message, kind = 'ok', undo = null) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.dataset.kind = kind;
    if (undo) {
        const btn = document.createElement('button');
        btn.className = 'toast-undo';
        btn.type = 'button';
        btn.textContent = 'Undo';
        btn.addEventListener('click', () => {
            el.hidden = true;
            clearTimeout(_toastTimer);
            undo();
        });
        el.appendChild(btn);
    }
    el.hidden = false;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { el.hidden = true; }, undo ? 8000 : 2400);
}

/* One-tap time capture. The user's stated failure mode is never logging
 * time ("friction, lazy") — so the moment a task is closed with nothing
 * logged on it, the toast offers four durations. One tap writes the log;
 * ignoring it costs nothing. */
/* Offer to log time in one tap. `label` lets the same chips serve both
   "just finished it" and "log another session on this" — the recurring case
   where you sit with one task 30 minutes a day for a fortnight. */
function quickLogPrompt(t, label = '✓ done — how long did it take?') {
    const el = $('#toast');
    if (!el) return;
    // A task you keep returning to should offer yesterday's amount first, so
    // repeating it is one tap rather than arithmetic.
    const prev = logsForTask(t.id)
        .slice().sort((a, b) => (b.endedAt || '').localeCompare(a.endedAt || ''))[0];
    const last = prev && prev.minutes ? Number(prev.minutes) : null;
    const mins = [...new Set([...(last ? [last] : []), 15, 30, 60, 120])].slice(0, 4);
    clearTimeout(_toastTimer);
    el.dataset.kind = 'ok';
    el.innerHTML = `<span>${esc(label)}</span>` +
        mins.map(m =>
            `<button class="toast-chip" data-mins="${m}">${fmtMinutes(m)}${
                m === last ? ' ↺' : ''}</button>`).join('') +
        `<button class="toast-chip ghost" data-mins="0">skip</button>`;
    el.hidden = false;
    el.querySelectorAll('[data-mins]').forEach(b => b.addEventListener('click', () => {
        el.hidden = true;
        const mins = Number(b.dataset.mins);
        if (!mins) return;
        const end = Date.now();
        state.logs.push({
            id: uuid(), taskId: t.id, matterId: t.matterId, clientId: t.clientId,
            startedAt: new Date(end - mins * 60000).toISOString(),
            endedAt: new Date(end).toISOString(),
            minutes: mins, notes: t.title, invoiceId: null
        });
        History.record('timeLogged', 'task', t.id, `${fmtMinutes(mins)} — ${t.title}`);
        Store.save(); render();
        toast(`Logged ${fmtMinutes(mins)}`);
    }));
    _toastTimer = setTimeout(() => { el.hidden = true; }, 12000);
}

/* =========================================================================
 * ASSISTANT — the app does the bookkeeping, the user just answers.
 *
 * Every card is a piece of admin ordify noticed on its own (unlogged time,
 * a slipped deadline, billable work piling up, a stalled task) turned into
 * a one-tap question. Cards can always be dismissed; "skip" answers are
 * remembered so the same nag never comes back twice.
 * ========================================================================= */

const Assist = {
    _key: 'ordify-assist-dismissed',

    _dismissed() {
        try { return JSON.parse(localStorage.getItem(Assist._key)) || {}; }
        catch (e) { return {}; }
    },
    dismiss(id, days = 1) {
        const d = Assist._dismissed();
        d[id] = new Date(Date.now() + days * 86400000).toISOString();
        try { localStorage.setItem(Assist._key, JSON.stringify(d)); } catch (e) {}
    },
    _hidden(id) {
        const until = Assist._dismissed()[id];
        return !!until && until > new Date().toISOString();
    },

    cards() {
        const out = [];

        // unsorted intake — morning triage belongs at the top of the day
        const pending = inboxPending();
        if (pending > 0 && !Assist._hidden('inbox')) out.push({
            icon: 'mail', text: `${pending} email${pending === 1 ? '' : 's'} waiting to become tasks`,
            chips: [{ label: 'triage', assist: 'goinbox' },
                    { label: 'hide', assist: 'dismiss:inbox', ghost: true }]
        });

        // closed recently, nothing logged — the money is evaporating
        const recent = new Date(Date.now() - 48 * 3600000).toISOString();
        liveTasks().filter(t => t.status === 'done' && t.matterId
                && (t.completedAt || '') >= recent
                && !logsForTask(t.id).length && !Assist._hidden('log:' + t.id))
            .slice(0, 2).forEach(t => out.push({
                icon: 'clock', text: `“${t.title}” closed — no time on it`,
                chips: [15, 30, 60, 120].map(m => ({ label: fmtMinutes(m), assist: `log:${t.id}:${m}` }))
                    .concat([{ label: 'skip', assist: `dismiss:log:${t.id}`, ghost: true }])
            }));

        // overdue — reschedule honestly instead of letting it rot in red
        liveTasks().filter(t => taskStatus(t) === 'overdue' && !Assist._hidden('due:' + t.id))
            .slice(0, 2).forEach(t => {
                const days = Math.max(1, Math.round((Date.now() - new Date(t.due + 'T00:00:00').getTime()) / 86400000));
                out.push({
                    icon: 'alert', text: `“${t.title}” — ${days} day${days === 1 ? '' : 's'} overdue`,
                    chips: [
                        { label: 'today', assist: `due:${t.id}:0` },
                        { label: 'tomorrow', assist: `due:${t.id}:1` },
                        { label: '+1 week', assist: `due:${t.id}:7` },
                        { label: 'later', assist: `dismiss:due:${t.id}`, ghost: true }
                    ]
                });
            });

        // 5h+ of unbilled work on one client — worth turning into money
        liveClients().forEach(c => {
            const mins = state.logs.filter(l => l.clientId === c.id && !l.invoiceId && !l.deletedAt)
                .reduce((s, l) => s + l.minutes, 0);
            if (mins >= 300 && !Assist._hidden('bill:' + c.id)) out.push({
                icon: 'banknote', text: `${c.name} — ${fmtMinutes(mins)} unbilled (${fmtMoney(totalUnbilledForClient(c.id), profileCurrency())})`,
                chips: [{ label: '→ invoice', assist: `bill:${c.id}` },
                        { label: 'later', assist: `dismiss:bill:${c.id}`, ghost: true }]
            });
        });

        // stalled work — surface the blocker instead of hoping someone remembers
        liveTasks().filter(t => t.status !== 'done' && t.blockedReason && !Assist._hidden('stuck:' + t.id))
            .slice(0, 1).forEach(t => {
                const c = clientById(t.clientId);
                out.push({
                    icon: 'flag', text: `“${t.title}” — waiting on: ${t.blockedReason}`,
                    chips: [
                        ...(c && c.shareEnabled ? [{ label: 'nudge in portal', assist: `nudge:${t.clientId}` }] : []),
                        { label: 'open', assist: `open:${t.id}` },
                        { label: 'hide', assist: `dismiss:stuck:${t.id}`, ghost: true }
                    ]
                });
            });

        // dateless tasks can never appear in the day plan — that is how things get dropped
        const nodate = liveTasks().filter(t => t.status !== 'done' && !t.due);
        if (nodate.length >= 3 && !Assist._hidden('nodate')) out.push({
            icon: 'grid', text: `${nodate.length} open tasks have no date — invisible to your day plan`,
            chips: [{ label: 'show them', assist: 'filter:nodate' },
                    { label: 'hide', assist: 'dismiss:nodate', ghost: true }]
        });

        return out.slice(0, 4);
    },

    handle(cmd) {
        const [verb, ...rest] = cmd.split(':');
        if (verb === 'dismiss') { Assist.dismiss(rest.join(':')); render(); return; }
        if (verb === 'log') {
            const [id, mins] = rest, t = taskById(id), m = Number(mins);
            if (!t || !m) return;
            const end = Date.now();
            state.logs.push({
                id: uuid(), taskId: t.id, matterId: t.matterId, clientId: t.clientId,
                startedAt: new Date(end - m * 60000).toISOString(),
                endedAt: new Date(end).toISOString(),
                minutes: m, notes: t.title, invoiceId: null
            });
            Store.save(); render(); toast(`Logged ${fmtMinutes(m)}`);
            return;
        }
        if (verb === 'due') {
            const [id, days] = rest, t = taskById(id);
            if (!t) return;
            t.due = new Date(Date.now() + Number(days) * 86400000).toISOString().slice(0, 10);
            Tasks.put(t); render(); toast('Rescheduled to ' + fmtDate(t.due));
            return;
        }
        if (verb === 'goinbox') { navigate('inbox'); return; }
        if (verb === 'bill')   { openInvoiceForm(null, null, rest[0]); return; }
        if (verb === 'nudge')  { navigate('clients/' + rest[0]); return; }
        if (verb === 'open')   { openTaskForm(rest[0]); return; }
        if (verb === 'filter') { todayFilter = rest[0]; render(); }
    }
};

/* Soft-deletes hand the toast the exact objects they touched, so one click
 * puts a cascade back. Tasks live in their own collection and need a write
 * of their own; everything else rides along in the blob. */
function deletedWithUndo(message, { blob = [], tasks = [] }) {
    toast(message, 'ok', () => {
        blob.forEach(o => { delete o.deletedAt; });
        tasks.forEach(t => { delete t.deletedAt; Tasks.put(t); });
        Store.save();
        render();
        toast('Restored');
    });
}

/* Anything soft-deleted longer ago than this is gone for good. Without a
 * Trash view nothing would ever clear it out otherwise. */
const PURGE_AFTER_DAYS = 30;

function purgeOldDeletions() {
    const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 86400000).toISOString();
    const stale = (o) => o.deletedAt && o.deletedAt < cutoff;
    let n = 0;
    ['clients', 'matters', 'logs', 'invoices', 'attachments'].forEach(k => {
        const before = state[k].length;
        state[k] = state[k].filter(o => !stale(o));
        n += before - state[k].length;
    });
    state.tasks.filter(stale).forEach(t => { Tasks.remove(t.id); n++; });
    if (n) {
        console.log(`[ordify] purged ${n} item(s) deleted over ${PURGE_AFTER_DAYS} days ago`);
        Store.save();
    }
}

/* =========================================================================
 * 5. MODAL
 * ========================================================================= */

const Modal = {
    el: null,
    onSave: null,
    onDelete: null,

    init() {
        Modal.el = $('#modal');
        $('#modal-close').addEventListener('click', () => Modal.close());
        $('#modal-cancel').addEventListener('click', () => Modal.close());
        $('#modal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (Modal.onSave) {
                const data = Modal._collect();
                if (Modal.onSave(data) !== false) Modal.close();
            }
        });
        $('#modal-delete').addEventListener('click', () => {
            if (Modal.onDelete && confirm('Delete this item? This cannot be undone.')) {
                Modal.onDelete();
                Modal.close();
            }
        });
    },

    open({ title, fields, onSave, onDelete = null, saveLabel = 'Save', ai = false }) {
        $('#modal-title').textContent = title;
        $('#modal-save').textContent = saveLabel;
        $('#modal-delete').style.display = onDelete ? '' : 'none';
        Modal.onSave = onSave;
        Modal.onDelete = onDelete;
        Modal.fields = fields;
        Modal.title = title;
        Modal.aiHint = ai ? (ai.hint || 'Describe it in a sentence — I\'ll fill the fields') : null;
        // onDelete is present only for an existing record, so it is the honest
        // signal for "editing vs creating".
        const editing = !!onDelete;

        const body = $('#modal-body');
        body.classList.toggle('modal-has-ai', !!Modal.aiHint);
        body.classList.remove('reveal-minor');
        // When describing from scratch, only the essentials show; the long tail
        // of fields sits behind one disclosure so the form isn't the wall of
        // empty inputs the AI bar exists to spare you. When editing, every
        // field that already holds a value shows — you came to change them.
        body.innerHTML =
            (Modal.aiHint ? Modal._aiBarHtml() : '') +
            fields.map(f => Modal._renderField(f, Modal.aiHint ? !Modal._isPrimary(f, editing) : false)).join('') +
            (Modal.aiHint ? Modal._moreToggleHtml() : '');

        if (Modal.aiHint) { Modal._bindAiBar(); Modal._bindMoreToggle(); Modal._syncMoreToggle(); }
        Modal.el.showModal();
        // focus the AI bar when there is one — describing beats tabbing
        setTimeout(() => {
            const first = Modal.aiHint
                ? $('#modal-ai-input')
                : $('#modal-body input, #modal-body textarea, #modal-body select');
            if (first && !first.disabled) first.focus();
        }, 30);
    },

    /* A field earns a place above the "more fields" fold if it is required, or
     * (when editing) it already carries a value worth seeing. Everything else
     * starts collapsed and pops up the moment the AI fills it. */
    _isPrimary(f, editing) {
        if (f.required) return true;
        if (!editing) return false;
        if (f.type === 'checkbox') return !!f.value;
        return f.value != null && f.value !== '';
    },

    close() {
        Modal.onSave = null;
        Modal.onDelete = null;
        Modal.fields = null;
        Modal.aiHint = null;
        if (Recorder.listening && Recorder.target && Recorder.target.inModal) Recorder.stop();
        if (Modal.el.open) Modal.el.close();
        // drop the markup too: a form that bails out before opening would
        // otherwise leave the previous form's fields on screen
        $('#modal-body').innerHTML = '';
    },

    /* ---- describe-it-once bar ----
     * Filling seven fields by hand is the tax this app exists to remove, so
     * every form that has one offers the same escape hatch: say it in a
     * sentence, let Claude place the values, then correct what it got wrong. */
    _aiBarHtml() {
        return `
            <div class="modal-ai" id="modal-ai">
                <div class="mai-label" id="modal-ai-label" hidden>Not right? Say what to change</div>
                <div class="mai-row">
                    <input id="modal-ai-input" type="text" autocomplete="off"
                           placeholder="${esc(Modal.aiHint)}">
                    <button type="button" class="btn sm icon" id="modal-ai-mic"
                            title="Dictate" aria-label="Dictate">
                        <svg class="ic-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>
                    </button>
                    <button type="button" class="btn sm primary" id="modal-ai-go">Fill</button>
                </div>
                <div class="mai-status" id="modal-ai-status" hidden></div>
            </div>`;
    },

    /* After the first fill the bar is no longer "describe it" — it is the same
     * "say what to change" correction channel omni offers, so the gesture for
     * fixing the AI is identical whether you started here or from the top bar.
     * The fields are this form's proposal cards; this is its refine row. */
    _enterCorrectionMode() {
        const label = $('#modal-ai-label');
        const inp   = $('#modal-ai-input');
        const go     = $('#modal-ai-go');
        if (label) label.hidden = false;
        if (inp) inp.placeholder = 'e.g. the client is Datavise, due Friday';
        if (go) go.textContent = 'Redo';
    },

    _bindAiBar() {
        const inp = $('#modal-ai-input');
        const go  = $('#modal-ai-go');
        const mic = $('#modal-ai-mic');
        if (go)  go.addEventListener('click', () => Capture.submit(inp ? inp.value : '', { mode: 'fill' }));
        if (inp) inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); Capture.submit(inp.value, { mode: 'fill' }); }
        });
        // the one microphone, told which box it is serving
        if (mic) mic.addEventListener('click', () =>
            Capture.listen({ el: inp, btn: mic, mode: 'fill' }));
    },

    _aiStatus(msg, kind = '') {
        const el = $('#modal-ai-status');
        if (!el) return;
        el.hidden = !msg;
        el.textContent = msg || '';
        el.dataset.kind = kind;
    },

    async _aiFill(spoken) {
        const inp = $('#modal-ai-input');
        const text = (spoken != null ? spoken : (inp ? inp.value : '')).trim();
        if (!text) { if (inp) inp.focus(); return; }
        if (!state.profile.anthropicKey) {
            Modal._aiStatus('Add an Anthropic API key in Settings to use this.', 'bad');
            return;
        }
        if (Modal.aiBusy) return;
        Modal.aiBusy = true;
        Modal._aiStatus('Reading…');
        try {
            const { values, note } = await AI.fillForm({
                fields: Modal.fields,
                values: Modal._collect(),
                text,
                title: Modal.title
            });
            const filled = Modal._applyValues(values);
            if (!filled.length) {
                Modal._aiStatus(note || 'Nothing in that matched a field — try naming what you want set.', 'bad');
            } else {
                Modal._aiStatus(
                    `Filled ${filled.join(', ')}${note ? ' · ' + note : ''} — check it before saving.`, 'ok');
                if (inp) inp.value = '';
                Modal._enterCorrectionMode();
            }
        } catch (e) {
            console.error('form fill failed', e);
            Modal._aiStatus('Could not fill that: ' + (e.message || 'error'), 'bad');
        } finally {
            Modal.aiBusy = false;
        }
    },

    /* Write values into the live inputs rather than re-rendering, so anything
     * the user already typed by hand survives untouched. */
    _applyValues(values) {
        const done = [];
        Object.entries(values || {}).forEach(([name, val]) => {
            if (val == null || val === '') return;
            const el = $(`#modal-body [name="${CSS.escape(name)}"]`);
            if (!el) return;
            const spec = (Modal.fields || []).find(f => f.name === name);
            if (el.tagName === 'SELECT') {
                const ok = [...el.options].some(o => o.value == val);
                if (!ok) return;   // never leave a select on a value it can't hold
            }
            if (el.type === 'checkbox') el.checked = !!val;
            else el.value = val;
            el.classList.add('ai-filled');
            // a field the AI just filled must be visible to be checked, even if
            // it started life in the collapsed tail
            const field = el.closest('.field');
            if (field) field.removeAttribute('data-minor');
            el.dispatchEvent(new Event('change', { bubbles: true }));
            done.push(spec ? spec.label.toLowerCase() : name);
        });
        if (done.length) Modal._syncMoreToggle();
        return done;
    },

    _renderField(f, minor = false) {
        const id = 'mf_' + f.name;
        const val = f.value ?? '';
        const req = f.required ? 'required' : '';
        const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
        let input = '';
        if (f.type === 'textarea') {
            input = `<textarea id="${id}" name="${f.name}" ${req} ${ph} rows="${f.rows || 4}">${esc(val)}</textarea>`;
        } else if (f.type === 'select') {
            input = `<select id="${id}" name="${f.name}" ${req}>` +
                f.options.map(o => `<option value="${esc(o.value)}" ${o.value == val ? 'selected':''}>${esc(o.label)}</option>`).join('') +
                `</select>`;
        } else if (f.type === 'checkbox') {
            input = `<label class="cb"><input type="checkbox" id="${id}" name="${f.name}" ${val ? 'checked':''}> ${esc(f.checkboxLabel || '')}</label>`;
        } else {
            input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}" ${req} ${ph} ${f.step?`step="${f.step}"`:''} ${f.min!=null?`min="${f.min}"`:''}>`;
        }
        return `
            <div class="field ${f.full ? 'full':''}" ${minor ? 'data-minor' : ''}>
                ${f.type === 'checkbox' ? '' : `<label for="${id}">${esc(f.label)}${f.required?' *':''}</label>`}
                ${input}
                ${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ''}
            </div>
        `;
    },

    /* ---- "more fields" disclosure ----
     * One button reveals the collapsed tail. AI-filling a field also reveals
     * just that field, so accepting the AI's work never means hunting through
     * a disclosure to confirm it. */
    _moreToggleHtml() {
        return `<button type="button" class="more-fields" id="modal-more" hidden>
            <span class="chev" aria-hidden="true">›</span><span class="more-label"></span>
        </button>`;
    },

    _bindMoreToggle() {
        const btn = $('#modal-more');
        if (btn) btn.addEventListener('click', () => {
            $('#modal-body').classList.toggle('reveal-minor');
            Modal._syncMoreToggle();
        });
    },

    /* Keep the button's label and visibility honest as fields get revealed. */
    _syncMoreToggle() {
        const btn = $('#modal-more');
        const body = $('#modal-body');
        if (!btn || !body) return;
        const hidden = $$('.field[data-minor]', body).length;
        if (!hidden) { btn.hidden = true; return; }
        btn.hidden = false;
        const open = body.classList.contains('reveal-minor');
        btn.classList.toggle('open', open);
        $('.more-label', btn).textContent = open
            ? 'Fewer fields'
            : `${hidden} more field${hidden === 1 ? '' : 's'}`;
    },

    _collect() {
        const out = {};
        $$('#modal-body [name]').forEach(el => {
            if (el.type === 'checkbox') out[el.name] = el.checked;
            else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
            else out[el.name] = el.value;
        });
        return out;
    }
};

/* =========================================================================
 * 6. ROUTER
 * ========================================================================= */

/* =========================================================================
 * 5b. VIEW STATE — how you are looking at the data, kept apart from the data.
 *
 * Every mutation re-renders the whole view, which threw all of this away:
 * anything you had expanded closed itself, and the caret jumped out of the
 * field you were typing in. Data changes constantly; the way you are looking
 * at it should survive that. Two earlier patches (keeping comment drafts on
 * the client page, writing AI values straight into live inputs) were really
 * this same problem worked around twice.
 * ========================================================================= */

const UI = {
    expanded: new Set(),          // tree nodes the user has opened
    route: null,                  // the route currently on screen

    isOpen(id) { return UI.expanded.has(id); },
    open(id)   { UI.expanded.add(id); },
    toggleOpen(id) {
        if (UI.expanded.has(id)) UI.expanded.delete(id); else UI.expanded.add(id);
    }
};

/* The page scrolls on the window — #view has no overflow of its own, so the
 * old `root.scrollTop = 0` never did anything. */
function _captureFocus() {
    const el = document.activeElement;
    const view = $('#view');
    if (!el || !view || !view.contains(el)) return null;
    // An id is the surest handle, but most fields in the app only carry a
    // name — without that fallback this would restore almost nothing.
    const sel = el.id ? '#' + CSS.escape(el.id)
              : el.name ? `[name="${CSS.escape(el.name)}"]`
              : null;
    if (!sel) return null;
    const f = { sel };
    // Carry the half-typed value across too: a re-render rebuilds the field
    // from state, and whatever you had not saved yet is not in state — which
    // is exactly how typing disappears mid-sentence.
    if (typeof el.value === 'string' && el.type !== 'password') f.value = el.value;
    if (typeof el.selectionStart === 'number') {
        f.start = el.selectionStart;
        f.end = el.selectionEnd;
    }
    return f;
}

function _restoreFocus(f) {
    if (!f) return;
    const el = $('#view ' + f.sel) || $(f.sel);
    if (!el) return;
    if (f.value != null && typeof el.value === 'string' && el.value !== f.value) {
        el.value = f.value;
    }
    el.focus({ preventScroll: true });
    if (f.start != null && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(f.start, f.end); } catch (e) {}
    }
}

/* Replace one region instead of the whole view — a branch of the tree can
 * redraw without disturbing the page around it, or the caret inside it. */
function patch(hostOrSelector, html) {
    const host = typeof hostOrSelector === 'string' ? $(hostOrSelector) : hostOrSelector;
    if (!host) return false;
    const focus = _captureFocus();
    host.innerHTML = html;
    _restoreFocus(focus);
    return true;
}

function parseHash() {
    const h = (location.hash || '#/today').replace(/^#\/?/, '');
    const parts = h.split('/').filter(Boolean);
    return { view: parts[0] || 'today', id: parts[1] || null, sub: parts[2] || null };
}

function navigate(path) {
    location.hash = path.startsWith('#') ? path : '#/' + path.replace(/^\//,'');
}

window.addEventListener('hashchange', render);

/* =========================================================================
 * 7. TIMER
 * ========================================================================= */

const Timer = {
    tickInterval: null,
    init() {
        $('#timer-stop').addEventListener('click', () => Timer.stop());
        Timer._refresh();
    },
    start({ taskId = null, matterId = null, clientId = null, label = '' }) {
        if (state.timer) {
            if (!confirm('Another timer is running. Stop it and start a new one?')) return;
            Timer.stop({ silent: true });
        }
        if (!matterId) {
            toast('Pick a project first', 'error');
            return;
        }
        state.timer = {
            taskId, matterId, clientId,
            label: label || (taskById(taskId)?.title || matterById(matterId)?.title || 'Work'),
            startedAt: new Date().toISOString()
        };
        Store.save();
        Timer._refresh();
        toast('Timer started');
    },
    stop({ silent = false } = {}) {
        if (!state.timer) return;
        const t = state.timer;
        const start = new Date(t.startedAt).getTime();
        const minutes = Math.max(1, Math.round((Date.now() - start) / 60000));
        const log = {
            id: uuid(),
            taskId: t.taskId,
            matterId: t.matterId,
            clientId: t.clientId,
            startedAt: t.startedAt,
            endedAt: new Date().toISOString(),
            minutes,
            notes: t.label || '',
            invoiceId: null
        };
        state.logs.push(log);
        state.timer = null;
        Store.save();
        Timer._refresh();
        if (!silent) toast(`Logged ${fmtMinutes(minutes)}`);
        render();
    },
    _refresh() {
        const strip = $('#timer-strip');
        clearInterval(Timer.tickInterval);
        if (!state.timer) {
            strip.hidden = true;
            return;
        }
        strip.hidden = false;
        const labelEl = $('#timer-label');
        const clockEl = $('#timer-clock');
        const update = () => {
            const ms = Date.now() - new Date(state.timer.startedAt).getTime();
            clockEl.textContent = fmtClock(ms);
            labelEl.textContent = state.timer.label;
        };
        update();
        Timer.tickInterval = setInterval(update, 1000);
    }
};

/* =========================================================================
 * 8. SIDEBAR
 * ========================================================================= */

/* Three groups = three working modes with different rhythms:
 *   day   — "what am I doing right now"      (opened every morning)
 *   work  — "who and what am I working for"  (a few times a week)
 *   money — "what do I get paid for it"      (end of month)
 * Note: internally a project is still `matter` everywhere (matterId,
 * mattersForClient …) — only the words the user sees changed. */
/* Inbox is deliberately NOT here: it is an intake pipe (email → task),
 * not a destination — so it lives in the topbar next to omni, its sibling
 * intake pipe, and announces itself on Today via an assistant card. */
const NAV_GROUPS = [
    { label: 'day',   items: [
        { id: 'today',    label: 'today',     icon: 'circle' } ] },
    { label: 'work',  items: [
        { id: 'clients',  label: 'clients',   icon: 'users' },
        { id: 'matters',  label: 'projects',  icon: 'folder' } ] },
    { label: 'money', items: [
        { id: 'time',     label: 'time',      icon: 'clock' },
        { id: 'invoices', label: 'invoices',  icon: 'receipt' } ] }
];
const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

function renderSidebar() {
    // #/tasks is an alias for Today, so it must light up the same nav item
    const cur = parseHash().view === 'tasks' ? 'today' : parseHash().view;
    const nav = $('#nav');
    const item = (it) => {
        let count = '';
        if (it.id === 'today') {
            const n = liveTasks().filter(t => taskStatus(t) !== 'done' && (t.due === todayISO() || taskStatus(t) === 'overdue')).length;
            if (n) count = `<span class="count">${n}</span>`;
        } else if (it.id === 'clients') count = `<span class="count">${liveClients().length || ''}</span>`;
        else if (it.id === 'matters') count = `<span class="count">${liveMatters().filter(m=>m.status!=='closed').length || ''}</span>`;
        else if (it.id === 'invoices') count = `<span class="count">${liveInvoices().filter(i=>i.status!=='paid').length || ''}</span>`;

        return `<button class="nav-item ${cur===it.id?'active':''}" data-nav="${it.id}">
            <span class="ic">${icon(it.icon)}</span><span>${it.label}</span>${count}
        </button>`;
    };
    nav.innerHTML = NAV_GROUPS.map(g =>
        `<div class="nav-group-label">${g.label}</div>` + g.items.map(item).join('')
    ).join('');
    nav.onclick = (e) => {
        const btn = e.target.closest('[data-nav]');
        if (btn) navigate(btn.dataset.nav);
    };
    $('#settings-btn').onclick = () => navigate('settings');
    const ib = $('#omni-inbox');
    if (ib && !ib.dataset.wired) {
        ib.dataset.wired = '1';
        ib.addEventListener('click', () => navigate('inbox'));
    }
    updateInboxBadge();
}

/* =========================================================================
 * 9. SEARCH — replaced by omni.js (Omni module)
 * ========================================================================= */

/* =========================================================================
 * 10. VIEW: TODAY
 * ========================================================================= */

const NUM_WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const numWord = (n) => NUM_WORDS[n] || String(n);

function weekStartDate() {
    const d = new Date();
    const dow = (d.getDay() + 6) % 7;   // Monday = 0
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
}

function viewToday() {
    const today = todayISO();
    const now = new Date();
    const tasks = liveTasks();
    const openTasks = tasks.filter(t => t.status !== 'done');
    const dueToday  = openTasks.filter(t => t.due === today);
    const overdue   = openTasks.filter(t => t.due && t.due < today);
    const doneToday = tasks.filter(t => t.status === 'done' && (t.completedAt || '').slice(0,10) === today);

    // time logged this week
    const wkStart = weekStartDate();
    const weekLogs = liveLogs().filter(l => new Date(l.startedAt) >= wkStart);
    const weekMins = weekLogs.reduce((s, l) => s + l.minutes, 0);
    const weekBillable = weekLogs.reduce((s, l) =>
        s + (l.minutes / 60) * matterRate(matterById(l.matterId)), 0);

    // nearest upcoming deadline
    const upcoming = openTasks.filter(t => t.due && t.due >= today)
        .sort((a, b) => a.due.localeCompare(b.due));
    const nextDeadline = upcoming[0] || null;
    const daysToDeadline = nextDeadline
        ? Math.round((new Date(nextDeadline.due) - new Date(today)) / 86400000)
        : null;

    // headline + greeting
    const matterCount = overdue.length + dueToday.length;
    const headline = matterCount === 0
        ? `a clear day ahead`
        : `${numWord(matterCount)} thing${matterCount === 1 ? '' : 's'} to clear today`;
    const hr = now.getHours();
    const greet = hr < 12 ? 'good morning' : hr < 18 ? 'good afternoon' : 'good evening';
    const firstName = (state.profile.name || '').trim().split(/\s+/)[0].toLowerCase() || 'there';

    // timer stat
    let timerVal = '—', timerSub = 'not running';
    if (state.timer) {
        const mins = Math.round((Date.now() - new Date(state.timer.startedAt).getTime()) / 60000);
        timerVal = fmtMinutes(mins);
        timerSub = state.timer.label || 'running';
    }

    // The task list below the schedule replaces the old separate Tasks view:
    // same tasks, sliced by when they are due rather than by which screen
    // you happened to open.
    const wkEnd = new Date(wkStart); wkEnd.setDate(wkEnd.getDate() + 7);
    const wkEndISO = wkEnd.toISOString().slice(0, 10);

    const byUrgency = (a, b) =>
        (a.due || '9999').localeCompare(b.due || '9999')
        || ({ high: 0, normal: 1, low: 2 }[a.priority || 'normal'] - { high: 0, normal: 1, low: 2 }[b.priority || 'normal']);

    let list;
    if (todayFilter === 'today')        list = [...overdue, ...dueToday];
    else if (todayFilter === 'overdue') list = [...overdue];
    else if (todayFilter === 'nodate')  list = openTasks.filter(t => !t.due);
    else if (todayFilter === 'all')     list = [...openTasks].sort(byUrgency);
    else if (todayFilter === 'done')    list = liveTasks().filter(t => t.status === 'done')
                                                .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
                                                .slice(0, 50);
    else /* week */                     list = [
        ...overdue,
        ...dueToday,
        ...openTasks.filter(t => t.due && t.due > today && t.due < wkEndISO),
        ...openTasks.filter(t => !t.due).slice(0, 4)
    ];
    const seen = new Set();
    list = list.filter(t => (seen.has(t.id) ? false : seen.add(t.id)));

    const FILTERS = [
        ['today',   'today'],
        ['week',    'this week'],
        ['overdue', 'overdue'],
        ['nodate',  'no date'],
        ['all',     'all open'],
        ['done',    'done']
    ];
    const counts = {
        today:   overdue.length + dueToday.length,
        overdue: overdue.length,
        nodate:  openTasks.filter(t => !t.due).length,
        all:     openTasks.length
    };
    const chips = FILTERS.map(([id, label]) => {
        const n = counts[id];
        return `<button class="chip ${todayFilter === id ? 'on' : ''}" data-filter="${id}"
            aria-pressed="${todayFilter === id}">${label}${n ? `<span class="chip-n">${n}</span>` : ''}</button>`;
    }).join('');

    const EMPTY = {
        today:   'Nothing due today. Enjoy it.',
        week:    'No open tasks this week — capture one with the bar above.',
        overdue: 'Nothing overdue. ✓',
        nodate:  'Every open task has a date on it.',
        all:     'No open tasks at all.',
        done:    'Nothing completed yet.'
    };

    return `
    <div class="today-v3">
        <div class="t-daterow">
            <span class="now">${now.toLocaleDateString(undefined,{weekday:'long', day:'2-digit', month:'long', year:'numeric'}).toLowerCase()}</span>
            <span class="sep">/</span>
            <span class="clock"><span class="pulse"></span>${now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            <span class="sep">/</span>
            <span>${overdue.length} overdue · ${openTasks.length} open</span>
        </div>

        <!-- The hero answers "what should I be doing right now": the ongoing
             or imminent meeting (with join), else the most urgent task. The
             decorative greeting this replaced answered nothing. -->
        <div id="t-now">${nowCardHtml()}</div>

        <div class="t-statline">
            <span>${doneToday.length} closed today</span><span class="sep">·</span>
            <span class="${state.timer?'accent':''}">timer ${esc(timerVal)}</span><span class="sep">·</span>
            <span>${(weekMins/60).toFixed(1)}h this week · ${fmtMoney(weekBillable, profileCurrency())}</span><span class="sep">·</span>
            <span class="${daysToDeadline != null && daysToDeadline <= 2 ? 'warn' : ''}">next deadline ${daysToDeadline != null ? 'in ' + daysToDeadline + 'd' : '—'}</span>
        </div>

        ${(() => {
            const cards = Assist.cards();
            return cards.length ? `
        <section class="t-assist" aria-label="Suggestions">
            ${cards.map(c => `
            <div class="assist-card">
                <span class="assist-ic">${icon(c.icon)}</span>
                <span class="assist-text">${esc(c.text)}</span>
                <span class="assist-chips">${c.chips.map(ch =>
                    `<button class="chip ${ch.ghost ? 'ghost' : ''}" data-assist="${esc(ch.assist)}">${esc(ch.label)}</button>`).join('')}</span>
            </div>`).join('')}
        </section>` : '';
        })()}

        <!-- Two different kinds of thing, so two different shapes: the day is
             fixed and time-ordered (a rail), the list is yours to reorder and
             tick off (a checklist). They used to look identical. -->
        <section class="t-sec is-schedule">
            <div class="t-sechdr">
                <span class="sec-ic">${icon('calendar', 15)}</span>
                <h2>schedule</h2>
                <span class="right t-ranges" role="group" aria-label="Schedule range">
                    ${Object.keys(SCHEDULE_RANGES).map(r =>
                        `<button class="chip ${scheduleRange === r ? 'on' : ''}" data-range="${r}"
                            aria-pressed="${scheduleRange === r}">${r}</button>`).join('')}
                </span>
            </div>
            <div id="t-schedule" class="t-schedule"><div class="t-sched-msg">Loading…</div></div>
        </section>

        <section class="t-sec is-tasks">
            <div class="t-sechdr">
                <span class="sec-ic">${icon('checklist', 15)}</span>
                <h2>tasks</h2>
                <span class="count">${list.length}</span>
                <span class="right"><button class="btn sm primary" data-act="new-task">＋ task</button></span>
            </div>
            <div class="t-filters" role="group" aria-label="Filter tasks">${chips}</div>
            ${list.length
                ? `<div class="t-tasks">${list.map(_todayTaskRow).join('')}</div>`
                : `<div class="t-sched-msg">${EMPTY[todayFilter] || EMPTY.week}</div>`}
        </section>
    </div>`;
}

function _todayTaskRow(t) {
    const cli = clientById(t.clientId);
    const mat = matterById(t.matterId);
    const st = taskStatus(t);
    const due = t.due
        ? (st === 'overdue' ? `overdue · ${fmtDate(t.due)}`
            : t.due === todayISO() ? 'due today'
            : `due ${fmtDate(t.due)}`)
        : '';
    const cliName = (cli && cli.name) || t.clientName || '';
    const matName = (mat && mat.title) || t.matterName || '';
    const ctx = [cliName, matName, due,
        t.assigneeEmail ? '→ ' + t.assigneeEmail : '',
        (t.status !== 'done' && t.blockedReason) ? 'stuck: ' + t.blockedReason : '']
        .filter(Boolean).map(x => esc(x)).join(' · ');
    return `
        <div class="t-task ${st==='done'?'done':''} ${st==='overdue'?'overdue':''}" data-task="${t.id}">
            <span class="t-check ${st==='done'?'done':''}" data-toggle="${t.id}"></span>
            <div class="t-task-body">
                <div class="t-task-title">${esc(t.title)}</div>
                ${ctx ? `<div class="t-task-ctx">${ctx}</div>` : ''}
            </div>
            ${mat ? `<button class="t-task-go" data-start="${t.id}" title="Start timer">${icon('play', 12)}</button>` : ''}
        </div>`;
}

/* =========================================================================
 * NOW — the hero of Today.
 * Priority: an ongoing meeting > a meeting starting within 3h > the most
 * urgent open task. Calendar data arrives async, so the card renders
 * immediately from tasks and upgrades itself once events land.
 * ========================================================================= */

let todayEventsCache = [];

/* How far ahead the schedule looks. Today is the default because the day
 * plan is the daily ritual; week and month answer a planning question. */
const SCHEDULE_RANGES = { today: 0, week: 6, month: 30 };
let scheduleRange = 'today';

function nowCardHtml() {
    const nowMs = Date.now();
    const timed = todayEventsCache.filter(e => !e.allDay && e.start && e.end);
    const ongoing = timed.find(e => new Date(e.start) <= nowMs && new Date(e.end) >= nowMs);
    const next = timed.filter(e => new Date(e.start) > nowMs)
        .sort((a, b) => a.start.localeCompare(b.start))[0];
    const ev = ongoing || (next && (new Date(next.start) - nowMs) < 3 * 3600000 ? next : null);

    if (ev) {
        const mins = ongoing
            ? Math.max(1, Math.round((new Date(ev.end) - nowMs) / 60000))
            : Math.max(1, Math.round((new Date(ev.start) - nowMs) / 60000));
        return `
        <div class="now-card ${ongoing ? 'live' : ''}">
            <div class="now-k">${ongoing ? 'in a meeting' : 'next up'}</div>
            <div class="now-title">${esc(ev.title)}</div>
            <div class="now-meta">${ongoing ? mins + 'm left' : 'in ' + mins + 'm'}${ev.calendar ? ' · ' + esc(ev.calendar) : ''}${ev.location ? ' · ' + esc(ev.location) : ''}</div>
            ${ev.joinLink ? `<div class="now-actions"><a class="btn primary" href="${esc(ev.joinLink)}" target="_blank" rel="noopener">join ↗</a></div>` : ''}
        </div>`;
    }

    const rank = { high: 0, normal: 1, low: 2 };
    const t = liveTasks().filter(x => x.status !== 'done').sort((a, b) =>
        ((taskStatus(b) === 'overdue') - (taskStatus(a) === 'overdue'))
        || (a.due || '9999').localeCompare(b.due || '9999')
        || (rank[a.priority || 'normal'] - rank[b.priority || 'normal']))[0];
    if (!t) return '';
    const cli = clientById(t.clientId), mat = matterById(t.matterId);
    const meta = [cli?.name, mat?.title,
        t.due ? (taskStatus(t) === 'overdue' ? 'overdue · ' + fmtDate(t.due) : 'due ' + fmtDate(t.due)) : '']
        .filter(Boolean).map(esc).join(' · ');
    return `
        <div class="now-card">
            <div class="now-k">focus</div>
            <div class="now-title" data-task="${t.id}" role="button" tabindex="0">${esc(t.title)}</div>
            ${meta ? `<div class="now-meta">${meta}</div>` : ''}
            <div class="now-actions">
                ${t.matterId ? `<button class="btn primary" data-start="${t.id}">${icon('play', 13)} start timer</button>` : ''}
                <button class="btn" data-toggle="${t.id}">${icon('check', 13)} done</button>
            </div>
        </div>`;
}

/* Today's calendar — fetched async after the view renders. */
async function populateTodaySchedule() {
    const host = document.getElementById('t-schedule');
    if (!host) return;
    if (!Google.configured()) {
        host.innerHTML = `<div class="t-sched-msg">Connect Google Calendar in <a href="#/settings">Settings</a> to see today's schedule.</div>`;
        return;
    }
    if (!Google.hasToken()) {
        host.innerHTML = `<button class="btn" id="t-cal-connect">Show today's calendar</button>`;
        const btn = document.getElementById('t-cal-connect');
        if (btn) btn.addEventListener('click', () => {
            // call Google.connect() directly in the click → popup is not blocked
            Google.connect().then(() => {
                host.innerHTML = `<div class="t-sched-msg">Loading calendar…</div>`;
                populateTodaySchedule();
            }).catch((e) => {
                host.innerHTML = `<div class="t-sched-msg">Sign-in failed: ${esc(e.message || 'cancelled')}</div>`;
            });
        });
        return;
    }
    host.innerHTML = `<div class="t-sched-msg">Loading calendar…</div>`;
    try {
        const days = SCHEDULE_RANGES[scheduleRange] ?? 0;
        const events = await Google.listEvents(days);

        // The NOW hero only ever concerns today, so it takes today's slice
        // no matter how far ahead the schedule below is looking.
        const todayISOstr = todayISO();
        todayEventsCache = events.filter(e => (e.start || '').slice(0, 10) === todayISOstr);
        const nowHost = document.getElementById('t-now');
        if (nowHost) nowHost.innerHTML = nowCardHtml();

        if (!events.length) {
            host.innerHTML = `<div class="t-sched-msg">${
                scheduleRange === 'today' ? 'No events on the calendar today.'
                : scheduleRange === 'week' ? 'Nothing scheduled in the next 7 days.'
                : 'Nothing scheduled in the next 30 days.'}</div>`;
            return;
        }

        const nowMs = Date.now();
        let html = '';
        let nowLineInserted = false;
        let lastDay = null;
        events.forEach(ev => {
            const day = (ev.start || '').slice(0, 10);
            // Day headers only make sense once the range spans more than a day
            if (scheduleRange !== 'today' && day && day !== lastDay) {
                lastDay = day;
                const d = new Date(day + 'T00:00:00');
                const label = day === todayISOstr
                    ? 'today'
                    : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase();
                const count = events.filter(e => (e.start || '').slice(0, 10) === day).length;
                html += `<div class="t-dayhdr ${day === todayISOstr ? 'is-today' : ''}">
                    <span>${esc(label)}</span><span class="n">${count}</span></div>`;
            }
            const startMs = ev.start ? new Date(ev.start).getTime() : 0;
            if (!nowLineInserted && !ev.allDay && startMs > nowMs && day === todayISOstr) {
                html += `<div class="t-nowline"><span>now · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>`;
                nowLineInserted = true;
            }
            html += _scheduleSlot(ev, nowMs);
        });
        host.innerHTML = html;
    } catch (e) {
        console.error('calendar load failed', e);
        host.innerHTML = `<div class="t-sched-msg">Calendar unavailable: ${esc(e.message || 'error')}</div>`;
    }
}

function _scheduleSlot(ev, nowMs) {
    const fmt = (iso) => new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const when = ev.allDay
        ? 'all day'
        : `${fmt(ev.start)}<span class="end">→ ${fmt(ev.end)}</span>`;
    const isPast = !ev.allDay && new Date(ev.end).getTime() < nowMs;
    const isNow  = !ev.allDay && new Date(ev.start).getTime() <= nowMs && new Date(ev.end).getTime() >= nowMs;
    const ctx = [ev.calendar, ev.location].filter(Boolean).map(x=>esc(x)).join(' · ');
    // There must always be a way into the meeting: the join URL when one is
    // detectable, otherwise the event in Google Calendar, where it lives.
    const action = isPast ? ''
        : ev.joinLink
            ? `<a class="t-slot-join" href="${esc(ev.joinLink)}" target="_blank" rel="noopener">${icon('video', 13)} join</a>`
            : ev.htmlLink
                ? `<a class="t-slot-join ghost" href="${esc(ev.htmlLink)}" target="_blank" rel="noopener">open ↗</a>`
                : '';
    return `
        <div class="t-slot ${isPast?'past':''} ${isNow?'now':''}">
            <div class="t-slot-when">${when}</div>
            <div class="t-slot-marker"></div>
            <div class="t-slot-body">
                <div class="t-slot-what">${esc(ev.title)}</div>
                ${ctx ? `<div class="t-slot-ctx">${ctx}</div>` : ''}
            </div>
            ${action ? `<div class="t-slot-action">${action}</div>` : ''}
        </div>`;
}

function renderTaskList(tasks) {
    if (!tasks.length) return '<div class="empty">No tasks.</div>';
    return `<table class="t"><tbody>
        ${tasks.map(t => {
            const cli = clientById(t.clientId);
            const mat = matterById(t.matterId);
            const st = taskStatus(t);
            const meta = [
                (cli && cli.name) || t.clientName || '',
                (mat && mat.title) || t.matterName || '',
                t.assigneeEmail ? '→ ' + t.assigneeEmail : ''
            ].filter(Boolean).map(x => esc(x)).join(' · ');
            return `
                <tr class="row" data-task="${t.id}">
                    <td style="width:32px"><span class="check ${st==='done'?'done':''}" data-toggle="${t.id}"></span></td>
                    <td>
                        <div class="task-title ${st==='done'?'is-done':''}">${esc(t.title)}</div>
                        ${meta ? `<div class="task-meta">${meta}</div>` : ''}
                    </td>
                    <td>${(() => {
                        // ONE colored signal per row — badge soup tells the eye nothing.
                        // Urgency order: overdue > stuck > high priority; the due date
                        // itself is quiet text unless it IS the alarm.
                        if (st === 'overdue') return `<span class="badge overdue">${fmtDate(t.due)}</span>`;
                        const dueTxt = t.due ? `<span class="due-quiet">${fmtDate(t.due)}</span> ` : '';
                        if (t.status !== 'done' && t.blockedReason)
                            return dueTxt + `<span class="badge stuck" title="${esc(t.blockedReason)}">stuck</span>`;
                        if (t.status !== 'done' && t.priority === 'high')
                            return dueTxt + `<span class="badge high">high</span>`;
                        return dueTxt;
                    })()}</td>
                    <td style="width:80px">
                        ${mat ? `<button class="play" data-start="${t.id}" title="Start timer">${icon('play', 12)}</button>` : ''}
                        ${t.due ? `<button class="play" data-act="gcal-task" data-id="${t.id}" title="Add to Google Calendar" style="width:auto;padding:0 6px">${icon('calendar', 13)}</button>` : ''}
                    </td>
                </tr>`;
        }).join('')}
    </tbody></table>`;
}

/* =========================================================================
 * 11. VIEW: CLIENTS
 * ========================================================================= */

function viewClients() {
    // Dragged clients keep the order you gave them; the rest stay alphabetical
    // behind them, so pulling one to the front doesn't scramble everything else.
    const list = ordered(liveClients().slice()
        .sort((a,b) => (a.name||'').localeCompare(b.name||'')));
    return `
        <div class="view-head">
            <h1>Clients</h1>
            <div class="meta">${list.length} total</div>
            <div class="actions">
                <button class="btn primary" data-act="new-client">＋ New client</button>
            </div>
        </div>

        ${list.length === 0 ? `
            <div class="empty-state">
                <h3>No clients yet</h3>
                <p>Add your first client to start tracking matters and time.</p>
                <button class="btn primary" data-act="new-client">＋ New client</button>
            </div>
        ` : `
            <div class="entity-grid">
                ${list.map(c => {
                    const matters = mattersForClient(c.id).length;
                    const openTasks = tasksForClient(c.id).filter(t => t.status !== 'done').length;
                    const stuck = tasksForClient(c.id).filter(t => t.status !== 'done' && t.blockedReason).length;
                    const unbilled = totalUnbilledForClient(c.id);
                    return `<div class="entity-card" data-go="clients/${c.id}" role="link" tabindex="0"
                        draggable="true" data-drag="client" data-drag-id="${esc(c.id)}">
                        <div class="e-name">${esc(c.name)}</div>
                        ${c.email ? `<div class="e-sub">${esc(c.email)}</div>` : ''}
                        <div class="e-stats">
                            <span>${matters} project${matters === 1 ? '' : 's'}</span>
                            <span>${openTasks} open</span>
                            ${unbilled ? `<span class="e-money">${fmtMoney(unbilled, profileCurrency())} unbilled</span>` : ''}
                        </div>
                        <div class="e-flags">
                            ${stuck ? `<span class="badge stuck">${stuck} stuck</span>` : ''}
                            ${c.shareEnabled ? `<span class="badge open">portal</span>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `}
    `;
}

function viewClient(id) {
    const c = clientById(id);
    if (!c) return `<div class="empty-state"><h3>Client not found</h3><a href="#/clients">Back</a></div>`;
    const matters = mattersForClient(id);
    const tasks = tasksForClient(id);
    const logs = logsForClient(id);
    const totalMins = logs.reduce((s,l)=>s+l.minutes,0);
    const unbilled = totalUnbilledForClient(id);
    const invoices = liveInvoices().filter(i => i.clientId === id);

    return `
        <div class="breadcrumb"><a href="#/clients">Clients</a> ›</div>
        <div class="view-head">
            <h1>${esc(c.name)}</h1>
            <div class="actions">
                <button class="btn" data-act="edit-client" data-id="${c.id}">Edit</button>
                <button class="btn primary" data-act="new-matter" data-client="${c.id}">＋ New project</button>
            </div>
        </div>

        <div class="cards">
            <div class="card"><div class="card-label">Projects</div><div class="card-value">${matters.length}</div></div>
            <div class="card"><div class="card-label">Total time</div><div class="card-value">${fmtMinutes(totalMins)}</div></div>
            <div class="card"><div class="card-label">Unbilled</div><div class="card-value">${fmtMoney(unbilled, profileCurrency())}</div></div>
            <div class="card"><div class="card-label">Open tasks</div><div class="card-value">${tasks.filter(t=>t.status!=='done').length}</div></div>
        </div>

        <div class="info-grid">
            ${c.email ? `<div><span class="lbl">Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ''}
            ${c.phone ? `<div><span class="lbl">Phone</span>${esc(c.phone)}</div>` : ''}
            ${c.website ? `<div><span class="lbl">Website</span><a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.website.replace(/^https?:\/\//, ''))}</a></div>` : ''}
            ${c.taxId ? `<div><span class="lbl">Tax ID</span>${esc(c.taxId)}</div>` : ''}
            ${c.address ? `<div><span class="lbl">Address</span>${esc(c.address)}</div>` : ''}
        </div>
        ${c.notes ? `<div class="notes-block">${esc(c.notes)}</div>` : ''}

        <h2 class="section-h">Client portal</h2>
        ${c.shareEnabled && c.shareId ? (() => {
            const cur = Share.doneDays(c);
            const opts = [
                [7, '7 days'], [30, '30 days'], [90, '3 months'],
                [180, '6 months'], [365, '12 months']
            ].map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('');
            return `
            <div class="share-box">
                <div class="share-row">
                    <input class="share-url" id="share-url" readonly value="${esc(Share.url(c))}" onclick="this.select()">
                    <button class="btn" data-act="share-copy" data-id="${c.id}">Copy link</button>
                    <a class="btn" href="${esc(Share.url(c))}" target="_blank" rel="noopener">Open</a>
                    <button class="btn" data-act="share-disable" data-id="${c.id}">Disable</button>
                </div>
                <div class="share-row">
                    <label class="share-opt" for="share-done-days">Show completed tasks from the last</label>
                    <select id="share-done-days" class="share-select" data-id="${c.id}">${opts}</select>
                </div>
                <div class="share-row">
                    <label class="share-opt cb">
                        <input type="checkbox" id="share-comments" data-id="${c.id}" ${c.shareComments !== false ? 'checked' : ''}>
                        Let ${esc(c.name)} reply to tasks on the portal
                    </label>
                </div>
                <small class="hint">Live status page for ${esc(c.name)}: tasks, priorities, deadlines and what's stuck.
                Rates, amounts, invoices and internal notes are never published. Updates automatically.
                Disabling kills the link immediately.</small>
            </div>`;
        })() : `
            <div class="share-box">
                <button class="btn primary" data-act="share-enable" data-id="${c.id}">Share status page with client</button>
                <small class="hint">Creates a secret live link the client can open — their tasks, priorities,
                deadlines and stuck items only. No rates, amounts, invoices or internal notes.</small>
            </div>
        `}

        ${renderClientThread(c)}

        <h2 class="section-h">Attachments</h2>
        <div id="att-host-client"></div>

        <h2 class="section-h">Work</h2>
        ${renderClientTree(c.id)}
        ${invoices.length ? `
            <h2 class="section-h">Invoices</h2>
            <table class="t">
                <thead><tr><th>Number</th><th>Issued</th><th>Status</th><th class="num">Amount</th></tr></thead>
                <tbody>${invoices.map(inv => `
                    <tr class="row" data-go="invoices/${inv.id}">
                        <td>${esc(inv.number)}</td>
                        <td>${fmtDate(inv.dateIssued)}</td>
                        <td><span class="badge ${inv.status}">${esc(inv.status)}</span></td>
                        <td class="num">${fmtMoney(invoiceTotal(inv), inv.currency)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `: ''}
    `;
}

/* =========================================================================
 * TREE — a client's work as folders, not as separate lists.
 *
 * Projects nest through parentId, tasks hang off any project or off the
 * client itself. Every node carries its own "+ task" and "+ subproject", so
 * you add things where you are looking instead of going to a corner of the
 * screen. Expanded nodes live in UI, so they survive a re-render.
 * ========================================================================= */

function treeTaskRow(t) {
    const overdue = t.due && t.due < todayISO() && t.status !== 'done';
    return `
        <li class="tr-task ${t.status === 'done' ? 'is-done' : ''}" data-task="${esc(t.id)}"
            draggable="true" data-drag="task" data-drag-id="${esc(t.id)}">
            <span class="tr-check" data-toggle="${esc(t.id)}" role="checkbox"
                  aria-checked="${t.status === 'done'}" tabindex="0"></span>
            <span class="tr-title">${esc(t.title)}</span>
            ${t.blockedReason ? `<span class="badge stuck" title="${esc(t.blockedReason)}">stuck</span>` : ''}
            ${t.due ? `<span class="tr-due ${overdue ? 'overdue' : ''}">${esc(fmtDate(t.due))}</span>` : ''}
            ${t.link ? driveLink(t.link, '') : ''}
            <button class="btn xs tr-log" data-log="${esc(t.id)}" title="Log time">${icon('clock', 13)}</button>
        </li>`;
}

function treeNode(m, depth = 0) {
    const kids = childMatters(m.id);
    const tasks = tasksForMatter(m.id).filter(t => t.status !== 'done');
    const doneN = tasksForMatter(m.id).length - tasks.length;
    const open = UI.isOpen(m.id);
    const bill = matterBillingType(m);
    const overdue = m.due && m.due < todayISO() && m.status !== 'closed';
    const count = tasks.length + kids.length;

    return `
        <li class="tr-node" data-node="${esc(m.id)}" style="--depth:${depth}">
            <div class="tr-head" draggable="true" data-drag="matter" data-drag-id="${esc(m.id)}">
                <button class="tr-twist ${open ? 'open' : ''}" data-tree-toggle="${esc(m.id)}"
                        aria-expanded="${open}" ${count ? '' : 'data-empty'}
                        title="${open ? 'Collapse' : 'Expand'}">›</button>
                <a class="tr-name" href="#/matters/${esc(m.id)}">${esc(m.title)}</a>
                ${count ? `<span class="tr-n">${count}</span>` : ''}
                ${bill !== 'hourly' ? `<span class="badge sm bill-${esc(bill)}">${esc(BILLING_LABEL[bill])}</span>` : ''}
                ${m.due ? `<span class="badge sm ${overdue ? 'overdue' : ''}">${esc(fmtDate(m.due))}</span>` : ''}
                ${driveLink(m.website, '')}
                <span class="tr-actions">
                    <button class="btn xs" data-add-task="${esc(m.id)}" title="Add a task here">＋ task</button>
                    <button class="btn xs" data-add-sub="${esc(m.id)}" title="Add a subproject here">＋ sub</button>
                </span>
            </div>
            ${open ? `
                <ul class="tr-children">
                    ${kids.map(k => treeNode(k, depth + 1)).join('')}
                    ${tasks.map(treeTaskRow).join('')}
                    ${!kids.length && !tasks.length
                        ? `<li class="tr-empty">Nothing here yet${doneN ? ` · ${doneN} done` : ''}</li>` : ''}
                    ${doneN && (kids.length || tasks.length) ? `<li class="tr-empty">${doneN} done, hidden</li>` : ''}
                </ul>` : ''}
        </li>`;
}

/* =========================================================================
 * DRAG — move things where they belong, and put the important ones on top.
 *
 * Two intents, read from where in the row you let go: near the middle of a
 * project means "put it inside", near an edge means "put it here, alongside".
 * A project cannot be dropped into its own descendant — that would detach the
 * branch from the tree entirely.
 * ========================================================================= */

const Drag = {
    kind: null,   // 'matter' | 'task' | 'client'
    id: null,

    start(e) {
        const row = e.target.closest('[data-drag]');
        if (!row) return;
        Drag.kind = row.dataset.drag;
        Drag.id = row.dataset.dragId;
        row.classList.add('dragging');
        try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', Drag.id);   // Firefox needs a payload
        } catch (err) {}
    },

    end() {
        $$('.dragging').forEach(el => el.classList.remove('dragging'));
        Drag._clearHints();
        Drag.kind = null;
        Drag.id = null;
    },

    _clearHints() {
        $$('.drop-into, .drop-before, .drop-after').forEach(el =>
            el.classList.remove('drop-into', 'drop-before', 'drop-after'));
    },

    /* Where would this land if released now? */
    _intent(e) {
        const row = e.target.closest('[data-drag]');
        if (!row || !Drag.kind) return null;
        if (row.dataset.dragId === Drag.id) return null;
        // dropping a project inside itself or its own child would orphan the branch
        if (Drag.kind === 'matter' && row.dataset.drag === 'matter') {
            if (matterDescendantIds(Drag.id).has(row.dataset.dragId)) return null;
        }
        if (Drag.kind === 'client' && row.dataset.drag !== 'client') return null;
        if (Drag.kind !== 'client' && row.dataset.drag === 'client') return null;

        const r = row.getBoundingClientRect();
        const third = r.height / 3;
        const canNest = row.dataset.drag === 'matter' && Drag.kind !== 'client';
        if (canNest && e.clientY > r.top + third && e.clientY < r.bottom - third) {
            return { row, mode: 'into' };
        }
        return { row, mode: e.clientY < r.top + r.height / 2 ? 'before' : 'after' };
    },

    over(e) {
        const it = Drag._intent(e);
        Drag._clearHints();
        if (!it) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        it.row.classList.add(it.mode === 'into' ? 'drop-into'
                           : it.mode === 'before' ? 'drop-before' : 'drop-after');
    },

    drop(e) {
        const it = Drag._intent(e);
        if (!it) { Drag.end(); return; }
        e.preventDefault();
        const targetId = it.row.dataset.dragId;
        const before = it.mode === 'before';

        if (Drag.kind === 'client') {
            const moved = clientById(Drag.id);
            if (moved) {
                placeBeside(liveClients(), moved, targetId, before);
                Store.save(); render();
            }
            Drag.end();
            return;
        }

        if (Drag.kind === 'matter') {
            const moved = matterById(Drag.id);
            const target = matterById(targetId);
            if (!moved || !target) { Drag.end(); return; }
            if (it.mode === 'into') {
                moved.parentId = target.id;
                moved.clientId = target.clientId;
                placeBeside(childMatters(target.id), moved, null, false);
                UI.open(target.id);
            } else {
                moved.parentId = target.parentId || null;
                moved.clientId = target.clientId;
                const sibs = target.parentId
                    ? childMatters(target.parentId)
                    : topMattersForClient(target.clientId);
                placeBeside(sibs, moved, target.id, before);
            }
            History.record('matterUpdated', 'matter', moved.id, 'moved: ' + moved.title);
            Store.save(); render();
            Drag.end();
            return;
        }

        // a task: into a project, or alongside another task
        const t = taskById(Drag.id);
        if (!t) { Drag.end(); return; }
        if (it.row.dataset.drag === 'matter') {
            const m = matterById(targetId);
            if (m) {
                t.matterId = m.id;
                t.clientId = m.clientId;
                placeBeside(tasksForMatter(m.id), t, null, false);
                UI.open(m.id);
            }
        } else {
            const sibling = taskById(targetId);
            if (sibling) {
                t.matterId = sibling.matterId;
                t.clientId = sibling.clientId;
                placeBeside(
                    sibling.matterId ? tasksForMatter(sibling.matterId)
                                     : standaloneTasksForClient(sibling.clientId),
                    t, sibling.id, before);
            }
        }
        Tasks.put(t);
        History.record('taskUpdated', 'task', t.id, 'moved: ' + t.title);
        Store.save(); render();
        Drag.end();
    },

    bind() {
        const v = $('#view');
        if (!v || v.dataset.dragBound) return;
        v.dataset.dragBound = '1';
        v.addEventListener('dragstart', Drag.start);
        v.addEventListener('dragover', Drag.over);
        v.addEventListener('drop', Drag.drop);
        v.addEventListener('dragend', Drag.end);
    }
};

function renderClientTree(cid) {
    const tops = topMattersForClient(cid);
    const loose = standaloneTasksForClient(cid).filter(t => t.status !== 'done');
    if (!tops.length && !loose.length) {
        return `<div class="empty-state">
            <h3>Nothing here yet</h3>
            <p>Projects hold the work; a task can also sit straight under the client.</p>
            <button class="btn primary" data-add-sub="" data-client="${esc(cid)}">＋ New project</button>
            <button class="btn" data-add-task="" data-client="${esc(cid)}">＋ Task</button>
        </div>`;
    }
    return `
        <ul class="tree">
            ${tops.map(m => treeNode(m, 0)).join('')}
            ${loose.length ? `
                <li class="tr-node" style="--depth:0">
                    <div class="tr-head">
                        <span class="tr-twist" data-empty></span>
                        <span class="tr-name tr-loose">Not in a project</span>
                        <span class="tr-n">${loose.length}</span>
                    </div>
                    <ul class="tr-children">${loose.map(treeTaskRow).join('')}</ul>
                </li>` : ''}
        </ul>
        <div class="tree-foot">
            <button class="btn" data-add-sub="" data-client="${esc(cid)}">＋ Project</button>
            <button class="btn" data-add-task="" data-client="${esc(cid)}">＋ Task without a project</button>
        </div>`;
}

/* The provenance panel: what happened to this thing, newest first, with a
 * statement about whether the chain still adds up. Tasks belonging to a
 * project are folded in, since "what happened on this matter" is the
 * question a practice actually asks. */
function renderHistory(entity, id) {
    let entries = History.forEntity(entity, id);
    if (entity === 'matter') {
        const taskIds = new Set(tasksForMatter(id).map(t => t.id));
        entries = (state.history || [])
            .filter(e => (e.entity === 'matter' && e.entityId === id) ||
                         (e.entity === 'task' && taskIds.has(e.entityId)))
            .slice().reverse();
    }
    const when = (iso) => {
        try {
            return new Date(iso).toLocaleString([], {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return iso; }
    };
    return `
        <h2 class="section-h">History <span class="hist-verdict" id="hist-verdict">checking…</span></h2>
        ${!entries.length ? '<div class="empty">Nothing recorded yet.</div>' : `
            <ol class="hist">
                ${entries.slice(0, 50).map(e => `
                    <li class="hist-row">
                        <span class="hist-seq">#${e.seq}</span>
                        <span class="hist-what">${esc(HISTORY_LABEL[e.action] || e.action)}</span>
                        <span class="hist-sum">${esc(e.summary || '')}</span>
                        <span class="hist-when">${esc(when(e.at))}</span>
                    </li>`).join('')}
            </ol>
            <p class="muted" style="font-size:12px;margin-top:6px">Each entry is sealed with the hash of the one before it —
            altering or removing any of them breaks every hash that follows.</p>
        `}`;
}

/* Verify runs after paint: hashing is async and the answer is not worth
   blocking the page for. */
async function paintHistoryVerdict() {
    const el = $('#hist-verdict');
    if (!el) return;
    const r = await History.verify();
    el.dataset.ok = r.ok ? 'yes' : 'no';
    el.textContent = r.ok
        ? `intact · ${r.count} entr${r.count === 1 ? 'y' : 'ies'}`
        : `broken at #${r.seq} — ${r.reason}`;
}

/* Portal conversation, grouped by task. Threads with unanswered client
 * messages float to the top — those are the ones costing time. */
function renderClientThread(c) {
    if (!c.shareEnabled || !c.shareId) return '';
    const all = Comments.forClient(c);
    const unread = Comments.unread(c);

    const groups = {};
    all.forEach(m => {
        const key = m.taskId || '_general';
        (groups[key] = groups[key] || []).push(m);
    });

    const ordered = Object.keys(groups).sort((a, b) => {
        const la = groups[a][groups[a].length - 1];
        const lb = groups[b][groups[b].length - 1];
        const waiting = (g) => g.author === 'client' ? 1 : 0;
        return (waiting(lb) - waiting(la)) || (lb.createdAt - la.createdAt);
    });

    const when = (ms) => ms
        ? new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'sending…';

    return `
        <h2 class="section-h">Portal conversation
            ${unread ? `<span class="badge overdue">${unread} new</span>` : ''}</h2>
        ${!ordered.length ? `
            <div class="empty">No messages yet. ${c.shareComments !== false
                ? 'Replies your client posts on the portal land here.'
                : 'Replying is currently switched off for this client.'}</div>
        ` : ordered.map(key => {
            const msgs = groups[key];
            const t = key === '_general' ? null : taskById(key);
            const title = t ? t.title : (key === '_general' ? 'General' : 'Deleted task');
            const awaiting = msgs[msgs.length - 1].author === 'client';
            return `
                <div class="thread ${awaiting ? 'awaiting' : ''}">
                    <div class="thread-head">
                        ${esc(title)}
                        ${awaiting ? '<span class="badge stuck">awaiting your reply</span>' : ''}
                    </div>
                    ${msgs.map(m => `
                        <div class="msg ${m.author === 'hub' ? 'mine' : ''}">
                            <div class="msg-who">${m.author === 'hub' ? 'You' : esc(c.name)} · ${esc(when(m.createdAt))}</div>
                            <div class="msg-text">${esc(m.text)}</div>
                        </div>`).join('')}
                    <div class="thread-reply">
                        <input type="text" class="thread-input" data-thread="${esc(key)}"
                               placeholder="Reply to ${esc(c.name)}…" maxlength="2000">
                        <button class="btn" data-act="comment-send" data-id="${c.id}" data-thread="${esc(key)}">Send</button>
                    </div>
                </div>`;
        }).join('')}
    `;
}

/* =========================================================================
 * 12. VIEW: MATTERS
 * ========================================================================= */

function viewMatters() {
    const list = [...liveMatters()].sort((a,b)=> (a.title||'').localeCompare(b.title||''));
    return `
        <div class="view-head">
            <h1>Projects</h1>
            <div class="meta">${list.length} total · ${list.filter(m=>m.status!=='closed').length} active</div>
            <div class="actions">
                <button class="btn primary" data-act="new-matter">＋ New project</button>
            </div>
        </div>
        ${list.length === 0 ? `
            <div class="empty-state">
                <h3>No projects yet</h3>
                <p>Projects group tasks, time, and invoices for a client engagement.</p>
                <button class="btn primary" data-act="new-matter">＋ New project</button>
            </div>
        ` : `
            <div class="entity-grid">
                ${list.map(m => {
                    const c = clientById(m.clientId);
                    const open = tasksForMatter(m.id).filter(t => t.status !== 'done').length;
                    const mins = logsForMatter(m.id).reduce((s,l)=>s+l.minutes,0);
                    return `<div class="entity-card ${m.status === 'closed' ? 'is-muted' : ''}" data-go="matters/${m.id}" role="link" tabindex="0">
                        <div class="e-name">${esc(m.title)}</div>
                        <div class="e-sub">${esc(c?.name || '—')}</div>
                        <div class="e-stats">
                            <span>${open} open</span>
                            <span>${fmtMinutes(mins)}</span>
                            <span>${fmtMoney(matterRate(m), profileCurrency())}/h</span>
                        </div>
                        <div class="e-flags">
                            ${m.status && m.status !== 'open' ? `<span class="badge ${esc(m.status)}">${esc(m.status)}</span>` : ''}
                            ${m.due ? `<span class="badge ${m.due < todayISO() && m.status !== 'closed' ? 'overdue' : ''}">${esc(fmtDate(m.due))}</span>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `}
    `;
}

function viewMatter(id) {
    const m = matterById(id);
    if (!m) return `<div class="empty-state"><h3>Project not found</h3><a href="#/matters">Back</a></div>`;
    const c = clientById(m.clientId);
    const tasks = tasksForMatter(id);
    const logs = logsForMatter(id);
    const mins = logs.reduce((s,l)=>s+l.minutes,0);
    const billable = (mins / 60) * matterRate(m);
    const unbilled = logs.filter(l => !l.invoiceId).reduce((s,l)=>s+l.minutes,0);

    return `
        <div class="breadcrumb">
            <a href="#/matters">Projects</a> ›
            ${c ? `<a href="#/clients/${c.id}">${esc(c.name)}</a> ›` : ''}
        </div>
        <div class="view-head">
            <h1>${esc(m.title)}</h1>
            <div class="meta"><span class="badge ${m.status||'open'}">${esc(m.status||'open')}</span>${
                m.due ? ` <span class="badge ${m.due < todayISO() && m.status !== 'closed' ? 'overdue' : ''}">due ${esc(fmtDate(m.due))}</span>` : ''}</div>
            <div class="actions">
                ${m.website ? `<a class="btn" href="${esc(/^https?:\/\//i.test(m.website) ? m.website : 'https://' + m.website)}" target="_blank" rel="noopener">📁 Drive</a>` : ''}
                <button class="btn" data-act="edit-matter" data-id="${m.id}">Edit</button>
                <button class="btn" data-act="new-task" data-matter="${m.id}">＋ Task</button>
                ${unbilled > 0 ? `<button class="btn primary" data-act="new-invoice" data-matter="${m.id}">＋ Invoice unbilled</button>` : ''}
            </div>
        </div>

        <div class="cards">
            <div class="card"><div class="card-label">Tasks</div><div class="card-value">${tasks.length}</div><div class="card-sub">${tasks.filter(t=>t.status!=='done').length} open</div></div>
            <div class="card"><div class="card-label">Time logged</div><div class="card-value">${fmtMinutes(mins)}</div></div>
            <div class="card"><div class="card-label">Billable</div><div class="card-value">${fmtMoney(billable, profileCurrency())}</div><div class="card-sub">@ ${fmtMoney(matterRate(m), profileCurrency())}/h</div></div>
            <div class="card"><div class="card-label">Unbilled</div><div class="card-value">${fmtMinutes(unbilled)}</div></div>
        </div>

        ${m.description ? `<div class="notes-block">${esc(m.description)}</div>` : ''}

        <h2 class="section-h">Tasks</h2>
        ${renderTaskList(tasks)}

        <h2 class="section-h">Attachments</h2>
        <div id="att-host-matter"></div>

        ${renderHistory('matter', m.id)}

        <h2 class="section-h">Time entries</h2>
        ${logs.length ? `
            <table class="t">
                <thead><tr><th>Date</th><th>Notes</th><th class="num">Duration</th><th>Status</th></tr></thead>
                <tbody>${[...logs].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).map(l => `
                    <tr class="row" data-act="edit-log" data-id="${l.id}">
                        <td>${fmtDate(l.startedAt)}</td>
                        <td>${esc(l.notes||'')}</td>
                        <td class="num">${fmtMinutes(l.minutes)}</td>
                        <td>${l.invoiceId ? '<span class="badge paid">billed</span>' : '<span class="badge">unbilled</span>'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        ` : '<div class="empty">No time logged yet.</div>'}
    `;
}

/* Tasks no longer have a screen of their own — Today owns the list and this
 * drives which slice of it is showing. Kept here next to the other view
 * state rather than inside viewToday so a re-render does not reset it. */
let todayFilter = 'week';

/* =========================================================================
 * 14. VIEW: TIME
 * ========================================================================= */

function viewTime() {
    const list = [...liveLogs()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
    const totalMins = list.reduce((s,l)=>s+l.minutes,0);
    const unbilled = list.filter(l=>!l.invoiceId).reduce((s,l)=>s+l.minutes,0);

    return `
        <div class="view-head">
            <h1>Time</h1>
            <div class="meta">${list.length} entries · ${fmtMinutes(totalMins)} total · ${fmtMinutes(unbilled)} unbilled</div>
            <div class="actions">
                <button class="btn" data-act="new-log">＋ Manual entry</button>
            </div>
        </div>
        ${(() => {
            // Unbilled time is only useful if it can become an invoice right
            // here — a bare "Xh unbilled" number closes no loop.
            const byClient = {};
            list.filter(l => !l.invoiceId).forEach(l => {
                if (l.clientId) byClient[l.clientId] = (byClient[l.clientId] || 0) + l.minutes;
            });
            const rows = Object.entries(byClient)
                .map(([cid, m]) => ({ c: clientById(cid), m, money: totalUnbilledForClient(cid) }))
                .filter(r => r.c && !r.c.deletedAt && r.m > 0)
                .sort((a, b) => b.money - a.money);
            return rows.length ? `
            <div class="unbilled-strip">
                ${rows.map(r => `
                <div class="unbilled-card">
                    <div class="u-name">${esc(r.c.name)}</div>
                    <div class="u-amt">${fmtMinutes(r.m)} · ${fmtMoney(r.money, profileCurrency())}</div>
                    <button class="btn sm primary" data-act="invoice-client" data-client="${r.c.id}">→ invoice</button>
                </div>`).join('')}
            </div>` : '';
        })()}
        ${list.length === 0 ? `
            <div class="empty-state">
                <h3>No time entries yet</h3>
                <p>Start a timer from any task or matter, or add an entry manually.</p>
            </div>
        ` : `
            <table class="t">
                <thead><tr>
                    <th>Date</th><th>Client</th><th>Project</th><th>Notes</th>
                    <th class="num">Duration</th><th>Status</th>
                </tr></thead>
                <tbody>${list.map(l => {
                    const c = clientById(l.clientId);
                    const m = matterById(l.matterId);
                    return `<tr class="row" data-act="edit-log" data-id="${l.id}">
                        <td>${fmtDate(l.startedAt)}</td>
                        <td>${esc(c?.name||'—')}</td>
                        <td>${esc(m?.title||'—')}</td>
                        <td class="muted">${esc(l.notes||'')}</td>
                        <td class="num">${fmtMinutes(l.minutes)}</td>
                        <td>${l.invoiceId ? '<span class="badge paid">billed</span>' : '<span class="badge">unbilled</span>'}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>
        `}
    `;
}

/* =========================================================================
 * 15. VIEW: INVOICES
 * ========================================================================= */

function invoiceTotal(inv) {
    return (inv.items || []).reduce((s,i) => s + (Number(i.amount) || 0), 0);
}

function viewInvoices() {
    const list = [...liveInvoices()].sort((a,b) => (b.dateIssued||'').localeCompare(a.dateIssued||''));
    return `
        <div class="view-head">
            <h1>Invoices</h1>
            <div class="meta">${list.length} total</div>
            <div class="actions">
                <button class="btn primary" data-act="new-invoice">＋ New invoice</button>
            </div>
        </div>
        ${list.length === 0 ? `
            <div class="empty-state">
                <h3>No invoices yet</h3>
                <p>Generate an invoice from unbilled time on any matter, or create one manually.</p>
            </div>
        ` : `
            <table class="t">
                <thead><tr>
                    <th>Number</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th class="num">Amount</th>
                </tr></thead>
                <tbody>${list.map(inv => `
                    <tr class="row" data-go="invoices/${inv.id}">
                        <td><strong>${esc(inv.number)}</strong></td>
                        <td>${esc(clientById(inv.clientId)?.name || '—')}</td>
                        <td>${fmtDate(inv.dateIssued)}</td>
                        <td>${fmtDate(inv.dateDue)}</td>
                        <td><span class="badge ${inv.status}">${esc(inv.status)}</span></td>
                        <td class="num">${fmtMoney(invoiceTotal(inv), inv.currency)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `}
    `;
}

function viewInvoice(id) {
    const inv = invoiceById(id);
    if (!inv) return `<div class="empty-state"><h3>Invoice not found</h3><a href="#/invoices">Back</a></div>`;
    const c = clientById(inv.clientId);
    const p = state.profile;

    const total = invoiceTotal(inv);
    const items = inv.items || [];

    return `
        <div class="breadcrumb no-print"><a href="#/invoices">Invoices</a> ›</div>
        <div class="view-head no-print">
            <h1>${esc(inv.number)}</h1>
            <div class="meta"><span class="badge ${inv.status}">${esc(inv.status)}</span></div>
            <div class="actions">
                <button class="btn" data-act="edit-invoice" data-id="${inv.id}">Edit</button>
                ${inv.status === 'draft' ? `<button class="btn" data-act="invoice-status" data-id="${inv.id}" data-status="sent">Mark sent</button>` : ''}
                ${inv.status !== 'paid' ? `<button class="btn primary" data-act="invoice-status" data-id="${inv.id}" data-status="paid">Mark paid</button>` : ''}
                <button class="btn" data-act="gmail-invoice" data-id="${inv.id}" title="Create a Gmail draft to the client">📧 Draft email</button>
                <button class="btn" onclick="window.print()">Print / PDF</button>
            </div>
        </div>

        <article class="inv-doc">

            <header class="inv-doc-hdr">
                <div class="left">
                    <div class="eyebrow">invoice · ${esc((c && c.name) || 'client')}</div>
                    <h1>${esc(String(inv.number).toLowerCase())}</h1>
                </div>
                <div class="right">
                    <div><span class="k">issued</span><span class="v">${fmtDate(inv.dateIssued)}</span></div>
                    <div><span class="k">due</span><span class="v">${inv.dateDue ? fmtDate(inv.dateDue) : '—'}</span></div>
                    <div><span class="k">currency</span><span class="v">${esc(inv.currency || 'EUR')}</span></div>
                    <div><span class="k">status</span><span class="v">${esc(inv.status)}</span></div>
                </div>
            </header>

            <section class="inv-doc-bill">
                <div class="blk">
                    <div class="lbl">from</div>
                    <div class="name">${esc(p.name || 'Your name')}</div>
                    <div class="lines">
                        ${p.address ? esc(p.address).replace(/\n/g,'<br>') + '<br>' : ''}
                        ${p.email ? esc(p.email) + '<br>' : ''}
                        ${p.taxId ? `<span class="mono">tax id · ${esc(p.taxId)}</span>` : ''}
                    </div>
                </div>
                <div class="blk">
                    <div class="lbl">bill to</div>
                    <div class="name">${esc((c && c.name) || '—')}</div>
                    <div class="lines">
                        ${c && c.address ? esc(c.address).replace(/\n/g,'<br>') + '<br>' : ''}
                        ${c && c.email ? esc(c.email) + '<br>' : ''}
                        ${c && c.taxId ? `<span class="mono">tax id · ${esc(c.taxId)}</span>` : ''}
                    </div>
                </div>
            </section>

            <section class="inv-doc-lines">
                <div class="lines-hdr">
                    <span>line</span><span>description</span>
                    <span class="num">hours</span><span class="num">rate</span><span class="num">amount</span>
                </div>
                ${items.map((it, idx) => `
                    <div class="line">
                        <span class="ord">${String(idx+1).padStart(2,'0')}</span>
                        <div class="desc">
                            ${esc(it.description)}
                            ${it.entries ? `<span class="ctx">${it.entries} ${it.entries===1?'entry':'entries'} bundled</span>` : ''}
                        </div>
                        <span class="qty">${(Number(it.hours)||0).toFixed(2)}<span class="dim"> h</span></span>
                        <span class="rate">${fmtMoney(it.rate, inv.currency)}<span class="dim"> /h</span></span>
                        <span class="amt">${fmtMoney(it.amount, inv.currency)}</span>
                    </div>
                `).join('')}
            </section>

            <section class="inv-doc-totals">
                <div class="left">
                    ${inv.notes ? esc(inv.notes).replace(/\n/g,'<br>') : ''}
                </div>
                <div class="right">
                    <div class="row sub"><span class="k">subtotal</span><span class="v">${fmtMoney(total, inv.currency)}</span></div>
                    <div class="row grand">
                        <span class="k">total due</span>
                        <span class="v">${fmtMoney(total, inv.currency)}</span>
                    </div>
                </div>
            </section>

            ${(() => {
                const accts = p.bankAccounts || [];
                const acct = accts.find(a => a.currency === inv.currency) || accts[0] || null;
                if (!acct && !p.paymentTerms) return '';
                return `
            <section class="inv-doc-pay">
                ${acct ? `
                <div class="blk">
                    <div class="lbl">remit to · ${esc(acct.currency || '')}</div>
                    <div class="iban">${esc(acct.iban || '')}</div>
                    ${(acct.swift || acct.bankName) ? `<div class="terms" style="margin-top:6px">${esc([acct.bankName, acct.swift && ('SWIFT ' + acct.swift)].filter(Boolean).join(' · '))}</div>` : ''}
                    ${acct.holder ? `<div class="terms">holder: ${esc(acct.holder)}</div>` : ''}
                </div>` : ''}
                ${p.paymentTerms ? `
                <div class="blk">
                    <div class="lbl">terms</div>
                    <div class="terms">${esc(p.paymentTerms).replace(/\n/g,'<br>')}</div>
                </div>` : ''}
            </section>`;
            })()}

            <footer class="inv-doc-foot">
                <span>${esc(inv.number)} · ${esc((c && c.name) || '')}</span>
                <span class="mid">drafted with ordify · editable before send</span>
            </footer>

        </article>
    `;
}

/* =========================================================================
 * 16. VIEW: SETTINGS
 * ========================================================================= */

function viewSettings() {
    const p = state.profile;
    return `
        <div class="view-head">
            <h1>Settings</h1>
        </div>

        <form id="settings-form" class="settings-form">
            <h3>Your details</h3>
            <div class="grid2">
                <div class="field"><label>Name</label><input name="name" value="${esc(p.name)}"></div>
                <div class="field"><label>Email</label><input name="email" type="email" value="${esc(p.email)}"></div>
                <div class="field full"><label>Address</label><textarea name="address" rows="2">${esc(p.address)}</textarea></div>
                <div class="field"><label>Tax / VAT ID</label><input name="taxId" value="${esc(p.taxId)}"></div>
            </div>

            <h3>Billing</h3>
            <div class="grid2">
                <div class="field"><label>Default rate (per hour)</label><input name="rate" type="number" min="0" step="1" value="${esc(p.rate)}"></div>
                <div class="field"><label>Currency</label>
                    <select name="currency">
                        ${['EUR','USD','GBP','PLN','CHF','CZK','UAH'].map(cur =>
                            `<option ${p.currency===cur?'selected':''}>${cur}</option>`).join('')}
                    </select>
                </div>
                <div class="field"><label>Invoice number prefix</label><input name="invoiceNumberPrefix" value="${esc(p.invoiceNumberPrefix)}"></div>
                <div class="field"><label>Next invoice number</label><input name="invoiceNumberCounter" type="number" min="1" step="1" value="${esc(p.invoiceNumberCounter)}"></div>
                <div class="field full"><label>Payment terms</label><textarea name="paymentTerms" rows="2" placeholder="Payment due within 14 days. Reference the invoice number in the wire memo.">${esc(p.paymentTerms||'')}</textarea></div>
            </div>

            <h3>AI &amp; voice input</h3>
            <div class="settings-warn">
                <strong>Heads up:</strong> these API keys are stored in this browser's localStorage in plaintext.
                Anyone with access to this device can read them. Use keys with limited spend, and revoke them if the device is compromised.
            </div>
            <div class="grid2">
                <div class="field full">
                    <label>Anthropic API key</label>
                    <input name="anthropicKey" type="password" placeholder="sk-ant-..." value="${esc(p.anthropicKey)}" autocomplete="off" data-check="anthropic">
                    <div class="key-status" id="anthropic-status" data-state="idle"></div>
                    <small class="hint">Get one at <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com → API keys</a>.
                    Runs typing, documents and images. Without it, AI parsing is off.</small>
                </div>
                <div class="field full">
                    <label>Gemini API key (audio / video)</label>
                    <input name="geminiKey" type="password" placeholder="AIza..." value="${esc(p.geminiKey||'')}" autocomplete="off" data-check="gemini">
                    <div class="key-status" id="gemini-status" data-state="idle"></div>
                    <small class="hint">Free at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a>.
                    Needed for attached audio and video, and for <strong>dictation on a phone</strong> — a phone gives the
                    microphone to one app at a time, so ordify records there and has Gemini read it back.</small>
                </div>
                <div class="field"><label>Dictation language</label>
                    <select name="dictationLang">
                        <option value="auto"  ${p.dictationLang==='auto' ?'selected':''}>Auto-detect (browser locale)</option>
                        <option value="uk-UA" ${p.dictationLang==='uk-UA'?'selected':''}>Ukrainian (uk-UA)</option>
                        <option value="ru-RU" ${p.dictationLang==='ru-RU'?'selected':''}>Russian (ru-RU)</option>
                        <option value="en-US" ${p.dictationLang==='en-US'?'selected':''}>English (en-US)</option>
                        <option value="pl-PL" ${p.dictationLang==='pl-PL'?'selected':''}>Polish (pl-PL)</option>
                    </select>
                    <small class="hint">Auto reads your browser locale (uk / ru / en / pl). Web Speech API can only listen to one language at a time — pick explicitly if auto guesses wrong.</small>
                </div>
            </div>

            <details class="advanced">
                <summary>Advanced — choose the models yourself</summary>
                <p class="muted" style="font-size:12px;margin:0 0 12px">ordify picks a model from each key on its own,
                and re-picks automatically when one is retired or out of quota. Override only if you have a reason to.</p>
                <div class="grid2">
                    <div class="field"><label>Claude model</label>
                        <select name="anthropicModel" id="anthropic-model">
                            <option selected>${esc(p.anthropicModel || 'claude-opus-4-8')}</option>
                        </select>
                        <small class="hint" id="anthropic-model-hint">Opus = most capable, Sonnet = balanced, Haiku = fastest.</small>
                    </div>
                    <div class="field"><label>Gemini model</label>
                        <select name="geminiModel" id="gemini-model">
                            <option selected>${esc(p.geminiModel || 'gemini-2.0-flash')}</option>
                        </select>
                        <small class="hint" id="gemini-model-hint">Flash = fast and has a free tier; Pro is more careful with long video.</small>
                    </div>
                </div>
            </details>

            <h3>Google integrations</h3>
            <div class="settings-warn">
                Setup at <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a>:
                enable <strong>Gmail API</strong> and <strong>Calendar API</strong>;
                create OAuth Client ID (Web app); add origin <code>https://ordifyme.netlify.app</code>.
                Paste the Client ID below.
            </div>
            <div class="grid2">
                <div class="field full">
                    <label>Google OAuth Client ID</label>
                    <input name="googleClientId" placeholder="123456789-abcdef.apps.googleusercontent.com" value="${esc(p.googleClientId || '')}" autocomplete="off">
                    <small class="hint">Required for Gmail drafts and Calendar sync.</small>
                </div>
            </div>
            <div class="settings-data">
                <button type="button" class="btn" data-act="google-signout">Disconnect Google account</button>
            </div>
            <p class="muted" style="font-size:12px;margin-top:6px">Use this to switch to a different Gmail / Calendar — next time you connect, Google will let you pick another account.</p>

            <div class="actions" style="margin-top:24px">
                <button type="submit" class="btn primary">Save settings</button>
            </div>
        </form>

        <h3 style="margin-top:48px">Bank accounts</h3>
        <p class="muted" style="font-size:12px;margin:0 0 12px">Shown on invoices — ordify picks the account whose currency matches the invoice.</p>
        ${(p.bankAccounts || []).length ? `
            <ul class="snap-list">
                ${p.bankAccounts.map(a => `
                    <li class="snap-row">
                        <span class="badge todo">${esc(a.currency || '—')}</span>
                        <span class="stats" style="font-family:var(--font-mono)">${esc(a.iban || '(no IBAN)')}</span>
                        <button class="btn sm" data-act="edit-bank" data-id="${esc(a.id)}">Edit</button>
                        <button class="btn sm danger" data-act="remove-bank" data-id="${esc(a.id)}">Remove</button>
                    </li>`).join('')}
            </ul>` : '<div class="empty">No bank accounts yet.</div>'}
        <div style="margin-top:10px"><button class="btn" data-act="add-bank">＋ Add account</button></div>

        <h3 style="margin-top:48px">Quick setup</h3>
        <p class="muted" style="font-size:12px;margin:0 0 10px">Upload an invoice you already use (.docx, PDF or image). ordify reads your name, address, tax ID and bank accounts, and fills in the profile above.</p>
        <button class="btn" data-act="import-invoice">⬆ Import my details from an invoice</button>

        <h3 style="margin-top:48px">Data</h3>
        <div class="settings-data">
            <button class="btn" data-act="export">Export JSON</button>
            <button class="btn" data-act="import">Import JSON</button>
            <button class="btn danger" data-act="reset">Reset all data</button>
        </div>
        <p class="muted" style="margin-top:8px;font-size:12px">Your data lives in Google Firestore and syncs across every device you sign in on. Export a JSON backup whenever you want a local copy.</p>
    `;
}

/* =========================================================================
 * VIEW: INBOX — Gmail triage
 * ========================================================================= */

let inboxEmails = [];

/* A key is either working or it isn't, and the only honest way to know is to
 * ask the provider. Settings says so in one line — no "save and find out later
 * when a parse fails with a 404". */
const KEY_PROVIDERS = {
    anthropic: {
        label: 'Claude',
        does: 'typing, documents, images',
        client: () => (typeof AI !== 'undefined' ? AI : null),
        saved: () => state.profile.anthropicModel,
        ids: (models) => models.map(m => m.id)
    },
    gemini: {
        label: 'Gemini',
        does: 'audio, video, phone dictation',
        client: () => (typeof Gemini !== 'undefined' ? Gemini : null),
        saved: () => state.profile.geminiModel,
        ids: (models) => models
    }
};

const keyCheckTimers = {};

async function refreshKeyStatus(which, key) {
    const cfg = KEY_PROVIDERS[which];
    const box = $('#' + which + '-status');
    const client = cfg && cfg.client();
    if (!box || !client) return;

    const set = (stateName, html) => { box.dataset.state = stateName; box.innerHTML = html; };

    if (!key) { box.dataset.token = ''; set('idle', 'No key yet — ' + esc(cfg.does) + ' stay off.'); return; }

    set('checking', 'Checking…');
    box.dataset.token = key;
    const r = await client.checkKey(key);
    // a slower earlier check must not overwrite a newer verdict
    if (box.dataset.token !== key) return;

    if (!r.ok) {
        const why = r.reason === 'rejected' ? cfg.label + ' rejected this key.'
                  : r.reason === 'network'  ? 'Could not reach ' + cfg.label + ' — check the connection.'
                  : cfg.label + ' answered HTTP ' + esc(String(r.status || '?')) + '.';
        set('bad', why);
        return;
    }
    const ids = cfg.ids(r.models || []);
    const saved = cfg.saved();
    const use = saved && ids.includes(saved)
        ? saved
        : [...ids].sort((a, b) => client._score(b) - client._score(a))[0];
    set('ok', 'Working — ' + esc(cfg.does) + '. Using <code>' + esc(use || '—') + '</code>'
        + (saved && ids.includes(saved) ? '' : ' (picked automatically)') + '.');
}

/* Same treatment for Claude: the hardcoded list had shipped with models that
 * Anthropic has since retired — including the one used by default, which made
 * every AI parse fail with a 404 that named nothing useful. */
async function populateAnthropicModels() {
    const sel = $('#anthropic-model');
    const hint = $('#anthropic-model-hint');
    if (!sel || typeof AI === 'undefined') return;
    if (!state.profile.anthropicKey) return;

    const current = state.profile.anthropicModel || '';
    const models = await AI.listModels();
    if (!models.length) {
        if (hint) hint.innerHTML = 'Could not read the model list — check the API key. '
            + 'Keeping <code>' + esc(current || '—') + '</code>.';
        return;
    }
    const ids = models.map(m => m.id);
    // a saved-but-retired model stays visible and flagged rather than being
    // swapped out from under the user
    const opts = ids.includes(current) || !current
        ? models
        : [{ id: current, name: current }, ...models];
    sel.innerHTML = opts.map(m =>
        `<option value="${esc(m.id)}" ${m.id === current ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    if (hint && current && !ids.includes(current)) {
        hint.innerHTML = '<strong>' + esc(current) + '</strong> is retired and will fail with a 404 — '
            + 'pick one of the live models above.';
    }
}

/* Fill the Gemini model dropdown from the API rather than from a list baked
 * into the code, which goes stale every time Google retires a model. */
async function populateGeminiModels() {
    const sel = $('#gemini-model');
    const hint = $('#gemini-model-hint');
    if (!sel || typeof Gemini === 'undefined') return;
    if (!state.profile.geminiKey) return;    // nothing to ask with

    const current = state.profile.geminiModel || '';
    const models = await Gemini.listModels();
    if (!models.length) {
        if (hint) hint.innerHTML = 'Could not read the model list — check the API key. '
            + 'Keeping <code>' + esc(current || '—') + '</code>.';
        return;
    }
    // keep the saved choice even if the API no longer lists it, so saving the
    // form does not silently switch models behind the user's back
    const opts = models.includes(current) || !current ? models : [current, ...models];
    sel.innerHTML = opts.map(m =>
        `<option ${m === current ? 'selected' : ''}>${esc(m)}</option>`).join('');
    if (hint && current && !models.includes(current)) {
        hint.innerHTML = '<strong>' + esc(current) + '</strong> is no longer offered for this key — '
            + 'pick one of the live models above.';
    }
}

/* Pending-intake count, cached by populateInbox. */
function inboxPending() {
    try { return Number(localStorage.getItem('ordify-inbox-pending')) || 0; }
    catch (e) { return 0; }
}

function updateInboxBadge() {
    const b = $('#inbox-badge');
    if (!b) return;
    const n = inboxPending();
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n);
}

function viewInbox() {
    const connected = (typeof Google !== 'undefined') && Google.configured && Google.hasToken();
    return `
        <div class="view-head">
            <h1>Inbox</h1>
            <div class="meta">intake, not a place to live — every email becomes a task or disappears. Goal: empty.</div>
            <div class="actions">
                ${connected ? `<button class="btn sm" data-act="email-switch" title="Disconnect and pick another Google account">Switch mailbox</button>` : ''}
            </div>
        </div>
        <div id="inbox-host"><div class="t-sched-msg">Loading…</div></div>
    `;
}

async function populateInbox() {
    const host = document.getElementById('inbox-host');
    if (!host) return;
    if (!Google.configured()) {
        host.innerHTML = `<div class="empty-state">
            <h3>Connect Gmail</h3>
            <p>Add your Google OAuth Client ID in <a href="#/settings">Settings</a> to triage email here.</p>
        </div>`;
        return;
    }
    if (!Google.hasToken()) {
        host.innerHTML = `<button class="btn primary" id="inbox-connect">Connect Gmail inbox</button>`;
        const b = document.getElementById('inbox-connect');
        if (b) b.addEventListener('click', () => {
            // call Google.connect() directly in the click → popup is not blocked
            Google.connect().then(() => {
                host.innerHTML = `<div class="t-sched-msg">Loading inbox…</div>`;
                populateInbox();
            }).catch((e) => {
                host.innerHTML = `<div class="t-sched-msg">Sign-in failed: ${esc(e.message || 'cancelled')}</div>`;
            });
        });
        return;
    }
    host.innerHTML = `<div class="t-sched-msg">Loading inbox…</div>`;
    try {
        const all = await Google.listInbox(30);
        const handled = new Set(state.emailHandled || []);
        inboxEmails = all.filter(e => !handled.has(e.id));
        // cache the pending count — the topbar badge and the Today assistant
        // card read it, so intake announces itself without another fetch
        try { localStorage.setItem('ordify-inbox-pending', String(inboxEmails.length)); } catch (e) {}
        updateInboxBadge();
        if (!inboxEmails.length) {
            host.innerHTML = `<div class="empty-state">
                <h3>Inbox clear</h3>
                <p>Nothing left to triage — every email is a task or dismissed.</p>
            </div>`;
            return;
        }
        host.innerHTML = `
            <div class="inbox-bar">
                <span class="inbox-count">${inboxEmails.length} waiting to become tasks</span>
                <button class="btn sm ghost" data-act="email-dismiss-all">Dismiss all</button>
            </div>
            <div class="inbox-list">${inboxEmails.map(_inboxRow).join('')}</div>`;
    } catch (e) {
        console.error('inbox load failed', e);
        host.innerHTML = `<div class="t-sched-msg">Inbox unavailable: ${esc(e.message || 'error')}</div>`;
    }
}

function _inboxRow(e) {
    const fromName = (e.from || '').replace(/<[^>]*>/, '').split('"').join('').trim() || e.from || '—';
    const when = e.date ? e.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    return `
        <div class="inbox-row">
            <div class="inbox-from">${esc(fromName)}</div>
            <div class="inbox-body">
                <div class="inbox-subj">${esc(e.subject)}</div>
                <div class="inbox-snip">${esc(e.snippet)}</div>
                <div class="inbox-actions">
                    <button class="btn sm primary" data-act="email-ai" data-id="${esc(e.id)}" title="Read the email and turn it into a task">→ Task</button>
                    <button class="btn sm" data-act="email-open" data-id="${esc(e.id)}">Open in Gmail</button>
                    <button class="btn sm ghost" data-act="email-dismiss" data-id="${esc(e.id)}">Dismiss</button>
                </div>
            </div>
            <div class="inbox-when">${esc(when)}</div>
        </div>`;
}

/* Mark emails handled — the single mechanism behind Dismiss, Dismiss all, and
   "a task from this email was accepted". Returns the ids it actually changed,
   so an undo can put them back. */
function dismissEmails(ids, { refresh = true } = {}) {
    state.emailHandled = state.emailHandled || [];
    const seen = new Set(state.emailHandled);
    const added = ids.filter(id => id && !seen.has(id));
    if (!added.length) return [];
    state.emailHandled.push(...added);
    if (state.emailHandled.length > 500) state.emailHandled = state.emailHandled.slice(-500);
    Store.save();
    if (refresh) { populateInbox(); updateInboxBadge(); }
    return added;
}

function restoreEmails(ids) {
    const back = new Set(ids);
    state.emailHandled = (state.emailHandled || []).filter(id => !back.has(id));
    Store.save();
    populateInbox(); updateInboxBadge();
}

/* Called from the proposal sheet when a task extracted from an email is
   accepted — only then does the email leave the inbox. */
function markEmailProcessed(id) {
    dismissEmails([id]);
}

/* Read an email's body, let Claude extract action items, and show them in the
   same proposal sheet the omni bar uses — so email tasks are reviewed, edited
   and (now) linked to a project before they exist, instead of being created
   blind behind a toast. The email stays in the inbox until one is accepted. */
async function emailToTasksAI(em) {
    toast('Reading the email…');
    try {
        const body = await Google.getMessageText(em.id);
        const extracted = await AI.extractEmailTasks(em.subject, body);
        if (!extracted.length) {
            // nothing to do with it — clear it out so the inbox trends to empty
            dismissEmails([em.id]);
            toast('No action items found — email dismissed');
            return;
        }
        const link = `https://mail.google.com/mail/u/0/#inbox/${em.threadId}`;
        // show the linked project in the summary so the grouping is visible
        const projLabel = (mId) => {
            const m = matterById(mId);
            if (!m) return null;
            const cn = clientById(m.clientId)?.name;
            return (cn ? cn + ' · ' : '') + m.title;
        };
        Omni.sourceEmail = em.id;
        Omni.lastInput = `Email — ${em.subject}`;
        Omni.proposals = extracted.map(td => {
            const data = {
                title: td.title || em.subject,
                due: td.due || null,
                priority: td.priority || 'normal',
                notes: (td.notes ? td.notes + '\n\n' : '') + `From email: ${em.subject}\n${link}`
            };
            if (td.matterId && matterById(td.matterId)) data.matterId = td.matterId;
            else if (td.matterName) data.matterName = td.matterName;
            else if (td.clientName) data.clientName = td.clientName;
            const proj = data.matterId ? projLabel(data.matterId) : (data.matterName || null);
            return {
                op: 'createTask',
                data,
                summary: `${data.title}${proj ? ' · ' + proj : ''}${data.due ? ' · due ' + data.due : ''}`,
                accepted: false
            };
        });
        Omni._renderProposals({ actions: Omni.proposals });
    } catch (e) {
        console.error('email AI failed', e);
        toast('AI failed: ' + (e.message || e), 'error');
    }
}

/* =========================================================================
 * 17. ACTIONS / FORMS
 * ========================================================================= */

function openClientForm(id = null) {
    const c = id ? clientById(id) : null;
    Modal.open({
        title: c ? 'Edit client' : 'New client',
        ai: { hint: 'Paste a signature block or describe the client' },
        fields: [
            { name: 'name', label: 'Name', value: c?.name || '', required: true, full: true },
            { name: 'email', label: 'Email', type: 'email', value: c?.email || '' },
            { name: 'phone', label: 'Phone', value: c?.phone || '' },
            { name: 'website', label: 'Website', type: 'url', value: c?.website || '', placeholder: 'https://' },
            { name: 'taxId', label: 'Tax / VAT ID', value: c?.taxId || '' },
            { name: 'address', label: 'Address', type: 'textarea', value: c?.address || '', rows: 2, full: true },
            { name: 'notes', label: 'Notes', type: 'textarea', value: c?.notes || '', rows: 3, full: true }
        ],
        onSave: (data) => {
            if (!data.name?.trim()) { toast('Name is required', 'error'); return false; }
            if (c) {
                Object.assign(c, data);
                History.record('clientUpdated', 'client', c.id, data.name);
            } else {
                const nc = { id: uuid(), createdAt: new Date().toISOString(), ...data };
                state.clients.push(nc);
                History.record('clientCreated', 'client', nc.id, data.name);
            }
            Store.save(); render();
            toast(c ? 'Client updated' : 'Client added');
        },
        onDelete: c ? () => {
            const has = mattersForClient(c.id).length || tasksForClient(c.id).length || logsForClient(c.id).length;
            if (has && !confirm('This client has projects/tasks/time. Delete all of it?')) return;
            const ts = new Date().toISOString();
            const blob = [c], tasks = [];
            state.matters.forEach(m => { if (m.clientId === c.id) { m.deletedAt = ts; blob.push(m); } });
            state.tasks.forEach(t => { if (t.clientId === c.id) { t.deletedAt = ts; Tasks.put(t); tasks.push(t); } });
            state.logs.forEach(l => { if (l.clientId === c.id) { l.deletedAt = ts; blob.push(l); } });
            c.deletedAt = ts;
            Store.save();
            navigate('clients');
            deletedWithUndo('Client deleted', { blob, tasks });
        } : null
    });
}

function openMatterForm(id = null, defaultClientId = null, parentId = null) {
    const m = id ? matterById(id) : null;
    if (!state.clients.length) {
        toast('Add a client first', 'error');
        navigate('clients');
        return;
    }
    Modal.open({
        title: m ? 'Edit project' : 'New project',
        ai: { hint: 'Describe the project — “MiCA licence application for Datalink, 220/h”' },
        fields: [
            { name: 'title', label: 'Title', value: m?.title || '', required: true, full: true },
            { name: 'clientId', label: 'Client', type: 'select', required: true,
                value: m?.clientId || defaultClientId || state.clients[0].id,
                options: state.clients.map(c => ({ value: c.id, label: c.name })) },
            { name: 'status', label: 'Status', type: 'select',
                value: m?.status || 'open',
                options: [
                    { value: 'open', label: 'Open' },
                    { value: 'on-hold', label: 'On hold' },
                    { value: 'closed', label: 'Closed' }
                ]},
            { name: 'billingType', label: 'Billing', type: 'select',
                value: m?.billingType || (m?.parentId ? '' : 'hourly'),
                options: [
                    ...(m?.parentId ? [{ value: '', label: 'Same as parent project' }] : []),
                    { value: 'hourly', label: 'Hourly' },
                    { value: 'fixed', label: 'Fixed fee' },
                    { value: 'probono', label: 'Pro bono' },
                    { value: 'partnership', label: 'Partnership' }
                ],
                hint: 'Pro bono and partnership still log time — it just never becomes money owed.' },
            { name: 'due', label: 'Deadline', type: 'date', value: fmtDateInput(m?.due),
                hint: 'When the whole project is due. Shown on the project and the client page.' },
            { name: 'rate', label: `Hourly rate (${profileCurrency()})`, type: 'number', min: 0, step: 1,
                value: m?.rate ?? '', hint: `Leave blank to use default ${state.profile.rate}/h` },
            { name: 'website', label: 'Link', type: 'url', value: m?.website || '', placeholder: 'https://',
                hint: 'Deal room, repo, data room — whatever this project lives behind.' },
            { name: 'description', label: 'Description', type: 'textarea', value: m?.description || '', rows: 4, full: true }
        ],
        onSave: (data) => {
            if (!data.title?.trim()) { toast('Title is required', 'error'); return false; }
            if (m) {
                Object.assign(m, data);
                History.record('matterUpdated', 'matter', m.id, data.title);
            } else {
                const nm = { id: uuid(), openedAt: new Date().toISOString(), ...data };
                // nesting comes from where you pressed "+ sub"
                if (parentId) nm.parentId = parentId;
                state.matters.push(nm);
                History.record('matterCreated', 'matter', nm.id, data.title);
            }
            Store.save(); render();
            toast(m ? 'Project updated' : 'Project created');
        },
        onDelete: m ? () => {
            const has = tasksForMatter(m.id).length || logsForMatter(m.id).length;
            if (has && !confirm('This project has tasks/time. Delete all of it?')) return;
            const ts = new Date().toISOString();
            const blob = [m], tasks = [];
            state.tasks.forEach(t => { if (t.matterId === m.id) { t.deletedAt = ts; Tasks.put(t); tasks.push(t); } });
            state.logs.forEach(l => { if (l.matterId === m.id) { l.deletedAt = ts; blob.push(l); } });
            m.deletedAt = ts;
            Store.save();
            navigate('matters');
            deletedWithUndo('Project deleted', { blob, tasks });
        } : null
    });
}

function openTaskForm(id = null, defaultMatterId = null, defaultClientId = null) {
    const t = id ? taskById(id) : null;
    Modal.open({
        title: t ? 'Edit task' : 'New task',
        ai: { hint: 'Say it in a sentence — “draft the escrow review for Fligen, high, by Friday”' },
        fields: [
            { name: 'title', label: 'Title', value: t?.title || '', required: true, full: true },
            { name: 'matterId', label: 'Project', type: 'select',
                value: t?.matterId || defaultMatterId || '',
                options: [{ value:'', label:'— none —' }, ...state.matters.map(m => ({
                    value: m.id, label: `${clientById(m.clientId)?.name || '—'} · ${m.title}`
                }))]},
            { name: 'due', label: 'Due date', type: 'date', value: fmtDateInput(t?.due) },
            { name: 'priority', label: 'Priority', type: 'select',
                value: t?.priority || 'normal',
                options: [
                    { value: 'low', label: 'Low' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'high', label: 'High' }
                ]},
            { name: 'assigneeEmail', label: 'Assignee email', type: 'email', value: t?.assigneeEmail || '',
                placeholder: 'teammate@example.com',
                hint: 'Leave blank to keep the task yours. The assignee sees it when they sign in.' },
            { name: 'link', label: 'Drive / link', type: 'url', value: t?.link || '', placeholder: 'https://drive.google.com/…',
                hint: 'A folder or document to open when you sit down to do this — Google Drive, a data room, anything.' },
            { name: 'blockedReason', label: 'Stuck / waiting on', value: t?.blockedReason || '', full: true,
                placeholder: 'e.g. waiting for signed POA from the client',
                hint: 'Why the task is not moving. Shown on the client portal if this client is shared — write it for the client to read.' },
            { name: 'notes', label: 'Notes (internal)', type: 'textarea', value: t?.notes || '', rows: 3, full: true }
        ],
        onSave: (data) => {
            if (!data.title?.trim()) { toast('Title is required', 'error'); return false; }
            const mat = data.matterId ? matterById(data.matterId) : null;
            const payload = {
                title: data.title,
                matterId: data.matterId || null,
                // a task with no project still belongs to its client
                clientId: mat?.clientId || data.clientId || defaultClientId || t?.clientId || null,
                due: data.due || null,
                priority: data.priority,
                assigneeEmail: (data.assigneeEmail || '').trim().toLowerCase() || null,
                blockedReason: (data.blockedReason || '').trim() || null,
                link: (data.link || '').trim() || null,
                notes: data.notes
            };
            if (t) {
                Object.assign(t, payload);
                Tasks.put(t);
                History.record('taskUpdated', 'task', t.id, payload.title);
            } else {
                const nt = { id: uuid(), status: 'todo', createdAt: new Date().toISOString(), ...payload };
                Tasks.put(nt);
                History.record('taskCreated', 'task', nt.id, payload.title);
            }
            render();
            toast(t ? 'Task updated' : 'Task added');
        },
        onDelete: t ? () => {
            t.deletedAt = new Date().toISOString();
            // unlink logs from deleted task but keep them — remember which,
            // so undo can hook the time back onto the task
            const unlinked = state.logs.filter(l => l.taskId === t.id);
            unlinked.forEach(l => { l.taskId = null; });
            Tasks.put(t);
            Store.save(); render();
            toast('Task deleted', 'ok', () => {
                delete t.deletedAt;
                unlinked.forEach(l => { l.taskId = t.id; });
                Tasks.put(t);
                Store.save(); render();
                toast('Restored');
            });
        } : null
    });
}

function openLogForm(id = null) {
    const l = id ? state.logs.find(x => x.id === id) : null;
    Modal.open({
        title: l ? 'Edit time entry' : 'Manual time entry',
        ai: { hint: 'e.g. “1h40 yesterday on the Datavise bylaws”' },
        fields: [
            { name: 'matterId', label: 'Project', type: 'select', required: true,
                value: l?.matterId || '',
                options: state.matters.length
                    ? state.matters.map(m => ({ value: m.id, label: `${clientById(m.clientId)?.name||'—'} · ${m.title}` }))
                    : [{ value:'', label:'— add a project first —' }]},
            { name: 'date', label: 'Date', type: 'date', required: true, value: fmtDateInput(l?.startedAt) || todayISO() },
            { name: 'minutes', label: 'Minutes', type: 'number', required: true, min: 1, step: 1, value: l?.minutes ?? 30 },
            { name: 'notes', label: 'Notes', type: 'textarea', value: l?.notes || '', rows: 3, full: true }
        ],
        onSave: (data) => {
            const m = matterById(data.matterId);
            if (!m) { toast('Pick a matter', 'error'); return false; }
            if (!data.minutes || data.minutes < 1) { toast('Enter minutes', 'error'); return false; }
            const startedAt = new Date(data.date + 'T09:00:00').toISOString();
            const payload = {
                matterId: m.id, clientId: m.clientId,
                startedAt,
                endedAt: new Date(new Date(startedAt).getTime() + data.minutes * 60000).toISOString(),
                minutes: data.minutes,
                notes: data.notes || ''
            };
            if (l) {
                if (l.invoiceId) { toast('Cannot edit billed entry', 'error'); return false; }
                Object.assign(l, payload);
            } else {
                const nl = { id: uuid(), taskId: null, invoiceId: null, ...payload };
                state.logs.push(nl);
            }
            Store.save(); render();
            toast(l ? 'Entry updated' : 'Entry added');
        },
        onDelete: l ? () => {
            if (l.invoiceId) { toast('Cannot delete billed entry', 'error'); return; }
            l.deletedAt = new Date().toISOString();
            Store.save(); render();
            deletedWithUndo('Entry deleted', { blob: [l] });
        } : null
    });
}

function openInvoiceForm(matterId = null, existingId = null, clientId = null) {
    const existing = existingId ? invoiceById(existingId) : null;

    if (existing) {
        // simple editor for existing invoice metadata
        Modal.open({
            title: 'Edit invoice ' + existing.number,
            fields: [
                { name: 'number', label: 'Number', value: existing.number, required: true },
                { name: 'dateIssued', label: 'Issued', type: 'date', value: fmtDateInput(existing.dateIssued), required: true },
                { name: 'dateDue', label: 'Due', type: 'date', value: fmtDateInput(existing.dateDue) },
                { name: 'notes', label: 'Notes', type: 'textarea', value: existing.notes || '', rows: 4, full: true }
            ],
            onSave: (data) => {
                Object.assign(existing, data);
                Store.save(); render();
                toast('Invoice updated');
            },
            onDelete: () => {
                // unlink logs so they become unbilled again; undo re-bills them
                const unbilled = state.logs.filter(l => l.invoiceId === existing.id);
                unbilled.forEach(l => { l.invoiceId = null; });
                existing.deletedAt = new Date().toISOString();
                Store.save();
                navigate('invoices');
                toast('Invoice deleted', 'ok', () => {
                    delete existing.deletedAt;
                    unbilled.forEach(l => { l.invoiceId = existing.id; });
                    Store.save(); render();
                    toast('Restored');
                });
            }
        });
        return;
    }

    // new invoice — pick a client, bundle ALL their unbilled time (across matters)
    const clientUnbilled = (cid) => state.logs.filter(l =>
        l.clientId === cid && !l.invoiceId && !l.deletedAt);
    const clientsWithUnbilled = liveClients().filter(c => clientUnbilled(c.id).length);
    if (!clientsWithUnbilled.length) {
        toast('No unbilled time to invoice yet', 'error');
        return;
    }
    const preClient = clientId || (matterId ? (matterById(matterId)?.clientId || '') : '');
    Modal.open({
        title: 'New invoice',
        fields: [
            { name: 'clientId', label: 'Client', type: 'select', required: true,
                value: preClient || clientsWithUnbilled[0].id,
                options: clientsWithUnbilled.map(c => {
                    const mins = clientUnbilled(c.id).reduce((s,l)=>s+l.minutes,0);
                    return { value: c.id, label: `${c.name} · ${fmtMinutes(mins)} unbilled` };
                }),
                hint: 'All unbilled time across the client’s matters is bundled, one line per matter.' },
            { name: 'dateIssued', label: 'Issued', type: 'date', required: true, value: todayISO() },
            { name: 'dateDue', label: 'Due', type: 'date', value: '' },
            { name: 'notes', label: 'Notes', type: 'textarea', value: '', rows: 3, full: true }
        ],
        onSave: (data) => {
            const c = clientById(data.clientId);
            if (!c) { toast('Pick a client', 'error'); return false; }
            const unbilled = clientUnbilled(c.id);
            if (!unbilled.length) { toast('No unbilled time for this client', 'error'); return false; }
            // one line item per matter
            const byMatter = {};
            unbilled.forEach(l => { (byMatter[l.matterId] = byMatter[l.matterId] || []).push(l); });
            const items = Object.keys(byMatter).map(mid => {
                const logs = byMatter[mid];
                const m = matterById(mid);
                const mins = logs.reduce((s,l)=>s+l.minutes,0);
                const hours = +(mins / 60).toFixed(2);
                const rate = matterRate(m);
                return {
                    description: m ? m.title : 'General work',
                    matterId: mid,
                    entries: logs.length,
                    hours, rate,
                    amount: +(hours * rate).toFixed(2)
                };
            });
            const number = state.profile.invoiceNumberPrefix + String(state.profile.invoiceNumberCounter).padStart(4,'0');
            const inv = {
                id: uuid(),
                number,
                clientId: c.id,
                matterId: null,
                dateIssued: data.dateIssued,
                dateDue: data.dateDue || null,
                currency: profileCurrency(),
                items,
                notes: data.notes || '',
                status: 'draft'
            };
            state.invoices.push(inv);
            state.profile.invoiceNumberCounter += 1;
            unbilled.forEach(l => l.invoiceId = inv.id);
            Store.save();
            navigate('invoices/' + inv.id);
            toast(`Invoice ${number} created`);
        }
    });
}

function openBankAccountForm(id = null) {
    if (!Array.isArray(state.profile.bankAccounts)) state.profile.bankAccounts = [];
    const accts = state.profile.bankAccounts;
    const a = id ? accts.find(x => x.id === id) : null;
    Modal.open({
        title: a ? 'Edit bank account' : 'Add bank account',
        fields: [
            { name: 'currency', label: 'Currency', type: 'select', required: true,
                value: a?.currency || profileCurrency(),
                options: ['EUR','USD','GBP','PLN','CHF','CZK','UAH'].map(c => ({ value: c, label: c })) },
            { name: 'iban', label: 'IBAN / account number', value: a?.iban || '', required: true, full: true },
            { name: 'swift', label: 'SWIFT / BIC', value: a?.swift || '' },
            { name: 'bankName', label: 'Bank', value: a?.bankName || '' },
            { name: 'holder', label: 'Account holder', value: a?.holder || '', full: true }
        ],
        onSave: (data) => {
            if (!data.iban || !data.iban.trim()) { toast('IBAN is required', 'error'); return false; }
            if (a) Object.assign(a, data);
            else accts.push({ id: uuid(), ...data });
            Store.save(); render();
            toast(a ? 'Account updated' : 'Account added');
        },
        onDelete: a ? () => {
            // hard delete — bank accounts carry no deletedAt, so undo re-adds it
            const at = accts.indexOf(a);
            state.profile.bankAccounts = accts.filter(x => x.id !== a.id);
            Store.save(); render();
            toast('Account removed', 'ok', () => {
                state.profile.bankAccounts.splice(at < 0 ? state.profile.bankAccounts.length : at, 0, a);
                Store.save(); render();
                toast('Restored');
            });
        } : null
    });
}

/* =========================================================================
 * 18. EVENT DELEGATION
 * ========================================================================= */

function bindGlobalActions() {
    // Quick time capture from anywhere: ⌘L / Ctrl+L opens the time entry, which
    // leads with the AI bar — say "1h40 on the Novawave memo" and it's logged.
    // This is the realistic "sync": you describe the time, ordify files it.
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            openLogForm();
        }
    });

    document.body.addEventListener('click', (e) => {
        // navigate by row
        const goRow = e.target.closest('[data-go]');
        if (goRow && !e.target.closest('[data-act], [data-toggle], [data-start], button, a')) {
            navigate(goRow.dataset.go);
            return;
        }

        // expand / collapse a branch — UI state, so it survives re-renders
        const twist = e.target.closest('[data-tree-toggle]');
        if (twist) {
            UI.toggleOpen(twist.dataset.treeToggle);
            render();
            return;
        }

        // "+ task" / "+ sub" on a node — create where you are looking
        const addTask = e.target.closest('[data-add-task]');
        if (addTask) {
            const mid = addTask.dataset.addTask || null;
            if (mid) UI.open(mid);
            openTaskForm(null, mid, addTask.dataset.client || null);
            return;
        }
        const addSub = e.target.closest('[data-add-sub]');
        if (addSub) {
            const parentId = addSub.dataset.addSub || null;
            const cid = addSub.dataset.client
                || (parentId ? matterById(parentId)?.clientId : null);
            if (parentId) UI.open(parentId);
            openMatterForm(null, cid, parentId);
            return;
        }

        // log time on a task without finishing it — the every-day-for-a-fortnight case
        const logBtn = e.target.closest('[data-log]');
        if (logBtn) {
            const t = taskById(logBtn.dataset.log);
            if (t) quickLogPrompt(t, 'How long on “' + (t.title || 'this') + '” today?');
            return;
        }

        // toggle task done
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
            const t = taskById(toggle.dataset.toggle);
            if (t) {
                const becameDone = t.status !== 'done';
                t.status = t.status === 'done' ? 'todo' : 'done';
                t.completedAt = t.status === 'done' ? new Date().toISOString() : null;
                Tasks.put(t); render();
                // Closing a task offers to log the time — unless a running timer
                // just logged it. It used to also require a project and demand
                // the task had no time at all, which meant anything you return
                // to day after day was never offered again.
                History.record(becameDone ? 'taskCompleted' : 'taskReopened', 'task', t.id, t.title);
                const justTimed = logsForTask(t.id).some(l =>
                    Date.now() - new Date(l.endedAt || l.startedAt).getTime() < 90 * 1000);
                if (becameDone && !justTimed) quickLogPrompt(t);
            }
            return;
        }

        // assistant cards — every chip is a one-tap answer
        const assist = e.target.closest('[data-assist]');
        if (assist) { Assist.handle(assist.dataset.assist); return; }

        // start timer for a task
        const startBtn = e.target.closest('[data-start]');
        if (startBtn) {
            const t = taskById(startBtn.dataset.start);
            if (t) Timer.start({ taskId: t.id, matterId: t.matterId, clientId: t.clientId, label: t.title });
            return;
        }

        // task row click → edit, unless the click was on a link/control inside it
        const taskRow = e.target.closest('[data-task]');
        if (taskRow && !e.target.closest('[data-toggle], [data-start], [data-stop], a')) {
            openTaskForm(taskRow.dataset.task);
            return;
        }

        // generic action handler
        const act = e.target.closest('[data-act]');
        if (!act) return;
        e.preventDefault();
        const a = act.dataset.act;
        switch (a) {
            case 'new-client': openClientForm(); break;
            case 'share-enable': Share.enable(act.dataset.id); toast('Client portal enabled — link is ready'); break;
            case 'share-disable': {
                if (confirm('Disable the client portal? The link stops working immediately.')) {
                    Share.disable(act.dataset.id);
                    toast('Client portal disabled');
                }
                break;
            }
            case 'comment-send': {
                const key = act.dataset.thread;
                const input = document.querySelector(`.thread-input[data-thread="${CSS.escape(key)}"]`);
                if (!input || !input.value.trim()) break;
                Comments.post(act.dataset.id, key === '_general' ? null : key, input.value);
                input.value = '';
                break;
            }
            case 'share-copy': {
                const c = clientById(act.dataset.id);
                if (!c || !c.shareId) break;
                const link = Share.url(c);
                (navigator.clipboard?.writeText(link) || Promise.reject())
                    .then(() => toast('Link copied'))
                    .catch(() => {
                        const el = $('#share-url');
                        if (el) { el.select(); document.execCommand('copy'); toast('Link copied'); }
                    });
                break;
            }
            case 'edit-client': openClientForm(act.dataset.id); break;
            case 'new-matter': openMatterForm(null, act.dataset.client); break;
            case 'edit-matter': openMatterForm(act.dataset.id); break;
            case 'new-task': openTaskForm(null, act.dataset.matter); break;
            case 'new-log': openLogForm(); break;
            case 'edit-log': openLogForm(act.dataset.id); break;
            case 'new-invoice': openInvoiceForm(act.dataset.matter); break;
            case 'invoice-client': openInvoiceForm(null, null, act.dataset.client); break;
            case 'edit-invoice': openInvoiceForm(null, act.dataset.id); break;
            case 'invoice-status': {
                const inv = invoiceById(act.dataset.id);
                if (inv) {
                    inv.status = act.dataset.status;
                    Store.save(); render(); toast('Marked '+inv.status);
                }
                break;
            }
            case 'gmail-invoice': {
                const inv = invoiceById(act.dataset.id);
                if (!inv) break;
                if (!Google.configured()) { toast('Set Google Client ID in Settings first', 'error'); break; }
                toast('Opening Google sign-in…');
                Google.draftInvoiceEmail(inv.id).then(() => {
                    toast('Draft saved in Gmail');
                    if (confirm('Open Gmail drafts in a new tab?')) Google.openDrafts();
                }).catch(e => toast('Gmail error: ' + e.message, 'error'));
                break;
            }
            case 'gcal-task': {
                const t = taskById(act.dataset.id);
                if (!t) break;
                if (!Google.configured()) { toast('Set Google Client ID in Settings first', 'error'); break; }
                Google.syncTaskToCalendar(t.id).then(evt => {
                    toast('Added to calendar');
                    render();
                }).catch(e => toast('Calendar error: ' + e.message, 'error'));
                break;
            }
            case 'google-signout': {
                Google.signOut();
                break;
            }
            case 'email-dismiss': {
                dismissEmails([act.dataset.id]);
                break;
            }
            case 'email-dismiss-all': {
                const ids = inboxEmails.map(e => e.id);
                const done = dismissEmails(ids);
                if (done.length) {
                    toast(`Dismissed ${done.length} email${done.length === 1 ? '' : 's'}`, 'ok',
                        () => restoreEmails(done));
                }
                break;
            }
            case 'email-ai': {
                const em = inboxEmails.find(x => x.id === act.dataset.id);
                if (!em) break;
                if (!state.profile.anthropicKey) {
                    toast('Add your Anthropic API key in Settings', 'error');
                    break;
                }
                emailToTasksAI(em);
                break;
            }
            case 'email-switch': {
                Google.signOut();
                render();   // re-renders the Inbox view → "Connect Gmail inbox" appears
                break;
            }
            case 'email-open': {
                const em = inboxEmails.find(x => x.id === act.dataset.id);
                if (em) Google.openThread(em.threadId);
                break;
            }
            case 'add-bank': openBankAccountForm(); break;
            case 'edit-bank': openBankAccountForm(act.dataset.id); break;
            case 'remove-bank': {
                if (!confirm('Remove this bank account?')) break;
                state.profile.bankAccounts = (state.profile.bankAccounts || []).filter(x => x.id !== act.dataset.id);
                Store.save(); render(); toast('Account removed');
                break;
            }
            case 'import-invoice':
                if (typeof DocImport !== 'undefined') DocImport.run();
                else toast('Import module not loaded', 'error');
                break;
            case 'export': doExport(); break;
            case 'import': doImport(); break;
            case 'reset': Store.reset(); break;
        }
    });

    // tasks filter chips
    document.body.addEventListener('click', (e) => {
        const f = e.target.closest('[data-filter]');
        if (f) {
            todayFilter = f.dataset.filter;
            render();
        }
        // schedule range — render() re-fetches the calendar itself on Today,
        // so calling populateTodaySchedule() here too would double every request
        const r = e.target.closest('[data-range]');
        if (r && r.dataset.range !== scheduleRange) {
            scheduleRange = r.dataset.range;
            render();
        }
    });

    // paste a key → it verifies itself, without waiting for Save
    document.body.addEventListener('input', (e) => {
        const which = e.target.dataset && e.target.dataset.check;
        if (!which) return;
        const key = e.target.value.trim();
        clearTimeout(keyCheckTimers[which]);
        keyCheckTimers[which] = setTimeout(() => refreshKeyStatus(which, key), 600);
    });

    // settings form
    document.body.addEventListener('submit', (e) => {
        if (e.target.id === 'settings-form') {
            e.preventDefault();
            const data = new FormData(e.target);
            const numericFields = new Set(['rate', 'invoiceNumberCounter']);
            for (const [k, v] of data.entries()) {
                if (numericFields.has(k)) state.profile[k] = Number(v) || 0;
                else state.profile[k] = v;
            }
            Store.save();
            toast('Settings saved');
            render();
        }
    });
}

/* =========================================================================
 * 19. EXPORT / IMPORT
 * ========================================================================= */

function doExport() {
    const blob = new Blob([Store.export()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordify-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Exported');
}

function doImport() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.onchange = () => {
        const file = inp.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                Store.import(reader.result);
                render();
                toast('Imported');
            } catch (e) {
                toast('Import failed: ' + e.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    inp.click();
}

/* =========================================================================
 * 20. RENDER
 * ========================================================================= */

function render() {
    renderSidebar();
    const { view, id } = parseHash();
    const root = $('#view');
    // A re-render in place keeps where you were and what you were typing; only
    // an actual move to another page starts at the top.
    const route = view + '/' + (id || '');
    const sameRoute = UI.route === route;
    const keepScroll = sameRoute ? window.scrollY : 0;
    const keepFocus = sameRoute ? _captureFocus() : null;
    let html = '';
    try {
        switch (view) {
            case 'today':
            case 'tasks':    html = viewToday(); break;   // #/tasks folded into Today
            case 'clients':  html = id ? viewClient(id) : viewClients(); break;
            case 'matters':  html = id ? viewMatter(id) : viewMatters(); break;
            case 'time':     html = viewTime(); break;
            case 'invoices': html = id ? viewInvoice(id) : viewInvoices(); break;
            case 'inbox':    html = viewInbox(); break;
            case 'settings': html = viewSettings(); break;
            default:         html = viewToday();
        }
    } catch (e) {
        console.error('Render failed', e);
        html = `<div class="empty-state"><h3>Render error</h3><pre>${esc(e.stack || e.message)}</pre></div>`;
    }
    root.innerHTML = html;
    UI.route = route;
    Drag.bind();               // delegated, so it survives every re-render
    window.scrollTo(0, keepScroll);
    _restoreFocus(keepFocus);
    if (view === 'today') populateTodaySchedule();
    if (view === 'inbox') populateInbox();
    if (view === 'settings') {
        populateGeminiModels(); populateAnthropicModels();
        refreshKeyStatus('anthropic', state.profile.anthropicKey);
        refreshKeyStatus('gemini', state.profile.geminiKey);
    }
    // mount attachment widgets if their hosts are present in the rendered view
    if (view === 'matters' && id) {
        Attach.renderInto('att-host-matter', Attach.forMatter(id), true);
        paintHistoryVerdict();
    } else if (view === 'clients' && id) {
        Attach.renderInto('att-host-client', Attach.forClient(id), true);
        const sel = $('#share-done-days');
        if (sel) sel.addEventListener('change', () => {
            Share.setDoneDays(sel.dataset.id, sel.value);
            toast('Portal window updated');
        });
        const cb = $('#share-comments');
        if (cb) cb.addEventListener('change', () => {
            const c = clientById(cb.dataset.id);
            if (!c) return;
            c.shareComments = cb.checked;
            Store.save();
            Share._publishNow();
            toast(cb.checked ? 'Client replies enabled' : 'Client replies switched off');
        });
        // Enter sends a reply without reaching for the button
        $$('.thread-input').forEach(inp => inp.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const c = clientById(id);
            if (!c || !inp.value.trim()) return;
            const key = inp.dataset.thread;
            Comments.post(c.id, key === '_general' ? null : key, inp.value);
            inp.value = '';
        }));
        const cl = clientById(id);
        if (cl && Comments.unread(cl)) Comments.markSeen(cl);
    }
}

/* =========================================================================
 * 21. BOOT
 * ========================================================================= */

async function boot(user) {
    Modal.init();
    Timer.init();
    bindGlobalActions();
    if (!location.hash) location.hash = '#/today';
    const uid = (user && user.uid) ? user.uid : null;
    await Store.init(uid);          // loads the blob from Firestore, realtime sync
    await Tasks.init(user);         // tasks collection + one-time migration
    Comments.sync();                // open a thread listener per shared client
    purgeOldDeletions();            // nothing else ever clears soft-deleted rows
    render();
}

// Boot is gated by auth.js — it calls window.ordifyBoot(user) once the user is
// signed in with Google. Until then the #auth-gate overlay covers the app.
window.ordifyBoot = boot;
