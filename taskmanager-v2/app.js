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
        anthropicModel: 'claude-3-5-haiku-latest',
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
const tasksForMatter = (mid) => state.tasks.filter(t => t.matterId === mid && !t.deletedAt);
const tasksForClient = (cid) => state.tasks.filter(t => t.clientId === cid && !t.deletedAt);
const logsForMatter = (mid) => state.logs.filter(l => l.matterId === mid && !l.deletedAt);
const logsForTask = (tid) => state.logs.filter(l => l.taskId === tid && !l.deletedAt);
const logsForClient = (cid) => state.logs.filter(l => l.clientId === cid && !l.deletedAt);

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
            const rate = matterRate(m);
            return sum + (l.minutes / 60) * rate;
        }, 0);
};

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

    open({ title, fields, onSave, onDelete = null, saveLabel = 'Save' }) {
        $('#modal-title').textContent = title;
        $('#modal-save').textContent = saveLabel;
        $('#modal-delete').style.display = onDelete ? '' : 'none';
        Modal.onSave = onSave;
        Modal.onDelete = onDelete;
        $('#modal-body').innerHTML = fields.map(f => Modal._renderField(f)).join('');
        Modal.el.showModal();
        // focus first input
        setTimeout(() => {
            const first = $('#modal-body input, #modal-body textarea, #modal-body select');
            if (first && !first.disabled) first.focus();
        }, 30);
    },

    close() {
        Modal.onSave = null;
        Modal.onDelete = null;
        if (Modal.el.open) Modal.el.close();
    },

    _renderField(f) {
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
            <div class="field ${f.full ? 'full':''}">
                ${f.type === 'checkbox' ? '' : `<label for="${id}">${esc(f.label)}${f.required?' *':''}</label>`}
                ${input}
                ${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ''}
            </div>
        `;
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
            toast('Pick a matter first', 'error');
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

const NAV_ITEMS = [
    { id: 'today',    label: 'today',     icon: '○' },
    { id: 'inbox',    label: 'inbox',     icon: '✉' },
    { id: 'clients',  label: 'clients',   icon: '◐' },
    { id: 'matters',  label: 'matters',   icon: '◇' },
    { id: 'tasks',    label: 'tasks',     icon: '☐' },
    { id: 'time',     label: 'time',      icon: '◴' },
    { id: 'invoices', label: 'invoices',  icon: '$' }
];

function renderSidebar() {
    const cur = parseHash().view;
    const nav = $('#nav');
    nav.innerHTML = NAV_ITEMS.map(it => {
        let count = '';
        if (it.id === 'today') {
            const n = liveTasks().filter(t => taskStatus(t) !== 'done' && (t.due === todayISO() || taskStatus(t) === 'overdue')).length;
            if (n) count = `<span class="count">${n}</span>`;
        } else if (it.id === 'clients') count = `<span class="count">${liveClients().length || ''}</span>`;
        else if (it.id === 'matters') count = `<span class="count">${liveMatters().filter(m=>m.status!=='closed').length || ''}</span>`;
        else if (it.id === 'tasks') count = `<span class="count">${liveTasks().filter(t=>t.status!=='done').length || ''}</span>`;
        else if (it.id === 'invoices') count = `<span class="count">${liveInvoices().filter(i=>i.status!=='paid').length || ''}</span>`;

        return `<button class="nav-item ${cur===it.id?'active':''}" data-nav="${it.id}">
            <span class="ic">${it.icon}</span><span>${it.label}</span>${count}
        </button>`;
    }).join('');
    nav.onclick = (e) => {
        const btn = e.target.closest('[data-nav]');
        if (btn) navigate(btn.dataset.nav);
    };
    $('#settings-btn').onclick = () => navigate('settings');
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

    // "open this week" — overdue first, then due today, then rest of the week
    const wkEnd = new Date(wkStart); wkEnd.setDate(wkEnd.getDate() + 7);
    const wkEndISO = wkEnd.toISOString().slice(0, 10);
    const weekTasks = [
        ...overdue,
        ...dueToday,
        ...openTasks.filter(t => t.due && t.due > today && t.due < wkEndISO),
        ...openTasks.filter(t => !t.due).slice(0, 4)
    ];
    const seen = new Set();
    const weekTasksUniq = weekTasks.filter(t => (seen.has(t.id) ? false : seen.add(t.id)));

    return `
    <div class="today-v3">
        <div class="t-daterow">
            <span class="now">${now.toLocaleDateString(undefined,{weekday:'long', day:'2-digit', month:'long', year:'numeric'}).toLowerCase()}</span>
            <span class="sep">/</span>
            <span class="clock"><span class="pulse"></span>${now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            <span class="sep">/</span>
            <span>${overdue.length} overdue · ${openTasks.length} open</span>
        </div>

        <header class="t-hero">
            <div class="t-greet">${esc(greet)}, ${esc(firstName)}</div>
            <h1 class="t-headline">${esc(headline)}<span class="dot">.</span></h1>
            <div class="t-stats">
                <div class="t-stat">
                    <div class="k">closed today</div>
                    <div class="v">${doneToday.length}</div>
                    <div class="sub">${openTasks.length} still open</div>
                </div>
                <div class="t-stat">
                    <div class="k">timer</div>
                    <div class="v ${state.timer?'accent':''}">${esc(timerVal)}</div>
                    <div class="sub">${esc(timerSub)}</div>
                </div>
                <div class="t-stat">
                    <div class="k">this week</div>
                    <div class="v">${(weekMins/60).toFixed(1)}<span class="small">h</span></div>
                    <div class="sub">${fmtMoney(weekBillable, profileCurrency())} billable</div>
                </div>
                <div class="t-stat">
                    <div class="k">next deadline</div>
                    <div class="v">${daysToDeadline != null ? daysToDeadline + 'd' : '—'}</div>
                    <div class="sub ${daysToDeadline != null && daysToDeadline <= 2 ? 'warn' : ''}">${nextDeadline ? esc(nextDeadline.title) : 'nothing scheduled'}</div>
                </div>
            </div>
        </header>

        <section class="t-sec">
            <div class="t-sechdr">
                <h2>schedule</h2>
                <span class="count">today</span>
                <span class="right"><button class="btn sm" data-act="new-task">＋ task</button></span>
            </div>
            <div id="t-schedule" class="t-schedule"><div class="t-sched-msg">Loading…</div></div>
        </section>

        <section class="t-sec">
            <div class="t-sechdr">
                <h2>open this week</h2>
                <span class="count">${weekTasksUniq.length} task${weekTasksUniq.length===1?'':'s'}</span>
                <span class="right"><a href="#/tasks">see all</a></span>
            </div>
            ${weekTasksUniq.length
                ? `<div class="t-tasks">${weekTasksUniq.map(_todayTaskRow).join('')}</div>`
                : `<div class="t-sched-msg">No open tasks this week — capture one with the bar above.</div>`}
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
        (t.status !== 'done' && t.blockedReason) ? '⚑ ' + t.blockedReason : '']
        .filter(Boolean).map(x => esc(x)).join(' · ');
    return `
        <div class="t-task ${st==='done'?'done':''} ${st==='overdue'?'overdue':''}" data-task="${t.id}">
            <span class="t-check ${st==='done'?'done':''}" data-toggle="${t.id}"></span>
            <div class="t-task-body">
                <div class="t-task-title">${esc(t.title)}</div>
                ${ctx ? `<div class="t-task-ctx">${ctx}</div>` : ''}
            </div>
            ${mat ? `<button class="t-task-go" data-start="${t.id}" title="Start timer">▶</button>` : ''}
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
        const events = await Google.listTodayEvents();
        if (!events.length) {
            host.innerHTML = `<div class="t-sched-msg">No events on the calendar today.</div>`;
            return;
        }
        const nowMs = Date.now();
        let html = '';
        let nowLineInserted = false;
        events.forEach(ev => {
            const startMs = ev.start ? new Date(ev.start).getTime() : 0;
            if (!nowLineInserted && !ev.allDay && startMs > nowMs) {
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
    const ctx = [ev.location, ev.hangoutLink ? 'video call' : ''].filter(Boolean).map(x=>esc(x)).join(' · ');
    return `
        <div class="t-slot ${isPast?'past':''} ${isNow?'now':''}">
            <div class="t-slot-when">${when}</div>
            <div class="t-slot-marker"></div>
            <div class="t-slot-body">
                <div class="t-slot-what">${esc(ev.title)}</div>
                ${ctx ? `<div class="t-slot-ctx">${ctx}</div>` : ''}
            </div>
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
                    <td>${t.status !== 'done' && t.blockedReason ? `<span class="badge stuck" title="${esc(t.blockedReason)}">stuck</span> ` : ''}${t.due ? `<span class="badge ${st==='overdue'?'overdue':''}">${fmtDate(t.due)}</span>` : ''}</td>
                    <td style="width:80px">
                        ${mat ? `<button class="play" data-start="${t.id}" title="Start timer">▶</button>` : ''}
                        ${t.due ? `<button class="play" data-act="gcal-task" data-id="${t.id}" title="Add to Google Calendar" style="font-size:11px;width:auto;padding:0 6px">📅</button>` : ''}
                    </td>
                </tr>`;
        }).join('')}
    </tbody></table>`;
}

/* =========================================================================
 * 11. VIEW: CLIENTS
 * ========================================================================= */

function viewClients() {
    const list = [...liveClients()].sort((a,b) => (a.name||'').localeCompare(b.name||''));
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
            <table class="t">
                <thead><tr>
                    <th>Name</th><th>Email</th><th class="num">Matters</th><th class="num">Open tasks</th><th class="num">Unbilled</th>
                </tr></thead>
                <tbody>
                    ${list.map(c => {
                        const matters = mattersForClient(c.id).length;
                        const openTasks = tasksForClient(c.id).filter(t => t.status !== 'done').length;
                        const unbilled = totalUnbilledForClient(c.id);
                        return `<tr class="row" data-go="clients/${c.id}">
                            <td><strong>${esc(c.name)}</strong></td>
                            <td class="muted">${esc(c.email||'')}</td>
                            <td class="num">${matters}</td>
                            <td class="num">${openTasks}</td>
                            <td class="num">${unbilled ? fmtMoney(unbilled, profileCurrency()) : '—'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
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
                <button class="btn primary" data-act="new-matter" data-client="${c.id}">＋ New matter</button>
            </div>
        </div>

        <div class="cards">
            <div class="card"><div class="card-label">Matters</div><div class="card-value">${matters.length}</div></div>
            <div class="card"><div class="card-label">Total time</div><div class="card-value">${fmtMinutes(totalMins)}</div></div>
            <div class="card"><div class="card-label">Unbilled</div><div class="card-value">${fmtMoney(unbilled, profileCurrency())}</div></div>
            <div class="card"><div class="card-label">Open tasks</div><div class="card-value">${tasks.filter(t=>t.status!=='done').length}</div></div>
        </div>

        <div class="info-grid">
            ${c.email ? `<div><span class="lbl">Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ''}
            ${c.phone ? `<div><span class="lbl">Phone</span>${esc(c.phone)}</div>` : ''}
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

        <h2 class="section-h">Matters</h2>
        ${matters.length ? `
            <table class="t">
                <thead><tr><th>Title</th><th>Status</th><th class="num">Tasks</th><th class="num">Time</th><th>Rate</th></tr></thead>
                <tbody>${matters.map(m => {
                    const mTasks = tasksForMatter(m.id);
                    const mLogs = logsForMatter(m.id);
                    const mins = mLogs.reduce((s,l)=>s+l.minutes,0);
                    return `<tr class="row" data-go="matters/${m.id}">
                        <td><strong>${esc(m.title)}</strong></td>
                        <td><span class="badge ${m.status||'open'}">${esc(m.status||'open')}</span></td>
                        <td class="num">${mTasks.length}</td>
                        <td class="num">${fmtMinutes(mins)}</td>
                        <td>${fmtMoney(matterRate(m), profileCurrency())}/h</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>
        ` : '<div class="empty">No matters yet.</div>'}

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
            <h1>Matters</h1>
            <div class="meta">${list.length} total · ${list.filter(m=>m.status!=='closed').length} active</div>
            <div class="actions">
                <button class="btn primary" data-act="new-matter">＋ New matter</button>
            </div>
        </div>
        ${list.length === 0 ? `
            <div class="empty-state">
                <h3>No matters yet</h3>
                <p>Matters group tasks, time, and invoices for a client engagement.</p>
                <button class="btn primary" data-act="new-matter">＋ New matter</button>
            </div>
        ` : `
            <table class="t">
                <thead><tr>
                    <th>Title</th><th>Client</th><th>Status</th><th class="num">Tasks</th><th class="num">Time</th><th>Rate</th>
                </tr></thead>
                <tbody>${list.map(m => {
                    const c = clientById(m.clientId);
                    const tcount = tasksForMatter(m.id).length;
                    const mins = logsForMatter(m.id).reduce((s,l)=>s+l.minutes,0);
                    return `<tr class="row" data-go="matters/${m.id}">
                        <td><strong>${esc(m.title)}</strong></td>
                        <td>${esc(c?.name || '—')}</td>
                        <td><span class="badge ${m.status||'open'}">${esc(m.status||'open')}</span></td>
                        <td class="num">${tcount}</td>
                        <td class="num">${fmtMinutes(mins)}</td>
                        <td>${fmtMoney(matterRate(m), profileCurrency())}/h</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>
        `}
    `;
}

function viewMatter(id) {
    const m = matterById(id);
    if (!m) return `<div class="empty-state"><h3>Matter not found</h3><a href="#/matters">Back</a></div>`;
    const c = clientById(m.clientId);
    const tasks = tasksForMatter(id);
    const logs = logsForMatter(id);
    const mins = logs.reduce((s,l)=>s+l.minutes,0);
    const billable = (mins / 60) * matterRate(m);
    const unbilled = logs.filter(l => !l.invoiceId).reduce((s,l)=>s+l.minutes,0);

    return `
        <div class="breadcrumb">
            <a href="#/matters">Matters</a> ›
            ${c ? `<a href="#/clients/${c.id}">${esc(c.name)}</a> ›` : ''}
        </div>
        <div class="view-head">
            <h1>${esc(m.title)}</h1>
            <div class="meta"><span class="badge ${m.status||'open'}">${esc(m.status||'open')}</span></div>
            <div class="actions">
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

/* =========================================================================
 * 13. VIEW: TASKS
 * ========================================================================= */

let tasksFilter = 'open';

function viewTasks() {
    let list = [...liveTasks()];
    if (tasksFilter === 'open') list = list.filter(t => t.status !== 'done');
    else if (tasksFilter === 'done') list = list.filter(t => t.status === 'done');
    else if (tasksFilter === 'overdue') list = list.filter(t => taskStatus(t) === 'overdue');
    list.sort((a,b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (b.status === 'done' && a.status !== 'done') return -1;
        return (a.due || '9999').localeCompare(b.due || '9999');
    });

    return `
        <div class="view-head">
            <h1>Tasks</h1>
            <div class="meta">${list.length} ${tasksFilter}</div>
            <div class="actions">
                <button class="btn primary" data-act="new-task">＋ New task</button>
            </div>
        </div>
        <div class="filter-row">
            <button class="chip ${tasksFilter==='open'?'on':''}" data-filter="open">Open</button>
            <button class="chip ${tasksFilter==='overdue'?'on':''}" data-filter="overdue">Overdue</button>
            <button class="chip ${tasksFilter==='done'?'on':''}" data-filter="done">Done</button>
            <button class="chip ${tasksFilter==='all'?'on':''}" data-filter="all">All</button>
        </div>
        ${renderTaskList(list)}
    `;
}

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
        ${list.length === 0 ? `
            <div class="empty-state">
                <h3>No time entries yet</h3>
                <p>Start a timer from any task or matter, or add an entry manually.</p>
            </div>
        ` : `
            <table class="t">
                <thead><tr>
                    <th>Date</th><th>Client</th><th>Matter</th><th>Notes</th>
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
                <strong>Heads up:</strong> your Anthropic API key is stored in this browser's localStorage in plaintext.
                Anyone with access to this device can read it. Use a key with limited spend, and revoke it if the device is compromised.
            </div>
            <div class="grid2">
                <div class="field full">
                    <label>Anthropic API key</label>
                    <input name="anthropicKey" type="password" placeholder="sk-ant-..." value="${esc(p.anthropicKey)}" autocomplete="off">
                    <small class="hint">Get one at console.anthropic.com → API Keys. Without this, omni-input AI parsing is disabled.</small>
                </div>
                <div class="field"><label>Claude model</label>
                    <select name="anthropicModel">
                        ${['claude-3-5-haiku-latest','claude-3-5-sonnet-latest','claude-sonnet-4-5','claude-opus-4-1'].map(m =>
                            `<option ${p.anthropicModel===m?'selected':''}>${m}</option>`).join('')}
                    </select>
                    <small class="hint">Haiku = cheapest &amp; fastest. Sonnet = better at ambiguous input.</small>
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
                <div class="field full">
                    <label>Gemini API key (audio / video)</label>
                    <input name="geminiKey" type="password" placeholder="AIza..." value="${esc(p.geminiKey||'')}" autocomplete="off">
                    <small class="hint">Get one free at <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com/app/apikey</a>. Required only to attach audio or video files via 📎 — Claude handles documents and images.</small>
                </div>
                <div class="field"><label>Gemini model</label>
                    <select name="geminiModel">
                        ${['gemini-2.0-flash','gemini-2.5-flash','gemini-1.5-flash','gemini-1.5-pro'].map(m =>
                            `<option ${p.geminiModel===m?'selected':''}>${m}</option>`).join('')}
                    </select>
                    <small class="hint">Flash = fast/cheap, Pro = more careful with long video.</small>
                </div>
            </div>

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

function viewInbox() {
    const connected = (typeof Google !== 'undefined') && Google.configured && Google.hasToken();
    return `
        <div class="view-head">
            <h1>Inbox</h1>
            <div class="meta">triage — turn what matters into a task, dismiss the rest</div>
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
        if (!inboxEmails.length) {
            host.innerHTML = `<div class="empty-state">
                <h3>Inbox clear</h3>
                <p>Nothing left to triage — every email is a task or dismissed.</p>
            </div>`;
            return;
        }
        host.innerHTML = `<div class="inbox-list">${inboxEmails.map(_inboxRow).join('')}</div>`;
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

/* Read an email's body, let Claude extract action items, create the tasks. */
async function emailToTasksAI(em) {
    toast('Reading the email…');
    try {
        const body = await Google.getMessageText(em.id);
        const extracted = await AI.extractEmailTasks(em.subject, body);
        if (!extracted.length) {
            toast('No action items found in that email');
            return;
        }
        const link = `https://mail.google.com/mail/u/0/#inbox/${em.threadId}`;
        extracted.forEach(td => {
            const t = {
                id: uuid(), status: 'todo', createdAt: new Date().toISOString(),
                matterId: null, clientId: null, assigneeEmail: null,
                title: td.title || em.subject,
                due: td.due || null,
                priority: td.priority || 'normal',
                notes: (td.notes ? td.notes + '\n\n' : '') + `From email: ${em.subject}\n${link}`
            };
            Tasks.put(t);
        });
        state.emailHandled = state.emailHandled || [];
        state.emailHandled.push(em.id);
        if (state.emailHandled.length > 500) state.emailHandled = state.emailHandled.slice(-500);
        Store.save();
        populateInbox();
        toast(`Created ${extracted.length} task${extracted.length === 1 ? '' : 's'} from the email`);
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
        fields: [
            { name: 'name', label: 'Name', value: c?.name || '', required: true, full: true },
            { name: 'email', label: 'Email', type: 'email', value: c?.email || '' },
            { name: 'phone', label: 'Phone', value: c?.phone || '' },
            { name: 'taxId', label: 'Tax / VAT ID', value: c?.taxId || '' },
            { name: 'address', label: 'Address', type: 'textarea', value: c?.address || '', rows: 2, full: true },
            { name: 'notes', label: 'Notes', type: 'textarea', value: c?.notes || '', rows: 3, full: true }
        ],
        onSave: (data) => {
            if (!data.name?.trim()) { toast('Name is required', 'error'); return false; }
            if (c) {
                Object.assign(c, data);
            } else {
                const nc = { id: uuid(), createdAt: new Date().toISOString(), ...data };
                state.clients.push(nc);
            }
            Store.save(); render();
            toast(c ? 'Client updated' : 'Client added');
        },
        onDelete: c ? () => {
            const has = mattersForClient(c.id).length || tasksForClient(c.id).length || logsForClient(c.id).length;
            if (has && !confirm('This client has matters/tasks/time. Delete all of it?')) return;
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

function openMatterForm(id = null, defaultClientId = null) {
    const m = id ? matterById(id) : null;
    if (!state.clients.length) {
        toast('Add a client first', 'error');
        navigate('clients');
        return;
    }
    Modal.open({
        title: m ? 'Edit matter' : 'New matter',
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
            { name: 'rate', label: `Hourly rate (${profileCurrency()})`, type: 'number', min: 0, step: 1,
                value: m?.rate ?? '', hint: `Leave blank to use default ${state.profile.rate}/h` },
            { name: 'description', label: 'Description', type: 'textarea', value: m?.description || '', rows: 4, full: true }
        ],
        onSave: (data) => {
            if (!data.title?.trim()) { toast('Title is required', 'error'); return false; }
            if (m) {
                Object.assign(m, data);
            } else {
                const nm = { id: uuid(), openedAt: new Date().toISOString(), ...data };
                state.matters.push(nm);
            }
            Store.save(); render();
            toast(m ? 'Matter updated' : 'Matter created');
        },
        onDelete: m ? () => {
            const has = tasksForMatter(m.id).length || logsForMatter(m.id).length;
            if (has && !confirm('This matter has tasks/time. Delete all of it?')) return;
            const ts = new Date().toISOString();
            const blob = [m], tasks = [];
            state.tasks.forEach(t => { if (t.matterId === m.id) { t.deletedAt = ts; Tasks.put(t); tasks.push(t); } });
            state.logs.forEach(l => { if (l.matterId === m.id) { l.deletedAt = ts; blob.push(l); } });
            m.deletedAt = ts;
            Store.save();
            navigate('matters');
            deletedWithUndo('Matter deleted', { blob, tasks });
        } : null
    });
}

function openTaskForm(id = null, defaultMatterId = null) {
    const t = id ? taskById(id) : null;
    Modal.open({
        title: t ? 'Edit task' : 'New task',
        fields: [
            { name: 'title', label: 'Title', value: t?.title || '', required: true, full: true },
            { name: 'matterId', label: 'Matter', type: 'select',
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
                clientId: mat?.clientId || null,
                due: data.due || null,
                priority: data.priority,
                assigneeEmail: (data.assigneeEmail || '').trim().toLowerCase() || null,
                blockedReason: (data.blockedReason || '').trim() || null,
                notes: data.notes
            };
            if (t) {
                Object.assign(t, payload);
                Tasks.put(t);
            } else {
                const nt = { id: uuid(), status: 'todo', createdAt: new Date().toISOString(), ...payload };
                Tasks.put(nt);
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
        fields: [
            { name: 'matterId', label: 'Matter', type: 'select', required: true,
                value: l?.matterId || '',
                options: state.matters.length
                    ? state.matters.map(m => ({ value: m.id, label: `${clientById(m.clientId)?.name||'—'} · ${m.title}` }))
                    : [{ value:'', label:'— add a matter first —' }]},
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

function openInvoiceForm(matterId = null, existingId = null) {
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
    const preClient = matterId ? (matterById(matterId)?.clientId || '') : '';
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
    document.body.addEventListener('click', (e) => {
        // navigate by row
        const goRow = e.target.closest('[data-go]');
        if (goRow && !e.target.closest('[data-act], [data-toggle], [data-start], button, a')) {
            navigate(goRow.dataset.go);
            return;
        }

        // toggle task done
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
            const t = taskById(toggle.dataset.toggle);
            if (t) {
                t.status = t.status === 'done' ? 'todo' : 'done';
                t.completedAt = t.status === 'done' ? new Date().toISOString() : null;
                Tasks.put(t); render();
            }
            return;
        }

        // start timer for a task
        const startBtn = e.target.closest('[data-start]');
        if (startBtn) {
            const t = taskById(startBtn.dataset.start);
            if (t) Timer.start({ taskId: t.id, matterId: t.matterId, clientId: t.clientId, label: t.title });
            return;
        }

        // task row click → edit
        const taskRow = e.target.closest('[data-task]');
        if (taskRow && !e.target.closest('[data-toggle], [data-start]')) {
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
                state.emailHandled = state.emailHandled || [];
                state.emailHandled.push(act.dataset.id);
                if (state.emailHandled.length > 500) state.emailHandled = state.emailHandled.slice(-500);
                Store.save();
                populateInbox();
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
            tasksFilter = f.dataset.filter;
            render();
        }
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
    let html = '';
    try {
        switch (view) {
            case 'today':    html = viewToday(); break;
            case 'clients':  html = id ? viewClient(id) : viewClients(); break;
            case 'matters':  html = id ? viewMatter(id) : viewMatters(); break;
            case 'tasks':    html = viewTasks(); break;
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
    root.scrollTop = 0;
    if (view === 'today') populateTodaySchedule();
    if (view === 'inbox') populateInbox();
    // mount attachment widgets if their hosts are present in the rendered view
    if (view === 'matters' && id) {
        Attach.renderInto('att-host-matter', Attach.forMatter(id), true);
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
