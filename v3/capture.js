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
        Capture.lastInput = '';
        Sheet.hide();
    }
};

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
   so it cannot drift from what will actually happen. */
function describe(p) {
    const d = p.data || {};
    const where = d.projectName || d.clientName ||
        (d.parentId && P.byId(d.parentId) ? P.byId(d.parentId).title : '');
    switch (p.op) {
        case 'createClient':  return `New client · ${d.title || d.name || '—'}`;
        case 'createProject': return `New project · ${d.title || '—'}${where ? ' for ' + where : ''}`;
        case 'createTask':    return `New task · ${d.title || '—'}${where ? ' in ' + where : ''}` +
                                     `${d.due ? ' · due ' + d.due : ''}`;
        case 'logTime':       return `Log ${fmtMinutes(d.minutes)}${where ? ' on ' + where : ''}` +
                                     `${d.on && d.on !== today() ? ' · ' + d.on : ''}`;
        default:              return p.op;
    }
}

if (typeof module !== 'undefined') module.exports = { Capture, applyAction, describe };
