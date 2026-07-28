/* ordify · ui
 *
 * Three screens and a search, over the one node model.
 *
 * Two rules learned the hard way in v2:
 *   1. how you are looking at the data is not the data — expanded branches,
 *      scroll and the caret survive a re-render, because everything
 *      re-renders on every change.
 *   2. nothing is drawn twice. The hero answers "what now"; the list answers
 *      "what else", and never repeats it.
 */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* How you are looking at things — kept apart from what you are looking at. */
const UI = {
    open: new Set(),
    route: null,
    isOpen: id => UI.open.has(id),
    toggle(id) { UI.open.has(id) ? UI.open.delete(id) : UI.open.add(id); }
};

let P = new Practice();          // the practice, replaced by the store on boot

/* ------------------------------------------------------------- routing --- */

function parseHash() {
    const parts = (location.hash || '#/now').replace(/^#\/?/, '').split('/').filter(Boolean);
    return { screen: parts[0] || 'now', id: parts[1] || null };
}
const go = (path) => { location.hash = '#/' + path.replace(/^\//, ''); };

/* ------------------------------------------------------------ rendering --- */

function keepPlace() {
    const el = document.activeElement;
    const main = $('main');
    if (!el || !main || !main.contains(el)) return null;
    const sel = el.id ? '#' + CSS.escape(el.id)
              : el.name ? `[name="${CSS.escape(el.name)}"]` : null;
    if (!sel) return null;
    return { sel, value: el.value, start: el.selectionStart, end: el.selectionEnd, y: window.scrollY };
}
function restorePlace(p) {
    if (!p) return;
    const el = $('main ' + p.sel);
    if (!el) return;
    if (p.value != null && el.value !== p.value) el.value = p.value;
    el.focus({ preventScroll: true });
    if (p.start != null && el.setSelectionRange) { try { el.setSelectionRange(p.start, p.end); } catch (e) {} }
}

function render() {
    const { screen, id } = parseHash();
    const route = screen + '/' + (id || '');
    const same = UI.route === route;
    const y = same ? window.scrollY : 0;
    const place = same ? keepPlace() : null;

    let html = '';
    try {
        if (screen === 'now')   html = viewNow();
        else if (screen === 'work')  html = id ? viewNode(id) : viewWork();
        else if (screen === 'money') html = viewMoney();
        else if (screen === 'bin')   html = viewBin();
        else html = viewNow();
    } catch (e) {
        console.error(e);
        html = `<h1>Something broke</h1><pre class="muted">${esc(e.stack || e.message)}</pre>`;
    }
    $('main').innerHTML = html;
    UI.route = route;
    $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.screen === screen));
    window.scrollTo(0, y);
    restorePlace(place);
}

/* ----------------------------------------------------------------- now --- */

function taskRow(t, { depth = null } = {}) {
    const late = t.due && t.due < today() && t.status !== 'done';
    const path = P.projectFor(t);
    return `
        <div class="task ${t.status === 'done' ? 'done' : ''}" data-task="${esc(t.id)}"
             ${depth != null ? `style="--depth:${depth}"` : ''}>
            <span class="box" data-done="${esc(t.id)}" role="checkbox"
                  aria-checked="${t.status === 'done'}" tabindex="0"></span>
            <span class="t">${esc(t.title)}</span>
            ${t.blocked ? `<span class="pill stuck" title="${esc(t.blocked)}">stuck</span>` : ''}
            ${path && depth == null ? `<span class="meta">${esc(path.title)}</span>` : ''}
            ${t.due ? `<span class="meta ${late ? 'late' : ''}">${esc(t.due.slice(5))}</span>` : ''}
        </div>`;
}

function viewNow() {
    const d = P.day();
    const open = P.ofType('task').filter(t => t.status !== 'done');

    if (!P.live().length) {
        return `
            <h1>Let's set up your practice</h1>
            <p class="muted" style="max-width:46ch">Start with a client — everything else hangs off one.
            Or just say what needs doing and sort it out afterwards.</p>
            <div class="now acts" style="display:flex;gap:8px;margin-top:16px;box-shadow:none;border:0;padding:0;background:none">
                <button class="btn primary" data-new="client">Add your first client</button>
                <button class="btn" data-new="task">Add a task</button>
            </div>`;
    }

    // the one thing to do now — latest overdue, else due today, else next up
    const hero = d.overdue[0] || d.today[0] || d.soon[0] || null;
    const groups = [
        ['Overdue', d.overdue, true],
        ['Today', d.today, false],
        ['Next 7 days', d.soon, false],
        ['No date', d.undated.slice(0, 6), false]
    ];

    return `
        <h1>${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
        <div class="muted">${d.overdue.length} overdue · ${open.length} open</div>

        ${hero ? `
            <div class="now">
                <div class="k">${d.overdue.length ? 'most overdue' : 'next'}</div>
                <div class="title">${esc(hero.title)}</div>
                <div class="path">${esc(P.ancestors(hero).map(a => a.title).join(' › ') || 'no project')}</div>
                <div class="acts">
                    <button class="btn primary" data-log="${esc(hero.id)}">Log time</button>
                    <button class="btn" data-done="${esc(hero.id)}">Mark done</button>
                    <a class="btn" href="#/work/${esc(hero.id)}">Open</a>
                </div>
            </div>` : ''}

        ${groups.map(([label, items, late]) => {
            const rows = items.filter(t => !hero || t.id !== hero.id);
            if (!rows.length) return '';
            return `<div class="grp">
                <div class="grp-h ${late ? 'late' : ''}">${label}<span class="n">${rows.length}</span></div>
                ${rows.map(t => taskRow(t)).join('')}
            </div>`;
        }).join('') || `<div class="empty">Nothing due in the next seven days.</div>`}`;
}

/* ---------------------------------------------------------------- work --- */

function treeNode(n, depth = 0) {
    const kids = P.children(n.id);
    const tasks = kids.filter(k => k.type === 'task' && k.status !== 'done');
    const subs  = kids.filter(k => k.type !== 'task');
    const open = UI.isOpen(n.id);
    const count = tasks.length + subs.length;
    const billing = n.type === 'project' ? P.billingOf(n) : null;

    return `
        <li class="node" style="--depth:${depth}">
            <div class="node-h">
                <button class="twist ${open ? 'open' : ''}" data-twist="${esc(n.id)}"
                        aria-expanded="${open}">›</button>
                <span>${n.type === 'client' ? '👤' : '📁'}</span>
                <a class="name" href="#/work/${esc(n.id)}">${esc(n.title)}</a>
                ${count ? `<span class="n">${count}</span>` : ''}
                ${billing && billing !== 'hourly'
                    ? `<span class="pill">${esc(BILLING_LABEL[billing])}</span>` : ''}
                <span class="add">
                    <button class="btn sm" data-new="task" data-parent="${esc(n.id)}">＋ task</button>
                    ${n.type !== 'task' ? `<button class="btn sm" data-new="project" data-parent="${esc(n.id)}">＋ project</button>` : ''}
                </span>
            </div>
            ${open ? `<ul class="kids">
                ${subs.map(s => treeNode(s, depth + 1)).join('')}
                ${tasks.map(t => taskRow(t, { depth: depth + 1 })).join('')}
                ${!count ? `<li class="empty" style="padding-left:${(depth+1)*18+24}px">Nothing here yet</li>` : ''}
            </ul>` : ''}
        </li>`;
}

function viewWork() {
    const clients = P.ofType('client').filter(c => !c.parentId);
    return `
        <h1>Work</h1>
        <div class="muted">${clients.length} client${clients.length === 1 ? '' : 's'}</div>
        ${clients.length
            ? `<ul class="tree" style="margin-top:16px">${sortNodes(clients).map(c => treeNode(c)).join('')}</ul>`
            : `<div class="empty">No clients yet.</div>`}
        <div style="margin-top:20px"><button class="btn primary" data-new="client">＋ New client</button></div>`;
}

function viewNode(id) {
    const n = P.byId(id);
    if (!n || n.deletedAt) return `<h1>Not found</h1><a class="btn" href="#/work">Back to work</a>`;

    const mins = P.minutesOn(n.id, { includeChildren: true });
    const project = P.projectFor(n);
    const billing = project ? P.billingOf(project) : 'hourly';
    const worth = billing === 'hourly' ? (mins / 60) * P.rateOf(n)
                : billing === 'fixed' && project ? Number(project.fee) || 0 : 0;
    const late = n.due && n.due < today() && n.status !== 'done';
    const path = P.ancestors(n);

    return `
        <div class="muted">${path.map(a =>
            `<a href="#/work/${esc(a.id)}" style="color:inherit">${esc(a.title)}</a>`).join(' › ')}</div>
        <h1>${esc(n.title)}</h1>

        ${n.type === 'task' ? `
            <div class="now" style="box-shadow:none">
                <div class="k">${n.status === 'done' ? 'done'
                    : late ? 'overdue' : n.due ? 'due ' + esc(n.due) : 'no date'}</div>
                ${n.blocked ? `<div class="path" style="color:var(--warn)">Waiting on: ${esc(n.blocked)}</div>` : ''}
                <div class="acts">
                    <button class="btn primary" data-log="${esc(n.id)}">Log time</button>
                    <button class="btn" data-done="${esc(n.id)}">${n.status === 'done' ? 'Reopen' : 'Mark done'}</button>
                    <button class="btn" data-del="${esc(n.id)}">Delete</button>
                </div>
            </div>` : ''}

        <div class="cards">
            <div class="card"><div class="k">Time</div><div class="v">${fmtMinutes(mins)}</div>
                <div class="s">${P.entriesFor(n.id, { includeChildren: true }).length} entries</div></div>
            <div class="card"><div class="k">${billing === 'hourly' ? 'Worth' : BILLING_LABEL[billing]}</div>
                <div class="v">${worth ? fmtMoney(worth, P.settings.currency) : '—'}</div>
                <div class="s">${billing === 'hourly' ? '@ ' + fmtMoney(P.rateOf(n), P.settings.currency) + '/h' : 'not hourly'}</div></div>
            ${n.type !== 'task' ? `<div class="card"><div class="k">Inside</div>
                <div class="v">${P.descendants(n.id).length}</div><div class="s">items</div></div>` : ''}
        </div>

        ${n.type !== 'task' ? `
            <h2 class="sec">Inside</h2>
            <ul class="tree">${P.children(n.id).map(c =>
                c.type === 'task' ? `<li>${taskRow(c)}</li>` : treeNode(c)).join('') ||
                '<li class="empty">Nothing here yet</li>'}</ul>
            <div style="margin-top:12px;display:flex;gap:8px">
                <button class="btn" data-new="task" data-parent="${esc(n.id)}">＋ task</button>
                <button class="btn" data-new="project" data-parent="${esc(n.id)}">＋ project</button>
            </div>` : ''}`;
}

/* --------------------------------------------------------------- money --- */

function viewMoney() {
    const clients = P.ofType('client');
    const rows = clients.map(c => ({ c, owed: P.unbilledFor(c.id) }))
                        .filter(r => r.owed.total > 0);
    const total = rows.reduce((s, r) => s + r.owed.total, 0);
    const weekMins = P.entries.filter(e => !e.deletedAt && e.on >= addDays(-7))
                              .reduce((s, e) => s + e.minutes, 0);
    return `
        <h1>Money</h1>
        <div class="cards">
            <div class="card"><div class="k">Unbilled</div>
                <div class="v">${fmtMoney(total, P.settings.currency)}</div>
                <div class="s">${rows.length} client${rows.length === 1 ? '' : 's'}</div></div>
            <div class="card"><div class="k">Logged this week</div>
                <div class="v">${fmtMinutes(weekMins)}</div></div>
        </div>
        <h2 class="sec">Ready to invoice</h2>
        ${rows.length ? rows.map(({ c, owed }) => `
            <div class="grp">
                <div class="grp-h">${esc(c.title)}<span class="n">${fmtMoney(owed.total, P.settings.currency)}</span></div>
                <table class="t"><tbody>${owed.lines.map(l => `
                    <tr><td>${esc(l.description)}</td>
                        <td class="num">${l.hours}h</td>
                        <td class="num">${fmtMoney(l.amount, P.settings.currency)}</td></tr>`).join('')}
                </tbody></table>
            </div>`).join('')
          : `<div class="empty">Nothing billable yet — log some time first.</div>`}`;
}

function viewBin() {
    const gone = P.nodes.filter(n => n.deletedAt);
    return `
        <h1>Bin</h1>
        <div class="muted">Deleted items are kept for 30 days.</div>
        ${gone.length ? `<div style="margin-top:16px">${gone.map(n => `
            <div class="task">
                <span class="t">${esc(n.title)}</span>
                <span class="meta">${esc(String(n.deletedAt).slice(0, 10))}</span>
                <button class="btn sm" data-restore="${esc(n.id)}">Restore</button>
            </div>`).join('')}</div>`
          : `<div class="empty">Nothing deleted.</div>`}`;
}

/* -------------------------------------------------------------- search --- */

function runSearch() {
    const q = $('#q').value;
    const box = $('#results');
    const hits = P.search(q);
    if (!q.trim()) { box.hidden = true; return; }
    box.innerHTML = hits.length
        ? hits.map((h, i) => `
            <div class="hit ${i === 0 ? 'on' : ''}" data-go="${esc(h.node.id)}">
                <span class="kind">${esc(h.node.type)}</span>
                <span class="h">${esc(h.node.title)}</span>
                ${h.path ? `<span class="p">${esc(h.path)}</span>` : ''}
            </div>`).join('')
        : `<div class="empty" style="padding:12px">Nothing matches “${esc(q)}”.</div>`;
    box.hidden = false;
}

/* --------------------------------------------------------------- edits --- */

async function createNode(type, parentId) {
    const title = prompt(type === 'client' ? 'Client name' : type === 'project' ? 'Project title' : 'Task');
    if (!title || !title.trim()) return;
    const node = makeNode(type, { title: title.trim(), parentId: parentId || null });
    if (type === 'task') node.status = 'todo';
    P.nodes.push(node);
    if (parentId) UI.open.add(parentId);
    await Store.put('node', node);
    render();
}

async function toggleDone(id) {
    const t = P.byId(id);
    if (!t) return;
    t.status = t.status === 'done' ? 'todo' : 'done';
    t.completedAt = t.status === 'done' ? new Date().toISOString() : null;
    await Store.put('node', t, ['status', 'completedAt']);
    render();
}

async function logTime(id) {
    const prev = P.entriesFor(id).slice(-1)[0];
    const suggested = prev ? prev.minutes : 30;
    const raw = prompt('Minutes on this?', String(suggested));
    const minutes = Number(raw);
    if (!minutes || minutes < 1) return;
    const entry = { id: uid(), nodeId: id, minutes, on: today(), invoiceId: null, deletedAt: null };
    P.entries.push(entry);
    await Store.put('entry', entry);
    render();
}

async function removeNode(id) {
    const n = P.byId(id);
    if (!n) return;
    n.deletedAt = new Date().toISOString();
    await Store.put('node', n, ['deletedAt']);
    go('work');
    render();
}

async function restoreNode(id) {
    const n = P.byId(id);
    if (!n) return;
    n.deletedAt = null;
    await Store.put('node', n, ['deletedAt']);
    render();
}

/* ---------------------------------------------------------------- boot --- */

function bind() {
    document.body.addEventListener('click', (e) => {
        const t = (sel) => e.target.closest(sel);

        const twist = t('[data-twist]');
        if (twist) { UI.toggle(twist.dataset.twist); render(); return; }

        const done = t('[data-done]');
        if (done) { toggleDone(done.dataset.done); return; }

        const log = t('[data-log]');
        if (log) { logTime(log.dataset.log); return; }

        const add = t('[data-new]');
        if (add) { createNode(add.dataset.new, add.dataset.parent); return; }

        const del = t('[data-del]');
        if (del) { removeNode(del.dataset.del); return; }

        const res = t('[data-restore]');
        if (res) { restoreNode(res.dataset.restore); return; }

        const hit = t('[data-go]');
        if (hit) { $('#q').value = ''; $('#results').hidden = true; go('work/' + hit.dataset.go); return; }

        const row = t('[data-task]');
        if (row && !t('[data-done]') && !t('button') && !t('a')) {
            go('work/' + row.dataset.task); return;
        }

        if (!t('#find')) $('#results').hidden = true;
    });

    $('#q').addEventListener('input', runSearch);
    $('#q').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { $('#q').value = ''; $('#results').hidden = true; $('#q').blur(); }
        if (e.key === 'Enter') {
            const first = $('#results .hit');
            if (first) first.click();
        }
    });
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault(); $('#q').focus(); $('#q').select();
        }
    });
    window.addEventListener('hashchange', render);
}

async function boot() {
    Store.use(MemoryAdapter());
    const [nodes, entries] = await Promise.all([Store.all('node'), Store.all('entry')]);
    P = new Practice(nodes, entries, []);
    if (!P.nodes.length) seed();
    bind();
    render();
}

/* A practice to look at while there is no sign-in — the shape of real work,
   so the screens are judged against something realistic. */
function seed() {
    const mk = (type, title, parent, extra = {}) => {
        const n = makeNode(type, { title, parentId: parent, ...extra });
        P.nodes.push(n); Store.put(type === 'task' || type === 'project' || type === 'client' ? 'node' : 'node', n);
        return n;
    };
    const nova = mk('client', 'Novawave S.A.');
    const aml  = mk('project', 'CNAD AML compliance', nova.id, { billing: 'hourly', rate: 200 });
    const filings = mk('project', 'Quarterly filings', aml.id);
    mk('task', 'Quarterly AML officer report', filings.id, { status: 'todo', due: addDays(-2), blocked: 'transaction data from client' });
    mk('task', 'Update internal policy v3.2', aml.id, { status: 'todo', due: addDays(3) });

    const datavise = mk('client', 'Datavise, Inc.');
    const decorp = mk('project', 'Delaware C-Corp package', datavise.id, { billing: 'fixed', fee: 4000 });
    mk('task', 'Founder Stock Purchase Agreement', decorp.id, { status: 'todo', due: today() });
    mk('task', 'Bylaws — final proofread', decorp.id, { status: 'todo', due: addDays(1) });

    const stellars = mk('client', 'StellarsTech');
    mk('project', 'Pro bono — ombudsman complaint', stellars.id, { billing: 'probono' });
    mk('task', 'Call back re: new mandate', stellars.id, { status: 'todo', due: null });

    const e = (nodeId, minutes, daysAgo) => {
        const entry = { id: uid(), nodeId, minutes, on: addDays(-daysAgo), invoiceId: null, deletedAt: null };
        P.entries.push(entry); Store.put('entry', entry);
    };
    e(aml.id, 95, 3); e(aml.id, 30, 1); e(decorp.id, 240, 2);
    UI.open.add(nova.id); UI.open.add(aml.id);
}

document.addEventListener('DOMContentLoaded', boot);
