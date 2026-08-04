/* ordify · capture
 *
 * One way in. You say a sentence — typed or spoken — and it becomes proposals
 * you confirm. Nothing is created until you accept it.
 *
 * v2 grew three of these boxes, one request at a time, each with its own
 * microphone and its own idea of what a sentence meant. Here there is a
 * single entry point whose behaviour depends on where you are standing, and
 * the parsing is a pure function of (text, practice) so it can be tested
 * without a network.
 *
 * Roles are split deliberately: Gemini has the ears, Claude has the head.
 * A recording is transcribed first, then the words travel exactly the path
 * typed words travel — so speaking and typing reach the same conclusions.
 */
'use strict';

const Capture = {
    proposals: [],
    learned: [],      // memories written by the last reading, shown in the sheet
    lastInput: '',
    busy: false,

    /* Where you are decides what a sentence means. */
    context() {
        if (Capture.proposals.length) return 'refine';
        const { screen, id } = parseHash();
        if (screen === 'work' && id) return 'under:' + id;
        return 'create';
    },

    /* The single entry point: everything — typed, spoken, a button — lands here. */
    async submit(text) {
        const words = (text || '').trim();
        if (!words || Capture.busy) return;
        const mode = Capture.context();

        Capture.busy = true;
        Sheet.loading(mode === 'refine' ? 'Reworking…' : 'Reading…');
        try {
            const parentId = mode.startsWith('under:') ? mode.slice(6) : null;
            const result = mode === 'refine'
                ? await AI.refine(Capture.lastInput, Capture.proposals, words)
                : await AI.parse(words, { parentId });
            if (mode !== 'refine') Capture.lastInput = words;
            Capture.proposals = (result.actions || []).map(a => ({ ...a, accepted: false }));
            // what it learned about you is kept whether or not you accept the
            // actions — being told "that is Datavise, not Novawave" is useful
            // even when the proposal it came with was wrong in other ways
            Capture.learned = [];
            for (const m of (result.remember || [])) {
                const saved = await Memory.remember(m && m.text, m && m.why);
                if (saved) Capture.learned.push(saved);
            }
            Sheet.show(result);
        } catch (e) {
            console.error('capture failed', e);
            Sheet.error(e.message || 'Could not read that');
        } finally {
            Capture.busy = false;
        }
    },

    /* Apply one proposal. Creating happens here and nowhere else, so there is
       one place where a proposal becomes real. */
    async accept(i) {
        const p = Capture.proposals[i];
        if (!p || p.accepted) return false;
        try {
            await applyAction(p);
            p.accepted = true;
            return true;
        } catch (e) {
            console.error('apply failed', e);
            Sheet.error(e.message || 'Could not apply that');
            return false;
        }
    },

    async acceptAll() {
        for (let i = 0; i < Capture.proposals.length; i++) await Capture.accept(i);
        Capture.clear();
        render();
    },

    clear() {
        Capture.proposals = [];
        Capture.learned = [];
        Capture.lastInput = '';
        Sheet.hide();
    }
};

/* The verbs that change something that is already in the practice. Kept as a
   set because both applying and describing need to know which family an op
   belongs to, and two lists would eventually disagree. */
const MUTATING = new Set(['completeTask', 'reschedule', 'setBlocked', 'rename', 'move']);

/* The full path of a node, which is what makes a proposal checkable: two
   clients can both have "Quarterly filings", and a bare title cannot tell
   you which one is about to be closed. */
function pathOf(n) {
    if (!n) return '';
    const up = P.ancestors(n).map(a => a.title);
    return up.length ? up.join(' › ') + ' › ' + n.title : n.title;
}

/* Strict on purpose. An id from context, or a title matching exactly one live
   node — never a best guess, because the cost of being wrong here is a task
   marked done that was not. */
function resolveNode(d, expectType = null) {
    if (d.nodeId) {
        const n = P.byId(d.nodeId);
        if (n && !n.deletedAt) return n;
        throw new Error('That refers to something no longer here');
    }
    const name = String(d.title || d.taskName || d.projectName || d.clientName || '').trim();
    if (!name) throw new Error('Nothing named to change');

    const hits = P.live().filter(n =>
        (!expectType || n.type === expectType) &&
        (n.title || '').toLowerCase() === name.toLowerCase());
    if (hits.length === 1) return hits[0];
    if (!hits.length) throw new Error(`Nothing here called "${name}"`);
    throw new Error(`"${name}" matches ${hits.length} things — open the one you mean`);
}

/* ---------------------------------------------------------------- apply ---
   A proposal names what it wants; resolving names to nodes happens once,
   here, so the model never has to know about ids it invented. */
async function applyAction(p) {
    const d = p.data || {};

    const findOrMake = async (type, name, parentId) => {
        if (!name) return null;
        const existing = P.ofType(type).find(n =>
            (n.title || '').toLowerCase() === String(name).toLowerCase() &&
            (!parentId || n.parentId === parentId));
        if (existing) return existing;
        const node = makeNode(type, { title: name, parentId: parentId || null });
        P.nodes.push(node);
        await Store.put('node', node);
        return node;
    };

    if (p.op === 'createClient') {
        return findOrMake('client', d.title || d.name, null);
    }

    if (p.op === 'createProject') {
        const client = d.clientId ? P.byId(d.clientId)
                     : await findOrMake('client', d.clientName, null);
        const node = makeNode('project', {
            title: d.title, parentId: client ? client.id : null,
            billing: d.billing || null, rate: d.rate ?? null, fee: d.fee ?? null
        });
        P.nodes.push(node);
        await Store.put('node', node);
        return node;
    }

    if (p.op === 'createTask') {
        let parent = d.parentId ? P.byId(d.parentId) : null;
        if (!parent && d.projectName) {
            const client = d.clientId ? P.byId(d.clientId)
                         : await findOrMake('client', d.clientName, null);
            parent = await findOrMake('project', d.projectName, client ? client.id : null);
        }
        if (!parent && d.clientName) parent = await findOrMake('client', d.clientName, null);
        const node = makeNode('task', {
            title: d.title, parentId: parent ? parent.id : null,
            due: d.due || null, status: 'todo',
            blocked: d.blocked || null, link: d.link || null
        });
        P.nodes.push(node);
        await Store.put('node', node);
        return node;
    }

    /* ---- ops that touch something that already exists ----
       Creating a duplicate is untidy; closing the wrong matter puts a false
       statement in the record. So these resolve strictly: an id from context,
       or a title that matches exactly one live node. Anything else refuses
       rather than picking. */
    if (MUTATING.has(p.op)) {
        const node = resolveNode(d, p.op === 'completeTask' ? 'task' : null);

        if (p.op === 'completeTask') {
            node.status = d.reopen ? 'todo' : 'done';
            node.completedAt = d.reopen ? null : new Date().toISOString();
            await Store.put('node', node, ['status', 'completedAt']);
            return node;
        }
        if (p.op === 'reschedule') {
            node.due = d.due || null;
            await Store.put('node', node, ['due']);
            return node;
        }
        if (p.op === 'setBlocked') {
            node.blocked = d.blocked || null;
            await Store.put('node', node, ['blocked']);
            return node;
        }
        if (p.op === 'rename') {
            const title = String(d.title || '').trim();
            if (!title) throw new Error('That rename has no new title');
            node.title = title;
            await Store.put('node', node, ['title']);
            return node;
        }
        if (p.op === 'move') {
            const parentId = d.parentId || null;
            if (parentId && !P.byId(parentId)) throw new Error('Nowhere to move that to');
            if (!P.canMove(node.id, parentId)) {
                throw new Error(`"${node.title}" cannot go there`);
            }
            P.move(node.id, parentId);
            await Store.put('node', node, ['parentId', 'order']);
            return node;
        }
    }

    if (p.op === 'logTime') {
        let target = d.nodeId ? P.byId(d.nodeId) : null;
        if (!target && d.projectName) {
            target = P.ofType('project').find(n =>
                (n.title || '').toLowerCase() === String(d.projectName).toLowerCase());
        }
        if (!target && d.clientName) {
            target = P.ofType('client').find(n =>
                (n.title || '').toLowerCase() === String(d.clientName).toLowerCase());
        }
        if (!target) throw new Error('Nothing to log that time against');
        const entry = {
            id: uid(), nodeId: target.id,
            minutes: Number(d.minutes) || 0,
            on: d.on || today(), invoiceId: null, deletedAt: null
        };
        if (entry.minutes < 1) throw new Error('That time entry has no minutes');
        P.entries.push(entry);
        await Store.put('entry', entry);
        return entry;
    }

    throw new Error('Unknown action: ' + p.op);
}

/* A one-line description of what a proposal will do — written from the data,
   so it cannot drift from what will actually happen.
   For anything that touches an existing thing it names that thing by its full
   path, because the one mistake worth catching before you accept is the right
   verb aimed at the wrong row. */
function describe(p) {
    const d = p.data || {};
    const where = d.projectName || d.clientName ||
        (d.parentId && P.byId(d.parentId) ? P.byId(d.parentId).title : '');

    // never throws: a proposal that cannot be resolved still has to be readable
    let target = null;
    if (MUTATING.has(p.op)) { try { target = resolveNode(d); } catch (e) { target = null; } }
    const it = target ? pathOf(target) : (d.nodeId ? '(not found)' : d.title || '—');

    switch (p.op) {
        case 'createClient':  return `New client · ${d.title || d.name || '—'}`;
        case 'createProject': return `New project · ${d.title || '—'}${where ? ' for ' + where : ''}`;
        case 'createTask':    return `New task · ${d.title || '—'}${where ? ' in ' + where : ''}` +
                                     `${d.due ? ' · due ' + d.due : ''}`;
        case 'logTime':       return `Log ${fmtMinutes(d.minutes)}${where ? ' on ' + where : ''}` +
                                     `${d.on && d.on !== today() ? ' · ' + d.on : ''}`;
        case 'completeTask':  return `${d.reopen ? 'Reopen' : 'Mark done'} · ${it}`;
        case 'reschedule':    return d.due ? `Move to ${d.due} · ${it}` : `Remove the date · ${it}`;
        case 'setBlocked':    return d.blocked ? `Waiting on ${d.blocked} · ${it}`
                                               : `No longer stuck · ${it}`;
        case 'rename':        return `Rename to "${d.title || '—'}" · ${it}`;
        case 'move':          return `Move under ${d.parentId && P.byId(d.parentId)
                                        ? P.byId(d.parentId).title : '—'} · ${it}`;
        default:              return p.op;
    }
}

if (typeof module !== 'undefined') {
    module.exports = { Capture, applyAction, describe, resolveNode, pathOf, MUTATING };
}
