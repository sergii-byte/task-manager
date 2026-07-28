/* ordify · core
 *
 * One node type for everything you organise, and separate facts about those
 * nodes (time, invoices). The v2 app kept clients, projects and tasks in three
 * tables, which meant three near-identical implementations of move, render,
 * drag and search. Here there is one.
 *
 * Nothing in this file touches the DOM or the network — it is the arithmetic
 * of the practice, and it is the part worth testing.
 */
'use strict';

/* ---------------------------------------------------------------- dates ---
 * Calendar dates are local, always. toISOString() converts to UTC first, so
 * east of Greenwich it returns yesterday late in the evening — which in v2
 * silently made "due today" wrong for part of every day.
 */
const isoDate = (d = new Date()) => {
    const x = d instanceof Date ? d : new Date(d);
    return x.getFullYear() + '-' +
           String(x.getMonth() + 1).padStart(2, '0') + '-' +
           String(x.getDate()).padStart(2, '0');
};
const today = () => isoDate();
const addDays = (n, from = new Date()) => {
    const x = new Date(from);
    x.setDate(x.getDate() + n);
    return isoDate(x);
};
const daysBetween = (a, b) =>
    Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

/* ---------------------------------------------------------------- nodes --- */

const NODE_TYPES = ['client', 'project', 'task'];
const BILLING = ['hourly', 'fixed', 'probono', 'partnership'];
const BILLING_LABEL = {
    hourly: 'Hourly', fixed: 'Fixed fee',
    probono: 'Pro bono', partnership: 'Partnership'
};

const uid = () => 'n-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function makeNode(type, fields = {}) {
    if (!NODE_TYPES.includes(type)) throw new Error('unknown node type: ' + type);
    return {
        id: fields.id || uid(),
        type,
        parentId: fields.parentId || null,
        title: (fields.title || '').trim(),
        createdAt: fields.createdAt || new Date().toISOString(),
        deletedAt: null,
        order: fields.order ?? null,
        ...fields
    };
}

/* A tiny world of nodes, so every selector below is pure and testable. */
class Practice {
    constructor(nodes = [], entries = [], invoices = []) {
        this.nodes = nodes;
        this.entries = entries;     // { id, nodeId, minutes, on, invoiceId }
        this.invoices = invoices;
        this.settings = { rate: 150, currency: 'EUR' };
    }

    /* ---- basic access ---- */
    byId(id) { return this.nodes.find(n => n.id === id) || null; }
    live() { return this.nodes.filter(n => !n.deletedAt); }
    ofType(type) { return this.live().filter(n => n.type === type); }

    children(id) {
        return sortNodes(this.live().filter(n => n.parentId === id));
    }
    roots() {
        return sortNodes(this.live().filter(n => !n.parentId));
    }

    /* Walk up to the owning client — a task three levels down still belongs to
       somebody, and every money question needs to know who. */
    clientOf(node) {
        let cur = node, guard = 0;
        while (cur && guard++ < 50) {
            if (cur.type === 'client') return cur;
            cur = cur.parentId ? this.byId(cur.parentId) : null;
        }
        return null;
    }

    ancestors(node) {
        const out = [];
        let cur = node && node.parentId ? this.byId(node.parentId) : null, guard = 0;
        while (cur && guard++ < 50) { out.unshift(cur); cur = cur.parentId ? this.byId(cur.parentId) : null; }
        return out;
    }

    descendants(id, acc = []) {
        this.children(id).forEach(c => { acc.push(c); this.descendants(c.id, acc); });
        return acc;
    }

    /* ---- moving ----
       The one operation that used to exist three times. Refuses the move that
       would detach a branch from the tree by making a node its own ancestor. */
    canMove(nodeId, newParentId) {
        if (nodeId === newParentId) return false;
        const node = this.byId(nodeId);
        if (!node) return false;
        if (newParentId === null) return node.type !== 'task' ? true : true;
        const parent = this.byId(newParentId);
        if (!parent) return false;
        if (parent.type === 'task') return false;                  // tasks hold nothing
        if (node.type === 'client' && parent) return false;        // clients are roots
        return !this.descendants(nodeId).some(d => d.id === newParentId);
    }

    move(nodeId, newParentId, { before = null } = {}) {
        if (!this.canMove(nodeId, newParentId)) return false;
        const node = this.byId(nodeId);
        node.parentId = newParentId;
        const siblings = newParentId ? this.children(newParentId) : this.roots();
        reorder(siblings.filter(s => s.id !== nodeId), node, before);
        return true;
    }

    /* ---- billing ----
       Type is set on a project and inherited by everything under it, so a
       subproject of a pro bono matter is pro bono too unless it says otherwise. */
    billingOf(node) {
        let cur = node, guard = 0;
        while (cur && guard++ < 50) {
            if (cur.billing) return cur.billing;
            cur = cur.parentId ? this.byId(cur.parentId) : null;
        }
        return 'hourly';
    }
    isBillable(node) {
        const b = this.billingOf(node);
        return b === 'hourly' || b === 'fixed';
    }
    rateOf(node) {
        let cur = node, guard = 0;
        while (cur && guard++ < 50) {
            if (cur.rate != null && cur.rate !== '') return Number(cur.rate);
            cur = cur.parentId ? this.byId(cur.parentId) : null;
        }
        return Number(this.settings.rate) || 0;
    }

    /* ---- time ---- */
    entriesFor(nodeId, { includeChildren = false } = {}) {
        const ids = new Set([nodeId]);
        if (includeChildren) this.descendants(nodeId).forEach(d => ids.add(d.id));
        return this.entries.filter(e => ids.has(e.nodeId) && !e.deletedAt);
    }
    minutesOn(nodeId, opts) {
        return this.entriesFor(nodeId, opts).reduce((s, e) => s + (Number(e.minutes) || 0), 0);
    }

    /* ---- money ----
       What a client owes, computed the same way an invoice would compute it —
       in v2 these were two different calculations and disagreed by €2,000. */
    unbilledFor(clientId) {
        const client = this.byId(clientId);
        if (!client) return { total: 0, lines: [] };
        const ids = new Set(this.descendants(clientId).map(n => n.id));
        const open = this.entries.filter(e =>
            !e.invoiceId && !e.deletedAt && ids.has(e.nodeId));

        const perProject = new Map();
        open.forEach(e => {
            const node = this.byId(e.nodeId);
            const project = this.projectFor(node);
            const key = project ? project.id : '_none';
            if (!perProject.has(key)) perProject.set(key, { project, minutes: 0, entries: [] });
            const bucket = perProject.get(key);
            bucket.minutes += Number(e.minutes) || 0;
            bucket.entries.push(e);
        });

        const lines = [];
        perProject.forEach(({ project, minutes, entries }) => {
            if (project && !this.isBillable(project)) return;         // logged, never owed
            const hours = +(minutes / 60).toFixed(2);
            if (project && this.billingOf(project) === 'fixed') {
                lines.push({
                    nodeId: project.id,
                    description: project.title + ' — fixed fee',
                    hours, rate: 0,
                    amount: +(Number(project.fee) || 0).toFixed(2),
                    entryIds: entries.map(e => e.id)
                });
            } else {
                const rate = this.rateOf(project || client);
                lines.push({
                    nodeId: project ? project.id : clientId,
                    description: project ? project.title : 'General work',
                    hours, rate,
                    amount: +(hours * rate).toFixed(2),
                    entryIds: entries.map(e => e.id)
                });
            }
        });
        return { total: +lines.reduce((s, l) => s + l.amount, 0).toFixed(2), lines };
    }

    /* The nearest project above a node — where money is decided. */
    projectFor(node) {
        let cur = node, guard = 0;
        while (cur && guard++ < 50) {
            if (cur.type === 'project') return cur;
            cur = cur.parentId ? this.byId(cur.parentId) : null;
        }
        return null;
    }

    /* ---- the day ----
       What Today asks: what is late, what is due now, what is coming. Seven
       days from today always means seven days — a calendar week meant "one
       more day" if you opened it on a Saturday. */
    day(ref = today()) {
        const open = this.ofType('task').filter(t => t.status !== 'done');
        const horizon = addDays(7, new Date(ref + 'T00:00:00'));
        const by = (a, b) => (a.due || '9999').localeCompare(b.due || '9999');
        return {
            overdue: open.filter(t => t.due && t.due < ref).sort(by),
            today:   open.filter(t => t.due === ref).sort(by),
            soon:    open.filter(t => t.due && t.due > ref && t.due <= horizon).sort(by),
            undated: open.filter(t => !t.due).sort(by),
            later:   open.filter(t => t.due && t.due > horizon).sort(by)
        };
    }

    /* ---- search ----
       One index over every node, because there is one node type. In v2 the
       only way to find a task was the omni bar. */
    search(q) {
        const needle = (q || '').trim().toLowerCase();
        if (!needle) return [];
        return this.live()
            .map(n => {
                const title = (n.title || '').toLowerCase();
                if (!title.includes(needle)) return null;
                const path = this.ancestors(n).map(a => a.title).join(' › ');
                return { node: n, path, exact: title === needle, starts: title.startsWith(needle) };
            })
            .filter(Boolean)
            .sort((a, b) => (b.exact - a.exact) || (b.starts - a.starts) ||
                            a.node.title.localeCompare(b.node.title))
            .slice(0, 30);
    }
}

/* ---- ordering ----
   Only things you have actually dragged carry an order; everything else keeps
   its natural place behind them, so promoting one client does not scramble
   the rest of the list. */
function sortNodes(list) {
    return list.slice().sort((a, b) => {
        const ao = a.order == null ? Infinity : a.order;
        const bo = b.order == null ? Infinity : b.order;
        if (ao !== bo) return ao - bo;
        return (a.title || '').localeCompare(b.title || '');
    });
}

function reorder(siblings, moved, beforeId) {
    const rest = siblings.filter(s => s.id !== moved.id);
    const at = beforeId ? rest.findIndex(s => s.id === beforeId) : -1;
    const idx = at < 0 ? rest.length : at;
    rest.splice(idx, 0, moved);
    rest.forEach((s, i) => { s.order = i * 10; });
    return rest;
}

/* ---- formatting ---- */
const fmtMinutes = (m) => {
    const mins = Math.max(0, Math.round(Number(m) || 0));
    const h = Math.floor(mins / 60), r = mins % 60;
    return h ? `${h}h ${String(r).padStart(2, '0')}m` : `${r}m`;
};
const fmtMoney = (n, ccy = 'EUR') =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy }).format(Number(n) || 0);

if (typeof module !== 'undefined') {
    module.exports = { isoDate, today, addDays, daysBetween, makeNode, Practice,
                       sortNodes, reorder, fmtMinutes, fmtMoney, BILLING, BILLING_LABEL, uid };
}
