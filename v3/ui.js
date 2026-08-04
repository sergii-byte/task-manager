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

/* How you are looking at things — kept apart from what you are looking at.
   `open` and `drawer` persist across screens: a branch you expanded and a
   drawer you opened are decisions, and re-rendering must not undo them.
   `adding`, `more` and `logging` are momentary and reset when you navigate. */
const UI = {
    open: new Set(),        // expanded tree branches
    drawer: new Set(),      // expanded page drawers
    adding: null,           // { parentId, type } — the inline new-thing row
    more: null,             // node id whose ⋯ row is showing
    logging: null,          // node id whose time row is showing
    migration: null,        // the dry run's findings, until you navigate away
    route: null,
    isOpen: id => UI.open.has(id),
    toggle(id) { UI.open.has(id) ? UI.open.delete(id) : UI.open.add(id); }
};

/* P is declared in core.js — the model owns it; boot() fills it from the store. */

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
    // a half-typed new task does not follow you to another page — but asking
    // to log time from Today and landing on the task should still find the row
    if (!same) {
        // the row survives exactly one navigation — the one that carries it to
        // the screen that can host it (first-run "add a client" lands on Work)
        if (UI.adding && UI.adding.pending) UI.adding.pending = false;
        else UI.adding = null;
        if (UI.more !== id) UI.more = null;
        if (UI.logging !== id) UI.logging = null;
        if (screen !== 'settings') UI.migration = null;
    }

    // signed out, there is exactly one thing to look at
    document.body.classList.toggle('locked', Session.mode === 'out');
    if (Session.mode === 'out') {
        $('main').innerHTML = viewDoor();
        UI.route = 'door';
        return;
    }

    let html = '';
    try {
        if (screen === 'now')   html = viewNow();
        else if (screen === 'work')  html = id ? viewNode(id) : viewWork();
        else if (screen === 'money') html = viewMoney();
        else if (screen === 'bin')   html = viewBin();
        else if (screen === 'settings') html = viewSettings();
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

    // whatever you just asked for should already have the caret
    const fresh = $('main [name="newtitle"]') || $('main [name="mins"]');
    if (fresh && document.activeElement !== fresh) { fresh.focus(); fresh.select(); }
}

/* ---------------------------------------------------------------- door --- */

function viewDoor() {
    return `
        <div class="door">
            <h1>ordify</h1>
            <p class="muted">Your clients, what is due, the time on each of them,
            and what that is worth. Sign in and it follows you between devices.</p>
            <div class="acts">
                <button class="btn primary" data-signin>Continue with Google</button>
                <button class="btn" data-anon>Look around first</button>
            </div>
            <p class="muted" style="max-width:44ch">Looking around keeps everything in this
            browser and starts you on example data. Nothing is sent anywhere until you sign in.</p>
            <div id="door-err" class="s-error" hidden></div>
        </div>`;
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
                <button class="btn primary" data-add="client">Add your first client</button>
                <button class="btn" data-add="task">Add a task</button>
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

/* Creating something is one line of text, typed where the thing will live.
   v2 opened a nine-field modal for a task whose only required field was the
   title — so eight of them were furniture you had to walk past. Everything
   else has a sensible default and is edited on the page afterwards, if ever. */

const isAddingTo = (parentId) =>
    !!UI.adding && (UI.adding.parentId || null) === (parentId || null);

const PLACEHOLDER = {
    client:  'Client name',
    project: 'Project title',
    task:    'What needs doing'
};

function newRow(parentId, type, depth = 0) {
    return `
        <li class="newrow" style="--depth:${depth}">
            <input name="newtitle" type="text" autocomplete="off" spellcheck="false"
                   placeholder="${esc(PLACEHOLDER[type])}"
                   aria-label="${esc(PLACEHOLDER[type])}">
            <button class="btn sm primary" data-newgo>Add</button>
            <button class="btn sm" data-newcancel>Cancel</button>
        </li>`;
}

/* The row appears under whichever node you asked from, and nowhere else. */
const addingHere = (parentId, depth = 0) =>
    isAddingTo(parentId) ? newRow(parentId, UI.adding.type, depth) : '';

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
                    <button class="btn sm" data-add="task" data-parent="${esc(n.id)}">＋ task</button>
                    ${n.type !== 'task' ? `<button class="btn sm" data-add="project" data-parent="${esc(n.id)}">＋ project</button>` : ''}
                </span>
            </div>
            ${open ? `<ul class="kids">
                ${subs.map(s => treeNode(s, depth + 1)).join('')}
                ${tasks.map(t => taskRow(t, { depth: depth + 1 })).join('')}
                ${addingHere(n.id, depth + 1)}
                ${!count && !isAddingTo(n.id) ? `<li class="empty" style="padding-left:${(depth+1)*18+24}px">Nothing here yet</li>` : ''}
            </ul>` : ''}
        </li>`;
}

function viewWork() {
    const clients = P.ofType('client').filter(c => !c.parentId);
    const adding = addingHere(null, 0);
    return `
        <h1>Work</h1>
        <div class="line">${clients.length} client${clients.length === 1 ? '' : 's'}</div>
        <div class="acts">
            <button class="btn primary" data-add="client">＋ Client</button>
        </div>
        ${clients.length || adding
            ? `<ul class="tree">${sortNodes(clients).map(c => treeNode(c)).join('')}${adding}</ul>`
            : `<div class="empty">No clients yet.</div>`}`;
}

/* =========================================================================
 * THE NODE PAGE — one shape for a client, a project and a task.
 *
 * v2 had three different pages for what is one kind of thing, each ordered by
 * the order its features were built. On a client that meant the work — the
 * reason you opened the page — was the eighth block down, below a sharing
 * settings panel. Here every page reads the same way, top to bottom:
 *
 *     where you are   → the path, every step clickable
 *     what it is      → the title, editable in place
 *     how it stands   → one line of facts, not a grid of stat cards
 *     what you can do → two actions and a ⋯
 *     what is in it   → the tree (or, for a task, its fields)
 *     everything else → drawers, closed, labelled with what is inside
 *
 * A drawer with nothing in it is not drawn at all: a heading over an empty
 * section is worse than no heading.
 * ========================================================================= */

/* The fields each kind of thing actually has. There is no `priority` and no
   `assignee`: a three-way priority that is "normal" on every task ranks
   nothing, and a solo practice has nobody to assign to. Due dates and
   overdue already order the day. */
const FIELDS = {
    client: [
        ['email',   'Email',    'email'],
        ['website', 'Website',  'url'],
        ['drive',   'Drive',    'url'],
        ['taxId',   'Tax ID',   'text'],
        ['address', 'Address',  'text'],
        ['rate',    'Rate',     'number']
    ],
    project: [
        ['billing', 'Billing',  'billing'],
        ['fee',     'Fixed fee','number'],
        ['rate',    'Rate',     'number'],
        ['due',     'Deadline', 'date'],
        ['drive',   'Drive',    'url']
    ],
    task: [
        ['due',     'Due',        'date'],
        ['blocked', 'Waiting on', 'text'],
        ['drive',   'Drive',      'url']
    ]
};

/* Editing is the page. There is no form and no save button: you type into the
   thing you are reading and leaving the field writes it. */
function field(n, name, label, kind) {
    const v = n[name] == null ? '' : String(n[name]);
    const at = `name="${esc(name)}" data-edit="${esc(n.id)}"`;
    let control;
    if (kind === 'billing') {
        const inherited = BILLING_LABEL[P.billingOf(n)];
        control = `<select ${at}>
            <option value="">Inherit — ${esc(inherited)}</option>
            ${BILLING.map(b => `<option value="${b}" ${n.billing === b ? 'selected' : ''}>${esc(BILLING_LABEL[b])}</option>`).join('')}
        </select>`;
    } else if (kind === 'notes') {
        control = `<textarea ${at} rows="3" placeholder="Anything worth remembering">${esc(v)}</textarea>`;
    } else {
        control = `<input ${at} type="${esc(kind)}" value="${esc(v)}" placeholder="—" autocomplete="off">`;
    }
    return `<label class="kv ${kind === 'notes' ? 'wide' : ''}"><span>${esc(label)}</span>${control}</label>`;
}

function fieldsFor(n) {
    const list = FIELDS[n.type].filter(f =>
        f[0] !== 'fee' || n.billing === 'fixed' || (!n.billing && P.billingOf(n) === 'fixed'));
    return `<div class="kvs">
        ${list.map(f => field(n, f[0], f[1], f[2])).join('')}
        ${field(n, 'notes', 'Notes', 'notes')}
    </div>`;
}

/* One line, in words. Four stat cards where two were the same button told you
   less than this does, and cost a grid. */
function statusLine(n) {
    const s = P.stats(n.id);
    const bits = [];
    const money = (v) => fmtMoney(v, P.settings.currency);

    if (n.type === 'task') {
        if (n.status === 'done') bits.push('Done');
        else if (n.due && n.due < today()) {
            const d = daysBetween(n.due, today());
            bits.push(`<b class="late">${d} day${d === 1 ? '' : 's'} overdue</b>`);
        }
        else if (n.due === today()) bits.push('<b>Due today</b>');
        else if (n.due) bits.push('Due ' + esc(n.due));
        else bits.push('No date');
        if (n.status !== 'done' && n.blocked) bits.push(`waiting on ${esc(n.blocked)}`);
        if (s.minutes) bits.push(fmtMinutes(s.minutes));
        if (P.isBillable(n) && P.billingOf(n) === 'hourly' && s.minutes) {
            bits.push(money((s.minutes / 60) * P.rateOf(n)));
        } else if (!P.isBillable(n)) {
            bits.push(esc(BILLING_LABEL[s.billing]));
        }
    } else {
        if (s.projects) bits.push(`${s.projects} project${s.projects === 1 ? '' : 's'}`);
        bits.push(`${s.open} open`);
        if (s.overdue) bits.push(`<b class="late">${s.overdue} overdue</b>`);
        if (s.minutes) bits.push(fmtMinutes(s.minutes));
        if (s.unbilled) bits.push(`${money(s.unbilled)} unbilled`);
        if (n.type === 'project' && !P.isBillable(n)) bits.push(esc(BILLING_LABEL[s.billing]));
    }
    return bits.join(' · ');
}

function actions(n) {
    const more = `<button class="btn more-b" data-more="${esc(n.id)}"
                          aria-expanded="${UI.more === n.id}" aria-label="More actions">⋯</button>`;
    if (n.type === 'task') {
        return `
            <button class="btn primary" data-log="${esc(n.id)}">Log time</button>
            <button class="btn" data-done="${esc(n.id)}">${n.status === 'done' ? 'Reopen' : 'Mark done'}</button>
            ${more}`;
    }
    return `
        <button class="btn primary" data-add="task" data-parent="${esc(n.id)}">＋ Task</button>
        <button class="btn" data-add="project" data-parent="${esc(n.id)}">＋ ${n.type === 'client' ? 'Project' : 'Subproject'}</button>
        ${more}`;
}

/* Logging time is a number and two taps, not a browser prompt. */
function logRow(n) {
    const prev = P.entriesFor(n.id).slice(-1)[0];
    return `
        <div class="logrow">
            <input name="mins" type="number" inputmode="numeric" min="1" step="5"
                   value="${prev ? prev.minutes : 30}" aria-label="Minutes">
            <span class="muted">min</span>
            ${[15, 30, 60, 90].map(m => `<button class="btn sm" data-quick="${m}">${m}</button>`).join('')}
            <button class="btn primary sm" data-logsave="${esc(n.id)}">Log</button>
        </div>`;
}

function drawer(key, label, meta, body) {
    if (!body) return '';
    const on = UI.drawer.has(key);
    return `
        <div class="drw">
            <button class="drw-h" data-drawer="${esc(key)}" aria-expanded="${on}">
                <span class="tw ${on ? 'open' : ''}">›</span>
                <span class="l">${esc(label)}</span>
                ${meta ? `<span class="m">${esc(meta)}</span>` : ''}
            </button>
            ${on ? `<div class="drw-b">${body}</div>` : ''}
        </div>`;
}

/* Time, as it was actually spent. Only drawn when there is any. */
function timeDrawer(n) {
    const deep = n.type !== 'task';
    const es = P.entriesFor(n.id, { includeChildren: deep });
    if (!es.length) return '';
    const mins = es.reduce((s, e) => s + (Number(e.minutes) || 0), 0);
    const rows = [...es]
        .sort((a, b) => String(b.on).localeCompare(String(a.on)))
        .map(e => {
            const on = P.byId(e.nodeId);
            return `<tr>
                <td>${esc(e.on)}</td>
                <td>${esc(on && on.id !== n.id ? on.title : '')}</td>
                <td class="num">${fmtMinutes(e.minutes)}</td>
                <td class="num">${e.invoiceId ? 'billed' : 'unbilled'}</td>
            </tr>`;
        }).join('');
    return drawer('time-' + n.id, 'Time',
        `${fmtMinutes(mins)} · ${es.length} ${es.length === 1 ? 'entry' : 'entries'}`,
        `<table class="t"><tbody>${rows}</tbody></table>`);
}

function viewNode(id) {
    const n = P.byId(id);
    if (!n || n.deletedAt) {
        return `<h1>Not here</h1>
                <div class="line">It may have been deleted — the bin keeps things for 30 days.</div>
                <div class="acts"><a class="btn" href="#/work">Back to work</a>
                <a class="btn" href="#/bin">Open the bin</a></div>`;
    }
    const isTask = n.type === 'task';
    const kids = isTask ? [] : P.children(n.id);
    const adding = addingHere(n.id, 0);
    const filled = FIELDS[n.type].filter(f => n[f[0]] != null && n[f[0]] !== '').length;

    return `
        <div class="path">
            <a href="#/work">Work</a>
            ${P.ancestors(n).map(a => `<a href="#/work/${esc(a.id)}">${esc(a.title)}</a>`).join('')}
        </div>

        <input class="h1" name="title" data-edit="${esc(n.id)}" value="${esc(n.title)}"
               aria-label="Title" spellcheck="false" autocomplete="off">
        <div class="line ${isTask && n.status === 'done' ? 'is-done' : ''}">${statusLine(n)}</div>

        <div class="acts">${actions(n)}</div>
        ${UI.logging === n.id ? logRow(n) : ''}
        ${UI.more === n.id ? `
            <div class="acts more">
                <button class="btn danger" data-del="${esc(n.id)}">Delete</button>
                <span class="muted">Deleting keeps it in the bin for 30 days.</span>
            </div>` : ''}

        ${isTask
            ? fieldsFor(n)
            : `<ul class="tree">
                    ${kids.map(c => c.type === 'task' ? `<li>${taskRow(c)}</li>` : treeNode(c)).join('')}
                    ${adding}
                    ${!kids.length && !adding ? '<li class="empty">Nothing here yet — add a task or a project above.</li>' : ''}
               </ul>
               ${drawer('det-' + n.id, 'Details', filled ? `${filled} filled` : 'empty', fieldsFor(n))}`}

        ${timeDrawer(n)}`;
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

function viewSettings() {
    const key = (which, label, hint, placeholder) => `
        <div class="field">
            <label for="k-${which}">${label}</label>
            <input id="k-${which}" type="password" placeholder="${placeholder}"
                   value="${esc(AI.keys[which] || '')}" data-key="${which}" autocomplete="off">
            <span class="hint">${hint}</span>
        </div>`;
    const localCount = (() => {
        try { return JSON.parse(localStorage.getItem('ordify.v3.node') || '[]').length; }
        catch (e) { return 0; }
    })();

    return `
        <h1>Settings</h1>

        <h2 class="sec">Account</h2>
        ${Session.mode === 'cloud' ? `
            <div class="line">Signed in as ${esc(Session.user.email || Session.user.uid)} —
            this practice syncs to every device you sign in on, and works offline.</div>
            <div class="acts">
                <button class="btn" data-signout>Sign out</button>
                ${localCount ? `<button class="btn" data-upload>Bring ${localCount} item${localCount === 1 ? '' : 's'} up from this browser</button>` : ''}
            </div>`
        : `
            <div class="line">Not signed in. Everything is kept in this browser only —
            clear the browser and it is gone, and no other device can see it.</div>
            <div class="acts"><button class="btn primary" data-signin>Continue with Google</button></div>
            <div id="door-err" class="s-error" hidden></div>`}

        ${Session.mode === 'cloud' ? `
            <h2 class="sec">Bring your practice from the old version</h2>
            <p class="muted" style="max-width:56ch">Reads the practice v2 keeps on this same
            account and rewrites it in the new shape. v2 is only ever read — it keeps working
            exactly as it does now. Ids are kept, so running it twice rewrites the same records
            instead of making a second copy.</p>
            <div class="acts">
                <button class="btn" data-mig="plan">Check what would come across</button>
                ${UI.migration && UI.migration.counts
                    ? `<button class="btn primary" data-mig="run">Bring it across</button>` : ''}
            </div>
            ${UI.migration ? migrationReport(UI.migration) : ''}`
        : ''}

        <h2 class="sec">Keys</h2>
        ${key('anthropic', 'Anthropic', 'Runs the understanding — turns a sentence into actions.', 'sk-ant-…')}
        ${key('gemini', 'Gemini', 'Runs the ears — turns a recording into words. Free tier is enough.', 'AIza…')}
        <p class="muted" style="max-width:52ch">Keys are kept in this browser only. Nothing is sent
        anywhere except to the provider you are calling.</p>

        <h2 class="sec">What it knows about you</h2>
        <p class="muted" style="max-width:56ch">Written only when you correct a reading or ask it to
        remember something, and sent with every sentence you say. It shapes how you are understood —
        it never does anything on its own. Delete anything that is wrong.</p>
        ${Memory.items.length ? `<div class="memos">${Memory.items.map(m => `
            <div class="memo">
                <div class="t">${esc(m.text)}</div>
                ${m.why ? `<div class="w">${esc(m.why)}</div>` : ''}
                <button class="btn sm" data-forget="${esc(m.id)}">Forget</button>
            </div>`).join('')}</div>`
          : `<div class="empty">Nothing yet. Correct it once and it will start keeping up.</div>`}

        <h2 class="sec">Data</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn" href="#/bin">Open the bin</a>
            <button class="btn" data-export>Export everything</button>
        </div>`;
}

/* What the dry run found. The problems are the reason this is two steps and
   not one button: anything odd in twelve years of records is named here,
   before a single document is written, and nothing was guessed on your
   behalf to make the number look tidier. */
function migrationReport(m) {
    if (m.error) return `<div class="s-error">${esc(m.error)}</div>`;
    if (m.busy) return `<div class="line">${esc(m.busy)}</div>`;
    const c = m.counts;
    return `
        <div class="line" style="margin-top:var(--s-3)">
            ${m.done ? 'Brought across' : 'Would bring'}:
            ${c.clients} client${c.clients === 1 ? '' : 's'} ·
            ${c.projects} project${c.projects === 1 ? '' : 's'} ·
            ${c.tasks} task${c.tasks === 1 ? '' : 's'} ·
            ${c.entries} time ${c.entries === 1 ? 'entry' : 'entries'} ·
            ${c.invoices} invoice${c.invoices === 1 ? '' : 's'}${
                c.deleted ? ` · ${c.deleted} already in the bin` : ''}
        </div>
        ${m.problems.length ? `
            <h2 class="sec">Worth looking at (${m.problems.length})</h2>
            <ul class="probs">${m.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
          : `<div class="muted">Nothing odd found.</div>`}`;
}

async function migration(step) {
    if (Session.mode !== 'cloud') return;
    UI.migration = { busy: step === 'run' ? 'Bringing it across…' : 'Reading v2…' };
    render();
    try {
        UI.migration = step === 'run'
            ? { ...(await Migrate.run(Session.user.uid, (n, total) => {
                    UI.migration = { busy: `Writing ${n} of ${total}…` };
                    render();
                })), done: true }
            : await Migrate.plan(Session.user.uid);
        if (step === 'run') {
            const [nodes, entries] = await Promise.all([Store.all('node'), Store.all('entry')]);
            P = new Practice(nodes, entries, []);
        }
    } catch (e) {
        UI.migration = { error: e.message || 'Could not read the old practice.' };
    }
    render();
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

/* The inline row commits and stays open: you rarely add exactly one task. */
async function commitNew() {
    const input = $('main [name="newtitle"]');
    if (!input || !UI.adding) return;
    const title = input.value.trim();
    if (!title) { UI.adding = null; render(); return; }

    const { parentId, type } = UI.adding;
    const node = makeNode(type, { title, parentId: parentId || null });
    if (type === 'task') node.status = 'todo';
    P.nodes.push(node);
    if (parentId) UI.open.add(parentId);
    await Store.put('node', node);
    input.value = '';
    render();
}

/* One field, written on blur. Empty means absent, not the empty string, so a
   cleared rate falls back to the inherited one instead of reading as zero. */
async function editField(el) {
    const n = P.byId(el.dataset.edit);
    if (!n) return;
    const name = el.name;
    let v = el.value;

    if (name === 'title') {
        v = v.trim();
        if (!v) { render(); return; }        // a thing with no name is not an edit
    } else if (el.type === 'number') {
        v = v.trim() === '' ? null : Number(v);
        if (v != null && !isFinite(v)) { render(); return; }
    } else if (typeof v === 'string' && v.trim() === '') {
        v = null;
    }

    if (n[name] === v) return;
    n[name] = v;
    await Store.put('node', n, [name]);
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

async function logTime(id, minutes) {
    if (!minutes || minutes < 1) return;
    const entry = { id: uid(), nodeId: id, minutes, on: today(), invoiceId: null, deletedAt: null };
    P.entries.push(entry);
    await Store.put('entry', entry);
    UI.logging = null;
    UI.drawer.add('time-' + id);   // show what was just recorded
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

/* Anything typed while looking around anonymously can come up to the account,
   once. It is a copy, not a move — the browser copy stays where it is, so a
   half-finished upload never leaves you with neither. Ids are preserved, so
   pressing it twice writes the same records again rather than duplicating
   them. */
async function uploadThisBrowser() {
    if (Session.mode !== 'cloud') return;
    const local = LocalAdapter();
    const kinds = ['node', 'entry', 'memo'];
    let n = 0;
    for (const kind of kinds) {
        for (const rec of await local.all(kind)) { await Store.put(kind, rec); n++; }
    }
    const [nodes, entries] = await Promise.all([Store.all('node'), Store.all('entry')]);
    P = new Practice(nodes, entries, []);
    await Memory.load();
    render();
    return n;
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

        const drw = t('[data-drawer]');
        if (drw) {
            const k = drw.dataset.drawer;
            UI.drawer.has(k) ? UI.drawer.delete(k) : UI.drawer.add(k);
            render(); return;
        }

        const done = t('[data-done]');
        if (done) { toggleDone(done.dataset.done); return; }

        // from Today this means "open the task and let me put the time in"
        const log = t('[data-log]');
        if (log) {
            UI.logging = log.dataset.log;
            if (parseHash().id === UI.logging) render(); else go('work/' + UI.logging);
            return;
        }
        const quick = t('[data-quick]');
        if (quick) { const m = $('main [name="mins"]'); if (m) { m.value = quick.dataset.quick; m.focus(); } return; }
        const save = t('[data-logsave]');
        if (save) {
            const m = $('main [name="mins"]');
            logTime(save.dataset.logsave, Number(m && m.value));
            return;
        }

        const more = t('[data-more]');
        if (more) { UI.more = UI.more === more.dataset.more ? null : more.dataset.more; render(); return; }

        const add = t('[data-add]');
        if (add) {
            const parent = add.dataset.parent || null;
            UI.adding = { parentId: parent, type: add.dataset.add };
            if (parent) UI.open.add(parent);
            // the tree already shows the row wherever it belongs; only come
            // from another screen (Now's first run) does it need a trip
            if (parseHash().screen === 'work') render();
            else { UI.adding.pending = true; go('work' + (parent ? '/' + parent : '')); }
            return;
        }
        if (t('[data-newgo]')) { commitNew(); return; }
        if (t('[data-newcancel]')) { UI.adding = null; render(); return; }

        const del = t('[data-del]');
        if (del) { removeNode(del.dataset.del); return; }

        const res = t('[data-restore]');
        if (res) { restoreNode(res.dataset.restore); return; }

        const forget = t('[data-forget]');
        if (forget) { Memory.forget(forget.dataset.forget).then(render); return; }

        if (t('[data-signin]')) {
            const err = $('#door-err');
            Auth.signIn().catch(e => {
                if (!err) return;
                err.textContent = e.message || 'Sign-in failed.';
                err.hidden = false;
            });
            return;
        }
        if (t('[data-anon]')) { Session.mode = 'local'; openPractice(); return; }
        if (t('[data-signout]')) {
            Auth.signOut().then(() => { Session.mode = 'out'; openPractice(); });
            return;
        }
        if (t('[data-upload]')) { uploadThisBrowser(); return; }
        const mig = t('[data-mig]');
        if (mig) { migration(mig.dataset.mig); return; }

        const hit = t('[data-go]');
        if (hit) { $('#q').value = ''; $('#results').hidden = true; go('work/' + hit.dataset.go); return; }

        const row = t('[data-task]');
        if (row && !t('[data-done]') && !t('button') && !t('a')) {
            go('work/' + row.dataset.task); return;
        }

        if (!t('#find')) $('#results').hidden = true;
    });

    // one way in: type or dictate, and the sheet confirms before anything exists
    $('#saygo').addEventListener('click', () => Capture.submit($('#sayin').value));
    $('#saymic').addEventListener('click', () => Mic.toggle($('#sayin')));
    $('#sayin').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); Capture.submit($('#sayin').value); }
        if (e.key === 'Escape') $('#sayin').value = '';
    });

    // keys save as you type them; so does every field on a node page
    document.body.addEventListener('change', (e) => {
        const k = e.target.closest('[data-key]');
        if (k) { AI.saveKey(k.dataset.key, k.value.trim()); return; }
        const f = e.target.closest('[data-edit]');
        if (f) editField(f);
    });

    // Enter commits, Escape backs out — the same everywhere on the page
    document.body.addEventListener('keydown', (e) => {
        const el = e.target;
        if (el.name === 'newtitle') {
            if (e.key === 'Enter') { e.preventDefault(); commitNew(); }
            if (e.key === 'Escape') { e.preventDefault(); UI.adding = null; render(); }
            return;
        }
        if (el.name === 'mins' && e.key === 'Enter') {
            e.preventDefault();
            const btn = $('main [data-logsave]');
            if (btn) logTime(btn.dataset.logsave, Number(el.value));
            return;
        }
        if (el.dataset && el.dataset.edit && el.tagName === 'INPUT') {
            if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); render(); }
        }
    });
    document.body.addEventListener('click', (e) => {
        if (!e.target.closest('[data-export]')) return;
        const blob = new Blob([JSON.stringify({ nodes: P.nodes, entries: P.entries }, null, 2)],
                              { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ordify-${today()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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

/* Which practice is open, and where it is kept.
   'out'   — nobody signed in; the only screen is the door
   'cloud' — signed in; Firestore, synced, offline-capable
   'local' — deliberately anonymous; this browser only, with demo data */
const Session = { mode: 'out', user: null, unsubscribe: null };

function localAdapter() {
    try {
        localStorage.setItem('__t', '1'); localStorage.removeItem('__t');
        return LocalAdapter();
    } catch (e) {
        console.warn('no local storage — this session will not persist', e);
        return MemoryAdapter();
    }
}

/* Everything a change of practice has to do, in one place: drop the old
   listener, point the store somewhere new, read it, and start listening
   again. Signing in and signing out are the same operation twice. */
async function openPractice() {
    if (Session.unsubscribe) { Session.unsubscribe(); Session.unsubscribe = null; }

    if (Session.mode === 'out') { P = new Practice(); Memory.items = []; render(); return; }

    let adapter;
    if (Session.mode === 'cloud') {
        try {
            adapter = FirestoreAdapter(Session.user.uid);
        } catch (e) {
            // Signed in but the cloud is unreachable. Falling back silently
            // would look like the practice had been emptied, which is worse
            // than saying so.
            console.error('cloud unavailable', e);
            Session.mode = 'local';
            adapter = localAdapter();
        }
    } else {
        adapter = localAdapter();
    }
    Store.use(adapter);

    const [nodes, entries] = await Promise.all([Store.all('node'), Store.all('entry')]);
    P = new Practice(nodes, entries, []);
    await Memory.load();

    // an empty cloud belongs to someone starting out — the first-run screen
    // tells them so. Demo data is only ever for the anonymous look-around.
    if (Session.mode === 'local' && !P.nodes.length) await seed();

    // another tab, or another device, is a second writer
    if (adapter.subscribe) {
        Session.unsubscribe = adapter.subscribe(async () => {
            const [n, e] = await Promise.all([Store.all('node'), Store.all('entry')]);
            P.nodes = n; P.entries = e;
            await Memory.load();   // a correction made elsewhere counts here too
            render();
        }) || null;
    }
    render();
}

async function boot() {
    AI.loadKeys();
    Sheet.mount();
    bind();
    render();                                  // the door, until Firebase answers

    if (!Auth.ready()) {                       // no SDK: this device, or nothing
        Session.mode = 'local';
        return openPractice();
    }
    Auth.watch(async (user) => {
        Session.user = user;
        // an anonymous look-around is not interrupted by a stale session
        if (!user && Session.mode === 'local') return;
        Session.mode = user ? 'cloud' : 'out';
        await openPractice();
    });
}

/* A practice to look at while there is no sign-in — the shape of real work,
   so the screens are judged against something realistic. */
async function seed() {
    const writes = [];
    const mk = (type, title, parent, extra = {}) => {
        const n = makeNode(type, { title, parentId: parent, ...extra });
        P.nodes.push(n); writes.push(Store.put('node', n));
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
        P.entries.push(entry); writes.push(Store.put('entry', entry));
    };
    e(aml.id, 95, 3); e(aml.id, 30, 1); e(decorp.id, 240, 2);
    UI.open.add(nova.id); UI.open.add(aml.id);
    await Promise.all(writes);
}

document.addEventListener('DOMContentLoaded', boot);
