// ordify.me — App boot + view renderers (Phase 1)
//
// Phase 1 wires up the top-3 hi-fi screens with real Store data:
//   • Today    — ON FIRE band + time-blocks + task rows + AI footer
//   • Capture  — pad + textarea + Parse stub
//   • ⌘L       — global quick-log-call spotlight popover
// AI parsing is stubbed (returns mock detection) — real Anthropic
// integration is Phase 9 per SPEC.

const App = {
    // Sidebar nav — 5 views + clients. Capture lives as ⌘N global.
    // Tasks (02) is a HUB with 3 grouping modes: Flat / By Matter / By Client.
    _nav: [
        { num: '01', view: 'today',     key: 'navToday',    icon: 'today'    },
        { num: '02', view: 'inbox',     key: 'navInbox',    icon: 'inbox'    },
        { num: '03', view: 'calendar',  key: 'navCalendar', icon: 'calendar' },
        { num: '04', view: 'time',      key: 'navTime',     icon: 'time'     },
        { num: '05', view: 'invoices',  key: 'navInvoices', icon: 'invoice'  },
    ],

    currentView: 'today',
    todayMode:  'list',  // 'list' | 'board' — Today's row/card toggle
    inboxMode:  'board', // 'list' | 'board' — Tasks row/card toggle
    inboxGroup: 'flat',  // 'flat' | 'matter' | 'client' — Tasks hub grouping

    init() {
        I18n.init();
        Store.init();

        if (Store.getSetting('theme')) {
            document.documentElement.dataset.theme = Store.getSetting('theme');
        }
        if (Store.getSetting('lang')) I18n.setLang(Store.getSetting('lang'));
        const storedMode = localStorage.getItem('ordify-today-mode');
        if (storedMode === 'list' || storedMode === 'board') this.todayMode = storedMode;
        const storedGroup = localStorage.getItem('ordify-inbox-group');
        if (['flat', 'matter', 'client'].includes(storedGroup)) this.inboxGroup = storedGroup;
        const storedInboxMode = localStorage.getItem('ordify-inbox-mode');
        if (storedInboxMode === 'list' || storedInboxMode === 'board') this.inboxMode = storedInboxMode;

        this.renderSidebar();
        this.bindEvents();
        this.show('today');
        this._syncAiRail();
        window.addEventListener('resize', () => this._syncAiRail());
        window.addEventListener('beforeunload', () => Store.flush());
    },

    // ============================================================
    // SIDEBAR
    // ============================================================
    renderSidebar() {
        const navHost = document.getElementById('nav-views');
        navHost.innerHTML = this._nav.map(n => {
            const count = this._navCount(n.view);
            return `<div class="proj nav-item${this.currentView === n.view ? ' active' : ''}"
                         data-view="${n.view}" role="button" tabindex="0"
                         aria-label="${Dom.escape(I18n.t(n.key))}">
                <span class="proj-num">${n.num}</span>
                <span class="proj-icon">${Icons[n.icon] ? Icons[n.icon](14) : ''}</span>
                <span class="proj-label">${Dom.escape(I18n.t(n.key))}</span>
                <span class="proj-count">${count || ''}</span>
            </div>`;
        }).join('');

        // Clients section — auto-numbered from 08+
        const clients = Store.getClients();
        document.getElementById('clients-count').textContent = clients.length;
        const clientsHost = document.getElementById('clients-list');
        const swatches = ['var(--accent)', 'var(--cobalt)', 'var(--saffron)', 'var(--ink)', 'var(--lime)', 'var(--magenta)'];
        let n = 6; // continues after 5 fixed nav rows
        clientsHost.innerHTML = clients.length === 0
            ? ''
            : clients.map((c, i) => {
                const matters = Store.getMatters(c.id);
                const num = String(n++).padStart(2, '0');
                const industry = c.industry ? ` (${c.industry})` : '';
                return `<div class="proj nav-item" data-action="select-client" data-id="${c.id}"
                             role="button" tabindex="0">
                    <span class="proj-num">${num}</span>
                    <span class="swatch-dot" style="background:${swatches[i % swatches.length]}"></span>
                    <span class="proj-label">${Dom.escape(c.name)}${industry}</span>
                    <span class="proj-count">${matters.length}</span>
                </div>`;
            }).join('');

        // Footer toggles
        document.getElementById('theme-light').classList.toggle('active', (document.documentElement.dataset.theme || 'light') === 'light');
        document.getElementById('theme-dark') .classList.toggle('active',  document.documentElement.dataset.theme === 'dark');
        document.getElementById('lang-en').classList.toggle('active', I18n.lang === 'en');
        document.getElementById('lang-uk').classList.toggle('active', I18n.lang === 'uk');
    },

    _navCount(view) {
        if (view === 'today')    return Store.getTodaysTasks().filter(t => t.status !== 'done').length;
        if (view === 'inbox')    return Store.getTasks().filter(t => t.status !== 'done').length;
        if (view === 'invoices') return Store.getInvoices().length;
        return '';
    },

    // ============================================================
    // EVENTS
    // ============================================================
    bindEvents() {
        // Sidebar nav (delegated)
        document.getElementById('sidebar').addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item[data-view]');
            if (navItem) { this.show(navItem.dataset.view); return; }
        });
        Dom.on('brand-btn', 'click', () => this.show('today'));
        Dom.on('btn-settings', 'click', () => alert('Settings — Phase 10'));
        Dom.on('btn-add-client', 'click', () => {
            const name = prompt('Client name:');
            if (!name?.trim()) return;
            Store.addClient({ name: name.trim() });
            this.renderSidebar();
        });

        // Theme + lang
        Dom.on('theme-light', 'click', () => this.setTheme('light'));
        Dom.on('theme-dark',  'click', () => this.setTheme('dark'));
        Dom.on('lang-en', 'click', () => this.setLang('en'));
        Dom.on('lang-uk', 'click', () => this.setLang('uk'));

        // AI rail expand on click of strip, close on × button
        document.getElementById('ai-rail').addEventListener('click', () => {
            if (!document.body.classList.contains('ai-expanded')) {
                document.body.classList.add('ai-expanded');
            }
        });
        Dom.on('ai-rail-close', 'click', (e) => {
            e.stopPropagation();
            document.body.classList.remove('ai-expanded');
        });

        // ⌘L / Ctrl+L → quick-log-call
        // ⌘N / Ctrl+N → capture view
        // Esc → close any open spotlight
        window.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                this.openLogCall();
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                this.show('capture');
            } else if (e.key === 'Escape') {
                this.closeLogCall();
            }
        });

        // Spotlight popover wiring
        Dom.on('sl-cancel', 'click', () => this.closeLogCall());
        Dom.on('sl-log',    'click', () => this.commitLogCall());
        Dom.on('sl-input',  'input', () => this.parseLogCall());
        Dom.on('sl-input',  'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.commitLogCall();
            }
        });
        // Click on scrim background closes
        document.getElementById('logcall-scrim').addEventListener('click', (e) => {
            if (e.target.id === 'logcall-scrim') this.closeLogCall();
        });
    },

    setTheme(theme) {
        document.documentElement.dataset.theme = theme;
        Store.setSetting('theme', theme);
        this.renderSidebar();
    },
    setLang(lang) {
        I18n.setLang(lang);
        Store.setSetting('lang', lang);
        this.renderSidebar();
        this.show(this.currentView);
    },

    // ============================================================
    // VIEW DISPATCH
    // ============================================================
    show(view) {
        this.currentView = view;
        document.body.className = 'view-' + view;
        if (localStorage.getItem('ordify-ai-rail-hidden') !== '1' && window.innerWidth >= 1200) {
            document.body.classList.add('with-ai-rail');
        }

        const root = document.getElementById('view-root');
        const fn = this['render_' + view];
        if (typeof fn === 'function') fn.call(this, root);
        else root.innerHTML = this._stubView(view);

        // Highlight active nav row
        document.querySelectorAll('#nav-views .nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.view === view);
        });

        // Sync AI rail context label
        const ctx = document.getElementById('ai-rail-context');
        if (ctx) ctx.textContent = '· ' + view;
    },

    _stubView(view) {
        return `<div class="hero">
            <div class="left">
                <span class="eyebrow">VIEW · ${view.toUpperCase()}</span>
                <h1>${view}, <span class="accent">soon.</span></h1>
            </div>
        </div>
        <div style="padding:48px 32px;text-align:center;color:var(--fg-muted);font-family:var(--font-text)">
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:0.18em;margin-bottom:12px;font-weight:600">PHASE 1</div>
            <p style="max-width:48ch;margin:0 auto;line-height:1.5">This view ships in a later phase. Today, Capture and ⌘L log-call are the Phase 1 trio.</p>
        </div>`;
    },

    // ============================================================
    // VIEW: TODAY
    // ============================================================
    render_today(root) {
        const fire = Store.getOnFire();
        const todays = Store.getTodaysTasks();
        const meetings = Store.getTodaysMeetings();

        // Items in ON FIRE band: overdue + due-soon + imminent meetings
        const fireItems = []
            .concat(fire.overdue.map(t => ({ kind: 'overdue', task: t })))
            .concat(fire.dueSoon.map(t => ({ kind: 'due-soon', task: t })))
            .concat(fire.imminentMeetings.map(m => ({ kind: 'meeting', meeting: m })));

        // Today's tasks split by morning/afternoon/done — exclude items already in fire
        const fireTaskIds = new Set([...fire.overdue, ...fire.dueSoon].map(t => t.id));
        const fireMtgIds  = new Set(fire.imminentMeetings.map(m => m.id));
        const morning = [], afternoon = [], done = [];
        for (const t of todays) {
            if (fireTaskIds.has(t.id)) continue;
            if (t.status === 'done') { done.push({ kind: 'task', task: t }); continue; }
            const h = new Date(t.deadline).getHours();
            (h < 13 ? morning : afternoon).push({ kind: 'task', task: t });
        }
        for (const m of meetings) {
            if (fireMtgIds.has(m.id)) continue;
            const h = new Date(m.starts_at).getHours();
            (h < 13 ? morning : afternoon).push({ kind: 'meeting', meeting: m });
        }
        // Sort each band by time
        const byTime = (a, b) => {
            const ax = a.task ? a.task.deadline : a.meeting.starts_at;
            const bx = b.task ? b.task.deadline : b.meeting.starts_at;
            return new Date(ax) - new Date(bx);
        };
        morning.sort(byTime); afternoon.sort(byTime); done.sort(byTime);

        const activeCount = todays.filter(t => t.status !== 'done').length + meetings.length;

        const date = new Date();
        const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }).toUpperCase();

        const isBoard = this.todayMode === 'board';
        const renderBlock = (items, label, time) => {
            if (!items.length) return '';
            const head = `<div class="time-bar"><span>${label} · ${this._pad(items.length)}</span><span>${time}</span></div>`;
            if (isBoard) {
                return head + `<div class="board-grid">${items.map(it => this._renderCard(it)).join('')}</div>`;
            }
            return head + items.map(it => this._renderRow(it)).join('');
        };

        // In board mode, ON FIRE items become a "burning" card-grid block
        // (consistent with the rest), tinted by status colour.
        const renderFire = () => {
            if (!fireItems.length) return '';
            const head = `<div class="fire-head" style="margin:0"><span>● ON FIRE · ${this._pad(fireItems.length)}</span><span class="right">SHIP NOW</span></div>`;
            if (isBoard) {
                return head + `<div class="board-grid fire-grid">${fireItems.map(it => this._renderFireCard(it)).join('')}</div>`;
            }
            return this._renderFireBand(fireItems);
        };

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <span class="eyebrow">VIEW 01 · TODAY · ${dateStr}</span>
                    <h1>today, <span class="accent">focused.</span></h1>
                </div>
                <div class="right">
                    <span class="status-pill"><span class="dot"></span>${activeCount} ACTIVE</span>
                    <div class="mode-toggle" role="group" aria-label="View mode">
                        <button class="${isBoard ? '' : 'active'}" data-mode="list" type="button">▤ List</button>
                        <button class="${isBoard ? 'active' : ''}" data-mode="board" type="button">⊞ Board</button>
                    </div>
                    <button class="btn-hero primary" type="button" data-go="capture">+ Capture</button>
                </div>
            </div>

            ${renderFire()}

            ${renderBlock(morning, 'MORNING', '09:00 — 12:00')}
            ${renderBlock(afternoon, 'AFTERNOON', '13:00 — 18:00')}
            ${done.length ? `<div class="time-bar done"><span>DONE · ${this._pad(done.length)}</span><span>EARLIER TODAY</span></div>` : ''}
            ${done.length ? (isBoard
                ? `<div class="board-grid">${done.map(it => this._renderCard(it)).join('')}</div>`
                : done.map(it => this._renderRow(it)).join('')) : ''}

            ${this._renderAiFooter()}
        `;

        root.querySelectorAll('[data-go="capture"]').forEach(b => b.addEventListener('click', () => this.show('capture')));
        // Mode toggle: list ↔ board
        root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
            const mode = b.dataset.mode;
            if (this.todayMode !== mode) {
                this.todayMode = mode;
                localStorage.setItem('ordify-today-mode', mode);
                this.render_today(root);
            }
        }));
        // Task row interactions — click checkbox cycles status, click body → edit (stub)
        root.addEventListener('click', (e) => {
            const check = e.target.closest('.check[data-task-id]');
            if (check) {
                e.stopPropagation();
                this.cycleTask(check.dataset.taskId);
                return;
            }
        });
    },

    _renderFireCard(it) {
        // Fire-card variant — same shape as a regular card, but tinted by status
        if (it.kind === 'meeting') {
            const m = it.meeting;
            const time = new Date(m.starts_at);
            return `<div class="task-card meeting" data-meeting-id="${m.id}">
                <div class="top">
                    <span>${m.id.toUpperCase()}</span>
                    <span style="color:var(--cobalt);font-weight:700">⏱ IN ${this._minutesUntil(time)}</span>
                </div>
                <div class="title">${Dom.escape(m.title)}</div>
                <div class="ctx">${this._matterContextHtml(m.matterId, m.clientId).replace(/<[^>]+>/g, '')}</div>
                <div class="foot">
                    <span class="badge meet">▸ MEETING</span>
                </div>
            </div>`;
        }
        const t = it.task;
        const cls = it.kind === 'overdue' ? 'is-overdue' : 'is-due-soon';
        const dueText = it.kind === 'overdue'
            ? `⚠ ${this._hoursAgo(new Date(t.deadline))} LATE`
            : `⏱ IN ${this._minutesUntil(new Date(t.deadline))}`;
        const dueColor = it.kind === 'overdue' ? 'var(--vermillion)' : '#8a6500';
        const alarmLabel = it.kind === 'overdue' ? 'OVERDUE' : 'DUE SOON';
        const alarmCls = it.kind === 'overdue' ? 'alarm-solid' : 'alarm-warn';
        return `<div class="task-card ${cls}" data-task-id="${t.id}">
            <div class="top">
                <span>${t.id.toUpperCase()}</span>
                <span style="color:${dueColor};font-weight:700">${dueText}</span>
            </div>
            <div class="title">${Dom.escape(t.title)}</div>
            <div class="ctx">${this._matterContextHtml(t.matterId, t.clientId).replace(/<[^>]+>/g, '')}</div>
            <div class="foot">
                <div class="check ${t.status === 'done' ? 'done' : ''}" data-task-id="${t.id}"></div>
                <span class="badge ${alarmCls}">${alarmLabel}</span>
                ${this._tagBadgesHtml(t.tags)}
            </div>
        </div>`;
    },

    _renderCard(item) {
        if (item.kind === 'meeting') {
            const m = item.meeting;
            return `<div class="task-card meeting" data-meeting-id="${m.id}">
                <div class="top">
                    <span>${m.id.toUpperCase()}</span>
                    <span class="meet-tag">▸ ${this._fmtHM(new Date(m.starts_at))}</span>
                </div>
                <div class="title">${Dom.escape(m.title)}</div>
                <div class="ctx">${this._matterContextHtml(m.matterId, m.clientId).replace(/<[^>]+>/g, '')}</div>
                <div class="foot">
                    <span class="badge meet">▸ MEETING</span>
                </div>
            </div>`;
        }
        const t = item.task;
        const isDone = t.status === 'done';
        const prio = t.priority === 'urgent' ? 'P0' : t.priority === 'high' ? 'P1' : t.priority === 'medium' ? 'P2' : 'P3';
        const showPrio = !isDone && (t.priority === 'urgent' || t.priority === 'high');
        return `<div class="task-card ${isDone ? 'done' : ''}" data-task-id="${t.id}">
            <div class="top">
                <span>${t.id.toUpperCase()}</span>
                <span>${t.deadline ? this._fmtHM(new Date(t.deadline)) : ''}</span>
            </div>
            <div class="title">${Dom.escape(t.title)}</div>
            <div class="ctx">${this._matterContextHtml(t.matterId, t.clientId).replace(/<[^>]+>/g, '')}</div>
            <div class="foot">
                <div class="check ${isDone ? 'done' : ''}" data-task-id="${t.id}"></div>
                ${showPrio ? `<span class="card-prio ${t.priority === 'urgent' ? 'p0' : 'p1'}">${prio}</span>` : '<span></span>'}
                ${this._tagBadgesHtml(t.tags)}
            </div>
        </div>`;
    },

    _renderFireBand(items) {
        const inside = items.map(it => {
            if (it.kind === 'meeting') return this._renderFireRow(it.meeting, 'meeting');
            return this._renderFireRow(it.task, it.kind);
        }).join('');
        return `<div class="fire">
            <div class="fire-head"><span>● ON FIRE · ${this._pad(items.length)}</span><span class="right">SHIP NOW</span></div>
            ${inside}
        </div>`;
    },

    _renderFireRow(item, kind) {
        if (kind === 'meeting') {
            const m = item;
            const time = new Date(m.starts_at);
            const due = `⏱ ${this._fmtHM(time)} · IN ${this._minutesUntil(time)}`;
            return `<div class="fire-row meeting" data-meeting-id="${m.id}">
                <span class="idx">${m.id.toUpperCase()}</span>
                <div class="check"></div>
                <div class="body">
                    <div class="title">${Dom.escape(m.title)}</div>
                    <div class="meta">
                        ${this._matterContextHtml(m.matterId, m.clientId)}
                        <span class="badge meet">▸ MEETING · ${this._minutesBetween(new Date(m.starts_at), new Date(m.ends_at))} MIN</span>
                        ${m.video_url ? '<span class="badge meet">▸ VIDEO</span>' : ''}
                    </div>
                </div>
                <span></span>
                <span class="due">${due}</span>
            </div>`;
        }
        const t = item;
        const cls = kind === 'overdue' ? 'is-overdue' : 'is-due-soon';
        const dueText = kind === 'overdue'
            ? `⚠ ${this._hoursAgo(new Date(t.deadline))} LATE`
            : `⏱ ${this._fmtHM(new Date(t.deadline))} · IN ${this._minutesUntil(new Date(t.deadline))}`;
        const alarmBadge = kind === 'overdue'
            ? '<span class="badge alarm-solid">OVERDUE</span>'
            : '<span class="badge alarm-warn">DUE SOON</span>';
        return `<div class="fire-row ${cls}" data-task-id="${t.id}">
            <span class="idx">${t.id.toUpperCase()}</span>
            <div class="check ${t.status === 'done' ? 'done' : ''}" data-task-id="${t.id}"></div>
            <div class="body">
                <div class="title">${Dom.escape(t.title)}</div>
                <div class="meta">
                    ${this._matterContextHtml(t.matterId, t.clientId)}
                    ${alarmBadge}
                    ${this._tagBadgesHtml(t.tags)}
                </div>
            </div>
            <span></span>
            <span class="due">${dueText}</span>
        </div>`;
    },

    _renderRow(item) {
        if (item.kind === 'meeting') {
            const m = item.meeting;
            return `<div class="row is-meeting" data-meeting-id="${m.id}">
                <span class="idx">${m.id.toUpperCase()}</span>
                <div class="check"></div>
                <div class="body">
                    <div class="title">${Dom.escape(m.title)}</div>
                    <div class="meta">${this._matterContextHtml(m.matterId, m.clientId)}<span class="badge meet">▸ MEETING</span></div>
                </div>
                <div class="right-cluster">
                    <span class="due">${this._fmtHM(new Date(m.starts_at))}</span>
                </div>
            </div>`;
        }
        const t = item.task;
        const isDone = t.status === 'done';
        const prio = t.priority === 'urgent' ? 'P0' : t.priority === 'high' ? 'P1' : t.priority === 'medium' ? 'P2' : 'P3';
        const prioCls = t.priority === 'urgent' ? 'alarm-solid' : t.priority === 'high' ? 'tag-corp' : '';
        const showPrio = !isDone && (t.priority === 'urgent' || t.priority === 'high');
        return `<div class="row ${isDone ? 'done' : ''}" data-task-id="${t.id}">
            <span class="idx">${t.id.toUpperCase()}</span>
            <div class="check ${isDone ? 'done' : ''}" data-task-id="${t.id}"></div>
            <div class="body">
                <div class="title">${Dom.escape(t.title)}</div>
                ${!isDone ? `<div class="meta">${this._matterContextHtml(t.matterId, t.clientId)}${this._tagBadgesHtml(t.tags)}</div>` : ''}
            </div>
            <div class="right-cluster">
                ${showPrio ? `<span class="badge ${prioCls}" style="font-family:var(--font-mono);font-size:9px;padding:3px 6px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;border:1px solid ${t.priority==='urgent'?'var(--vermillion)':'var(--ink)'};${t.priority==='urgent'?'background:var(--vermillion);color:var(--bg)':'background:var(--ink);color:var(--bg)'}">${prio}</span>` : ''}
                <span class="due">${t.deadline ? this._fmtHM(new Date(t.deadline)) : ''}</span>
            </div>
        </div>`;
    },

    _renderAiFooter() {
        // Compute scope-warning if any subscription matter > 80%
        const matters = Store.getMatters().filter(m => m.billing?.mode === 'subscription');
        for (const m of matters) {
            const scope = Store.getSubscriptionScope(m.id);
            if (!scope || !scope.included) continue;
            const pct = Math.round((scope.used / scope.included) * 100);
            if (pct >= 50) {
                const client = Store.getClient(m.clientId);
                return `<div class="ai-footer">
                    <span class="mark">AI ▸</span>
                    <span class="msg">${Dom.escape(client?.name || '')} subscription used <strong>${scope.used.toFixed(1)}h / ${scope.included}h</strong> this period — at ${pct}%. Want me to prep the invoice draft now?</span>
                    <button class="btn-fmin accent" type="button">Apply</button>
                    <button class="btn-fmin" type="button">Dismiss</button>
                </div>`;
            }
        }
        // Fallback friendly footer
        return `<div class="ai-footer">
            <span class="mark">AI ▸</span>
            <span class="msg">Open laptop → focus on what burns first. Type <strong>⌘N</strong> to capture · <strong>⌘L</strong> to log a call.</span>
            <button class="btn-fmin" type="button">Got it</button>
        </div>`;
    },

    cycleTask(id) {
        const t = Store.getTask(id);
        if (!t) return;
        const next = t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'todo';
        Store.updateTask(id, { status: next });
        // Re-render whatever view is current
        const root = document.getElementById('view-root');
        const fn = this['render_' + this.currentView];
        if (typeof fn === 'function') fn.call(this, root);
        this.renderSidebar();
    },

    // ============================================================
    // VIEW: TASKS (HUB — flat / by matter / by client)
    // ============================================================
    render_inbox(root) {
        const allTasks = Store.getTasks().filter(t => t.status !== 'done');
        const total = allTasks.length;
        const group = this.inboxGroup;

        const isBoard = this.inboxMode === 'board';
        const groupBtn = (key, label) => `<button class="${group === key ? 'active' : ''}" data-group="${key}" type="button">${label}</button>`;
        const modeBtn  = (key, label) => `<button class="${this.inboxMode === key ? 'active' : ''}" data-imode="${key}" type="button">${label}</button>`;

        let body = '';
        if (group === 'flat') body = this._inboxFlat(allTasks);
        else if (group === 'matter') body = this._inboxByMatter(allTasks);
        else if (group === 'client') body = this._inboxByClient(allTasks);

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <span class="eyebrow">VIEW 02 · TASKS · ${total} OPEN</span>
                    <h1>all your <span class="accent">work.</span></h1>
                </div>
                <div class="right">
                    <div class="mode-toggle" role="group" aria-label="Group by">
                        ${groupBtn('flat',   '▤ Flat')}
                        ${groupBtn('matter', '⊟ By Matter')}
                        ${groupBtn('client', '👤 By Client')}
                    </div>
                    <div class="mode-toggle" role="group" aria-label="View mode">
                        ${modeBtn('list',  '▤ List')}
                        ${modeBtn('board', '⊞ Board')}
                    </div>
                    <button class="btn-hero primary" type="button" data-go="capture">+ Capture</button>
                </div>
            </div>
            ${body}
        `;

        // Toggle group mode
        root.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => {
            const g = b.dataset.group;
            if (this.inboxGroup !== g) {
                this.inboxGroup = g;
                localStorage.setItem('ordify-inbox-group', g);
                this.render_inbox(root);
            }
        }));
        // Toggle list/board mode
        root.querySelectorAll('[data-imode]').forEach(b => b.addEventListener('click', () => {
            const m = b.dataset.imode;
            if (this.inboxMode !== m) {
                this.inboxMode = m;
                localStorage.setItem('ordify-inbox-mode', m);
                this.render_inbox(root);
            }
        }));
        root.querySelectorAll('[data-go="capture"]').forEach(b => b.addEventListener('click', () => this.show('capture')));
        root.addEventListener('click', (e) => {
            const check = e.target.closest('.check[data-task-id]');
            if (check) {
                e.stopPropagation();
                this.cycleTask(check.dataset.taskId);
            }
        });
    },

    /** Render a list of tasks in the inbox-current mode (list or board). */
    _inboxRenderTasks(tasks) {
        if (this.inboxMode === 'board') {
            return `<div class="board-grid">${tasks.map(t => this._renderCard({ kind: 'task', task: t })).join('')}</div>`;
        }
        return tasks.map(t => this._renderRow({ kind: 'task', task: t })).join('');
    },

    _inboxFlat(tasks) {
        const sorted = tasks.slice().sort((a, b) => {
            // urgent first, then deadline asc, then title
            const pri = { urgent: 0, high: 1, medium: 2, low: 3 };
            if (pri[a.priority] !== pri[b.priority]) return pri[a.priority] - pri[b.priority];
            const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
            const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
            return ad - bd;
        });
        if (!sorted.length) return this._inboxEmpty();
        return this._inboxRenderTasks(sorted);
    },

    _inboxByMatter(tasks) {
        const matters = Store.getMatters();
        const buckets = matters.map(m => ({
            matter: m,
            client: Store.getClient(m.clientId),
            tasks: tasks.filter(t => t.matterId === m.id),
        })).filter(b => b.tasks.length);

        const orphanByMatter = tasks.filter(t => !t.matterId && t.clientId);
        const orphanByMatterByClient = {};
        for (const t of orphanByMatter) {
            (orphanByMatterByClient[t.clientId] = orphanByMatterByClient[t.clientId] || []).push(t);
        }
        const fullOrphans = tasks.filter(t => !t.matterId && !t.clientId);

        if (!buckets.length && !orphanByMatter.length && !fullOrphans.length) return this._inboxEmpty();

        let html = '';
        for (const b of buckets) html += this._matterCard(b.matter, b.client, b.tasks);
        for (const cid of Object.keys(orphanByMatterByClient)) {
            const c = Store.getClient(cid);
            html += this._orphanBlock(`NO MATTER · ${c?.name || ''}`, orphanByMatterByClient[cid]);
        }
        if (fullOrphans.length) html += this._orphanBlock('NO MATTER · NO CLIENT', fullOrphans);
        return html;
    },

    _matterCard(matter, client, tasks) {
        const mode = matter.billing?.mode || 'hourly';
        const tagCls = mode === 'subscription' ? 'sub' : mode === 'fixed' ? 'fix' : 'hrly';
        const tagLabel = mode === 'subscription' ? 'SUB' : mode === 'fixed' ? 'FIX' : 'HRLY';

        // Build metadata cells per billing mode
        let metaCells = '';
        let progressBar = '';
        if (mode === 'subscription') {
            const scope = Store.getSubscriptionScope(matter.id);
            const used = scope ? scope.used : 0;
            const incl = scope ? scope.included : 0;
            const pct = incl ? Math.round((used / incl) * 100) : 0;
            const pctCls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
            const valCls = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
            metaCells = `
                <div><span class="k">Scope</span><span class="v ${valCls}">${used.toFixed(1)}h / ${incl}h</span></div>
                <div><span class="k">Period fee</span><span class="v">€${matter.billing.period_fee || 0}/${matter.billing.period || 'mo'}</span></div>
                <div><span class="k">Used</span><span class="v ${valCls}">${pct}%</span></div>
            `;
            progressBar = `<div class="matter-progress"><div class="bar ${pctCls}" style="width:${Math.min(100, pct)}%"></div></div>`;
        } else if (mode === 'fixed') {
            const total = matter.billing.fixed_amount || 0;
            const dl = matter.billing.deadline || matter.deadline;
            const daysLeft = dl ? Math.round((new Date(dl).getTime() - Date.now()) / 86400000) : null;
            const dlCls = daysLeft != null && daysLeft < 0 ? 'danger' : daysLeft != null && daysLeft <= 3 ? 'warn' : 'ok';
            const ms = matter.billing.milestones || [];
            const done = ms.filter(m => m.status === 'done').length;
            metaCells = `
                <div><span class="k">Amount</span><span class="v">€${total}</span></div>
                <div><span class="k">Deadline</span><span class="v ${dlCls}">${dl ? this._fmtDate(new Date(dl)) : '—'}${daysLeft != null ? ' · ' + (daysLeft < 0 ? Math.abs(daysLeft)+'d late' : daysLeft+'d') : ''}</span></div>
                ${ms.length ? `<div><span class="k">Milestones</span><span class="v">${done}/${ms.length}</span></div>` : ''}
            `;
            if (ms.length) {
                const pct = Math.round((done / ms.length) * 100);
                progressBar = `<div class="matter-progress"><div class="bar" style="width:${pct}%"></div></div>`;
            }
        } else {
            // hourly
            const logs = Store.getTimeLogsForMatter(matter.id);
            const hours = logs.reduce((s, l) => s + (l.hours || 0), 0);
            const rate = matter.billing.hourly_rate || 0;
            metaCells = `
                <div><span class="k">Rate</span><span class="v">€${rate}/h</span></div>
                <div><span class="k">Logged</span><span class="v">${hours.toFixed(1)}h</span></div>
                <div><span class="k">Pending</span><span class="v">€${(hours * rate).toFixed(0)}</span></div>
            `;
        }

        return `<div class="matter-card" data-matter-id="${matter.id}">
            <div class="matter-card-head">
                <span class="client">${Dom.escape(client?.name || 'NO CLIENT')}</span>
                <span class="arrow">→</span>
                <span class="title">${Dom.escape(matter.name)}</span>
                <span class="billing-tag ${tagCls}">${tagLabel}</span>
            </div>
            <div class="matter-card-meta">
                ${metaCells}
                <div><span class="k">Open</span><span class="v">${this._pad(tasks.length)}</span></div>
            </div>
            ${progressBar}
            <div class="matter-card-body">
                ${this._inboxRenderTasks(tasks)}
            </div>
        </div>`;
    },

    _inboxByClient(tasks) {
        const clients = Store.getClients();
        const clientCards = [];
        for (const c of clients) {
            const cTasks = tasks.filter(t => t.clientId === c.id || (t.matterId && Store.getMatter(t.matterId)?.clientId === c.id));
            if (!cTasks.length) continue;
            clientCards.push(this._clientCard(c, cTasks));
        }
        const fullOrphans = tasks.filter(t => !t.clientId && !t.matterId);
        let html = clientCards.join('');
        if (fullOrphans.length) html += this._orphanBlock('NO CLIENT (orphan inbox)', fullOrphans);
        if (!html) return this._inboxEmpty();
        return html;
    },

    _clientCard(client, cTasks) {
        const matters = Store.getMatters(client.id);
        const activeMatters = matters.filter(m => m.status === 'active');
        const mattersWithTasks = matters.filter(m => cTasks.some(t => t.matterId === m.id));
        const noMatterTasks = cTasks.filter(t => !t.matterId);

        // Stats
        const subMatters = matters.filter(m => m.billing?.mode === 'subscription');
        const fixMatters = matters.filter(m => m.billing?.mode === 'fixed');
        const subUsed = subMatters.reduce((s, m) => {
            const sc = Store.getSubscriptionScope(m.id);
            return s + (sc ? sc.used : 0);
        }, 0);
        const subIncl = subMatters.reduce((s, m) => s + (m.billing?.hours_included || 0), 0);
        const fixTotal = fixMatters.reduce((s, m) => s + (m.billing?.fixed_amount || 0), 0);

        const swatchByIndustry = {
            'IT': 'var(--accent)',
            'Crypto': 'var(--saffron)',
            'B2B-Trade': 'var(--cobalt)',
            'Other': 'var(--ink)',
        }[client.industry] || 'var(--fg-faint)';

        const subRows = mattersWithTasks.map(m => {
            const mTasks = cTasks.filter(t => t.matterId === m.id);
            const mode = m.billing?.mode || 'hourly';
            const tagCls = mode === 'subscription' ? 'sub' : mode === 'fixed' ? 'fix' : 'hrly';
            const tag = this._matterBillingTag(m);
            return `<div class="matter-sub">
                <div class="matter-sub-head" data-drill-matter="${m.id}">
                    <span class="marker">▸</span>
                    <span class="name">${Dom.escape(m.name)}</span>
                    <span class="tag ${tagCls}">${tag}</span>
                </div>
                <div class="matter-sub-body">
                    ${this._inboxRenderTasks(mTasks)}
                </div>
            </div>`;
        }).join('');

        const noMatterBlock = noMatterTasks.length ? `<div class="matter-sub">
            <div class="matter-sub-head">
                <span class="marker">▸</span>
                <span class="name">No matter (orphan)</span>
                <span class="tag" style="color:var(--vermillion)">${this._pad(noMatterTasks.length)}</span>
            </div>
            <div class="matter-sub-body">
                ${this._inboxRenderTasks(noMatterTasks)}
            </div>
        </div>` : '';

        return `<div class="client-card" data-drill-client="${client.id}">
            <div class="client-card-head">
                <span class="swatch" style="background:${swatchByIndustry}"></span>
                <span class="name">${Dom.escape(client.name)}</span>
                <span class="industry">${Dom.escape(client.industry || 'OTHER')}</span>
                <span class="contact">${Dom.escape(client.email || '')}</span>
            </div>
            <div class="client-card-stats">
                <div><span class="k">Active matters</span><span class="v">${this._pad(activeMatters.length)}</span></div>
                <div><span class="k">Open tasks</span><span class="v accent">${this._pad(cTasks.length)}</span></div>
                ${subMatters.length ? `<div><span class="k">Subscription scope</span><span class="v">${subUsed.toFixed(1)}h / ${subIncl}h</span></div>` : ''}
                ${fixMatters.length ? `<div><span class="k">Fixed in flight</span><span class="v">€${fixTotal}</span></div>` : ''}
            </div>
            <div class="client-card-body">
                ${subRows}
                ${noMatterBlock}
            </div>
        </div>`;
    },

    _orphanBlock(label, tasks) {
        return `<div class="matter-card" style="border-color:var(--vermillion);border-left-width:3px">
            <div class="matter-card-head">
                <span class="title" style="color:var(--vermillion)">${Dom.escape(label)}</span>
                <span class="billing-tag" style="margin-left:auto;color:var(--vermillion)">ORPHAN</span>
            </div>
            <div class="matter-card-body">
                ${this._inboxRenderTasks(tasks)}
            </div>
        </div>`;
    },

    _inboxGroupHead(label, count, drillId, drillType) {
        const drill = drillId ? `data-drill-${drillType || 'matter'}="${drillId}"` : '';
        return `<div class="time-bar inbox-head" ${drill}>
            <span>${Dom.escape(label)}</span>
            <span>${this._pad(count)} ${count === 1 ? 'TASK' : 'TASKS'}</span>
        </div>`;
    },
    _matterHeadLabel(matter, client) {
        const billingTag = matter.billing?.mode ? ` · ${matter.billing.mode.toUpperCase()}` : '';
        return `${client?.name?.toUpperCase() || 'NO CLIENT'} → ${matter.name.toUpperCase()}${billingTag}`;
    },
    _matterBillingTag(matter) {
        if (!matter.billing?.mode) return '';
        if (matter.billing.mode === 'subscription') {
            const scope = Store.getSubscriptionScope(matter.id);
            return scope ? `SUB · ${scope.used.toFixed(1)}H / ${scope.included}H` : 'SUB';
        }
        if (matter.billing.mode === 'fixed') return `FIXED €${matter.billing.fixed_amount || ''}`;
        if (matter.billing.mode === 'hourly') return `HOURLY €${matter.billing.hourly_rate || ''}/H`;
        return matter.billing.mode.toUpperCase();
    },
    _inboxEmpty() {
        return `<div style="padding:64px 32px;text-align:center;color:var(--fg-muted);font-family:var(--font-text)">
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:0.18em;margin-bottom:12px;font-weight:600">INBOX EMPTY</div>
            <p style="max-width:48ch;margin:0 auto;line-height:1.5">No open tasks. Type ⌘N to capture something.</p>
        </div>`;
    },

    // ============================================================
    // VIEW: CAPTURE
    // ============================================================
    render_capture(root) {
        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <span class="eyebrow">01 · CAPTURE</span>
                    <h1>catch the <span class="accent">thought.</span></h1>
                </div>
                <div class="right">
                    <a href="#" class="quiet-link" data-action="recents">↓ Recent</a>
                    <span class="quiet-dot">·</span>
                    <span class="quiet-link" style="color:var(--fg-faint)">⌘N</span>
                </div>
            </div>
            <div class="capture-frame">
                <div class="pad">
                    <textarea class="pad-input" id="cap-text"
                        placeholder="Maria called about SAFT review — wants it by Friday, not next week. Add a slide on pricing tiers · cobalt accent. Loop in Sam for legal review before send."
                        autofocus></textarea>
                    <div class="pad-foot">
                        <div class="grow"></div>
                        <button class="btn-pad icon" type="button" aria-label="Voice input" id="cap-mic">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="1" width="6" height="11" rx="3"/>
                                <path d="M19 10v1a7 7 0 01-14 0v-1M12 18.5v3.5M8 22h8"/>
                            </svg>
                        </button>
                        <button class="btn-pad primary" type="button" id="cap-parse">▸ Parse <span class="kbd-inline">⏎</span></button>
                    </div>
                </div>
            </div>
        `;
        Dom.on('cap-parse', 'click', () => this.parseCapture());
        Dom.on('cap-text', 'keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.parseCapture();
            }
        });
        setTimeout(() => document.getElementById('cap-text')?.focus(), 50);
    },

    parseCapture() {
        const txt = document.getElementById('cap-text')?.value.trim();
        if (!txt) {
            alert('Type something to parse.');
            return;
        }
        // Phase 1 stub: pretend AI parsed it as one task on inbox
        // Phase 9: real Anthropic call returns structured action(s)
        const t = Store.addTask({
            title: txt.slice(0, 120),
            matterId: null, clientId: null,
            priority: 'medium', status: 'todo',
        });
        alert(`Captured (Phase 1 stub):\n\n→ Task: "${t.title}"\n\nIn Phase 9 this will go through AI Preview Modal\nwith proper structuring.`);
        document.getElementById('cap-text').value = '';
        this.show('today');
    },

    // ============================================================
    // QUICK-LOG-CALL — global ⌘L spotlight popover
    // ============================================================
    openLogCall() {
        const scrim = document.getElementById('logcall-scrim');
        scrim.hidden = false;
        document.getElementById('sl-input').value = '';
        document.getElementById('sl-parse').hidden = true;
        document.getElementById('sl-hint').textContent = 'Type to start · Enter to log';
        setTimeout(() => document.getElementById('sl-input').focus(), 50);
    },
    closeLogCall() {
        const scrim = document.getElementById('logcall-scrim');
        if (scrim) scrim.hidden = true;
    },
    parseLogCall() {
        const txt = document.getElementById('sl-input').value.trim();
        const parseBlock = document.getElementById('sl-parse');
        const fields = document.getElementById('sl-fields');
        const hint = document.getElementById('sl-hint');
        if (!txt) {
            parseBlock.hidden = true;
            hint.textContent = 'Type to start · Enter to log';
            return;
        }
        // Stub parser: detect a known client name + a duration "Nmin/Nm"
        const clients = Store.getClients();
        let matchClient = null;
        for (const c of clients) {
            const first = c.name.toLowerCase().split(/\s+/)[0];
            if (txt.toLowerCase().includes(first)) { matchClient = c; break; }
        }
        const durMatch = txt.match(/(\d+)\s*(?:m|min|m\b|хв)/i);
        const duration = durMatch ? parseInt(durMatch[1], 10) : 12;

        const matter = matchClient ? Store.getMatters(matchClient.id)[0] : null;
        const topic  = txt.replace(/^[\w]+\s+/, '').replace(/\d+\s*(min|m|хв)/i, '').trim() || '(no topic)';

        // Tag swatch by industry
        const indColor = matchClient ? (
            matchClient.industry === 'Crypto' ? 'var(--saffron)' :
            matchClient.industry === 'IT' ? 'var(--accent)' :
            matchClient.industry === 'B2B-Trade' ? 'var(--cobalt)' : 'var(--ink)'
        ) : 'var(--fg-faint)';

        const billPill = matter && matter.billing?.mode === 'subscription'
            ? '<span class="pill">SUBSCRIPTION</span>'
            : matter && matter.billing?.mode === 'fixed' ? '<span class="pill">FIXED</span>'
            : matter && matter.billing?.mode === 'hourly' ? '<span class="pill">HOURLY</span>'
            : '';

        const scope = matter ? Store.getSubscriptionScope(matter.id) : null;
        const scopeStr = scope
            ? `counts toward scope (${scope.used.toFixed(1)}h / ${scope.included}h → ${(scope.used + duration/60).toFixed(1)}h / ${scope.included}h)`
            : 'billable';

        fields.innerHTML = `
            <span class="k">CLIENT</span>
            <span class="v">${matchClient
                ? `<span class="swatch-dot" style="background:${indColor}"></span>${Dom.escape(matchClient.name)}${matchClient.industry ? ` · ${matchClient.industry}` : ''}`
                : '<span class="muted">(not detected — type a client name)</span>'}</span>

            <span class="k">MATTER</span>
            <span class="v">${matter ? Dom.escape(matter.name) : '<span class="muted">(no matter)</span>'}${billPill}</span>

            <span class="k">DURATION</span>
            <span class="v">${duration} min</span>

            <span class="k">TOPIC</span>
            <span class="v">${Dom.escape(topic)}</span>

            <span class="k">BILLABLE</span>
            <span class="v muted">${scopeStr}</span>
        `;
        parseBlock.hidden = false;
        hint.textContent = matchClient ? 'Press Enter to log' : 'Add client name · Enter to log';

        // Stash parsed result for commit
        this._pendingLog = matchClient && matter ? {
            taskId: null,
            matterId: matter.id,
            clientId: matchClient.id,
            duration, topic,
        } : null;
    },
    commitLogCall() {
        const p = this._pendingLog;
        if (!p) {
            alert('Couldn\'t parse — try: "maria 12min EU stablecoin"');
            return;
        }
        // Auto-create a stub task on the matter, link the timelog to it
        const t = Store.addTask({
            matterId: p.matterId, clientId: p.clientId,
            title: 'Call · ' + p.topic,
            status: 'done', priority: 'medium',
            tags: [],
        });
        Store.addTimeLog({
            taskId: t.id, matterId: p.matterId,
            hours: p.duration / 60,
            description: p.topic,
            source: 'quick-call',
            billable: true,
        });
        this._pendingLog = null;
        this.closeLogCall();
        // Toast (Phase 1: alert stub)
        alert(`✓ Logged ${p.duration} min — ${p.topic}`);
        this.show(this.currentView);
        this.renderSidebar();
    },

    // ============================================================
    // HELPERS
    // ============================================================
    _pad(n) { return String(n).padStart(2, '0'); },
    _fmtHM(d) { return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); },
    _fmtDate(d) { return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }); },
    _minutesUntil(d) {
        const m = Math.round((d.getTime() - Date.now()) / 60000);
        if (m < 0) return Math.abs(m) + ' MIN AGO';
        if (m < 60) return m + ' MIN';
        const h = Math.floor(m / 60); const rem = m % 60;
        return rem ? `${h}H ${rem}M` : `${h}H`;
    },
    _hoursAgo(d) {
        const ms = Date.now() - d.getTime();
        const h = Math.round(ms / 3600000);
        return h + 'H';
    },
    _minutesBetween(a, b) {
        return Math.round((b.getTime() - a.getTime()) / 60000);
    },
    _matterContextHtml(matterId, clientId) {
        const matter = matterId ? Store.getMatter(matterId) : null;
        const client = clientId ? Store.getClient(clientId) : (matter ? Store.getClient(matter.clientId) : null);
        const parts = [];
        if (client) parts.push(Dom.escape(client.name));
        if (matter) parts.push(Dom.escape(matter.name));
        return parts.length ? `<span>${parts.join(' → ')}</span>` : '<span style="color:var(--fg-faint)">INBOX</span>';
    },
    _tagBadgesHtml(tagIds) {
        if (!tagIds || !tagIds.length) return '';
        const cls = {
            corporate: 'tag-corp',
            crypto: 'tag-crypto',
            research: 'tag-research',
            personal: 'tag-personal',
            billable: 'bill',
            legal: '',
            meeting: 'meet',
        };
        return tagIds.slice(0, 3).map(id => {
            const c = cls[id] || '';
            return `<span class="badge ${c}">${id.toUpperCase()}</span>`;
        }).join('');
    },

    // ============================================================
    // AI RAIL VISIBILITY
    // ============================================================
    _syncAiRail() {
        const wide = window.innerWidth >= 1200;
        const userHidden = localStorage.getItem('ordify-ai-rail-hidden') === '1';
        document.body.classList.toggle('with-ai-rail', wide && !userHidden);
    },
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
