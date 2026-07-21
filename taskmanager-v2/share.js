/* ordify · client status page
 *
 * Read-only. Loads one /shares/{token} document (token = location.hash),
 * renders it, and keeps listening — the page updates live as the lawyer
 * works. The document only ever contains the sanitized payload built by
 * Share.payload() in app.js: no rates, amounts, invoices or internal notes.
 *
 * `share.html#demo` renders built-in sample data (no network) — used to
 * preview the page and in local testing.
 */
'use strict';

/* ---------------------------------------------------------------- i18n */

const STRINGS = {
    en: {
        statusPage: 'status page',
        preparedBy: 'prepared by',
        updated: 'updated',
        live: 'live',
        loading: 'loading…',
        notFoundTitle: 'this link is not active',
        notFoundBody: 'The status page was disabled or the link is incomplete. Ask your counsel for a fresh link.',
        cardOpen: 'open tasks',
        cardDueSoon: 'due in 7 days',
        cardStuck: 'needs your input',
        cardDone: 'done',
        window: { d7: 'last 7 days', d30: 'last 30 days', m3: 'last 3 months', m6: 'last 6 months', y1: 'last 12 months' },
        secStuck: 'needs your attention',
        secStuckSub: 'these items are waiting on something — usually from your side. Unblocking them moves the work forward.',
        secOpen: 'in progress',
        secOpenSub: 'everything currently on our desk for you, nearest deadline first.',
        secDone: 'recently completed',
        secMatters: 'projects',
        thTask: 'task', thDue: 'deadline', thPriority: 'priority', thTime: 'time spent',
        thMatter: 'project', thStatus: 'status', thCompleted: 'completed',
        waitingOn: 'waiting on:',
        overdue: 'overdue',
        today: 'today',
        noOpen: 'nothing in progress right now.',
        noDone: 'nothing completed in the last 30 days.',
        noMatters: 'no projects yet.',
        prio: { high: 'high', normal: 'normal', low: 'low' },
        mstatus: { open: 'open', 'on-hold': 'on hold', closed: 'closed' },
        footNote: 'this page shows work status only — it contains no financial details.',
        poweredBy: 'powered by',
        reply: 'reply',
        replyPlaceholder: 'Write a reply…',
        send: 'send',
        you: 'you',
        sending: 'sending…',
        sendFailed: 'could not send — try again',
        threadEmpty: 'no messages on this task yet',
        commentsOff: 'replies are switched off for this page'
    },
    ua: {
        statusPage: 'сторінка статусу',
        preparedBy: 'підготував(ла)',
        updated: 'оновлено',
        live: 'наживо',
        loading: 'завантаження…',
        notFoundTitle: 'посилання неактивне',
        notFoundBody: 'Сторінку статусу вимкнено, або посилання неповне. Запитайте у вашого юриста нове посилання.',
        cardOpen: 'відкриті задачі',
        cardDueSoon: 'дедлайни за 7 днів',
        cardStuck: 'потрібна ваша участь',
        cardDone: 'виконано',
        window: { d7: 'за 7 днів', d30: 'за 30 днів', m3: 'за 3 місяці', m6: 'за 6 місяців', y1: 'за 12 місяців' },
        secStuck: 'потрібна ваша увага',
        secStuckSub: 'ці пункти чекають на щось — зазвичай з вашого боку. Розблокування рухає роботу далі.',
        secOpen: 'в роботі',
        secOpenSub: 'усе, що зараз у роботі по вас, найближчий дедлайн — першим.',
        secDone: 'нещодавно виконано',
        secMatters: 'проєкти',
        thTask: 'задача', thDue: 'дедлайн', thPriority: 'пріоритет', thTime: 'витрачено часу',
        thMatter: 'проєкт', thStatus: 'статус', thCompleted: 'виконано',
        waitingOn: 'очікуємо:',
        overdue: 'прострочено',
        today: 'сьогодні',
        noOpen: 'зараз нічого не в роботі.',
        noDone: 'за останні 30 днів нічого не завершено.',
        noMatters: 'проєктів поки немає.',
        prio: { high: 'високий', normal: 'звичайний', low: 'низький' },
        mstatus: { open: 'активна', 'on-hold': 'на паузі', closed: 'закрита' },
        footNote: 'ця сторінка показує лише статус роботи — без фінансових деталей.',
        poweredBy: 'працює на',
        reply: 'відповісти',
        replyPlaceholder: 'Напишіть відповідь…',
        send: 'надіслати',
        you: 'ви',
        sending: 'надсилання…',
        sendFailed: 'не вдалося надіслати — спробуйте ще раз',
        threadEmpty: 'по цій задачі ще немає повідомлень',
        commentsOff: 'відповіді для цієї сторінки вимкнено'
    }
};

let lang = localStorage.getItem('ordify-share-lang')
    || (/^(uk|ru)/.test(navigator.language || '') ? 'ua' : 'en');
const T = () => STRINGS[lang] || STRINGS.en;

/* ---------------------------------------------------------------- utils */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString(lang === 'ua' ? 'uk-UA' : 'en-GB',
        { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

const fmtMinutes = (m) => {
    if (!m) return '—';
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h}h ${r ? r + 'm' : ''}`.trim() : `${r}m`;
};

const fmtUpdated = (ts) => new Date(ts).toLocaleString(lang === 'ua' ? 'uk-UA' : 'en-GB',
    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/* map a done-window (days) to a localized label */
const windowLabel = (days) => {
    const w = T().window;
    if (days <= 7) return w.d7;
    if (days <= 30) return w.d30;
    if (days <= 90) return w.m3;
    if (days <= 180) return w.m6;
    return w.y1;
};

/* ---------------------------------------------------------------- render */

let current = null;        // { data, updatedAt }
let token = '';            // the share token from location.hash
let comments = [];         // [{ id, taskId, author, text, createdAt }]
let commentsOn = false;    // hub's kill switch, read off the share doc
const openThreads = new Set();   // task ids whose thread is expanded
const drafts = {};         // taskId -> in-progress text, survives re-render

const msgsFor = (taskId) => comments.filter(m => (m.taskId || '_general') === taskId);

/* Anonymous session — created lazily, only when the client actually posts.
 * If the hub happens to be signed in on this origin, that session is used
 * instead and the rules will accept the message as a 'hub' reply. */
async function ensureAuth() {
    if (fbAuth && fbAuth.currentUser) return fbAuth.currentUser;
    const cred = await fbAuth.signInAnonymously();
    return cred.user;
}

async function postComment(taskId, text) {
    const body = (text || '').trim();
    if (!body || !token || token === 'demo') return;
    await ensureAuth();
    await fbDb.collection('shares').doc(token).collection('comments').add({
        taskId: taskId === '_general' ? null : taskId,
        author: (fbAuth.currentUser && !fbAuth.currentUser.isAnonymous) ? 'hub' : 'client',
        text: body,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/* Messages + compose box for one task. */
function threadHtml(taskId) {
    const s = T();
    const msgs = msgsFor(taskId);
    const when = (ms) => ms
        ? new Date(ms).toLocaleString(lang === 'ua' ? 'uk-UA' : 'en-GB',
            { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : s.sending;
    return `
        <div class="thread">
            ${msgs.length
                ? msgs.map(m => `
                    <div class="msg ${m.author === 'client' ? 'mine' : ''}">
                        <div class="msg-who">${m.author === 'client' ? s.you : esc(current.data.from || 'ordify')} · ${esc(when(m.createdAt))}</div>
                        <div class="msg-text">${esc(m.text)}</div>
                    </div>`).join('')
                : `<div class="thread-empty">${s.threadEmpty}</div>`}
            ${commentsOn ? `
                <div class="thread-reply">
                    <input type="text" class="thread-input" data-thread="${esc(taskId)}"
                           placeholder="${esc(s.replyPlaceholder)}" maxlength="2000"
                           value="${esc(drafts[taskId] || '')}">
                    <button class="thread-send" data-send="${esc(taskId)}">${esc(s.send)}</button>
                </div>
            ` : `<div class="thread-empty">${s.commentsOff}</div>`}
        </div>`;
}

/* The toggle that opens a task's thread. */
function threadToggle(taskId) {
    const s = T();
    const n = msgsFor(taskId).length;
    const open = openThreads.has(taskId);
    return `<button class="thread-toggle ${open ? 'on' : ''}" data-toggle="${esc(taskId)}">
        💬 ${n ? n : ''} ${esc(s.reply)}
    </button>`;
}

function dueCell(t) {
    if (!t.due) return '<td class="date"></td>';
    const s = T();
    if (t.overdue) return `<td class="date overdue">${esc(fmtDate(t.due))} · ${s.overdue}</td>`;
    if (t.due === todayISO()) return `<td class="date">${s.today}</td>`;
    return `<td class="date">${esc(fmtDate(t.due))}</td>`;
}

function render() {
    const app = document.getElementById('app');
    if (!current) return;
    const s = T();
    const d = current.data;

    const open = d.tasks.filter(t => t.status !== 'done')
        .sort((a, b) => (b.overdue - a.overdue)
            || (a.due || '9999').localeCompare(b.due || '9999')
            || ({ high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority]));
    const stuck = open.filter(t => t.stuck);
    const flowing = open.filter(t => !t.stuck);

    const doneDays = (d.doneDays >= 1 && d.doneDays <= 365) ? d.doneDays : 30;
    const doneCutoff = new Date(Date.now() - doneDays * 86400000).toISOString();
    const done = d.tasks.filter(t => t.status === 'done' && (t.completedAt || t.createdAt || '') >= doneCutoff)
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
        .slice(0, 100);

    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const dueSoon = open.filter(t => t.due && t.due <= weekAhead).length;

    app.innerHTML = `
        <div class="top">
            <span class="brand">ordify</span>
            <span class="kind">${s.statusPage}</span>
            <span class="lang">
                <button data-lang="en" class="${lang === 'en' ? 'on' : ''}">EN</button>
                <button data-lang="ua" class="${lang === 'ua' ? 'on' : ''}">UA</button>
            </span>
        </div>

        <h1>${esc(d.client)}</h1>
        <div class="sub">
            ${d.from ? `${s.preparedBy} ${esc(d.from)} · ` : ''}
            <span class="upd"><span class="live-dot"></span>${s.live} · ${s.updated} ${esc(fmtUpdated(current.updatedAt))}</span>
        </div>

        <div class="cards">
            <div class="card"><div class="lbl">${s.cardOpen}</div><div class="val">${open.length}</div></div>
            <div class="card"><div class="lbl">${s.cardDueSoon}</div><div class="val">${dueSoon}</div></div>
            <div class="card ${stuck.length ? 'attn' : ''}"><div class="lbl">${s.cardStuck}</div><div class="val">${stuck.length}</div></div>
            <div class="card"><div class="lbl">${s.cardDone} · ${windowLabel(doneDays)}</div><div class="val">${done.length}</div></div>
        </div>

        ${stuck.length ? `
            <h2 class="section-h">${s.secStuck}</h2>
            <div class="section-sub">${s.secStuckSub}</div>
            ${stuck.map(t => `
                <div class="stuck-card">
                    <div class="t">${esc(t.title)}</div>
                    <div class="why"><b>${s.waitingOn}</b> ${esc(t.stuck)}</div>
                    <div class="meta">${[t.matter, t.due ? fmtDate(t.due) : ''].filter(Boolean).map(esc).join(' · ')}</div>
                    ${t.id ? threadToggle(t.id) : ''}
                    ${t.id && openThreads.has(t.id) ? threadHtml(t.id) : ''}
                </div>`).join('')}
        ` : ''}

        <h2 class="section-h">${s.secOpen}</h2>
        <div class="section-sub">${s.secOpenSub}</div>
        ${flowing.length ? `
            <table class="t">
                <thead><tr><th>${s.thTask}</th><th>${s.thDue}</th><th>${s.thPriority}</th><th style="text-align:right">${s.thTime}</th></tr></thead>
                <tbody>${flowing.map(t => `
                    <tr>
                        <td>
                            <div class="task-title">${esc(t.title)}</div>
                            ${t.matter ? `<div class="task-meta">${esc(t.matter)}</div>` : ''}
                            ${t.id ? threadToggle(t.id) : ''}
                        </td>
                        ${dueCell(t)}
                        <td><span class="badge ${esc(t.priority)}">${esc(s.prio[t.priority] || t.priority)}</span></td>
                        <td class="num">${fmtMinutes(t.minutes)}</td>
                    </tr>
                    ${t.id && openThreads.has(t.id) ? `
                        <tr class="thread-tr"><td colspan="4">${threadHtml(t.id)}</td></tr>` : ''}`).join('')}
                </tbody>
            </table>
        ` : `<div class="empty">${s.noOpen}</div>`}

        <h2 class="section-h">${s.secDone}</h2>
        ${done.length ? `
            <table class="t">
                <thead><tr><th>${s.thTask}</th><th>${s.thCompleted}</th><th style="text-align:right">${s.thTime}</th></tr></thead>
                <tbody>${done.map(t => `
                    <tr>
                        <td>
                            <div class="task-title is-done">${esc(t.title)}</div>
                            ${t.matter ? `<div class="task-meta">${esc(t.matter)}</div>` : ''}
                        </td>
                        <td class="date">${esc(t.completedAt ? fmtDate(t.completedAt.slice(0, 10)) : '')}</td>
                        <td class="num">${fmtMinutes(t.minutes)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        ` : `<div class="empty">${s.noDone}</div>`}

        <h2 class="section-h">${s.secMatters}</h2>
        ${d.matters.length ? `
            <table class="t">
                <thead><tr><th>${s.thMatter}</th><th>${s.thStatus}</th><th style="text-align:right">${s.thTime}</th></tr></thead>
                <tbody>${d.matters.map(m => `
                    <tr>
                        <td><div class="task-title">${esc(m.title)}</div></td>
                        <td><span class="badge ${esc(m.status)}">${esc(s.mstatus[m.status] || m.status)}</span></td>
                        <td class="num">${fmtMinutes(m.minutes)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        ` : `<div class="empty">${s.noMatters}</div>`}

        <div class="foot">
            <span>${s.footNote}</span>
            <span style="margin-left:auto">${s.poweredBy} <span class="brand-sm">ordify</span></span>
        </div>
    `;

    app.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click', () => {
        lang = btn.dataset.lang;
        localStorage.setItem('ordify-share-lang', lang);
        render();
    }));

    app.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', () => {
        const key = btn.dataset.toggle;
        if (openThreads.has(key)) openThreads.delete(key); else openThreads.add(key);
        render();
    }));

    // keep the draft alive across the re-renders the live listener triggers
    app.querySelectorAll('.thread-input').forEach(inp => {
        inp.addEventListener('input', () => { drafts[inp.dataset.thread] = inp.value; });
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); send(inp.dataset.thread); }
        });
    });

    app.querySelectorAll('[data-send]').forEach(btn =>
        btn.addEventListener('click', () => send(btn.dataset.send)));

    // restore focus + caret after a re-render so typing is never interrupted
    if (focusedThread) {
        const inp = app.querySelector(`.thread-input[data-thread="${CSS.escape(focusedThread)}"]`);
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
}

let focusedThread = null;

function send(taskId) {
    const app = document.getElementById('app');
    const inp = app.querySelector(`.thread-input[data-thread="${CSS.escape(taskId)}"]`);
    if (!inp || !inp.value.trim()) return;
    const text = inp.value;
    inp.value = '';
    drafts[taskId] = '';
    focusedThread = taskId;
    postComment(taskId, text).catch((e) => {
        console.error('comment post failed', e);
        drafts[taskId] = text;      // hand the text back rather than losing it
        render();
        alert(T().sendFailed);
    });
}

function renderState(title, body) {
    document.getElementById('app').innerHTML = `
        <div class="state"><h2>${esc(title)}</h2><p>${esc(body)}</p></div>`;
}

/* ---------------------------------------------------------------- boot */

const DEMO_COMMENTS = [
    { id: 'dc1', taskId: 'demo-ubo', author: 'hub', text: 'Could you send a certified copy of the second director\'s passport? Notarised scan is enough to file.', createdAt: Date.now() - 2 * 86400000 },
    { id: 'dc2', taskId: 'demo-ubo', author: 'client', text: 'Ordering the notarisation tomorrow — should have it by Thursday.', createdAt: Date.now() - 86400000 }
];

const DEMO = {
    client: 'Acme Ltd',
    from: 'S. Rybalchenko',
    doneDays: 365,
    matters: [
        { title: 'Corporate restructuring', status: 'open', minutes: 1240 },
        { title: 'MiCA licensing — KNF application', status: 'open', minutes: 2310 },
        { title: 'Trademark dispute', status: 'on-hold', minutes: 180 }
    ],
    tasks: [
        { id: 'demo-sha', title: 'Draft shareholders agreement v2', status: 'open', overdue: false, priority: 'high',
          due: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), stuck: null,
          matter: 'Corporate restructuring', minutes: 320, completedAt: null, createdAt: '2026-07-01' },
        { id: 'demo-ubo', title: 'File UBO declaration', status: 'open', overdue: true, priority: 'high',
          due: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
          stuck: 'waiting for a certified passport copy of the second director',
          matter: 'MiCA licensing — KNF application', minutes: 45, completedAt: null, createdAt: '2026-06-20' },
        { id: 'demo-aml', title: 'Review AML policy draft', status: 'open', overdue: false, priority: 'normal',
          due: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10), stuck: null,
          matter: 'MiCA licensing — KNF application', minutes: 150, completedAt: null, createdAt: '2026-07-05' },
        { id: 'demo-res', title: 'Prepare board resolution on share issue', status: 'open', overdue: false, priority: 'low',
          due: null, stuck: 'waiting for the bank to confirm the capital deposit',
          matter: 'Corporate restructuring', minutes: 0, completedAt: null, createdAt: '2026-07-10' },
        { id: 'demo-inc', title: 'Incorporation documents — final signing pack', status: 'done', overdue: false, priority: 'high',
          due: null, stuck: null, matter: 'Corporate restructuring', minutes: 480,
          completedAt: new Date(Date.now() - 5 * 86400000).toISOString(), createdAt: '2026-06-01' },
        { id: 'demo-knf', title: 'Answer KNF pre-filing questionnaire', status: 'done', overdue: false, priority: 'normal',
          due: null, stuck: null, matter: 'MiCA licensing — KNF application', minutes: 610,
          completedAt: new Date(Date.now() - 12 * 86400000).toISOString(), createdAt: '2026-06-10' }
    ]
};

function boot() {
    token = (location.hash || '').replace(/^#/, '').trim();

    if (token === 'demo') {
        current = { data: DEMO, updatedAt: Date.now() };
        commentsOn = true;
        comments = DEMO_COMMENTS;
        render();
        return;
    }

    if (!token || typeof fbDb === 'undefined' || !fbDb) {
        renderState(T().notFoundTitle, T().notFoundBody);
        return;
    }

    fbDb.collection('shares').doc(token).onSnapshot(
        (doc) => {
            if (!doc.exists) { renderState(T().notFoundTitle, T().notFoundBody); return; }
            const raw = doc.data();
            try {
                current = {
                    data: JSON.parse(raw.state),
                    updatedAt: raw.updatedAt || Date.now()
                };
                commentsOn = raw.commentsEnabled === true;
                render();
            } catch (e) {
                console.error('share payload parse failed', e);
                renderState(T().notFoundTitle, T().notFoundBody);
            }
        },
        (err) => {
            console.error('share load failed', err);
            renderState(T().notFoundTitle, T().notFoundBody);
        }
    );

    // Live thread — new replies from either side appear without a refresh.
    fbDb.collection('shares').doc(token).collection('comments')
        .orderBy('createdAt')
        .onSnapshot(
            (snap) => {
                comments = snap.docs.map(d => {
                    const v = d.data();
                    return {
                        id: d.id,
                        taskId: v.taskId || '_general',
                        author: v.author || 'client',
                        text: v.text || '',
                        createdAt: v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : 0
                    };
                });
                if (current) render();
            },
            (err) => console.error('comments load failed', err)
        );
}

window.addEventListener('hashchange', () => location.reload());
boot();
