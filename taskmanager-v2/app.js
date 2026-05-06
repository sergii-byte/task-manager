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
    v: 2,
    profile: {
        name: '', email: '', address: '', taxId: '',
        currency: 'EUR', rate: 150,
        invoiceNumberPrefix: 'INV-', invoiceNumberCounter: 1
    },
    clients: [],
    matters: [],
    tasks: [],
    logs: [],
    invoices: [],
    timer: null   // { taskId, matterId, clientId, label, startedAt }
});

let state = defaultState();

const Store = {
    load() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) { state = defaultState(); return; }
            const parsed = JSON.parse(raw);
            // shallow merge to retain new keys after upgrades
            state = Object.assign(defaultState(), parsed);
            // ensure arrays exist
            ['clients','matters','tasks','logs','invoices'].forEach(k => {
                if (!Array.isArray(state[k])) state[k] = [];
            });
            if (!state.profile) state.profile = defaultState().profile;
        } catch (e) {
            console.error('Store.load failed', e);
            state = defaultState();
        }
    },
    save() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Store.save failed', e);
            toast('Save failed: ' + e.message, 'error');
        }
    },
    export() {
        return JSON.stringify(state, null, 2);
    },
    import(json) {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid data');
        state = Object.assign(defaultState(), parsed);
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
 * 3. SELECTORS / DERIVED
 * ========================================================================= */

const byId = (list, id) => list.find(x => x.id === id);
const clientById = (id) => byId(state.clients, id);
const matterById = (id) => byId(state.matters, id);
const taskById   = (id) => byId(state.tasks, id);
const invoiceById = (id) => byId(state.invoices, id);

const mattersForClient = (cid) => state.matters.filter(m => m.clientId === cid);
const tasksForMatter = (mid) => state.tasks.filter(t => t.matterId === mid);
const tasksForClient = (cid) => state.tasks.filter(t => t.clientId === cid);
const logsForMatter = (mid) => state.logs.filter(l => l.matterId === mid);
const logsForTask = (tid) => state.logs.filter(l => l.taskId === tid);
const logsForClient = (cid) => state.logs.filter(l => l.clientId === cid);

const taskStatus = (t) => {
    if (t.status === 'done') return 'done';
    if (t.due && isPastDate(t.due)) return 'overdue';
    return 'todo';
};

const matterRate = (m) => Number(m?.rate) || Number(state.profile.rate) || 0;
const profileCurrency = () => state.profile.currency || 'EUR';

const totalUnbilledForClient = (cid) => {
    return state.logs
        .filter(l => l.clientId === cid && !l.invoiceId)
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
function toast(message, kind = 'ok') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.dataset.kind = kind;
    el.hidden = false;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
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
        state.logs.push({
            id: uuid(),
            taskId: t.taskId,
            matterId: t.matterId,
            clientId: t.clientId,
            startedAt: t.startedAt,
            endedAt: new Date().toISOString(),
            minutes,
            notes: t.label || '',
            invoiceId: null
        });
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
    { id: 'today',    label: 'Today',     icon: '○' },
    { id: 'clients',  label: 'Clients',   icon: '◐' },
    { id: 'matters',  label: 'Matters',   icon: '◇' },
    { id: 'tasks',    label: 'Tasks',     icon: '☐' },
    { id: 'time',     label: 'Time',      icon: '◴' },
    { id: 'invoices', label: 'Invoices',  icon: '$' }
];

function renderSidebar() {
    const cur = parseHash().view;
    const nav = $('#nav');
    nav.innerHTML = NAV_ITEMS.map(it => {
        let count = '';
        if (it.id === 'today') {
            const n = state.tasks.filter(t => taskStatus(t) !== 'done' && (t.due === todayISO() || taskStatus(t) === 'overdue')).length;
            if (n) count = `<span class="count">${n}</span>`;
        } else if (it.id === 'clients') count = `<span class="count">${state.clients.length || ''}</span>`;
        else if (it.id === 'matters') count = `<span class="count">${state.matters.filter(m=>m.status!=='closed').length || ''}</span>`;
        else if (it.id === 'tasks') count = `<span class="count">${state.tasks.filter(t=>t.status!=='done').length || ''}</span>`;
        else if (it.id === 'invoices') count = `<span class="count">${state.invoices.filter(i=>i.status!=='paid').length || ''}</span>`;

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
 * 9. SEARCH
 * ========================================================================= */

function setupSearch() {
    const inp = $('#search');
    const handle = debounce(() => {
        const q = inp.value.trim().toLowerCase();
        if (!q) return;
        // jump to first match
        const cli = state.clients.find(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
        if (cli) { navigate('clients/' + cli.id); inp.value=''; return; }
        const mat = state.matters.find(m => m.title?.toLowerCase().includes(q));
        if (mat) { navigate('matters/' + mat.id); inp.value=''; return; }
        const tk = state.tasks.find(t => t.title?.toLowerCase().includes(q));
        if (tk) { navigate('tasks'); inp.value=''; return; }
        toast('No matches');
    }, 320);
    inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handle();
    });
    inp.addEventListener('input', () => {
        if (inp.value.length > 2) handle();
    });
}

/* =========================================================================
 * 10. VIEW: TODAY
 * ========================================================================= */

function viewToday() {
    const today = todayISO();
    const dueToday = state.tasks.filter(t => t.status !== 'done' && t.due === today);
    const overdue = state.tasks.filter(t => t.status !== 'done' && t.due && t.due < today);
    const noDate = state.tasks.filter(t => t.status !== 'done' && !t.due).slice(0, 5);

    const todayLogs = state.logs.filter(l => l.startedAt.slice(0,10) === today);
    const todayMins = todayLogs.reduce((s, l) => s + l.minutes, 0);

    const recentInvoices = [...state.invoices].sort((a,b)=> (b.dateIssued||'').localeCompare(a.dateIssued||'')).slice(0, 3);

    return `
        <div class="view-head">
            <h1>Today</h1>
            <div class="meta">${new Date().toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'})}</div>
            <div class="actions">
                <button class="btn primary" data-act="new-task">＋ New task</button>
            </div>
        </div>

        <div class="cards">
            <div class="card">
                <div class="card-label">Time today</div>
                <div class="card-value">${fmtMinutes(todayMins)}</div>
                <div class="card-sub">${todayLogs.length} ${todayLogs.length===1?'entry':'entries'}</div>
            </div>
            <div class="card">
                <div class="card-label">Active matters</div>
                <div class="card-value">${state.matters.filter(m=>m.status!=='closed').length}</div>
                <div class="card-sub">across ${state.clients.length} ${state.clients.length===1?'client':'clients'}</div>
            </div>
            <div class="card">
                <div class="card-label">Open tasks</div>
                <div class="card-value">${state.tasks.filter(t=>t.status!=='done').length}</div>
                <div class="card-sub">${overdue.length} overdue</div>
            </div>
            <div class="card">
                <div class="card-label">Unpaid invoices</div>
                <div class="card-value">${state.invoices.filter(i=>i.status!=='paid').length}</div>
                <div class="card-sub">${state.invoices.filter(i=>i.status==='draft').length} draft</div>
            </div>
        </div>

        ${overdue.length ? `
            <h2 class="section-h">Overdue</h2>
            ${renderTaskList(overdue)}
        ` : ''}

        <h2 class="section-h">Due today</h2>
        ${dueToday.length ? renderTaskList(dueToday) : '<div class="empty">Nothing due today.</div>'}

        ${noDate.length ? `
            <h2 class="section-h">No deadline</h2>
            ${renderTaskList(noDate)}
        ` : ''}

        ${recentInvoices.length ? `
            <h2 class="section-h">Recent invoices</h2>
            <table class="t">
                <thead><tr><th>Number</th><th>Client</th><th>Issued</th><th>Status</th><th class="num">Amount</th></tr></thead>
                <tbody>${recentInvoices.map(inv => `
                    <tr class="row" data-go="invoices/${inv.id}">
                        <td>${esc(inv.number)}</td>
                        <td>${esc(clientById(inv.clientId)?.name || '—')}</td>
                        <td>${fmtDate(inv.dateIssued)}</td>
                        <td><span class="badge ${inv.status}">${esc(inv.status)}</span></td>
                        <td class="num">${fmtMoney(invoiceTotal(inv), inv.currency)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        ` : ''}
    `;
}

function renderTaskList(tasks) {
    if (!tasks.length) return '<div class="empty">No tasks.</div>';
    return `<table class="t"><tbody>
        ${tasks.map(t => {
            const cli = clientById(t.clientId);
            const mat = matterById(t.matterId);
            const st = taskStatus(t);
            return `
                <tr class="row" data-task="${t.id}">
                    <td style="width:32px"><span class="check ${st==='done'?'done':''}" data-toggle="${t.id}"></span></td>
                    <td>
                        <div class="task-title ${st==='done'?'is-done':''}">${esc(t.title)}</div>
                        ${cli || mat ? `<div class="task-meta">${esc(cli?.name||'')}${mat?` · ${esc(mat.title)}`:''}</div>` : ''}
                    </td>
                    <td>${t.due ? `<span class="badge ${st==='overdue'?'overdue':''}">${fmtDate(t.due)}</span>` : ''}</td>
                    <td style="width:48px">
                        ${mat ? `<button class="play" data-start="${t.id}" title="Start timer">▶</button>` : ''}
                    </td>
                </tr>`;
        }).join('')}
    </tbody></table>`;
}

/* =========================================================================
 * 11. VIEW: CLIENTS
 * ========================================================================= */

function viewClients() {
    const list = [...state.clients].sort((a,b) => (a.name||'').localeCompare(b.name||''));
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
    const invoices = state.invoices.filter(i => i.clientId === id);

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

/* =========================================================================
 * 12. VIEW: MATTERS
 * ========================================================================= */

function viewMatters() {
    const list = [...state.matters].sort((a,b)=> (a.title||'').localeCompare(b.title||''));
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
    let list = [...state.tasks];
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
    const list = [...state.logs].sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
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
    const list = [...state.invoices].sort((a,b) => (b.dateIssued||'').localeCompare(a.dateIssued||''));
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

    return `
        <div class="breadcrumb"><a href="#/invoices">Invoices</a> ›</div>
        <div class="view-head no-print">
            <h1>${esc(inv.number)}</h1>
            <div class="meta"><span class="badge ${inv.status}">${esc(inv.status)}</span></div>
            <div class="actions">
                <button class="btn" data-act="edit-invoice" data-id="${inv.id}">Edit</button>
                ${inv.status === 'draft' ? `<button class="btn" data-act="invoice-status" data-id="${inv.id}" data-status="sent">Mark sent</button>` : ''}
                ${inv.status !== 'paid' ? `<button class="btn primary" data-act="invoice-status" data-id="${inv.id}" data-status="paid">Mark paid</button>` : ''}
                <button class="btn" onclick="window.print()">Print / PDF</button>
            </div>
        </div>

        <article class="invoice-doc">
            <header class="inv-head">
                <div class="inv-from">
                    <div class="inv-brand">${esc(p.name || 'Your name')}</div>
                    ${p.address ? `<div>${esc(p.address).replace(/\n/g,'<br>')}</div>` : ''}
                    ${p.email ? `<div>${esc(p.email)}</div>` : ''}
                    ${p.taxId ? `<div>Tax ID: ${esc(p.taxId)}</div>` : ''}
                </div>
                <div class="inv-title">
                    <h2>Invoice</h2>
                    <div class="inv-num">${esc(inv.number)}</div>
                    <div><span class="lbl">Issued</span> ${fmtDate(inv.dateIssued)}</div>
                    <div><span class="lbl">Due</span> ${fmtDate(inv.dateDue)}</div>
                </div>
            </header>

            <section class="inv-bill">
                <div class="lbl">Bill to</div>
                <div class="inv-bill-to">
                    <strong>${esc(c?.name || '—')}</strong>
                    ${c?.address ? `<br>${esc(c.address).replace(/\n/g,'<br>')}` : ''}
                    ${c?.email ? `<br>${esc(c.email)}` : ''}
                    ${c?.taxId ? `<br>Tax ID: ${esc(c.taxId)}` : ''}
                </div>
            </section>

            <table class="inv-items">
                <thead><tr>
                    <th>Description</th>
                    <th class="num">Hours</th>
                    <th class="num">Rate</th>
                    <th class="num">Amount</th>
                </tr></thead>
                <tbody>
                    ${(inv.items||[]).map(i => `<tr>
                        <td>${esc(i.description)}</td>
                        <td class="num">${(Number(i.hours)||0).toFixed(2)}</td>
                        <td class="num">${fmtMoney(i.rate, inv.currency)}</td>
                        <td class="num">${fmtMoney(i.amount, inv.currency)}</td>
                    </tr>`).join('')}
                </tbody>
                <tfoot><tr>
                    <td colspan="3" class="num"><strong>Total</strong></td>
                    <td class="num"><strong>${fmtMoney(invoiceTotal(inv), inv.currency)}</strong></td>
                </tr></tfoot>
            </table>

            ${inv.notes ? `<div class="inv-notes"><div class="lbl">Notes</div>${esc(inv.notes).replace(/\n/g,'<br>')}</div>` : ''}
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
            </div>

            <div class="actions" style="margin-top:24px">
                <button type="submit" class="btn primary">Save settings</button>
            </div>
        </form>

        <h3 style="margin-top:48px">Data</h3>
        <div class="settings-data">
            <button class="btn" data-act="export">Export JSON</button>
            <button class="btn" data-act="import">Import JSON</button>
            <button class="btn danger" data-act="reset">Reset all data</button>
        </div>
        <p class="muted" style="margin-top:8px;font-size:12px">All data lives in your browser's localStorage. Export regularly for backup.</p>
    `;
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
            if (c) Object.assign(c, data);
            else state.clients.push({ id: uuid(), createdAt: new Date().toISOString(), ...data });
            Store.save(); render();
            toast(c ? 'Client updated' : 'Client added');
        },
        onDelete: c ? () => {
            // soft cascade check
            const has = mattersForClient(c.id).length || tasksForClient(c.id).length || logsForClient(c.id).length;
            if (has && !confirm('This client has matters/tasks/time. Delete them all too?')) return;
            state.matters = state.matters.filter(m => m.clientId !== c.id);
            state.tasks = state.tasks.filter(t => t.clientId !== c.id);
            state.logs = state.logs.filter(l => l.clientId !== c.id);
            state.clients = state.clients.filter(x => x.id !== c.id);
            Store.save();
            navigate('clients');
            toast('Client deleted');
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
            if (m) Object.assign(m, data);
            else state.matters.push({ id: uuid(), openedAt: new Date().toISOString(), ...data });
            Store.save(); render();
            toast(m ? 'Matter updated' : 'Matter created');
        },
        onDelete: m ? () => {
            const has = tasksForMatter(m.id).length || logsForMatter(m.id).length;
            if (has && !confirm('This matter has tasks/time. Delete them all too?')) return;
            state.tasks = state.tasks.filter(t => t.matterId !== m.id);
            state.logs = state.logs.filter(l => l.matterId !== m.id);
            state.matters = state.matters.filter(x => x.id !== m.id);
            Store.save();
            navigate('matters');
            toast('Matter deleted');
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
            { name: 'notes', label: 'Notes', type: 'textarea', value: t?.notes || '', rows: 3, full: true }
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
                notes: data.notes
            };
            if (t) Object.assign(t, payload);
            else state.tasks.push({ id: uuid(), status: 'todo', createdAt: new Date().toISOString(), ...payload });
            Store.save(); render();
            toast(t ? 'Task updated' : 'Task added');
        },
        onDelete: t ? () => {
            state.tasks = state.tasks.filter(x => x.id !== t.id);
            // unlink logs from deleted task but keep them
            state.logs.forEach(l => { if (l.taskId === t.id) l.taskId = null; });
            Store.save(); render();
            toast('Task deleted');
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
                state.logs.push({ id: uuid(), taskId: null, invoiceId: null, ...payload });
            }
            Store.save(); render();
            toast(l ? 'Entry updated' : 'Entry added');
        },
        onDelete: l ? () => {
            if (l.invoiceId) { toast('Cannot delete billed entry', 'error'); return; }
            state.logs = state.logs.filter(x => x.id !== l.id);
            Store.save(); render();
            toast('Entry deleted');
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
                // unlink logs
                state.logs.forEach(l => { if (l.invoiceId === existing.id) l.invoiceId = null; });
                state.invoices = state.invoices.filter(i => i.id !== existing.id);
                Store.save();
                navigate('invoices');
                toast('Invoice deleted');
            }
        });
        return;
    }

    // new invoice — pick matter, generate from unbilled logs
    if (!state.matters.length) { toast('Add a matter first', 'error'); return; }
    Modal.open({
        title: 'New invoice',
        fields: [
            { name: 'matterId', label: 'Matter', type: 'select', required: true,
                value: matterId || '',
                options: state.matters.map(m => ({
                    value: m.id, label: `${clientById(m.clientId)?.name||'—'} · ${m.title}`
                })) },
            { name: 'dateIssued', label: 'Issued', type: 'date', required: true, value: todayISO() },
            { name: 'dateDue', label: 'Due', type: 'date', value: '' },
            { name: 'notes', label: 'Notes', type: 'textarea', value: '', rows: 3, full: true }
        ],
        onSave: (data) => {
            const m = matterById(data.matterId);
            if (!m) { toast('Pick a matter', 'error'); return false; }
            const unbilledLogs = logsForMatter(m.id).filter(l => !l.invoiceId);
            if (!unbilledLogs.length) { toast('No unbilled time on this matter', 'error'); return false; }
            const rate = matterRate(m);
            const items = unbilledLogs.map(l => {
                const hours = +(l.minutes / 60).toFixed(2);
                return {
                    description: `${fmtDate(l.startedAt)}${l.notes?' — '+l.notes:''}`,
                    hours,
                    rate,
                    amount: +(hours * rate).toFixed(2)
                };
            });
            const number = state.profile.invoiceNumberPrefix + String(state.profile.invoiceNumberCounter).padStart(4,'0');
            const inv = {
                id: uuid(),
                number,
                clientId: m.clientId,
                matterId: m.id,
                dateIssued: data.dateIssued,
                dateDue: data.dateDue || null,
                currency: profileCurrency(),
                items,
                notes: data.notes || '',
                status: 'draft'
            };
            state.invoices.push(inv);
            state.profile.invoiceNumberCounter += 1;
            unbilledLogs.forEach(l => l.invoiceId = inv.id);
            Store.save();
            navigate('invoices/' + inv.id);
            toast(`Invoice ${number} created`);
        }
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
                Store.save(); render();
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
                if (inv) { inv.status = act.dataset.status; Store.save(); render(); toast('Marked '+inv.status); }
                break;
            }
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
            for (const [k, v] of data.entries()) {
                if (k === 'rate' || k === 'invoiceNumberCounter') state.profile[k] = Number(v) || 0;
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
            case 'settings': html = viewSettings(); break;
            default:         html = viewToday();
        }
    } catch (e) {
        console.error('Render failed', e);
        html = `<div class="empty-state"><h3>Render error</h3><pre>${esc(e.stack || e.message)}</pre></div>`;
    }
    root.innerHTML = html;
    root.scrollTop = 0;
}

/* =========================================================================
 * 21. BOOT
 * ========================================================================= */

function boot() {
    Store.load();
    Modal.init();
    Timer.init();
    bindGlobalActions();
    setupSearch();
    if (!location.hash) location.hash = '#/today';
    render();
}

document.addEventListener('DOMContentLoaded', boot);
