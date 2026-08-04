/* ordify · migrate
 *
 * Bringing a real practice out of v2.
 *
 * v2 keeps three tables — clients, matters, tasks — plus time logs and
 * invoices, all inside one Firestore document at /userdata/{uid}, with tasks
 * mirrored into a /tasks collection. v3 has one node type. The whole job is
 * therefore a shape change, and the shape change is a **pure function**:
 * `fromV2(blob, tasks)` takes plain data and returns plain data. That is what
 * makes it testable against fixtures instead of against someone's real
 * practice, and it is why the risky part — reading and writing — is only a
 * dozen lines at the bottom.
 *
 * Three rules, because this touches work that took years to accumulate:
 *
 *   1. **Nothing is lost.** Fields v3 has no use for (priority, assignee) are
 *      carried across anyway rather than dropped; a node is an open shape.
 *      Deleted records come too, still marked deleted, so the bin has them.
 *   2. **Nothing is invented.** A record whose parent is missing is attached
 *      to nothing and *reported*, never quietly reparented to a plausible
 *      guess. The report is the point: you get to see what was odd.
 *   3. **Ids are preserved**, so running it twice writes the same records
 *      again instead of creating a second copy of the practice.
 *
 * v2's own data is only ever read. Nothing here writes to /userdata.
 */
'use strict';

/* v2 called it a matter; the parts of a record that simply change name. */
const V2_CLIENT = { name: 'title', email: 'email', phone: 'phone', website: 'website',
                    taxId: 'taxId', address: 'address', notes: 'notes' };
const V2_MATTER = { title: 'title', billingType: 'billing', rate: 'rate', fee: 'fee',
                    due: 'due', website: 'drive', description: 'notes', status: 'status' };
const V2_TASK   = { title: 'title', due: 'due', status: 'status', blockedReason: 'blocked',
                    link: 'drive', notes: 'notes', completedAt: 'completedAt',
                    priority: 'priority', assigneeEmail: 'assigneeEmail', order: 'order' };

function carry(src, map) {
    const out = {};
    Object.entries(map).forEach(([from, to]) => {
        const v = src[from];
        if (v !== undefined && v !== '') out[to] = v;
    });
    return out;
}

/* The whole migration, as arithmetic. No network, no DOM, no Store. */
function fromV2(blob = {}, taskDocs = null) {
    const problems = [];
    const nodes = [];
    const byId = new Map();

    const clients  = Array.isArray(blob.clients) ? blob.clients : [];
    const matters  = Array.isArray(blob.matters) ? blob.matters : [];
    // /tasks is the authoritative copy once v2 moved them out of the blob;
    // the blob keeps a mirror that can lag, so prefer the collection.
    const tasks    = Array.isArray(taskDocs) && taskDocs.length ? taskDocs
                   : (Array.isArray(blob.tasks) ? blob.tasks : []);
    const logs     = Array.isArray(blob.logs) ? blob.logs : [];
    const invoices = Array.isArray(blob.invoices) ? blob.invoices : [];

    const push = (type, src, parentId, extra) => {
        const n = makeNode(type, {
            id: src.id, parentId: parentId || null,
            createdAt: src.createdAt || new Date().toISOString(),
            ...extra
        });
        n.deletedAt = src.deletedAt || null;   // makeNode always starts it null
        nodes.push(n);
        byId.set(n.id, n);
        return n;
    };

    clients.forEach(c => {
        const f = carry(c, V2_CLIENT);
        if (!f.title) { problems.push(`A client with no name (${c.id}) came across untitled.`); }
        push('client', c, null, f);
    });

    /* Projects nest. v2 allowed a matter to have a parent matter, so the
       parent may not have been seen yet — hang them all off their client
       first, then re-point in a second pass once every id exists. */
    matters.forEach(m => {
        const f = carry(m, V2_MATTER);
        if (m.clientId && !byId.has(m.clientId)) {
            problems.push(`Project "${f.title || m.id}" points at a client that is not there — it came across unfiled.`);
        }
        push('project', m, byId.has(m.clientId) ? m.clientId : null, f);
    });

    matters.forEach(m => {
        if (!m.parentId) return;
        const self = byId.get(m.id);
        if (!byId.has(m.parentId)) {
            problems.push(`Project "${self.title || m.id}" sat under a project that is not there — it now sits under its client.`);
            return;                              // already parented to the client
        }
        // a loop would detach the branch from the tree entirely
        let cur = byId.get(m.parentId), guard = 0, looped = false;
        while (cur && guard++ < 50) {
            if (cur.id === m.id) { looped = true; break; }
            cur = cur.parentId ? byId.get(cur.parentId) : null;
        }
        if (looped) {
            problems.push(`Project "${self.title || m.id}" was inside itself — left under its client.`);
            return;
        }
        self.parentId = m.parentId;
    });

    tasks.forEach(t => {
        const f = carry(t, V2_TASK);
        if (!f.status) f.status = 'todo';
        const parent = (t.matterId && byId.has(t.matterId)) ? t.matterId
                     : (t.clientId && byId.has(t.clientId)) ? t.clientId : null;
        if (!parent && (t.matterId || t.clientId)) {
            problems.push(`Task "${f.title || t.id}" belonged to something that is not there — it came across standalone.`);
        }
        push('task', t, parent, f);
    });

    /* Time attaches to the most specific thing it named. A log against a
       matter stays against the matter — v3 rolls it up the tree anyway. */
    const entries = [];
    logs.forEach(l => {
        const target = [l.taskId, l.matterId, l.clientId].find(id => id && byId.has(id));
        if (!target) {
            problems.push(`${l.minutes || 0} minutes logged on ${String(l.startedAt || '').slice(0, 10)} had nothing to attach to — left out.`);
            return;
        }
        entries.push({
            id: l.id, nodeId: target,
            minutes: Number(l.minutes) || 0,
            on: l.startedAt ? isoDate(new Date(l.startedAt)) : today(),
            notes: l.notes || null,
            invoiceId: l.invoiceId || null,
            deletedAt: l.deletedAt || null
        });
    });

    return {
        nodes, entries,
        invoices: invoices.map(i => ({ ...i, deletedAt: i.deletedAt || null })),
        problems,
        counts: {
            clients: clients.length, projects: matters.length, tasks: tasks.length,
            entries: entries.length, invoices: invoices.length,
            deleted: nodes.filter(n => n.deletedAt).length
        }
    };
}

/* ------------------------------------------------------------- the risky bit
   Reading v2 and writing v3. Everything above is pure; this is the only part
   that touches the network, and it reads v2 and never writes to it. */
const Migrate = {
    async read(uid) {
        if (!fbReady || !fbDb) throw new Error('Firestore is not available');
        const doc = await fbDb.collection('userdata').doc(uid).get();
        if (!doc.exists) throw new Error('No v2 practice found on this account.');
        const raw = doc.data().state;
        const blob = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});

        let taskDocs = [];
        try {
            const snap = await fbDb.collection('tasks').where('ownerId', '==', uid).get();
            taskDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('could not read the /tasks collection; using the blob mirror', e);
        }
        return { blob, taskDocs };
    },

    /* What would happen, without anything happening. */
    async plan(uid) {
        const { blob, taskDocs } = await Migrate.read(uid);
        return fromV2(blob, taskDocs);
    },

    /* Ids are preserved, so this is safe to run twice — the second run
       rewrites the same documents rather than making a second practice. */
    async run(uid, onProgress) {
        const result = await Migrate.plan(uid);
        let done = 0;
        const total = result.nodes.length + result.entries.length + result.invoices.length;
        const write = async (kind, rows) => {
            for (const r of rows) {
                await Store.put(kind, r);
                if (onProgress && ++done % 10 === 0) onProgress(done, total);
            }
        };
        await write('node', result.nodes);
        await write('entry', result.entries);
        await write('invoice', result.invoices);
        if (onProgress) onProgress(total, total);
        return result;
    }
};

if (typeof module !== 'undefined') module.exports = { fromV2, Migrate };
