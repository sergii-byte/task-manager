/* ordify · store
 *
 * One document per thing, not one blob for everything.
 *
 * v2 serialised the entire practice into a single JSON document and wrote it
 * whole on every change. Two devices editing anything at all — different
 * clients, different days — would overwrite each other, last writer winning,
 * silently. That is the one class of bug that loses work rather than
 * annoying you, so it is the first thing fixed here.
 *
 * Each node, time entry and invoice is its own record with its own version.
 * A write touches one record. Concurrent edits to different records simply
 * both survive; concurrent edits to the *same* record are resolved by field,
 * newest wins, and the loser is kept so nothing disappears without trace.
 */
'use strict';

const Store = {
    /* An adapter so the core is testable without a network: memory here,
       Firestore in the app. Anything with get/put/all/subscribe will do. */
    adapter: null,
    onChange: null,

    use(adapter) { Store.adapter = adapter; return Store; },

    /* Every record carries who last touched each field and when, which is what
       makes a field-level merge possible at all. */
    stamp(record, fields, at = Date.now(), by = 'local') {
        const meta = { ...(record._v || {}) };
        fields.forEach(f => { meta[f] = { at, by }; });
        return { ...record, _v: meta, updatedAt: at };
    },

    /* Merge two versions of the same record without losing an edit.
       Field by field: whoever wrote later wins that field. Equal timestamps
       fall back to the id of the writer so both devices agree on the outcome
       rather than flip-flopping. */
    merge(mine, theirs) {
        if (!mine) return theirs;
        if (!theirs) return mine;
        const out = { ...mine };
        const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
        keys.delete('_v');
        const mv = mine._v || {}, tv = theirs._v || {};
        const meta = {};
        keys.forEach(k => {
            const a = mv[k], b = tv[k];
            const at = a ? a.at : 0, bt = b ? b.at : 0;
            const takeTheirs = bt > at || (bt === at && b && a && String(b.by) > String(a.by));
            out[k] = takeTheirs ? theirs[k] : mine[k];
            meta[k] = takeTheirs ? b : a;
        });
        Object.keys(meta).forEach(k => { if (!meta[k]) delete meta[k]; });
        out._v = meta;
        out.updatedAt = Math.max(mine.updatedAt || 0, theirs.updatedAt || 0);
        return out;
    },

    async put(kind, record, changedFields) {
        const fields = changedFields || Object.keys(record).filter(k => k[0] !== '_');
        const stamped = Store.stamp(record, fields);
        const existing = await Store.adapter.get(kind, record.id);
        const merged = Store.merge(existing, stamped);
        await Store.adapter.put(kind, merged);
        if (Store.onChange) Store.onChange(kind, merged);
        return merged;
    },

    async all(kind) { return Store.adapter.all(kind); },
    async get(kind, id) { return Store.adapter.get(kind, id); },

    /* Deleting is marking, always. A practice has retention duties, and v2's
       only route back was an undo toast that vanished in seconds. */
    async remove(kind, id) {
        const rec = await Store.adapter.get(kind, id);
        if (!rec) return null;
        return Store.put(kind, { ...rec, deletedAt: new Date().toISOString() }, ['deletedAt']);
    },
    async restore(kind, id) {
        const rec = await Store.adapter.get(kind, id);
        if (!rec) return null;
        return Store.put(kind, { ...rec, deletedAt: null }, ['deletedAt']);
    },

    /* What the bin shows: everything removed, newest first, with how long is
       left before it is really gone. */
    async binned(kind, { days = 30 } = {}) {
        const all = await Store.adapter.all(kind);
        const cutoff = Date.now() - days * 86400000;
        return all
            .filter(r => r.deletedAt && new Date(r.deletedAt).getTime() > cutoff)
            .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''))
            .map(r => ({
                record: r,
                daysLeft: Math.max(0, days - Math.floor((Date.now() - new Date(r.deletedAt)) / 86400000))
            }));
    }
};

/* A memory adapter — what the tests run against, and what the app falls back
   to when offline. */
function MemoryAdapter(seed = {}) {
    const db = {};
    Object.entries(seed).forEach(([k, v]) => { db[k] = new Map(v.map(r => [r.id, r])); });
    return {
        async get(kind, id) { return (db[kind] && db[kind].get(id)) || null; },
        async all(kind) { return db[kind] ? [...db[kind].values()] : []; },
        async put(kind, rec) {
            if (!db[kind]) db[kind] = new Map();
            db[kind].set(rec.id, rec);
            return rec;
        },
        _raw: db
    };
}

/* Local storage, which is where the practice actually lives until you sign in.
   Same shape as the memory adapter, so nothing above it knows the difference —
   and the same field-merge applies, because two tabs of the same browser are
   already two writers. */
function LocalAdapter(prefix = 'ordify.v3') {
    const key = (kind) => prefix + '.' + kind;
    const read = (kind) => {
        try { return JSON.parse(localStorage.getItem(key(kind)) || '[]'); }
        catch (e) { console.warn('unreadable store, starting empty', e); return []; }
    };
    const write = (kind, rows) => {
        try { localStorage.setItem(key(kind), JSON.stringify(rows)); }
        catch (e) {
            // out of quota is the one failure worth surfacing: silently losing
            // a write is exactly the class of bug this rewrite exists to kill
            console.error('could not save', e);
            throw new Error('Could not save — storage is full.');
        }
    };
    return {
        async all(kind) { return read(kind); },
        async get(kind, id) { return read(kind).find(r => r.id === id) || null; },
        async put(kind, rec) {
            const rows = read(kind);
            const i = rows.findIndex(r => r.id === rec.id);
            if (i < 0) rows.push(rec); else rows[i] = rec;
            write(kind, rows);
            return rec;
        },
        /* Another tab writing the same practice is a real second device. */
        subscribe(onExternal) {
            window.addEventListener('storage', (e) => {
                if (e.key && e.key.startsWith(prefix)) onExternal(e.key.slice(prefix.length + 1));
            });
        },
        _clear() { ['node', 'entry', 'invoice', 'memo'].forEach(k => localStorage.removeItem(key(k))); }
    };
}

if (typeof module !== 'undefined') module.exports = { Store, MemoryAdapter, LocalAdapter };
