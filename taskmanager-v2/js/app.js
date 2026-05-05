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
        { num: '06', view: 'reports',   key: 'navReports',  icon: 'time'     },
        // Mail no longer surfaced in nav — Gmail-extraction is a Today-plate
        // and a `g m` hotkey escape-hatch. render_mail kept for that hatch.
    ],

    currentView: 'today',
    todayMode:  'list',   // 'list' | 'board' — Today's row/card toggle
    inboxMode:  'table',  // 'list' | 'board' | 'table' — Tasks render mode
    inboxGroup: 'flat',   // 'flat' | 'matter' | 'client' — Tasks hub grouping (ignored in table mode)
    inboxSort:  { col: 'client', dir: 'asc' },  // table-mode sort spec
    inboxShowDone: false,                        // toggle to include done tasks in views
    calCursor:  null,     // ISO string — anchor date (month / week / day)
    calMode:    'month',  // 'month' | 'week' | 'day'
    invoiceExpandedId: null,  // which invoice row is expanded inline
    currentMatterId: null,    // matter id when view='matter'
    currentClientId: null,    // client id when view='client'
    _cursorTaskId: null,      // keyboard navigation cursor (j/k)
    reportPeriod: 'week',     // day | week | month | quarter | year

    init() {
        I18n.init();
        Store.init();
        Store.purgeOldTrash();   // drops anything past 30-day window

        if (Store.getSetting('theme')) {
            document.documentElement.dataset.theme = Store.getSetting('theme');
        }
        if (Store.getSetting('lang')) I18n.setLang(Store.getSetting('lang'));
        const storedMode = localStorage.getItem('ordify-today-mode');
        if (storedMode === 'list' || storedMode === 'board') this.todayMode = storedMode;
        const storedGroup = localStorage.getItem('ordify-inbox-group');
        if (['flat', 'matter', 'client'].includes(storedGroup)) this.inboxGroup = storedGroup;
        const storedInboxMode = localStorage.getItem('ordify-inbox-mode');
        if (['list', 'board', 'table'].includes(storedInboxMode)) this.inboxMode = storedInboxMode;
        try {
            const sortRaw = localStorage.getItem('ordify-inbox-sort');
            if (sortRaw) {
                const s = JSON.parse(sortRaw);
                if (s && s.col && (s.dir === 'asc' || s.dir === 'desc')) this.inboxSort = s;
            }
        } catch (_) { /* ignore */ }
        const storedCalMode = localStorage.getItem('ordify-cal-mode');
        if (['day', 'week', 'month'].includes(storedCalMode)) this.calMode = storedCalMode;

        this.renderSidebar();
        this.bindEvents();
        this._bindInlineEdit();
        this._bindBulkActions();
        this._bindDragDrop();
        this._bindUniversalLinks();
        this.Timer.init(this);
        this.Omni.init(this);
        this.OmniK.init(this);
        this.Notify.init(this);
        this.Edit.init();
        this.Setup.init(this);
        this._bindOnlineState();
        this.show('today');
        // First-run wizard if anything is missing (Anthropic key, profile name)
        if (this.Setup.needed()) this.Setup.open();
        this._syncAiRail();
        window.addEventListener('resize', () => this._syncAiRail());
        window.addEventListener('beforeunload', () => Store.flush());
    },

    // ============================================================
    // TIMER — drives the global active-strip + per-task ▶ buttons
    // ============================================================
    Timer: {
        _tickHandle: null,
        _app: null,

        init(app) {
            this._app = app;
            // Stop button
            document.getElementById('active-strip-stop')
                ?.addEventListener('click', () => this.stop());
            // Assign link — focus omni + prefill "assign " (Lovable channel)
            document.getElementById('active-strip-assign')
                ?.addEventListener('click', () => {
                    App.Omni.focus();
                    if (App.Omni._input) {
                        App.Omni._input.value = 'assign ';
                        App.Omni._input.setSelectionRange(7, 7);
                        App.Omni._updateIntentLabel();
                    }
                });
            // Delegated ▶ click — works for any current/future view
            document.getElementById('view-root')
                ?.addEventListener('click', (e) => {
                    const btn = e.target.closest('.play-mini[data-task-id]');
                    if (!btn) return;
                    e.stopPropagation();
                    e.preventDefault();
                    this.toggle(btn.dataset.taskId);
                });
            // Initial render (covers re-load while a timer was running)
            this.render();
        },

        toggle(taskId) {
            const cur = Store.getTimer();
            if (cur && cur.taskId === taskId) {
                this.stop();
            } else {
                Store.startTimer({ taskId });
                this.render();
                if (this._app.currentView) this._app.show(this._app.currentView);
            }
        },

        start({ taskId = null, matterId = null, note = '' } = {}) {
            Store.startTimer({ taskId, matterId, note });
            this.render();
            if (this._app.currentView) this._app.show(this._app.currentView);
        },

        stop() {
            const log = Store.stopTimer();
            this.render();
            if (this._app.currentView) this._app.show(this._app.currentView);
            // Confirm where the time went so the user sees the matter/client attribution.
            if (log) {
                const matter = log.matterId ? Store.getMatter(log.matterId) : null;
                const client = matter?.clientId ? Store.getClient(matter.clientId) : null;
                const total = Math.round((log.hours || 0) * 60);
                const hh = Math.floor(total / 60), mm = total % 60;
                const dur = `${hh}:${String(mm).padStart(2, '0')}`;
                let where = '';
                if (matter) where += ` → ${matter.name || ''}`;
                if (client) where += ` · ${client.name || ''}`;
                if (!matter && !client) where = ' · unassigned';
                App.Omni._flash(`logged ${dur}${where}`);
            } else {
                App.Omni._flash('timer stopped · under 1 min');
            }
            return log;
        },

        render() {
            const strip = document.getElementById('active-strip');
            const t = Store.getTimer();
            if (!t) {
                strip.hidden = true;
                this._stopTick();
                return;
            }
            strip.hidden = false;
            const what = document.getElementById('active-strip-what');
            const assign = document.getElementById('active-strip-assign');
            const task = t.taskId ? Store.getTask(t.taskId) : null;
            const matter = t.matterId ? Store.getMatter(t.matterId) : null;
            if (task) {
                const ctx = matter ? ` · ${matter.title || matter.name || ''}` : '';
                what.textContent = (task.title || task.name || 'task') + ctx;
                what.classList.add('assigned');
                if (assign) assign.hidden = true;
            } else if (matter) {
                what.textContent = matter.title || matter.name || 'matter';
                what.classList.add('assigned');
                if (assign) assign.hidden = true;
            } else {
                what.textContent = t.note ? `unassigned · ${t.note}` : 'unassigned';
                what.classList.remove('assigned');
                if (assign) assign.hidden = false;
            }
            this._renderClock();
            this._startTick();
        },

        _renderClock() {
            const t = Store.getTimer();
            if (!t) return;
            const elapsed = Date.now() - new Date(t.started_at).getTime();
            const s = Math.max(0, Math.floor(elapsed / 1000));
            const hh = String(Math.floor(s / 3600)).padStart(2, '0');
            const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
            const ss = String(s % 60).padStart(2, '0');
            document.getElementById('active-strip-clock').textContent = `${hh}:${mm}:${ss}`;
            const todayClock = document.getElementById('today-running-clock');
            if (todayClock) todayClock.textContent = `${hh}:${mm}:${ss}`;
            // Live update of the sidebar Time nav count (lightweight — updates only that span)
            App._updateTimeNavCount();
        },

        _startTick() {
            if (this._tickHandle) return;
            this._tickHandle = setInterval(() => this._renderClock(), 1000);
        },
        _stopTick() {
            if (this._tickHandle) { clearInterval(this._tickHandle); this._tickHandle = null; }
        },

        /** Helper for renderers — returns the SVG-button HTML for a task row. */
        playButtonHtml(taskId) {
            const t = Store.getTimer();
            const isRunning = !!(t && t.taskId === taskId);
            const icon = isRunning
                ? '<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><rect x="1.5" y="1" width="1.6" height="6"/><rect x="4.9" y="1" width="1.6" height="6"/></svg>'
                : '<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><polygon points="1.5,0.7 7,4 1.5,7.3"/></svg>';
            const cls = 'play-mini' + (isRunning ? ' is-running' : '');
            const label = isRunning ? 'Pause timer' : 'Start timer';
            return `<button type="button" class="${cls}" data-task-id="${taskId}" aria-label="${label}" title="${label}">${icon}</button>`;
        },

        /** Returns "is-running" class fragment if this task is the active one. */
        rowClass(taskId) {
            const t = Store.getTimer();
            return (t && t.taskId === taskId) ? ' is-running' : '';
        },
    },

    // ============================================================
    // OMNI — single primary input, intent dispatcher
    // ============================================================
    // Intents (Phase 2 stub, regex-based):
    //   • start  → "start timer [note...]"
    //   • stop   → "stop" / "stop timer"
    //   • log    → "log <N> (min|m|h|hours) [on <text>]"
    //   • query  → "?<text>"  (routed to AI rail bubble)
    //   • capture → default — creates a new task with this title
    //
    // Phase 9 swaps the regex parser for a real AI dispatcher.
    Omni: {
        _app: null,
        _bar: null,
        _input: null,
        _hint: null,

        init(app) {
            this._app = app;
            this._bar  = document.getElementById('omni-bar');
            this._input = document.getElementById('omni-input');
            this._hint = document.getElementById('omni-hint');
            if (!this._input) return;

            // First-paint cue: pulsate glyph + place caret in input so the user
            // can start typing immediately. Pulse fades after 2 cycles via CSS animation.
            this._bar?.classList.add('first-paint');
            setTimeout(() => this._bar?.classList.remove('first-paint'), 2200);
            // Autofocus on desktop only — mobile would force the keyboard on app open
            if (window.innerWidth > 900) {
                setTimeout(() => this._input?.focus({ preventScroll: true }), 120);
            }

            // Submit on Enter
            this._input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                    e.preventDefault();
                    this.submit();
                } else if (e.key === 'Escape') {
                    this._input.blur();
                }
            });
            this._input.addEventListener('focus', () => this._bar.classList.add('focused'));
            this._input.addEventListener('blur',  () => this._bar.classList.remove('focused'));
            // Live intent preview — updates the right pill as the user types.
            this._input.addEventListener('input', () => this._updateIntentLabel());

            // ⌘K / Ctrl+K → open fullscreen modal (when AI key set)
            // Without a key, fall back to inline focus so the bar still works.
            window.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    if (Store.getSetting('anthropic_api_key') && App.OmniK) {
                        App.OmniK.open();
                    } else {
                        this.focus();
                    }
                }
            });

            // Voice — Web Speech API. Falls back to a stub flash if unavailable.
            const mic = document.getElementById('omni-mic');
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) {
                mic?.classList.add('unsupported');
            } else if (mic) {
                let rec = null;
                let active = false;
                mic.addEventListener('click', () => {
                    if (active && rec) { rec.stop(); return; }
                    rec = new SR();
                    rec.continuous = false;
                    rec.interimResults = true;
                    const lang = (Store.getSetting('lang') || 'en') === 'uk' ? 'uk-UA' : 'en-US';
                    rec.lang = lang;
                    let baseValue = this._input.value;
                    if (baseValue && !baseValue.endsWith(' ')) baseValue += ' ';
                    rec.onstart = () => {
                        active = true;
                        mic.classList.add('recording');
                        this._flash('listening · click mic to stop');
                        this._input.focus();
                    };
                    rec.onresult = (e) => {
                        let text = '';
                        for (let i = 0; i < e.results.length; i++) {
                            text += e.results[i][0].transcript;
                        }
                        this._input.value = baseValue + text;
                        this._updateIntentLabel();
                    };
                    rec.onerror = (ev) => {
                        active = false;
                        mic.classList.remove('recording');
                        this._flash('voice error · ' + (ev.error || 'unknown'));
                    };
                    rec.onend = () => {
                        active = false;
                        mic.classList.remove('recording');
                        this._updateIntentLabel();
                    };
                    try { rec.start(); }
                    catch (e) { this._flash('voice unavailable'); }
                });
            }
        },

        focus() {
            this._input?.focus();
            this._input?.select();
            this._updateIntentLabel();
        },

        /** Read current input, parse intent, dispatch, clear. */
        submit() {
            const raw = (this._input?.value || '').trim();
            if (!raw) return;
            const intent = this.parse(raw);
            this.dispatch(intent);
            this._input.value = '';
            this._updateIntentLabel();
        },

        /** Update the right-side intent pill based on current input value. */
        _updateIntentLabel() {
            if (!this._hint || !this._input) return;
            const raw = this._input.value.trim();
            if (!raw) {
                this._hint.dataset.intent = 'empty';
                this._hint.textContent = '⌘K';
                return;
            }
            const intent = this.parse(raw);
            const labels = {
                capture: '↵ NEW TASK',
                log:     '↵ LOG TIME',
                start:   '↵ START TIMER',
                stop:    '↵ STOP TIMER',
                assign:  '↵ ASSIGN',
                find:    '↵ FIND',
                query:   '↵ ASK',
            };
            this._hint.dataset.intent = intent.type;
            this._hint.textContent = labels[intent.type] || '↵';
        },

        /** Parse → { type, ...payload }. */
        parse(text) {
            const t = text.trim();
            const lower = t.toLowerCase();

            // stop / stop timer
            if (/^stop(\s+timer)?$/.test(lower)) {
                return { type: 'stop' };
            }
            // start timer [note...]
            const mStart = lower.match(/^start(\s+timer)?(?:\s+(.+))?$/);
            if (mStart) {
                return { type: 'start', note: mStart[2] || '' };
            }
            // assign <text> → late-attach running timer to a task
            const mAssign = lower.match(/^assign\s+(.+)$/);
            if (mAssign) {
                return { type: 'assign', query: mAssign[1].trim() };
            }
            // find <text> → local fuzzy search across tasks/matters/clients/invoices
            const mFind = lower.match(/^(?:find|search|go)\s+(.+)$/);
            if (mFind) {
                return { type: 'find', query: mFind[1].trim() };
            }
            // log <N> (min|m|h|hours) [on <text>]
            const mLog = t.match(/^log(?:ged)?\s+(\d+(?:[.,]\d+)?)\s*(min|mins|m|h|hr|hrs|hour|hours)?\s*(?:on\s+(.+))?$/i);
            if (mLog) {
                const n = parseFloat(mLog[1].replace(',', '.'));
                const unit = (mLog[2] || 'min').toLowerCase();
                const isHours = /^h/.test(unit);
                const hours = isHours ? n : n / 60;
                return { type: 'log', hours, note: mLog[3] || '' };
            }
            // ?<text>  → query
            if (lower.startsWith('?')) {
                return { type: 'query', text: t.slice(1).trim() };
            }
            // default → capture as task
            return { type: 'capture', text: t };
        },

        dispatch(intent) {
            switch (intent.type) {
                case 'stop': {
                    const log = App.Timer.stop();
                    this._flash(log ? `logged ${this._fmtH(log.hours)}` : 'timer stopped');
                    break;
                }
                case 'start': {
                    App.Timer.start({ note: intent.note });
                    this._flash('timer started · unassigned');
                    break;
                }
                case 'assign': {
                    const cur = Store.getTimer();
                    if (!cur) { this._flash('no timer running'); break; }
                    // Fuzzy match: case-insensitive substring on open tasks. Earliest match wins.
                    const q = intent.query.toLowerCase();
                    const candidates = Store.getTasks()
                        .filter(t => t.status !== 'done')
                        .map(t => ({ task: t, idx: (t.title || '').toLowerCase().indexOf(q) }))
                        .filter(x => x.idx >= 0)
                        .sort((a, b) => a.idx - b.idx);
                    if (!candidates.length) { this._flash(`no match · «${intent.query}»`); break; }
                    Store.assignTimer(candidates[0].task.id);
                    App.Timer.render();
                    if (this._app.currentView) this._app.show(this._app.currentView);
                    this._flash(`assigned · ${candidates[0].task.title.slice(0, 30)}`);
                    break;
                }
                case 'log': {
                    if (intent.hours <= 0) { this._flash('duration?'); break; }
                    // Attach to running task (if any) — else log unassigned (review later)
                    const cur = Store.getTimer();
                    Store.addTimeLog({
                        taskId: cur?.taskId || null,
                        matterId: cur?.matterId || null,
                        hours: Math.round(intent.hours * 100) / 100,
                        billable: true,
                        source: 'manual',
                        note: intent.note,
                    });
                    this._flash(`logged ${this._fmtH(intent.hours)}${intent.note ? ' · ' + intent.note : ''}`);
                    if (this._app.currentView) this._app.show(this._app.currentView);
                    break;
                }
                case 'find': {
                    const q = intent.query.toLowerCase().trim();
                    /**
                     * Fuzzy match: case-insensitive subsequence + substring + word-boundary.
                     * Returns a score (lower = better match), -1 if no match.
                     *  • exact substring at start  → 0
                     *  • word boundary substring   → 5
                     *  • any substring             → 10
                     *  • subsequence (typos)       → 30 + gap-penalty
                     *  • no match                  → -1
                     */
                    const score = (raw) => {
                        if (!raw) return -1;
                        const text = raw.toLowerCase();
                        if (text.startsWith(q)) return 0;
                        const wIdx = text.indexOf(' ' + q);
                        if (wIdx >= 0) return 5 + wIdx;
                        const i = text.indexOf(q);
                        if (i >= 0) return 10 + i;
                        // subsequence
                        let pi = 0; let lastIdx = -1; let gaps = 0;
                        for (let k = 0; k < text.length && pi < q.length; k++) {
                            if (text[k] === q[pi]) {
                                if (lastIdx >= 0) gaps += k - lastIdx - 1;
                                lastIdx = k;
                                pi++;
                            }
                        }
                        if (pi === q.length) return 30 + gaps;
                        return -1;
                    };
                    const rank = (items, fields) => items
                        .map(it => {
                            const best = fields.reduce((m, f) => {
                                const s = score(typeof f === 'function' ? f(it) : it[f]);
                                return s >= 0 && (m < 0 || s < m) ? s : m;
                            }, -1);
                            return { item: it, score: best };
                        })
                        .filter(x => x.score >= 0)
                        .sort((a, b) => a.score - b.score)
                        .map(x => x.item);

                    const tasks   = rank(Store.getTasks(),    ['title', 'notes']).slice(0, 8);
                    const matters = rank(Store.getMatters(),  ['name', 'notes']).slice(0, 5);
                    const clients = rank(Store.getClients(),  ['name', 'industry', 'email', 'notes']).slice(0, 5);
                    const invoices= rank(Store.getInvoices(), ['number', i => i.lines?.map(l => l.description).join(' ')]).slice(0, 5);

                    const body = document.getElementById('ai-rail-body');
                    document.body.classList.add('ai-expanded');
                    if (!body) { this._flash('rail missing'); break; }

                    const total = tasks.length + matters.length + clients.length + invoices.length;
                    if (!total) {
                        const stub = document.createElement('div');
                        stub.className = 'ai-bubble warn';
                        stub.textContent = `no matches for «${intent.query}»`;
                        body.appendChild(stub);
                    } else {
                        const bubble = document.createElement('div');
                        bubble.className = 'ai-bubble';
                        const sect = (label, items, mkLabel, onClick) => items.length
                            ? `<div class="find-sect"><div class="find-sect-head">${label} · ${items.length}</div>${items.map(it => `<button class="find-row" data-find="${onClick}" data-id="${it.id}" type="button">${Dom.escape(mkLabel(it))}</button>`).join('')}</div>`
                            : '';
                        bubble.innerHTML = `<div class="find-results">
                            ${sect('Tasks',    tasks,    t => t.title, 'task')}
                            ${sect('Matters',  matters,  m => m.name,  'matter')}
                            ${sect('Clients',  clients,  c => c.name,  'client')}
                            ${sect('Invoices', invoices, i => `${i.number} · €${i.total}`, 'invoice')}
                        </div>`;
                        body.appendChild(bubble);
                        bubble.querySelectorAll('[data-find]').forEach(b => b.addEventListener('click', () => {
                            const kind = b.dataset.find;
                            const id = b.dataset.id;
                            if (kind === 'matter')   this._app.openMatter(id);
                            if (kind === 'client')   this._app.openClient(id);
                            if (kind === 'invoice') {
                                this._app.invoiceExpandedId = id;
                                this._app.show('invoices');
                            }
                            if (kind === 'task') {
                                this._app.show('inbox');
                                setTimeout(() => {
                                    const el = document.querySelector(`tr[data-task-id="${id}"], .row[data-task-id="${id}"], .task-card[data-task-id="${id}"]`);
                                    if (el) {
                                        el.classList.add('kb-cursor');
                                        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                                    }
                                }, 80);
                            }
                        }));
                    }
                    body.scrollTop = body.scrollHeight;
                    this._flash(`found ${total}`);
                    break;
                }
                case 'query': {
                    const body = document.getElementById('ai-rail-body');
                    document.body.classList.add('ai-expanded');
                    if (!body) { this._flash('rail missing'); break; }

                    // Render the user bubble
                    const userBubble = document.createElement('div');
                    userBubble.className = 'ai-bubble user';
                    userBubble.textContent = intent.text;
                    body.appendChild(userBubble);
                    body.scrollTop = body.scrollHeight;

                    // No key → friendly stub bubble pointing to settings
                    if (!Store.getSetting('anthropic_api_key')) {
                        const stub = document.createElement('div');
                        stub.className = 'ai-bubble warn';
                        stub.innerHTML = 'add an Anthropic API key in <button class="link-btn" data-open-settings type="button">settings</button> to enable real answers.';
                        body.appendChild(stub);
                        stub.querySelector('[data-open-settings]')?.addEventListener('click', () => {
                            this._app.show('settings');
                        });
                        body.scrollTop = body.scrollHeight;
                        this._flash('no api key');
                        break;
                    }

                    // Thinking… bubble that gets replaced with the answer
                    const thinking = document.createElement('div');
                    thinking.className = 'ai-bubble thinking';
                    thinking.textContent = 'thinking…';
                    body.appendChild(thinking);
                    body.scrollTop = body.scrollHeight;
                    this._flash('asked');

                    AI.query(intent.text)
                        .then(answer => {
                            thinking.classList.remove('thinking');
                            thinking.textContent = answer;
                            body.scrollTop = body.scrollHeight;
                        })
                        .catch(err => {
                            thinking.classList.remove('thinking');
                            thinking.classList.add('error');
                            thinking.textContent = '✗ ' + err.message;
                            body.scrollTop = body.scrollHeight;
                        });
                    break;
                }
                case 'capture':
                default: {
                    // Extract trailing "every (day|week|month)" or "every N (days|weeks|months)" → recurrence
                    let title = intent.text;
                    let recurrence = null;
                    const recMatch = title.match(/\s+every\s+(\d+\s+)?(day|days|week|weeks|month|months)\s*$/i);
                    if (recMatch) {
                        const interval = parseInt(recMatch[1], 10) || 1;
                        const unit = recMatch[2].toLowerCase();
                        const freq = unit.startsWith('day') ? 'daily'
                                   : unit.startsWith('week') ? 'weekly'
                                   : 'monthly';
                        recurrence = { freq, interval };
                        title = title.replace(recMatch[0], '').trim();
                    }
                    // Auto-detect deadline phrases like "by tomorrow" / "by friday" / "by 14 may"
                    let deadline = null;
                    const byMatch = title.match(/\s+by\s+(today|tomorrow|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[\/\.\-]\d{1,2}(?:[\/\.\-]\d{2,4})?)\s*$/i);
                    if (byMatch) {
                        const parsed = this._parseDeadline(byMatch[1]);
                        if (parsed) {
                            deadline = parsed.toISOString();
                            title = title.replace(byMatch[0], '').trim();
                        }
                    }
                    const task = Store.addTask({
                        title, status: 'todo', priority: 'medium',
                        deadline, recurrence,
                    });
                    const recLbl = recurrence ? ` · every ${recurrence.interval > 1 ? recurrence.interval + ' ' : ''}${recurrence.freq.replace(/ly$/, '')}` : '';
                    this._flash(`captured · ${task.title.slice(0, 30)}${recLbl}`);
                    if (this._app.currentView) this._app.show(this._app.currentView);
                    this._app.renderSidebar();
                    break;
                }
            }
        },

        _flash(text) {
            if (!this._hint) return;
            this._hint.textContent = '✓ ' + text.toUpperCase();
            this._hint.classList.add('flash');
            clearTimeout(this._flashHandle);
            this._flashHandle = setTimeout(() => {
                this._hint.classList.remove('flash');
                this._updateIntentLabel();
            }, 1600);
        },

        _fmtH(hours) {
            if (hours >= 1) return `${hours.toFixed(2)}h`.replace(/\.?0+h$/, 'h');
            const m = Math.round(hours * 60);
            return `${m} min`;
        },

        /** Best-effort deadline parser — used by the inline capture intent. */
        _parseDeadline(text) {
            const now = new Date(); now.setSeconds(0, 0);
            const t = text.toLowerCase().trim();
            if (t === 'today') { now.setHours(18, 0, 0, 0); return now; }
            if (t === 'tomorrow') {
                const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d;
            }
            // Day-of-week (next occurrence)
            const dows = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const dowMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
                             monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
            if (t in dowMap) {
                const target = dowMap[t];
                const cur = now.getDay();
                let diff = (target - cur + 7) % 7;
                if (diff === 0) diff = 7;
                const d = new Date(now); d.setDate(d.getDate() + diff); d.setHours(18, 0, 0, 0); return d;
            }
            // dd.mm or dd.mm.yyyy or dd/mm
            const m = t.match(/^(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?$/);
            if (m) {
                const day = parseInt(m[1], 10);
                const month = parseInt(m[2], 10) - 1;
                let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
                if (year < 100) year += 2000;
                const d = new Date(year, month, day, 18, 0, 0, 0);
                if (!isNaN(d.getTime())) return d;
            }
            return null;
        },
    },

    // ============================================================
    // NOTIFY — browser Notifications for due-soon tasks
    // ============================================================
    Notify: {
        _app: null,
        _interval: null,
        _seen: new Set(),   // task ids already notified (this session)

        init(app) {
            this._app = app;
            // Restore previously-notified ids from sessionStorage
            try {
                const raw = sessionStorage.getItem('ordify-notified');
                if (raw) JSON.parse(raw).forEach(id => this._seen.add(id));
            } catch (_) {}
            // If user already has perm from a prior session, kick off the watcher.
            if (this.enabled() && Notification.permission === 'granted') {
                this.startWatcher();
            }
        },

        enabled() {
            return Store.getSetting('notifications') !== false;  // default ON
        },

        async request() {
            if (!('Notification' in window)) {
                App.Omni._flash('notifications unsupported');
                return false;
            }
            if (Notification.permission === 'granted') return true;
            const perm = await Notification.requestPermission();
            if (perm === 'granted') {
                this.startWatcher();
                App.Omni._flash('notifications on');
                return true;
            }
            App.Omni._flash('notifications denied');
            return false;
        },

        startWatcher() {
            if (this._interval) return;
            this.scan();   // immediate first pass
            this._interval = setInterval(() => this.scan(), 60_000);  // every minute
        },

        stopWatcher() {
            if (this._interval) clearInterval(this._interval);
            this._interval = null;
        },

        scan() {
            if (Notification.permission !== 'granted') return;
            if (!this.enabled()) return;
            const now = Date.now();
            const horizon = 60 * 60 * 1000;   // 60 minutes
            for (const t of Store.getTasks()) {
                if (t.status === 'done' || !t.deadline) continue;
                if (this._seen.has(t.id)) continue;
                const dl = new Date(t.deadline).getTime();
                const delta = dl - now;
                // Notify when entering the 0…60-minute window
                if (delta > 0 && delta <= horizon) {
                    const matter = t.matterId ? Store.getMatter(t.matterId) : null;
                    const minutes = Math.round(delta / 60_000);
                    new Notification(`${t.title}`, {
                        body: `due in ${minutes} min${matter ? ' · ' + matter.name : ''}`,
                        icon: '/favicon.ico',
                        tag: 'ordify-' + t.id,
                    });
                    this._seen.add(t.id);
                    this._persistSeen();
                }
            }
        },

        _persistSeen() {
            try {
                sessionStorage.setItem('ordify-notified', JSON.stringify(Array.from(this._seen)));
            } catch (_) {}
        },
    },

    // ============================================================
    // OMNIK — fullscreen ⌘K modal with AI structured-parse preview
    // ============================================================
    OmniK: {
        _app: null,
        _scrim: null,
        _input: null,
        _preview: null,
        _commitBtn: null,
        _hint: null,
        _parseHandle: null,
        _parsed: null,    // last successful parse { kind, summary, fields, questions }
        _seq: 0,           // request sequence — race-condition guard

        init(app) {
            this._app = app;
            this._scrim     = document.getElementById('omnik-scrim');
            this._input     = document.getElementById('omnik-input');
            this._preview   = document.getElementById('omnik-preview');
            this._commitBtn = document.getElementById('omnik-commit');
            this._hint      = document.getElementById('omnik-hint');
            if (!this._scrim) return;

            this._input.addEventListener('input', () => this._scheduleParse());
            this._input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    this.commit();
                }
            });
            document.getElementById('omnik-cancel')?.addEventListener('click', () => this.close());
            this._commitBtn?.addEventListener('click', () => this.commit());
            // Backdrop click closes
            this._scrim.addEventListener('click', (e) => {
                if (e.target === this._scrim) this.close();
            });
        },

        open(prefill = '') {
            this._scrim.hidden = false;
            this._input.value = prefill || '';
            this._parsed = null;
            this._renderEmpty();
            setTimeout(() => this._input?.focus(), 50);
        },

        close() {
            if (!this._scrim) return;
            this._scrim.hidden = true;
            clearTimeout(this._parseHandle);
        },

        _renderEmpty() {
            this._preview.innerHTML = `<div class="omnik-empty">type to preview · ⌘⏎ to commit</div>`;
            this._commitBtn.disabled = true;
        },

        _renderThinking() {
            this._preview.innerHTML = `<div class="omnik-thinking">parsing<span class="omnik-dot"></span></div>`;
            this._commitBtn.disabled = true;
        },

        _renderError(msg) {
            this._preview.innerHTML = `<div class="omnik-error">✗ ${Dom.escape(msg)}</div>`;
            this._commitBtn.disabled = true;
        },

        _renderPreview(data) {
            this._parsed = data;
            const kind = data.kind || 'ambiguous';
            const fields = data.fields || {};
            const summary = data.summary || '';
            const questions = data.questions || [];

            const fieldRows = Object.entries(fields).map(([k, v]) => {
                let val = v;
                if (typeof v === 'object' && v !== null) val = JSON.stringify(v, null, 2);
                if (k === 'clientId' && v) {
                    const c = Store.getClient(v);
                    val = c ? `${c.name} (${v})` : v;
                }
                if (k === 'matterId' && v) {
                    const m = Store.getMatter(v);
                    val = m ? `${m.name} (${v})` : v;
                }
                return `<tr><td class="k">${Dom.escape(k)}</td><td class="v">${Dom.escape(String(val))}</td></tr>`;
            }).join('');

            const questionsHtml = questions.length
                ? `<div class="omnik-questions"><strong>need to clarify:</strong><ul>${questions.map(q => `<li>${Dom.escape(q)}</li>`).join('')}</ul></div>`
                : '';

            this._preview.innerHTML = `
                <div class="omnik-kind">↵ ${kind.toUpperCase()}</div>
                <div class="omnik-summary">${Dom.escape(summary)}</div>
                <table class="omnik-fields"><tbody>${fieldRows || '<tr><td class="empty">no fields parsed</td></tr>'}</tbody></table>
                ${questionsHtml}
            `;

            const canCommit = ['task', 'matter', 'meeting', 'client', 'log'].includes(kind) && questions.length === 0;
            this._commitBtn.disabled = !canCommit;
        },

        _scheduleParse() {
            clearTimeout(this._parseHandle);
            const text = this._input.value.trim();
            if (!text) {
                this._parsed = null;
                this._renderEmpty();
                return;
            }
            this._renderThinking();
            const seq = ++this._seq;
            this._parseHandle = setTimeout(async () => {
                try {
                    const data = await AI.parseStructured(text);
                    if (seq !== this._seq) return;  // newer parse already in flight
                    this._renderPreview(data);
                } catch (err) {
                    if (seq !== this._seq) return;
                    this._renderError(err.message);
                }
            }, 700);
        },

        commit() {
            const data = this._parsed;
            if (!data) return;
            const f = data.fields || {};
            try {
                let summary = data.summary || '';
                switch (data.kind) {
                    case 'task': {
                        const task = Store.addTask({
                            title: f.title || '(untitled)',
                            clientId: f.clientId || null,
                            matterId: f.matterId || null,
                            deadline: f.deadline || null,
                            priority: f.priority || 'medium',
                            status: 'todo',
                            tags: [],
                        });
                        summary = 'task · ' + task.title;
                        break;
                    }
                    case 'matter': {
                        let clientId = f.clientId;
                        if (!clientId && f.clientName) {
                            const c = Store.addClient({ name: f.clientName });
                            clientId = c.id;
                        }
                        const matter = Store.addMatter({
                            name: f.name,
                            clientId,
                            billing: f.billing || { mode: 'hourly' },
                        });
                        summary = 'matter · ' + matter.name;
                        break;
                    }
                    case 'meeting': {
                        const meet = Store.addMeeting({
                            title: f.title || '(meeting)',
                            starts_at: f.starts_at,
                            ends_at: f.ends_at || f.starts_at,
                            clientId: f.clientId || null,
                            matterId: f.matterId || null,
                            video_url: f.video_url || null,
                        });
                        summary = 'meeting · ' + meet.title;
                        // Auto-push to Google Calendar if connected
                        if (typeof GCal !== 'undefined' && GCal.isConnected()) {
                            GCal.insert(meet)
                                .then(gcalId => {
                                    meet.gcal_id = gcalId;
                                    Store.flush();
                                    App.Omni._flash('synced to google ✓');
                                })
                                .catch(err => App.Omni._flash('gcal push · ' + err.message));
                        }
                        break;
                    }
                    case 'client': {
                        const c = Store.addClient({
                            name: f.name,
                            industry: f.industry || '',
                            email: f.email || '',
                        });
                        summary = 'client · ' + c.name;
                        break;
                    }
                    case 'log': {
                        Store.addTimeLog({
                            taskId: f.taskId || null,
                            matterId: f.matterId || null,
                            hours: f.hours || 0,
                            note: f.note || '',
                            billable: true,
                            source: 'manual',
                        });
                        summary = 'logged ' + (f.hours || 0) + 'h';
                        break;
                    }
                    default:
                        App.Omni._flash('cannot commit · ambiguous');
                        return;
                }
                this.close();
                App.show(App.currentView);
                App.renderSidebar();
                App.Omni._flash('created · ' + summary);
            } catch (err) {
                this._renderError(err.message);
            }
        },
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

    /** Set of task ids selected via checkbox in inbox table. */
    _bulkIds: new Set(),
    _bulkLogIds: new Set(),

    /** Bind global bulk-actions wiring (called from init). */
    _bindBulkActions() {
        // Listen for checkbox changes on task rows + timelog rows
        document.body.addEventListener('change', (e) => {
            const cb = e.target;
            if (!(cb instanceof HTMLInputElement) || cb.type !== 'checkbox') return;
            const taskRow = cb.closest('tr[data-task-id]');
            if (taskRow) {
                const id = taskRow.dataset.taskId;
                if (cb.checked) this._bulkIds.add(id); else this._bulkIds.delete(id);
                this._renderBulkBar();
                return;
            }
            const logRow = cb.closest('tr[data-log-id]');
            if (logRow) {
                const id = logRow.dataset.logId;
                if (cb.checked) this._bulkLogIds.add(id); else this._bulkLogIds.delete(id);
                this._renderBulkLogBar();
                return;
            }
        });
        // Bulk-log-bar buttons
        document.getElementById('bulk-log-bar')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-bulklog]');
            if (!btn) return;
            const action = btn.dataset.bulklog;
            const ids = Array.from(this._bulkLogIds);
            if (action === 'clear') { this._bulkLogIds.clear(); this._renderBulkLogBar(); this.show(this.currentView); return; }
            if (!ids.length) return;
            if (action === 'non-billable') {
                ids.forEach(id => {
                    const l = Store._data.timeLogs.find(x => x.id === id);
                    if (l) l.billable = false;
                });
                Store.flush();
                App.Omni._flash(`marked non-billable · ${ids.length}`);
            } else if (action === 'delete') {
                if (!confirm(`Delete ${ids.length} log${ids.length === 1 ? '' : 's'}? This is permanent.`)) return;
                Store._data.timeLogs = Store._data.timeLogs.filter(x => !this._bulkLogIds.has(x.id));
                Store.flush();
                App.Omni._flash(`deleted · ${ids.length}`);
            } else if (action === 'move') {
                const matters = Store.getMatters();
                const list = matters.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
                const choice = prompt(`Move ${ids.length} log(s) to which matter?\n\n` + list);
                const idx = parseInt(choice, 10) - 1;
                if (matters[idx]) {
                    ids.forEach(id => {
                        const l = Store._data.timeLogs.find(x => x.id === id);
                        if (l) l.matterId = matters[idx].id;
                    });
                    Store.flush();
                    App.Omni._flash(`moved to ${matters[idx].name} · ${ids.length}`);
                }
            }
            this._bulkLogIds.clear();
            this._renderBulkLogBar();
            this.show(this.currentView);
        });

        // Wire bulk-bar buttons
        document.getElementById('bulk-bar')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-bulk]');
            if (!btn) return;
            const action = btn.dataset.bulk;
            const ids = Array.from(this._bulkIds);
            if (action === 'clear') {
                this._bulkIds.clear();
                this._renderBulkBar();
                this.show(this.currentView);
                return;
            }
            if (!ids.length) return;
            if (action === 'done') {
                ids.forEach(id => Store.updateTask(id, { status: 'done' }));
                App.Omni._flash(`marked done · ${ids.length}`);
            } else if (action === 'delete') {
                if (!confirm(`Delete ${ids.length} task${ids.length === 1 ? '' : 's'}?`)) return;
                ids.forEach(id => Store.deleteTask(id));
                App.Omni._flash(`deleted · ${ids.length}`);
            }
            this._bulkIds.clear();
            this._renderBulkBar();
            this.renderSidebar();
            this.show(this.currentView);
        });
    },

    _renderBulkBar() {
        const bar = document.getElementById('bulk-bar');
        const count = document.getElementById('bulk-count');
        if (!bar || !count) return;
        const n = this._bulkIds.size;
        if (n === 0) bar.hidden = true; else { bar.hidden = false; count.textContent = n; }
    },
    _renderBulkLogBar() {
        const bar = document.getElementById('bulk-log-bar');
        const count = document.getElementById('bulk-log-count');
        if (!bar || !count) return;
        const n = this._bulkLogIds.size;
        if (n === 0) bar.hidden = true; else { bar.hidden = false; count.textContent = n; }
    },

    /** Bind drag-and-drop on board task cards (status changes by drop target). */
    _bindDragDrop() {
        // Make every task card draggable on demand
        document.body.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.task-card[data-task-id]');
            if (!card) return;
            e.dataTransfer.setData('text/plain', card.dataset.taskId);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('dragging');
        });
        document.body.addEventListener('dragend', (e) => {
            document.querySelectorAll('.task-card.dragging').forEach(c => c.classList.remove('dragging'));
            document.querySelectorAll('.dnd-target.over').forEach(c => c.classList.remove('over'));
        });
        document.body.addEventListener('dragover', (e) => {
            const target = e.target.closest('.dnd-target');
            if (!target) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            document.querySelectorAll('.dnd-target.over').forEach(c => c.classList.remove('over'));
            target.classList.add('over');
        });
        document.body.addEventListener('drop', (e) => {
            const target = e.target.closest('.dnd-target');
            if (!target) return;
            e.preventDefault();
            const taskId = e.dataTransfer.getData('text/plain');
            if (!taskId) return;
            const matterId = target.dataset.dropMatter;
            const status = target.dataset.dropStatus;
            const patch = {};
            if (matterId !== undefined) patch.matterId = matterId || null;
            if (status) patch.status = status;
            if (Object.keys(patch).length) {
                Store.updateTask(taskId, patch);
                App.Omni._flash(status === 'done' ? 'marked done' : 'moved');
                App.show(App.currentView);
            }
            document.querySelectorAll('.dnd-target.over').forEach(c => c.classList.remove('over'));
        });
    },

    /** Inbox-scan plate on Today: shows AI-extracted action items from recent unread emails.
       Lazy: kicks off background scan once per 10 minutes when Today renders. */
    _inboxScan: { messages: [], analysis: {}, dismissed: new Set(), lastScanAt: 0 },
    _inboxScanInflight: false,

    _renderInboxScanPlate() {
        if (typeof Gmail === 'undefined' || !Gmail.isConnected()) return '';
        if (!Store.getSetting('anthropic_api_key')) return '';
        // Count proposed tasks across analysed messages, minus dismissed
        let proposed = 0;
        const sources = [];
        for (const m of this._inboxScan.messages) {
            const a = this._inboxScan.analysis[m.id];
            if (!a || this._inboxScan.dismissed.has(m.id)) continue;
            const n = (a.tasks?.length || 0) + (a.meetings?.length || 0);
            if (n > 0) { proposed += n; sources.push({ msg: m, analysis: a }); }
        }
        if (!proposed) return '';

        const items = sources.slice(0, 5).map(({ msg, analysis }) => `
            <div class="iscan-row" data-msg-id="${msg.id}">
                <div class="iscan-from">${Dom.escape((msg.from || '').replace(/<.*?>/, '').trim().slice(0, 28))}</div>
                <div class="iscan-subj">${Dom.escape(msg.subject || '(no subject)')}</div>
                <div class="iscan-summary">${Dom.escape(analysis.summary || '')}</div>
                <div class="iscan-tasks">
                    ${(analysis.tasks || []).map((t, i) => `
                        <button class="iscan-task" data-iscan-accept data-msg-id="${msg.id}" data-task-idx="${i}" type="button">
                            + ${Dom.escape((t.title || '').slice(0, 60))}
                            ${t.deadline ? `<span class="d">· ${Dom.escape(new Date(t.deadline).toISOString().slice(5,10))}</span>` : ''}
                        </button>
                    `).join('')}
                </div>
                <button class="iscan-dismiss" data-iscan-dismiss data-msg-id="${msg.id}" type="button" title="Dismiss this email">✕</button>
            </div>
        `).join('');

        return `<div class="inbox-scan">
            <div class="iscan-head">
                <span class="dot"></span>
                <span class="lbl">📥 ${proposed} action${proposed === 1 ? '' : 's'} from ${sources.length} email${sources.length === 1 ? '' : 's'}</span>
                <span class="grow"></span>
                <button class="link-btn quiet" data-iscan-rescan type="button">↻ rescan</button>
                <button class="link-btn quiet" data-iscan-clear type="button">✕ dismiss all</button>
            </div>
            <div class="iscan-body">${items}</div>
        </div>`;
    },

    async _kickoffInboxScan() {
        if (typeof Gmail === 'undefined' || !Gmail.isConnected()) return;
        if (!Store.getSetting('anthropic_api_key')) return;
        if (this._inboxScanInflight) return;
        const stale = Date.now() - this._inboxScan.lastScanAt > 10 * 60 * 1000;
        if (!stale && this._inboxScan.messages.length) return;
        this._inboxScanInflight = true;
        try {
            const ids = await Gmail.listRecent({ max: 8, query: 'is:unread newer_than:7d' });
            const messages = [];
            for (const ref of ids) {
                try { messages.push(await Gmail.getMessage(ref.id)); } catch (_) {}
            }
            this._inboxScan.messages = messages;
            // Analyse each (sequential — keeps cost modest, gives us partial UI updates)
            for (const m of messages) {
                if (this._inboxScan.analysis[m.id]) continue;
                if (this._inboxScan.dismissed.has(m.id)) continue;
                try {
                    const data = await AI.parseEmail({ from: m.from, subject: m.subject, body: m.body, date: m.date });
                    this._inboxScan.analysis[m.id] = data;
                    if (this.currentView === 'today') this.show('today');
                } catch (_) { /* skip */ }
            }
            this._inboxScan.lastScanAt = Date.now();
        } finally {
            this._inboxScanInflight = false;
        }
    },

    /** Prominent "what's running now" strip rendered at the top of Today. */
    _todayActiveTimerBlock() {
        const t = Store.getTimer();
        if (!t) return '';
        const task = t.taskId ? Store.getTask(t.taskId) : null;
        const matter = t.matterId ? Store.getMatter(t.matterId) : null;
        const client = matter?.clientId ? Store.getClient(matter.clientId) : null;
        const what = task ? task.title : (t.note || 'unassigned');
        return `<div class="today-running">
            <span class="rec-dot"></span>
            <div class="tr-body">
                <div class="tr-what">${Dom.escape(what)}</div>
                <div class="tr-ctx">${matter ? Dom.escape(matter.name) : ''}${client ? ' · ' + Dom.escape(client.name) : ''}</div>
            </div>
            <div class="tr-clock" id="today-running-clock">00:00:00</div>
            <button class="inv-act primary" data-stop-running type="button">stop</button>
        </div>`;
    },

    /** HTML for the attachments block on a detail view (matter/task/client). */
    _renderAiUsage() {
        const u = Store._data.settings.ai_usage || { events: [], total_in: 0, total_out: 0, total_cost: 0 };
        const now = Date.now();
        const sinceMs = (days) => now - days * 86_400_000;
        const filt = (since) => u.events.filter(e => new Date(e.at).getTime() >= since);
        const sum = (arr, k) => arr.reduce((s, e) => s + (e[k] || 0), 0);
        const today = filt(sinceMs(1));
        const week  = filt(sinceMs(7));
        const month = filt(sinceMs(30));
        return `<div class="ai-usage">
            <div class="usage-row"><span class="lbl">today</span><span class="cnt">${today.length} req</span><span class="tok">${sum(today,'in') + sum(today,'out')} tok</span><span class="cost">€${sum(today,'cost').toFixed(3)}</span></div>
            <div class="usage-row"><span class="lbl">7d</span><span class="cnt">${week.length} req</span><span class="tok">${sum(week,'in') + sum(week,'out')} tok</span><span class="cost">€${sum(week,'cost').toFixed(3)}</span></div>
            <div class="usage-row"><span class="lbl">30d</span><span class="cnt">${month.length} req</span><span class="tok">${sum(month,'in') + sum(month,'out')} tok</span><span class="cost">€${sum(month,'cost').toFixed(2)}</span></div>
            <div class="usage-row total"><span class="lbl">total</span><span class="cnt">${u.events.length} req</span><span class="tok">${(u.total_in||0) + (u.total_out||0)} tok</span><span class="cost">€${(u.total_cost||0).toFixed(2)}</span></div>
        </div>`;
    },

    _renderAttachments({ ownerType, ownerId }) {
        const list = Files.listFor(ownerType, ownerId);
        const recBadge = Recorder.isRecording() ? '<span class="rec-dot"></span> recording' : '';
        const items = list.length
            ? list.map(a => {
                const isAudio = a.mime.startsWith('audio/');
                const isVideo = a.mime.startsWith('video/');
                const isImage = a.mime.startsWith('image/');
                const canTranscribe = (isAudio || isVideo) && !a.transcript;
                return `<div class="att-row" data-att-id="${a.id}">
                    <span class="att-icon">${Files.iconFor(a.mime)}</span>
                    <div class="att-name">
                        ${Dom.escape(a.name)}
                        <span class="att-meta">${Files.fmtSize(a.size)} · ${a.mime.split(';')[0]}${a.transcript ? ' · transcribed' : ''}</span>
                        ${a.transcript ? `<details class="att-transcript"><summary>view transcript</summary><pre>${Dom.escape(a.transcript)}</pre>${a.transcript_summary ? `<p><strong>summary:</strong> ${Dom.escape(a.transcript_summary)}</p>` : ''}</details>` : ''}
                    </div>
                    ${isAudio || isVideo || isImage ? `<button class="inv-act ghost" data-att-action="preview" type="button">▷ Play</button>` : ''}
                    ${canTranscribe ? `<button class="inv-act ghost" data-att-action="transcribe" type="button">↻ Transcribe</button>` : ''}
                    <button class="inv-act ghost" data-att-action="open" type="button">↗ Open</button>
                    <button class="inv-act ghost" data-att-action="download" type="button">⤓</button>
                    <button class="inv-act ghost" data-att-action="delete" type="button" title="Delete">✕</button>
                </div>`;
            }).join('')
            : `<div class="att-empty">No attachments yet — drag a file here, upload, or record audio / a meeting.</div>`;

        return `
            <div class="time-section attachments" data-att-owner-type="${ownerType}" data-att-owner-id="${ownerId}">
                <div class="time-section-head">
                    attachments · ${list.length}
                    <span class="att-actions">
                        <button class="inv-act ghost" data-att-do="upload" type="button">⤒ Upload</button>
                        <button class="inv-act ghost" data-att-do="record-voice" type="button">● Record call</button>
                        <button class="inv-act ghost" data-att-do="record-meeting" type="button">● Record meeting</button>
                    </span>
                </div>
                <div class="att-dropzone" data-att-owner-type="${ownerType}" data-att-owner-id="${ownerId}">
                    ${items}
                </div>
                <div class="att-rec-strip" id="att-rec-${ownerId}" hidden>
                    <span class="rec-dot"></span>
                    <span class="rec-label" id="rec-label-${ownerId}">recording…</span>
                    <span class="rec-time" id="rec-time-${ownerId}">00:00</span>
                    <button class="inv-act primary" data-att-stop type="button">■ Stop</button>
                    <button class="inv-act ghost"   data-att-cancel type="button">✕ Cancel</button>
                </div>
            </div>
        `;
    },

    /** Wire up an attachments block (call from each render_* that includes it). */
    _bindAttachments(root) {
        const blocks = root.querySelectorAll('.attachments');
        blocks.forEach(block => {
            const ownerType = block.dataset.attOwnerType;
            const ownerId   = block.dataset.attOwnerId;
            const refresh = () => {
                if (this.currentView === 'matter') this.show('matter');
                else if (this.currentView === 'client') this.show('client');
                else this.show(this.currentView);
            };

            // Top-level upload + record buttons
            block.querySelectorAll('[data-att-do="upload"]').forEach(b => b.addEventListener('click', () => {
                const inp = document.createElement('input');
                inp.type = 'file'; inp.multiple = true;
                inp.onchange = async () => {
                    for (const f of (inp.files || [])) {
                        const meta = await Files.put(f, { ownerType, ownerId });
                        const owner = this._attLookupOwner(ownerType, ownerId);
                        if (owner) {
                            if (!owner.attachmentIds) owner.attachmentIds = [];
                            owner.attachmentIds.push(meta.id);
                        }
                    }
                    Store.flush();
                    App.Omni._flash(`uploaded · ${(inp.files || []).length}`);
                    refresh();
                };
                inp.click();
            }));
            block.querySelectorAll('[data-att-do="record-voice"]').forEach(b => b.addEventListener('click', () =>
                this._beginRecording('voice', ownerType, ownerId, refresh)));
            block.querySelectorAll('[data-att-do="record-meeting"]').forEach(b => b.addEventListener('click', () =>
                this._beginRecording('meeting', ownerType, ownerId, refresh)));

            // Stop / cancel during recording
            block.querySelectorAll('[data-att-stop]').forEach(b => b.addEventListener('click', () => Recorder.stop()));
            block.querySelectorAll('[data-att-cancel]').forEach(b => b.addEventListener('click', () => {
                Recorder.cancel();
                refresh();
            }));

            // Per-row actions
            block.querySelectorAll('[data-att-action]').forEach(b => b.addEventListener('click', async (e) => {
                const id = e.target.closest('[data-att-id]')?.dataset.attId;
                if (!id) return;
                const action = b.dataset.attAction;
                if (action === 'open' || action === 'preview') {
                    const url = await Files.openUrl(id);
                    window.open(url, '_blank', 'noopener');
                    setTimeout(() => URL.revokeObjectURL(url), 30_000);
                } else if (action === 'download') {
                    Files.download(id);
                } else if (action === 'delete') {
                    if (!confirm('Delete this attachment?')) return;
                    await Files.remove(id);
                    refresh();
                } else if (action === 'transcribe') {
                    if (!Store.getSetting('openai_api_key')) {
                        App.Omni._flash('add OpenAI key in settings');
                        return;
                    }
                    const meta = Store._data.attachments.find(a => a.id === id);
                    if (!meta) return;
                    b.disabled = true; b.textContent = 'transcribing…';
                    try {
                        const blob = await Files.get(id);
                        if (!blob) throw new Error('blob missing');
                        const tr = await AI.transcribe(blob, meta.name);
                        meta.transcript = tr.text;
                        meta.transcript_lang = tr.language || null;
                        // Then summarise (best-effort)
                        try {
                            const sum = await AI.summarizeTranscript(tr.text);
                            meta.transcript_summary = sum.summary || '';
                            meta.transcript_tasks = sum.tasks || [];
                        } catch (_) {}
                        Store.flush();
                        App.Omni._flash('transcribed · ' + tr.text.length + ' chars');
                        refresh();
                    } catch (err) {
                        b.disabled = false; b.textContent = '↻ Transcribe';
                        App.Omni._flash('transcribe · ' + err.message);
                    }
                }
            }));

            // Drag-drop file upload
            const dz = block.querySelector('.att-dropzone');
            if (dz) {
                dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
                dz.addEventListener('dragleave', () => dz.classList.remove('over'));
                dz.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    dz.classList.remove('over');
                    const files = Array.from(e.dataTransfer?.files || []);
                    if (!files.length) return;
                    for (const f of files) {
                        const meta = await Files.put(f, { ownerType, ownerId });
                        const owner = this._attLookupOwner(ownerType, ownerId);
                        if (owner) {
                            if (!owner.attachmentIds) owner.attachmentIds = [];
                            owner.attachmentIds.push(meta.id);
                        }
                    }
                    Store.flush();
                    App.Omni._flash(`uploaded · ${files.length}`);
                    refresh();
                });
            }
        });
    },

    async _beginRecording(kind, ownerType, ownerId, refresh) {
        if (Recorder.isRecording()) {
            App.Omni._flash('already recording — stop first');
            return;
        }
        const strip = document.getElementById(`att-rec-${ownerId}`);
        const label = document.getElementById(`rec-label-${ownerId}`);
        const time  = document.getElementById(`rec-time-${ownerId}`);
        if (strip) strip.hidden = false;
        if (label) label.textContent = (kind === 'meeting' ? 'recording meeting' : 'recording call');
        Recorder.onTick = (s) => {
            if (!time) return;
            const mm = String(Math.floor(s / 60)).padStart(2, '0');
            const ss = String(s % 60).padStart(2, '0');
            time.textContent = `${mm}:${ss}`;
        };
        try {
            const meta = await Recorder.start({ kind, owner: { type: ownerType, id: ownerId } });
            App.Omni._flash(`saved · ${meta.name}`);
        } catch (e) {
            if (e.message !== 'cancelled') App.Omni._flash('rec · ' + e.message);
        } finally {
            Recorder.onTick = null;
            if (strip) strip.hidden = true;
            refresh();
        }
    },

    _attLookupOwner(type, id) {
        if (type === 'matter')  return Store.getMatter(id);
        if (type === 'task')    return Store.getTask(id);
        if (type === 'client')  return Store.getClient(id);
        if (type === 'meeting') return Store.getMeeting(id);
        return null;
    },

    /** Bind global inline-edit handlers (called from init). */
    _bindInlineEdit() {
        // Double-click on a task title cell turns it into an editable input.
        document.body.addEventListener('dblclick', (e) => {
            const target = e.target.closest('[data-task-id] .title, [data-task-id] .title-cell');
            if (!target) return;
            const row = target.closest('[data-task-id]');
            if (!row) return;
            // Don't edit the play button or other interactive elements
            if (e.target.closest('.play-mini, .check, button, a, input')) return;
            const taskId = row.dataset.taskId;
            const task = Store.getTask(taskId);
            if (!task) return;

            // Build an inline input replacing the cell's text content (preserve play button)
            e.preventDefault();
            e.stopPropagation();
            const playBtn = target.querySelector('.play-mini');
            const original = task.title;
            target.dataset.originalContent = target.innerHTML;
            target.innerHTML = '';
            if (playBtn) target.appendChild(playBtn);
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'inline-edit';
            input.value = original;
            target.appendChild(input);
            input.focus();
            input.select();

            const commit = () => {
                const v = input.value.trim();
                if (v && v !== original) {
                    Store.updateTask(taskId, { title: v });
                    App.show(App.currentView);
                    App.Omni._flash(`renamed · ${v.slice(0, 30)}`);
                } else {
                    target.innerHTML = target.dataset.originalContent;
                }
            };
            const cancel = () => {
                target.innerHTML = target.dataset.originalContent;
            };
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
                else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
            });
            input.addEventListener('blur', () => commit());
        });
    },

    /** Move the keyboard cursor across visible task rows by delta (+1 / -1). */
    _moveCursor(delta) {
        const all = Array.from(document.querySelectorAll('[data-task-id]'))
            .filter(el => el.querySelector('.title') || el.classList.contains('inv-row') ? false : true)
            // Only elements that have a meaningful task-id (rows / cards / table-rows / chips)
            .filter(el => el.matches('.row, .task-card, .fire-row, tr[data-task-id]'));
        if (!all.length) return;
        // Dedupe by data-task-id, prefer first occurrence (visual order)
        const seen = new Set();
        const list = [];
        for (const el of all) {
            const id = el.dataset.taskId;
            if (!id || seen.has(id)) continue;
            seen.add(id);
            list.push({ id, el });
        }
        if (!list.length) return;

        let idx = list.findIndex(x => x.id === this._cursorTaskId);
        if (idx < 0) idx = delta > 0 ? -1 : list.length;  // first j → 0; first k → last
        idx = Math.max(0, Math.min(list.length - 1, idx + delta));
        const next = list[idx];
        this._cursorTaskId = next.id;
        // Visual cue: scroll into view + temp highlight class
        list.forEach(x => x.el.classList.remove('kb-cursor'));
        next.el.classList.add('kb-cursor');
        next.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },

    /** Export 5 CSV files (one per entity) zipped client-side via plain text.
       Falls back to downloading individual files if browser blocks zip. */
    _exportCsvBundle() {
        const csvFor = (rows, cols) => {
            const esc = (v) => {
                if (v == null) return '';
                const s = (typeof v === 'object') ? JSON.stringify(v) : String(v);
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const out = [cols.join(',')];
            for (const r of rows) out.push(cols.map(c => esc(this._csvCell(r, c))).join(','));
            return out.join('\n');
        };
        const today = new Date().toISOString().slice(0, 10);
        const downloads = [
            { name: `clients-${today}.csv`,  cols: ['id','name','email','industry','primary_currency','notes','created','updated'], rows: Store.getClients({ includeDeleted: true }) },
            { name: `matters-${today}.csv`,  cols: ['id','clientId','clientName','name','status','industry','billing_mode','billing_period_fee','billing_hours_included','billing_overage_rate','billing_fixed_amount','billing_hourly_rate','billing_deadline','notes','completed_at','created','updated'], rows: Store.getMatters(null, { includeDeleted: true }) },
            { name: `tasks-${today}.csv`,    cols: ['id','clientId','clientName','matterId','matterName','title','deadline','priority','status','tags','notes','created','updated'], rows: Store.getTasks(null, { includeDeleted: true }) },
            { name: `timelogs-${today}.csv`, cols: ['id','date','clientName','matterName','taskTitle','hours','billable','source','note','invoiceId'], rows: Store.getTimeLogs() },
            { name: `invoices-${today}.csv`, cols: ['id','number','clientId','clientName','status','issued_at','due_at','paid_at','currency','subtotal','vat_amount','total','line_count','line_descriptions','line_amounts'], rows: Store.getInvoices(null, { includeDeleted: true }) },
        ];
        for (const file of downloads) {
            const blob = new Blob([csvFor(file.rows, file.cols)], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = file.name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5_000);
        }
        App.Omni._flash(`exported · ${downloads.length} CSV files`);
    },

    /** Resolve a CSV cell — flattens id-references into both id and human name. */
    _csvCell(r, col) {
        // Joined fields
        if (col === 'clientName') {
            const c = r.clientId ? Store.getClient(r.clientId) : null;
            return c?.name || '';
        }
        if (col === 'matterName') {
            const m = r.matterId ? Store.getMatter(r.matterId) : null;
            return m?.name || '';
        }
        if (col === 'taskTitle') {
            const t = r.taskId ? Store.getTask(r.taskId) : null;
            return t?.title || '';
        }
        // Flattened nested
        if (col.startsWith('billing_')) {
            const key = col.replace('billing_', '');
            return r.billing?.[key];
        }
        if (col === 'tags') return Array.isArray(r.tags) ? r.tags.join(';') : '';
        // Invoice line summaries
        if (col === 'line_count')        return r.lines?.length || 0;
        if (col === 'line_descriptions') return (r.lines || []).map(l => l.description).join(' | ');
        if (col === 'line_amounts')      return (r.lines || []).map(l => l.amount).join(' | ');
        return r[col];
    },

    /** Universal click-delegate for [data-open="kind"][data-id] links across all views.
       Lets every list cell / detail link navigate consistently:
         data-open="client"  → openClient(id)
         data-open="matter"  → openMatter(id)
         data-open="task"    → Edit modal
         data-open="invoice" → invoices view + expand
         data-open="meeting" → Edit modal */
    _bindUniversalLinks() {
        document.body.addEventListener('click', (e) => {
            const link = e.target.closest('[data-open][data-id]');
            if (!link) return;
            // Don't hijack clicks on buttons/inputs nested inside the link
            if (e.target.closest('button:not([data-open]), input, textarea, select')) return;
            e.preventDefault();
            e.stopPropagation();
            const kind = link.dataset.open;
            const id   = link.dataset.id;
            if (!id) return;
            switch (kind) {
                case 'client':  this.openClient(id); break;
                case 'matter':  this.openMatter(id); break;
                case 'task':    this.Edit.open('task', id); break;
                case 'meeting': this.Edit.open('meeting', id); break;
                case 'invoice': this.invoiceExpandedId = id; this.show('invoices'); break;
            }
        });
    },

    /** Online/offline indicator + queue gate for AI/Google calls. */
    _bindOnlineState() {
        const banner = document.getElementById('offline-banner');
        const set = () => {
            const off = !navigator.onLine;
            document.body.classList.toggle('is-offline', off);
            if (banner) banner.hidden = !off;
        };
        window.addEventListener('online',  set);
        window.addEventListener('offline', set);
        set();
    },

    isOnline() { return navigator.onLine; },

    /** Update only the Time nav row's count span (called from Timer._renderClock at 1 Hz). */
    _updateTimeNavCount() {
        const row = document.querySelector('#nav-views .nav-item[data-view="time"] .proj-count');
        if (!row) return;
        row.textContent = this._navCount('time') || '';
    },

    _navCount(view) {
        if (view === 'today')    return Store.getTodaysTasks().filter(t => t.status !== 'done').length;
        if (view === 'inbox')    return Store.getTasks().filter(t => t.status !== 'done').length;
        if (view === 'invoices') return Store.getInvoices().length;
        if (view === 'time') {
            // Live elapsed if timer is running, otherwise today's logged total.
            const t = Store.getTimer();
            const startOfDay = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
            const todayLogged = Store.getTimeLogs()
                .filter(l => l.date && new Date(l.date).getTime() >= startOfDay)
                .reduce((s, l) => s + (l.hours || 0), 0);
            let hours = todayLogged;
            if (t) {
                const live = (Date.now() - new Date(t.started_at).getTime()) / 3_600_000;
                hours += live;
            }
            if (hours <= 0) return '';
            const total = Math.round(hours * 60);
            return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        }
        return '';
    },

    // ============================================================
    // EVENTS
    // ============================================================
    bindEvents() {
        // Sidebar nav (delegated) — handles both top nav (data-view) and clients (data-action)
        document.getElementById('sidebar').addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item[data-view]');
            if (navItem) {
                this.show(navItem.dataset.view);
                document.body.classList.remove('sidebar-open');
                return;
            }
            const clientItem = e.target.closest('[data-action="select-client"]');
            if (clientItem) {
                this.openClient(clientItem.dataset.id);
                document.body.classList.remove('sidebar-open');
                return;
            }
        });
        // Hamburger toggles the sidebar drawer on mobile
        Dom.on('hamburger', 'click', () => {
            const open = document.body.classList.toggle('sidebar-open');
            document.getElementById('hamburger')?.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        // Click on the backdrop (body::after) closes the drawer
        document.addEventListener('click', (e) => {
            if (!document.body.classList.contains('sidebar-open')) return;
            const sb = document.getElementById('sidebar');
            const ham = document.getElementById('hamburger');
            if (sb && !sb.contains(e.target) && ham && !ham.contains(e.target)) {
                document.body.classList.remove('sidebar-open');
            }
        });
        Dom.on('brand-btn', 'click', () => this.show('today'));
        Dom.on('btn-settings', 'click', () => this.show('settings'));
        Dom.on('btn-trash',    'click', () => this.show('trash'));
        Dom.on('btn-audit',    'click', () => this.show('audit'));
        Dom.on('btn-add-client', 'click', () => {
            const name = prompt('Client name:');
            if (!name?.trim()) return;
            const c = Store.addClient({ name: name.trim() });
            this.renderSidebar();
            this.openClient(c.id);
            // Open Edit modal so the user can fill industry / email / currency right away
            setTimeout(() => this.Edit.open('client', c.id), 80);
            App.Omni._flash(`+ client · ${c.name}`);
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

        // Keyboard shortcuts.
        //   ⌘K           → fullscreen modal (or focus inline if no key)
        //   ⌘N           → focus omni (legacy capture alias)
        //   ⌘L           → focus omni + prefill "log "
        //   Esc          → close modals / blur omni
        //   /            → focus omni
        //   ?            → focus omni + prefill "?" (ask AI)
        //   t            → focus the running task's row OR trigger ▶ on the focused/first task
        //   x            → mark focused task done
        //   j / k        → move keyboard cursor down / up through tasks
        //   g g          → go to today
        //   g i          → go to inbox
        //   g c          → calendar
        //   g t          → time view
        //   g v          → invoices
        let chordPending = null;
        let chordTimer = null;

        const inEditable = (el) => {
            if (!el) return false;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
            return !!el.isContentEditable;
        };

        window.addEventListener('keydown', (e) => {
            // Cmd/Ctrl combos (legacy aliases) — work even inside inputs.
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                this.Omni.focus();
                if (this.Omni._input) { this.Omni._input.value = 'log '; this.Omni._input.setSelectionRange(4, 4); }
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                this.Omni.focus();
                return;
            }
            // Esc closes modals + log-call popover
            if (e.key === 'Escape') {
                this.closeLogCall();
                if (this.OmniK?._scrim && !this.OmniK._scrim.hidden) this.OmniK.close();
                const kbd = document.getElementById('kbd-scrim');
                if (kbd && !kbd.hidden) kbd.hidden = true;
                return;
            }

            // Single-key shortcuts — only when no input is focused and no modifier
            if (inEditable(document.activeElement)) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            // Chord pending? Resolve it.
            if (chordPending === 'g') {
                chordPending = null; clearTimeout(chordTimer);
                const map = { g: 'today', i: 'inbox', c: 'calendar', t: 'time', v: 'invoices', s: 'settings', w: 'digest', m: 'mail', r: 'reports', a: 'audit' };
                const dest = map[e.key.toLowerCase()];
                if (dest) { e.preventDefault(); this.show(dest); }
                return;
            }

            const k = e.key;
            if (k === '/') { e.preventDefault(); this.Omni.focus(); return; }
            if (k === '?') {
                // Shift+/ produces '?' on most layouts. Use it as the keyboard-help toggle.
                e.preventDefault();
                const scrim = document.getElementById('kbd-scrim');
                if (scrim) scrim.hidden = !scrim.hidden;
                return;
            }
            if (k === 'g') {
                chordPending = 'g';
                chordTimer = setTimeout(() => { chordPending = null; }, 800);
                return;
            }
            if (k === 'j' || k === 'k') {
                e.preventDefault();
                this._moveCursor(k === 'j' ? 1 : -1);
                return;
            }
            if (k === 'x') {
                e.preventDefault();
                const id = this._cursorTaskId;
                if (id) this.cycleTask(id);
                return;
            }
            if (k === 't') {
                e.preventDefault();
                const id = this._cursorTaskId;
                if (id) this.Timer.toggle(id);
                return;
            }
            if (k === 'e') {
                e.preventDefault();
                const id = this._cursorTaskId;
                if (id) this.Edit.open('task', id);
                return;
            }
            if (k === '#') {
                e.preventDefault();
                this.show('trash');
                return;
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
                <h1>${view}, <span class="accent">soon.</span></h1>
            </div>
        </div>
        <div style="padding:48px 32px;text-align:center;color:var(--fg-muted);font-family:var(--font-text)">
            <p style="max-width:48ch;margin:0 auto;line-height:1.5">This view ships in a later phase.</p>
        </div>`;
    },

    // ============================================================
    // VIEW: MAIL — Gmail integration, AI extracts tasks per message
    // ============================================================
    _mailCache: { messages: [], analysis: {} },  // { msgId → { tasks, meetings, summary } }

    render_mail(root) {
        if (!Store.getSetting('google_client_id') || !Store.getSetting('anthropic_api_key')) {
            root.innerHTML = `
                <div class="hero"><div class="left"><h1>mail</h1></div></div>
                <div class="empty-state">
                    <div class="es-title">Mail needs two keys.</div>
                    <div>Add your <strong>Anthropic API key</strong> and a <strong>Google OAuth Client ID</strong> in <button class="link-btn" data-go-settings type="button">Settings</button> — then connect Gmail.</div>
                </div>
            `;
            root.querySelector('[data-go-settings]')?.addEventListener('click', () => this.show('settings'));
            return;
        }

        if (!Gmail.isConnected()) {
            root.innerHTML = `
                <div class="hero"><div class="left"><h1>mail</h1></div></div>
                <div class="empty-state">
                    <div class="es-title">Connect Gmail.</div>
                    <div>Read-only access. AI will scan the last 14 days and suggest tasks per message.</div>
                    <div style="margin-top:14px"><button class="inv-act primary" data-mail-connect type="button">Connect Gmail</button></div>
                </div>
            `;
            root.querySelector('[data-mail-connect]')?.addEventListener('click', async () => {
                try {
                    await Gmail.connect();
                    this._mailCache = { messages: [], analysis: {} };
                    this.render_mail(root);
                }
                catch (e) { App.Omni._flash('gmail · ' + e.message); }
            });
            return;
        }

        // Render shell, then async-load list
        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <h1>${I18n.t('heroMail')}</h1>
                    <span class="hero-meta" id="mail-meta">loading…</span>
                </div>
                <div class="right">
                    <button class="inv-act ghost" data-mail-refresh type="button">↻ Refresh</button>
                </div>
            </div>
            <div class="time-section">
                <div id="mail-list" class="mail-list">loading recent messages…</div>
            </div>
        `;
        root.querySelector('[data-mail-refresh]')?.addEventListener('click', () => {
            this._mailCache = { messages: [], analysis: {} };
            this.render_mail(root);
        });

        this._loadMail(root);
    },

    async _loadMail(root) {
        const list = root.querySelector('#mail-list');
        const meta = root.querySelector('#mail-meta');
        try {
            // Use cached if we have it, else fetch
            if (!this._mailCache.messages.length) {
                const ids = await Gmail.listRecent({ max: 15 });
                meta.textContent = `loading ${ids.length} messages…`;
                const messages = [];
                for (const ref of ids) {
                    try { messages.push(await Gmail.getMessage(ref.id)); }
                    catch (_) {}
                }
                this._mailCache.messages = messages;
            }
            const messages = this._mailCache.messages;
            meta.textContent = `${messages.length} recent · last 14 days`;

            list.innerHTML = messages.map(m => this._mailRowHtml(m)).join('') ||
                `<div class="empty-state"><div class="es-title">Inbox is calm.</div></div>`;

            // Wire row clicks
            list.querySelectorAll('.mail-row').forEach(r => {
                r.addEventListener('click', (e) => {
                    if (e.target.closest('[data-mail-accept], [data-mail-paste]')) return;
                    r.classList.toggle('expanded');
                    this._analyzeMail(r.dataset.msgId, root);
                });
            });
            list.querySelectorAll('[data-mail-paste]').forEach(b => b.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = b.dataset.msgId;
                const msg = messages.find(m => m.id === id);
                if (!msg) return;
                App.OmniK.open(`Email from ${msg.from}\nSubject: ${msg.subject}\n\n${msg.body}`);
            }));
            list.querySelectorAll('[data-mail-accept]').forEach(b => b.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = b.dataset.msgId;
                const idx = parseInt(b.dataset.taskIdx, 10);
                const a = this._mailCache.analysis[id];
                const taskFields = a?.tasks?.[idx];
                if (!taskFields) return;
                Store.addTask({
                    title: taskFields.title || '(from email)',
                    deadline: taskFields.deadline || null,
                    priority: taskFields.priority || 'medium',
                    clientId: taskFields.clientId || null,
                    matterId: taskFields.matterId || null,
                    status: 'todo',
                    tags: ['email'],
                });
                App.Omni._flash(`captured · ${(taskFields.title || '').slice(0, 30)}`);
                this.renderSidebar();
                // Mark this one as accepted
                b.disabled = true;
                b.textContent = '✓ added';
            }));
        } catch (err) {
            list.innerHTML = `<div class="empty-state"><div class="es-title">Gmail error</div><div>${Dom.escape(err.message)}</div></div>`;
        }
    },

    _mailRowHtml(m) {
        const date = m.date ? new Date(m.date) : null;
        const dateStr = date ? `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}` : '';
        const fromShort = (m.from || '').replace(/<.*?>/, '').trim().slice(0, 32);
        const a = this._mailCache.analysis[m.id];
        const taskCount = a?.tasks?.length || 0;
        const meetCount = a?.meetings?.length || 0;
        const badge = a
            ? (taskCount + meetCount === 0 ? `<span class="mail-badge none">no actions</span>`
                                            : `<span class="mail-badge ai">${taskCount + meetCount} suggested</span>`)
            : '<span class="mail-badge pending">·</span>';
        const tasks = a?.tasks?.map((t, i) => `
            <div class="mail-task">
                <div class="mt-title">${Dom.escape(t.title || '')}</div>
                ${t.deadline ? `<div class="mt-meta">due ${Dom.escape(new Date(t.deadline).toISOString().slice(0,16).replace('T',' '))}</div>` : ''}
                <button class="inv-act primary" data-mail-accept data-msg-id="${m.id}" data-task-idx="${i}" type="button">+ add</button>
            </div>
        `).join('') || '';
        const summary = a?.summary ? `<div class="mail-summary"><strong>AI ▸</strong> ${Dom.escape(a.summary)}</div>` : '';

        return `<div class="mail-row ${m.unread ? 'unread' : ''}" data-msg-id="${m.id}">
            <div class="mail-head">
                <span class="mail-date">${dateStr}</span>
                <span class="mail-from">${Dom.escape(fromShort)}</span>
                <span class="mail-subj">${Dom.escape(m.subject || '(no subject)')}</span>
                ${badge}
            </div>
            <div class="mail-snippet">${Dom.escape(m.snippet)}</div>
            <div class="mail-detail">
                ${summary}
                ${tasks ? `<div class="mail-tasks">${tasks}</div>` : ''}
                <div class="mail-actions">
                    <button class="inv-act ghost" data-mail-paste data-msg-id="${m.id}" type="button">⌘K · custom parse</button>
                </div>
            </div>
        </div>`;
    },

    async _analyzeMail(msgId, root) {
        if (this._mailCache.analysis[msgId]) return;  // already analyzed
        const msg = this._mailCache.messages.find(m => m.id === msgId);
        if (!msg) return;
        this._mailCache.analysis[msgId] = { _pending: true };
        // Re-render to show pending state (current row stays expanded)
        const row = root.querySelector(`.mail-row[data-msg-id="${msgId}"]`);
        if (row) {
            const detail = row.querySelector('.mail-detail');
            if (detail) detail.innerHTML = `<div class="mail-summary"><strong>AI ▸</strong> analysing<span class="omnik-dot"></span></div>`;
        }
        try {
            const data = await AI.parseEmail({
                from: msg.from, subject: msg.subject, body: msg.body, date: msg.date,
            });
            this._mailCache.analysis[msgId] = data;
            // Re-render only this row to keep scroll position
            this._refreshMailRow(msgId, root);
        } catch (e) {
            this._mailCache.analysis[msgId] = { summary: 'AI error: ' + e.message, tasks: [], meetings: [] };
            this._refreshMailRow(msgId, root);
        }
    },

    _refreshMailRow(msgId, root) {
        const msg = this._mailCache.messages.find(m => m.id === msgId);
        const row = root.querySelector(`.mail-row[data-msg-id="${msgId}"]`);
        if (!msg || !row) return;
        const wasExpanded = row.classList.contains('expanded');
        row.outerHTML = this._mailRowHtml(msg);
        const fresh = root.querySelector(`.mail-row[data-msg-id="${msgId}"]`);
        if (!fresh) return;
        if (wasExpanded) fresh.classList.add('expanded');
        // Re-bind handlers for fresh row
        fresh.addEventListener('click', (e) => {
            if (e.target.closest('[data-mail-accept], [data-mail-paste]')) return;
            fresh.classList.toggle('expanded');
            this._analyzeMail(msgId, root);
        });
        fresh.querySelectorAll('[data-mail-paste]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation();
            App.OmniK.open(`Email from ${msg.from}\nSubject: ${msg.subject}\n\n${msg.body}`);
        }));
        fresh.querySelectorAll('[data-mail-accept]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(b.dataset.taskIdx, 10);
            const taskFields = this._mailCache.analysis[msgId]?.tasks?.[idx];
            if (!taskFields) return;
            Store.addTask({
                title: taskFields.title || '(from email)',
                deadline: taskFields.deadline || null,
                priority: taskFields.priority || 'medium',
                clientId: taskFields.clientId || null,
                matterId: taskFields.matterId || null,
                status: 'todo',
                tags: ['email'],
            });
            App.Omni._flash(`captured · ${(taskFields.title || '').slice(0, 30)}`);
            this.renderSidebar();
            b.disabled = true;
            b.textContent = '✓ added';
        }));
    },

    // ============================================================
    // VIEW: DIGEST — Friday-style weekly review (printable)
    // ============================================================
    render_digest(root) {
        const now = new Date();
        const startWeek = (() => { const d = new Date(now); d.setHours(0,0,0,0); const dow = (d.getDay()+6)%7; d.setDate(d.getDate()-dow); return d; })();
        const endWeek   = (() => { const d = new Date(startWeek); d.setDate(d.getDate()+6); d.setHours(23,59,59,999); return d; })();
        const startMs = startWeek.getTime(), endMs = endWeek.getTime();
        const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
        const fmtHM = (h) => {
            const total = Math.round((h || 0) * 60);
            return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        };

        const weekLogs = Store.getTimeLogs().filter(l => {
            const ts = new Date(l.date).getTime();
            return ts >= startMs && ts <= endMs;
        });
        const totalH = weekLogs.reduce((s, l) => s + (l.hours || 0), 0);
        const billH = weekLogs.filter(l => l.billable !== false).reduce((s, l) => s + (l.hours || 0), 0);

        // Top matters
        const byMatter = {};
        for (const l of weekLogs) {
            if (!l.matterId) continue;
            byMatter[l.matterId] = (byMatter[l.matterId] || 0) + (l.hours || 0);
        }
        const topMatters = Object.entries(byMatter)
            .map(([mid, h]) => ({ matter: Store.getMatter(mid), hours: h }))
            .filter(x => x.matter)
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 8);
        const projected = topMatters.reduce((s, x) => {
            const r = x.matter.billing?.mode === 'hourly' ? (x.matter.billing.hourly_rate || 0) : 0;
            return s + x.hours * r;
        }, 0);

        // Overdue tasks + invoices
        const overdueTasks = Store.getTasks().filter(t =>
            t.status !== 'done' && t.deadline && new Date(t.deadline).getTime() < Date.now()
        );
        const overdueInvoices = Store.getInvoices().filter(i =>
            i.status === 'sent' && i.due_at && new Date(i.due_at).getTime() < Date.now()
        );

        // Tasks completed this week
        const doneThisWeek = Store.getTasks().filter(t => {
            if (t.status !== 'done') return false;
            const ts = new Date(t.updated || t.created).getTime();
            return ts >= startMs && ts <= endMs;
        });

        const matterRows = topMatters.map(x => {
            const c = x.matter.clientId ? Store.getClient(x.matter.clientId) : null;
            return `<tr>
                <td><a class="cell-link" data-open="matter" data-id="${x.matter.id}">${Dom.escape(x.matter.name)}</a></td>
                <td class="mode-cell">${c ? `<a class="cell-link" data-open="client" data-id="${c.id}">${Dom.escape(c.name)}</a>` : '—'}</td>
                <td class="num">${fmtHM(x.hours)}</td>
            </tr>`;
        }).join('') || `<tr><td colspan="3" class="empty-cell">No logged time this week.</td></tr>`;

        const overdueTaskRows = overdueTasks.slice(0, 10).map(t => {
            const m = t.matterId ? Store.getMatter(t.matterId) : null;
            return `<tr>
                <td><a class="cell-link" data-open="task" data-id="${t.id}">${Dom.escape(t.title)}</a></td>
                <td class="mode-cell">${m ? `<a class="cell-link" data-open="matter" data-id="${m.id}">${Dom.escape(m.name)}</a>` : '—'}</td>
                <td class="num">${fmtDate(new Date(t.deadline))}</td>
            </tr>`;
        }).join('') || `<tr><td colspan="3" class="empty-cell">All clear.</td></tr>`;

        const overdueInvRows = overdueInvoices.map(i => {
            const c = i.clientId ? Store.getClient(i.clientId) : null;
            return `<tr>
                <td class="inv-num"><a class="cell-link" data-open="invoice" data-id="${i.id}">${Dom.escape(i.number)}</a></td>
                <td>${c ? `<a class="cell-link" data-open="client" data-id="${c.id}">${Dom.escape(c.name)}</a>` : '—'}</td>
                <td class="num">€${(i.total||0).toLocaleString('en-US')}</td>
                <td class="num">${fmtDate(new Date(i.due_at))}</td>
            </tr>`;
        }).join('') || `<tr><td colspan="4" class="empty-cell">All invoices on time.</td></tr>`;

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <h1>${I18n.t('heroDigest')}</h1>
                    <span class="hero-meta">${fmtDate(startWeek)} — ${fmtDate(endWeek)} · ${fmtHM(billH)} billable · €${Math.round(projected)} hourly</span>
                </div>
                <div class="right">
                    <button class="inv-act ghost" data-print-digest type="button">⎙ Print / PDF</button>
                </div>
            </div>

            <div class="time-section digest-stats">
                <div class="ds-stat"><div class="lbl">total</div><div class="val">${fmtHM(totalH)}</div></div>
                <div class="ds-stat"><div class="lbl">billable</div><div class="val accent">${fmtHM(billH)}</div></div>
                <div class="ds-stat"><div class="lbl">€ projected</div><div class="val accent">€${Math.round(projected).toLocaleString('en-US')}</div></div>
                <div class="ds-stat"><div class="lbl">tasks done</div><div class="val">${doneThisWeek.length}</div></div>
                <div class="ds-stat"><div class="lbl">overdue tasks</div><div class="val ${overdueTasks.length ? 'danger' : ''}">${overdueTasks.length}</div></div>
                <div class="ds-stat"><div class="lbl">overdue inv</div><div class="val ${overdueInvoices.length ? 'danger' : ''}">${overdueInvoices.length}</div></div>
            </div>

            <div class="time-section">
                <div class="time-section-head">top matters this week</div>
                <table class="time-table">
                    <colgroup><col><col style="width:200px"><col style="width:90px"></colgroup>
                    <thead><tr><th>Matter</th><th>Client</th><th class="num">Hours</th></tr></thead>
                    <tbody>${matterRows}</tbody>
                </table>
            </div>

            ${overdueTasks.length ? `
                <div class="time-section">
                    <div class="time-section-head">overdue tasks · ${overdueTasks.length}</div>
                    <table class="time-table">
                        <colgroup><col><col style="width:200px"><col style="width:90px"></colgroup>
                        <thead><tr><th>Title</th><th>Matter</th><th class="num">Was due</th></tr></thead>
                        <tbody>${overdueTaskRows}</tbody>
                    </table>
                </div>
            ` : ''}

            ${overdueInvoices.length ? `
                <div class="time-section">
                    <div class="time-section-head">overdue invoices · ${overdueInvoices.length}</div>
                    <table class="time-table">
                        <colgroup><col style="width:160px"><col><col style="width:100px"><col style="width:90px"></colgroup>
                        <thead><tr><th>Number</th><th>Client</th><th class="num">Total</th><th class="num">Was due</th></tr></thead>
                        <tbody>${overdueInvRows}</tbody>
                    </table>
                </div>
            ` : ''}
        `;
        root.querySelectorAll('[data-print-digest]').forEach(b => b.addEventListener('click', () => {
            document.body.classList.add('printing-digest');
            setTimeout(() => {
                window.print();
                setTimeout(() => document.body.classList.remove('printing-digest'), 200);
            }, 80);
        }));
    },

    // ============================================================
    // VIEW: REPORTS — period-bucketed stats (D / W / M / Q / Y)
    // ============================================================
    render_reports(root) {
        const period = this.reportPeriod || 'week';
        const now = new Date();
        const range = this._reportRange(period, now);
        const startMs = range.start.getTime();
        const endMs   = range.end.getTime();

        const inRange = (iso) => {
            if (!iso) return false;
            const t = new Date(iso).getTime();
            return t >= startMs && t <= endMs;
        };
        const fmtHM = (h) => {
            const total = Math.round((h || 0) * 60);
            return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        };
        const fmtDate = (d) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

        // === Tasks ===
        const tasksAll = Store.getTasks({ includeDeleted: true });
        const tasksDone = tasksAll.filter(t => t.status === 'done' && inRange(t.updated || t.created));
        const tasksCreated = tasksAll.filter(t => inRange(t.created));
        const overdueNow = Store.getTasks().filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline).getTime() < Date.now()).length;

        // === Time logs ===
        const logs = Store.getTimeLogs().filter(l => inRange(l.date));
        const totalH = logs.reduce((s, l) => s + (l.hours || 0), 0);
        const billH  = logs.filter(l => l.billable !== false).reduce((s, l) => s + (l.hours || 0), 0);

        // === Per-matter ===
        const byMatter = {};
        for (const l of logs) {
            if (!l.matterId) continue;
            byMatter[l.matterId] = (byMatter[l.matterId] || 0) + (l.hours || 0);
        }
        const matterRows = Object.entries(byMatter)
            .map(([mid, h]) => {
                const m = Store.getMatter(mid);
                if (!m) return null;
                const c = m.clientId ? Store.getClient(m.clientId) : null;
                const rate = m.billing?.mode === 'hourly' ? (m.billing.hourly_rate || 0) : 0;
                return { matter: m, client: c, hours: h, rate, amount: h * rate };
            })
            .filter(Boolean)
            .sort((a, b) => b.hours - a.hours);
        const projected = matterRows.reduce((s, r) => s + r.amount, 0);

        // === Per-client ===
        const byClient = {};
        for (const r of matterRows) {
            const cid = r.matter.clientId || 'orphan';
            byClient[cid] = (byClient[cid] || 0) + r.hours;
        }
        const clientRows = Object.entries(byClient)
            .map(([cid, h]) => ({ client: cid === 'orphan' ? null : Store.getClient(cid), hours: h }))
            .sort((a, b) => b.hours - a.hours);

        // === Invoices ===
        const invsIssued = Store.getInvoices().filter(i => inRange(i.issued_at));
        const invsPaid   = Store.getInvoices().filter(i => i.paid_at && inRange(i.paid_at));
        const invsAmount = invsIssued.reduce((s, i) => s + (i.total || 0), 0);
        const paidAmount = invsPaid.reduce((s, i) => s + (i.total || 0), 0);

        // === Productivity ===
        const days = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
        const avgPerDay = totalH / days;
        const taskCloseRate = tasksCreated.length ? (tasksDone.length / tasksCreated.length * 100) : null;

        const periodBtn = (key, label) =>
            `<button class="${period === key ? 'active' : ''}" data-period="${key}" type="button">${label}</button>`;

        const matterTbody = matterRows.length
            ? matterRows.map(r => `<tr>
                <td><a class="cell-link" data-open="matter" data-id="${r.matter.id}">${Dom.escape(r.matter.name)}</a></td>
                <td class="mode-cell">${r.client ? `<a class="cell-link" data-open="client" data-id="${r.client.id}">${Dom.escape(r.client.name)}</a>` : '—'}</td>
                <td class="num">${fmtHM(r.hours)}</td>
                <td class="num">${r.amount ? '€' + Math.round(r.amount) : '<span class="fade">—</span>'}</td>
            </tr>`).join('')
            : `<tr><td colspan="4" class="empty-cell">No matter activity in this period.</td></tr>`;

        const clientTbody = clientRows.length
            ? clientRows.map(r => `<tr>
                <td>${r.client ? `<a class="cell-link" data-open="client" data-id="${r.client.id}">${Dom.escape(r.client.name)}</a>` : '— orphan'}</td>
                <td class="num">${fmtHM(r.hours)}</td>
            </tr>`).join('')
            : `<tr><td colspan="2" class="empty-cell">No client activity.</td></tr>`;

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <h1>${I18n.t('heroReports')}</h1>
                    <span class="hero-meta">${fmtDate(range.start)} — ${fmtDate(range.end)} · ${range.label}</span>
                </div>
                <div class="right">
                    <div class="mode-toggle" role="group" aria-label="Period">
                        ${periodBtn('day',     'Day')}
                        ${periodBtn('week',    'Week')}
                        ${periodBtn('month',   'Month')}
                        ${periodBtn('quarter', 'Quarter')}
                        ${periodBtn('year',    'Year')}
                    </div>
                    <button class="inv-act ghost" data-print-report type="button">⎙ Print / PDF</button>
                </div>
            </div>

            <div class="time-section digest-stats">
                <div class="ds-stat"><div class="lbl">total time</div><div class="val">${fmtHM(totalH)}</div></div>
                <div class="ds-stat"><div class="lbl">billable</div><div class="val accent">${fmtHM(billH)}</div></div>
                <div class="ds-stat"><div class="lbl">€ hourly proj.</div><div class="val accent">€${Math.round(projected).toLocaleString('en-US')}</div></div>
                <div class="ds-stat"><div class="lbl">tasks closed</div><div class="val">${tasksDone.length}</div></div>
                <div class="ds-stat"><div class="lbl">tasks created</div><div class="val">${tasksCreated.length}</div></div>
                <div class="ds-stat"><div class="lbl">close rate</div><div class="val">${taskCloseRate == null ? '—' : Math.round(taskCloseRate) + '%'}</div></div>
                <div class="ds-stat"><div class="lbl">overdue now</div><div class="val ${overdueNow ? 'danger' : ''}">${overdueNow}</div></div>
                <div class="ds-stat"><div class="lbl">avg / day</div><div class="val">${fmtHM(avgPerDay)}</div></div>
                <div class="ds-stat"><div class="lbl">invoices sent</div><div class="val">${invsIssued.length}</div></div>
                <div class="ds-stat"><div class="lbl">€ invoiced</div><div class="val accent">€${Math.round(invsAmount).toLocaleString('en-US')}</div></div>
                <div class="ds-stat"><div class="lbl">€ paid</div><div class="val accent">€${Math.round(paidAmount).toLocaleString('en-US')}</div></div>
            </div>

            <div class="time-section">
                <div class="time-section-head">by matter</div>
                <table class="time-table">
                    <colgroup><col><col style="width:200px"><col style="width:90px"><col style="width:90px"></colgroup>
                    <thead><tr><th>Matter</th><th>Client</th><th class="num">Hours</th><th class="num">€</th></tr></thead>
                    <tbody>${matterTbody}</tbody>
                </table>
            </div>

            <div class="time-section">
                <div class="time-section-head">by client</div>
                <table class="time-table">
                    <colgroup><col><col style="width:90px"></colgroup>
                    <thead><tr><th>Client</th><th class="num">Hours</th></tr></thead>
                    <tbody>${clientTbody}</tbody>
                </table>
            </div>
        `;
        root.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => {
            this.reportPeriod = b.dataset.period;
            this.render_reports(root);
        }));
        root.querySelectorAll('[data-print-report]').forEach(b => b.addEventListener('click', () => {
            document.body.classList.add('printing-digest');
            setTimeout(() => {
                window.print();
                setTimeout(() => document.body.classList.remove('printing-digest'), 200);
            }, 80);
        }));
    },

    /** Wire the +Log inline form (called from render_time after innerHTML set). */
    _wireAddLogForm(root) {
        const form = root.querySelector('#add-log-form');
        const btn  = root.querySelector('[data-add-log]');
        if (!form || !btn) return;
        btn.addEventListener('click', () => {
            form.hidden = !form.hidden;
            if (!form.hidden) setTimeout(() => root.querySelector('#alf-hours')?.focus(), 50);
        });
        const matterSel = root.querySelector('#alf-matter');
        const taskSel   = root.querySelector('#alf-task');
        matterSel?.addEventListener('change', () => {
            const mid = matterSel.value;
            const tasks = mid ? Store.getTasks(mid).filter(t => t.status !== 'done') : [];
            taskSel.innerHTML = '<option value="">— none —</option>' +
                tasks.map(t => `<option value="${t.id}">${Dom.escape(t.title)}</option>`).join('');
        });
        root.querySelector('#alf-cancel')?.addEventListener('click', () => { form.hidden = true; });
        root.querySelector('#alf-save')?.addEventListener('click', () => {
            const hours = parseFloat(root.querySelector('#alf-hours').value);
            if (!hours || hours <= 0) { App.Omni._flash('hours?'); return; }
            const matterId = root.querySelector('#alf-matter').value || null;
            if (!matterId) { App.Omni._flash('pick matter'); return; }
            const dateStr = root.querySelector('#alf-date').value;
            const date = dateStr ? new Date(dateStr + 'T12:00:00').toISOString() : new Date().toISOString();
            const taskId   = root.querySelector('#alf-task').value || null;
            const note     = root.querySelector('#alf-note').value.trim();
            const billable = root.querySelector('#alf-billable').checked;
            Store.addTimeLog({ taskId, matterId, hours, date, billable, note, source: 'manual' });
            App.Omni._flash(`+ ${hours}h logged`);
            this.render_time(root);   // re-renders → form is hidden again by default
        });
    },

    /** Compute start/end Date objects for a period anchored to today. */
    _reportRange(period, now = new Date()) {
        const start = new Date(now);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        let label = '';
        if (period === 'day') {
            start.setHours(0, 0, 0, 0);
            label = 'today';
        } else if (period === 'week') {
            const dow = (start.getDay() + 6) % 7;
            start.setDate(start.getDate() - dow);
            start.setHours(0, 0, 0, 0);
            const e = new Date(start); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999);
            end.setTime(e.getTime());
            label = `week ${this._weekNumber(start)}`;
        } else if (period === 'month') {
            start.setDate(1); start.setHours(0, 0, 0, 0);
            const e = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
            end.setTime(e.getTime());
            label = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(start).toLowerCase();
        } else if (period === 'quarter') {
            const q = Math.floor(start.getMonth() / 3);
            start.setMonth(q * 3, 1); start.setHours(0, 0, 0, 0);
            const e = new Date(start.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
            end.setTime(e.getTime());
            label = `Q${q + 1} ${start.getFullYear()}`;
        } else if (period === 'year') {
            start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
            const e = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
            end.setTime(e.getTime());
            label = `${start.getFullYear()}`;
        }
        return { start, end, label };
    },

    _weekNumber(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date - yearStart) / 86_400_000) + 1) / 7);
    },

    // ============================================================
    // VIEW: AUDIT — append-only change log (last ~500 events)
    // ============================================================
    auditFilter: 'all',  // 'all' | 'create' | 'update' | 'delete' | 'restore'

    render_audit(root) {
        const all = (Store._data.audit || []).slice().reverse();   // newest first
        const filtered = this.auditFilter === 'all'
            ? all
            : all.filter(e => e.op === this.auditFilter);

        const opIcon = { create: '+', update: '↻', delete: '✕', restore: '↶' };
        const opCls  = { create: 'op-create', update: 'op-update', delete: 'op-delete', restore: 'op-restore' };
        const fmtAgo = (iso) => {
            const ms = Date.now() - new Date(iso).getTime();
            if (ms < 60_000)         return 'just now';
            if (ms < 3_600_000)      return Math.floor(ms / 60_000) + 'm ago';
            if (ms < 86_400_000)     return Math.floor(ms / 3_600_000) + 'h ago';
            return Math.floor(ms / 86_400_000) + 'd ago';
        };
        const fmtDateTime = (iso) => {
            const d = new Date(iso);
            const pad = n => String(n).padStart(2, '0');
            return `${pad(d.getDate())}.${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        const filterBtn = (key, label) => `<button class="${this.auditFilter === key ? 'active' : ''}" data-audit-filter="${key}" type="button">${label}</button>`;

        const rows = filtered.length
            ? filtered.map(e => {
                const detailsHtml = (e.details && Array.isArray(e.details))
                    ? `<div class="audit-details">${e.details.map(d =>
                        `<span class="audit-field"><span class="k">${Dom.escape(d.key)}</span> ${Dom.escape(this._fmtAuditValue(d.before))} → <strong>${Dom.escape(this._fmtAuditValue(d.after))}</strong></span>`
                      ).join('')}</div>`
                    : '';
                return `<tr>
                    <td class="audit-when" title="${Dom.escape(e.ts)}">${fmtDateTime(e.ts)}<div class="ago">${fmtAgo(e.ts)}</div></td>
                    <td class="audit-op ${opCls[e.op] || ''}"><span class="op-icon">${opIcon[e.op] || '·'}</span> ${e.op}</td>
                    <td class="audit-entity">${e.entity}</td>
                    <td class="audit-summary">${Dom.escape(e.summary || '')}${detailsHtml}</td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="4" class="empty-cell">No audit entries${this.auditFilter !== 'all' ? ' for this filter' : ''}.</td></tr>`;

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <h1>${I18n.t('heroAudit')}</h1>
                    <span class="hero-meta">${all.length} event${all.length === 1 ? '' : 's'} · last ${Store.AUDIT_MAX || 500} kept</span>
                </div>
                <div class="right">
                    <div class="mode-toggle" role="group" aria-label="Filter">
                        ${filterBtn('all',     'All')}
                        ${filterBtn('create',  'Create')}
                        ${filterBtn('update',  'Update')}
                        ${filterBtn('delete',  'Delete')}
                        ${filterBtn('restore', 'Restore')}
                    </div>
                    <button class="inv-act ghost" data-audit-action="export" type="button">⤓ CSV</button>
                    <button class="inv-act ghost" data-audit-action="clear" type="button" style="border-color:var(--vermillion);color:var(--vermillion)">Clear log</button>
                </div>
            </div>
            <div class="time-section">
                <table class="time-table audit-table">
                    <colgroup><col style="width:130px"><col style="width:120px"><col style="width:100px"><col></colgroup>
                    <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        root.querySelectorAll('[data-audit-filter]').forEach(b => b.addEventListener('click', () => {
            this.auditFilter = b.dataset.auditFilter;
            this.render_audit(root);
        }));
        root.querySelectorAll('[data-audit-action]').forEach(b => b.addEventListener('click', () => {
            const action = b.dataset.auditAction;
            if (action === 'clear') {
                if (!confirm('Clear the audit log? This cannot be undone.')) return;
                Store._data.audit = [];
                Store.flush();
                this.render_audit(root);
                App.Omni._flash('audit cleared');
            } else if (action === 'export') {
                const cols = ['ts', 'op', 'entity', 'id', 'summary', 'details'];
                const esc = (v) => {
                    if (v == null) return '';
                    const s = (typeof v === 'object') ? JSON.stringify(v) : String(v);
                    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                };
                const lines = [cols.join(',')];
                for (const e of (Store._data.audit || [])) {
                    lines.push(cols.map(c => esc(e[c])).join(','));
                }
                const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `audit-${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 5_000);
                App.Omni._flash('exported');
            }
        }));
    },

    _fmtAuditValue(v) {
        if (v == null) return '—';
        if (typeof v === 'object') return JSON.stringify(v).slice(0, 40);
        const s = String(v);
        return s.length > 40 ? s.slice(0, 40) + '…' : s;
    },

    // ============================================================
    // VIEW: TRASH — soft-deleted items, restorable for 30 days
    // ============================================================
    render_trash(root) {
        const items = Store.listTrash();
        const fmtAgo = (iso) => {
            const ms = Date.now() - new Date(iso).getTime();
            const days = Math.floor(ms / 86_400_000);
            const hours = Math.floor(ms / 3_600_000);
            return days >= 1 ? `${days}d ago` : (hours >= 1 ? `${hours}h ago` : 'just now');
        };
        const remaining = (iso) => {
            const horizonMs = new Date(iso).getTime() + Store.TRASH_RETENTION_DAYS * 86_400_000;
            const days = Math.ceil((horizonMs - Date.now()) / 86_400_000);
            return Math.max(0, days);
        };
        const niceType = { tasks: 'task', matters: 'matter', clients: 'client', meetings: 'meeting', invoices: 'invoice' };
        const titleOf = (e) => e.title || e.name || e.number || '(unnamed)';

        const rows = items.length
            ? items.map(it => `<tr data-trash-id="${it.entity.id}" data-trash-type="${it.type}">
                <td class="mode-cell">${niceType[it.type]}</td>
                <td>${Dom.escape(titleOf(it.entity))}</td>
                <td class="num">${fmtAgo(it.deletedAt)}</td>
                <td class="num">in ${remaining(it.deletedAt)}d</td>
                <td>
                    <button class="inv-act ghost" data-trash-action="restore" type="button">↶ Restore</button>
                    <button class="inv-act ghost" data-trash-action="purge" type="button" style="border-color:var(--vermillion);color:var(--vermillion)">Delete forever</button>
                </td>
            </tr>`).join('')
            : `<tr><td colspan="5" class="empty-cell">Trash is empty.</td></tr>`;

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <h1>${I18n.t('heroTrash')}</h1>
                    <span class="hero-meta">${items.length} item${items.length === 1 ? '' : 's'} · auto-purge after ${Store.TRASH_RETENTION_DAYS} days</span>
                </div>
            </div>
            <div class="time-section">
                <table class="time-table">
                    <colgroup><col style="width:90px"><col><col style="width:90px"><col style="width:90px"><col style="width:240px"></colgroup>
                    <thead><tr><th>Type</th><th>Title</th><th class="num">Deleted</th><th class="num">Auto-purge</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        root.querySelectorAll('[data-trash-action]').forEach(b => b.addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-trash-id]');
            if (!tr) return;
            const id   = tr.dataset.trashId;
            const type = tr.dataset.trashType;
            const action = b.dataset.trashAction;
            if (action === 'restore') {
                Store.restoreEntity(type, id);
                App.Omni._flash('restored');
            } else if (action === 'purge') {
                if (!confirm('Permanently delete? This cannot be undone.')) return;
                const map = { tasks: 'deleteTask', matters: 'deleteMatter', clients: 'deleteClient', meetings: 'deleteMeeting', invoices: 'deleteInvoice' };
                Store[map[type]](id, { permanent: true });
                App.Omni._flash('purged');
            }
            this.render_trash(root);
            this.renderSidebar();
        }));
    },

    // ============================================================
    // SETUP WIZARD — first-run flow that walks through API keys + profile
    // ============================================================
    Setup: {
        _app: null,
        _scrim: null,
        _body: null,
        _stepEl: null,
        _backBtn: null,
        _nextBtn: null,
        _step: 0,
        _origin: '',

        init(app) {
            this._app = app;
            this._scrim   = document.getElementById('setup-scrim');
            this._body    = document.getElementById('setup-body');
            this._stepEl  = document.getElementById('setup-step');
            this._backBtn = document.getElementById('setup-back');
            this._nextBtn = document.getElementById('setup-next');
            this._origin  = location.origin;
            if (!this._scrim) return;
            this._backBtn.addEventListener('click', () => this._go(-1));
            this._nextBtn.addEventListener('click', () => this._go(+1));
            document.getElementById('setup-skip')?.addEventListener('click', () => {
                Store.setSetting('setup_dismissed', true);
                this.close();
            });
        },

        /** Returns true if first-run setup hasn't been completed (and isn't skipped). */
        needed() {
            if (Store.getSetting('setup_dismissed')) return false;
            if (Store.getSetting('setup_completed')) return false;
            // Heuristic: nothing important configured yet
            const profile = Store.getSetting('profile') || {};
            return !Store.getSetting('anthropic_api_key') && !profile.name;
        },

        open() {
            this._step = 0;
            this._scrim.hidden = false;
            this._render();
        },

        close() {
            this._scrim.hidden = true;
        },

        _go(delta) {
            this._save();
            const next = this._step + delta;
            if (next < 0) return;
            if (next >= this._steps.length) {
                Store.setSetting('setup_completed', new Date().toISOString());
                this.close();
                App.Omni._flash('all set · welcome');
                App.show('today');
                App.renderSidebar();
                return;
            }
            this._step = next;
            this._render();
        },

        _save() {
            this._body.querySelectorAll('[data-setup-field]').forEach(inp => {
                const k = inp.dataset.setupField;
                const v = inp.value.trim();
                if (k.startsWith('profile.')) {
                    if (!Store._data.settings.profile) Store._data.settings.profile = {};
                    Store._data.settings.profile[k.replace('profile.', '')] = v;
                } else {
                    Store.setSetting(k, v);
                }
            });
            Store.flush();
        },

        _render() {
            const step = this._steps[this._step];
            const profile = Store.getSetting('profile') || {};
            this._stepEl.textContent = `step ${this._step + 1} of ${this._steps.length}`;
            this._backBtn.style.visibility = this._step === 0 ? 'hidden' : 'visible';
            this._nextBtn.textContent = this._step === this._steps.length - 1 ? 'Finish ✓' : 'Next ›';
            // Step title is hardcoded; intro is hardcoded HTML with {{origin}} substitution.
            // Origin is window.location.origin (browser-controlled, not user input).
            const safeOrigin = this._origin.replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'})[c]);
            const intro = step.intro.replace(/\{\{origin\}\}/g, safeOrigin);
            this._body.innerHTML = `
                <h2 class="setup-h">${Dom.escape(step.title)}</h2>
                <p class="setup-p">${intro}</p>
                ${step.fields(profile, safeOrigin)}
            `;
        },

        _steps: [
            {
                title: 'Hi.',
                intro: 'ordify is a private practice manager. Everything lives in your browser; nothing goes to any server we run. We\'ll set up your profile, your AI key, and Google integrations — about 5 minutes.',
                fields: (p) => `
                    <label class="set-field set-field-wide">
                        <span>Your firm name</span>
                        <input type="text" data-setup-field="profile.name" value="${Dom.escape(p.name || '')}" placeholder="Sergiy Vasylenko · Legal Practice">
                    </label>
                    <label class="set-field set-field-wide">
                        <span>Your email</span>
                        <input type="email" data-setup-field="profile.email" value="${Dom.escape(p.email || '')}" placeholder="you@firm.eu">
                    </label>
                `,
            },
            {
                title: 'AI · Anthropic.',
                intro: 'Used for ⌘K structured parsing, ?ask queries, and email-to-task extraction. You provide your own key — ordify never sees it. Get one at <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>.',
                fields: () => `
                    <label class="set-field set-field-wide">
                        <span>Anthropic API key</span>
                        <input type="password" data-setup-field="anthropic_api_key" value="${Dom.escape(Store.getSetting('anthropic_api_key') || '')}" placeholder="sk-ant-…" autocomplete="off">
                        <small class="set-help-inline">Stored encrypted in your browser. You can leave blank now and add later in Settings.</small>
                    </label>
                `,
            },
            {
                title: 'Google · OAuth.',
                intro: `For Gmail, Calendar, and encrypted Sheets backup. Create an OAuth Client at <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a>:<ol class="setup-list">
                    <li>Create a new project (or pick an existing one)</li>
                    <li>Enable APIs: <strong>Gmail API</strong>, <strong>Calendar API</strong>, <strong>Drive API</strong>, <strong>Sheets API</strong></li>
                    <li>Credentials → Create OAuth Client → Web application</li>
                    <li>Add authorised JS origin: <code>{{origin}}</code></li>
                    <li>Copy the Client ID below</li>
                </ol>`,
                fields: (_, origin) => `
                    <label class="set-field set-field-wide">
                        <span>Google OAuth Client ID</span>
                        <input type="text" data-setup-field="google_client_id" value="${Dom.escape(Store.getSetting('google_client_id') || '')}" placeholder="123-abc.apps.googleusercontent.com">
                        <small class="set-help-inline">Authorised origin to register: <code>${origin}</code></small>
                    </label>
                `,
            },
            {
                title: 'Backup passphrase.',
                intro: 'A passphrase that locally derives an AES-GCM key. Used to encrypt your data before it goes to your private Sheet. If you lose this — there is no recovery, by design.',
                fields: () => `
                    <label class="set-field set-field-wide">
                        <span>Sync passphrase</span>
                        <input type="password" data-setup-field="sync_passphrase" value="${Dom.escape(Store.getSetting('sync_passphrase') || '')}" placeholder="something only you know" autocomplete="new-password">
                        <small class="set-help-inline">Optional now. Set it before you push to Sheets — keep it in a password manager.</small>
                    </label>
                `,
            },
        ],
    },

    // ============================================================
    // EDIT MODAL — universal CRUD modal for any entity
    // ============================================================
    Edit: {
        _scrim: null,
        _body: null,
        _titleEl: null,
        _saveBtn: null,
        _ctx: null,    // { type, id, fields[] }

        init() {
            this._scrim   = document.getElementById('edit-scrim');
            this._body    = document.getElementById('edit-body');
            this._titleEl = document.getElementById('edit-title');
            this._saveBtn = document.getElementById('edit-save');
            if (!this._scrim) return;
            this._scrim.addEventListener('click', (e) => { if (e.target === this._scrim) this.close(); });
            document.getElementById('edit-cancel')?.addEventListener('click', () => this.close());
            document.getElementById('edit-delete')?.addEventListener('click', () => this.delete());
            this._saveBtn?.addEventListener('click', () => this.save());
            window.addEventListener('keydown', (e) => {
                if (this._scrim?.hidden) return;
                if (e.key === 'Escape') { e.preventDefault(); this.close(); }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.save(); }
            });
        },

        open(type, id) {
            const lookup = {
                task:    Store.getTask(id),
                matter:  Store.getMatter(id),
                client:  Store.getClient(id),
                meeting: Store.getMeeting(id),
            };
            const entity = lookup[type];
            if (!entity) { App.Omni._flash('not found'); return; }

            this._ctx = { type, id, entity };
            this._titleEl.textContent = type + ' · ' + (entity.title || entity.name || id);

            const fields = this._fieldsFor(type, entity);
            this._body.innerHTML = fields.map(f => this._fieldHtml(f, entity)).join('');
            this._scrim.hidden = false;
            setTimeout(() => this._body.querySelector('input,textarea,select')?.focus(), 50);
        },

        close() {
            if (!this._scrim) return;
            this._scrim.hidden = true;
            this._ctx = null;
        },

        save() {
            if (!this._ctx) return;
            const patch = {};
            this._body.querySelectorAll('[data-edit-field]').forEach(el => {
                const key = el.dataset.editField;
                let val = el.value;
                if (el.dataset.editType === 'number') val = val === '' ? null : Number(val);
                if (el.dataset.editType === 'date')   val = val ? new Date(val).toISOString() : null;
                if (key === 'excludeFromAi') val = (val === 'yes');
                if (key.includes('.')) {
                    // nested: billing.mode etc.
                    const [parent, child] = key.split('.');
                    if (!patch[parent]) patch[parent] = { ...(this._ctx.entity[parent] || {}) };
                    patch[parent][child] = val;
                } else {
                    patch[key] = val;
                }
            });
            const updaters = {
                task:    (id, p) => Store.updateTask(id, p),
                matter:  (id, p) => { Object.assign(this._ctx.entity, p, { updated: new Date().toISOString() }); Store.flush(); },
                client:  (id, p) => Store.updateClient(id, p),
                meeting: (id, p) => { Object.assign(this._ctx.entity, p, { updated: new Date().toISOString() }); Store.flush(); },
            };
            updaters[this._ctx.type](this._ctx.id, patch);
            App.Omni._flash('saved');
            this.close();
            App.show(App.currentView);
            App.renderSidebar();
        },

        delete() {
            if (!this._ctx) return;
            if (!confirm('Move to trash? You can restore within 30 days.')) return;
            const deleters = {
                task: (id) => Store.deleteTask(id),
                matter: (id) => Store.deleteMatter(id),
                client: (id) => Store.deleteClient(id),
                meeting: (id) => Store.deleteMeeting(id),
            };
            deleters[this._ctx.type](this._ctx.id);
            App.Omni._flash('moved to trash');
            this.close();
            App.show(this._ctx.type === 'matter' ? 'inbox' : App.currentView);
            App.renderSidebar();
        },

        _fieldsFor(type, e) {
            const clientOpts = [{ id: '', label: '— none —' }, ...Store.getClients().map(c => ({ id: c.id, label: c.name }))];
            const matterOpts = [{ id: '', label: '— none —' }, ...Store.getActiveMatters().map(m => {
                const c = Store.getClient(m.clientId);
                return { id: m.id, label: `${m.name}${c ? ' · ' + c.name : ''}` };
            })];
            switch (type) {
                case 'task': return [
                    { key: 'title', label: 'Title', kind: 'text' },
                    { key: 'deadline', label: 'Deadline', kind: 'date' },
                    { key: 'priority', label: 'Priority', kind: 'select', options: ['urgent', 'high', 'medium', 'low'] },
                    { key: 'status', label: 'Status', kind: 'select', options: ['todo', 'in_progress', 'done'] },
                    { key: 'clientId', label: 'Client', kind: 'select-id', options: clientOpts },
                    { key: 'matterId', label: 'Matter', kind: 'select-id', options: matterOpts },
                    { key: 'notes', label: 'Notes', kind: 'textarea' },
                ];
                case 'matter': return [
                    { key: 'name', label: 'Name', kind: 'text' },
                    { key: 'clientId', label: 'Client', kind: 'select-id', options: clientOpts },
                    { key: 'status', label: 'Status', kind: 'select', options: ['active', 'paused', 'done'] },
                    { key: 'billing.mode', label: 'Billing mode', kind: 'select', options: ['subscription', 'fixed', 'hourly'] },
                    { key: 'billing.period_fee', label: 'Period fee €', kind: 'number' },
                    { key: 'billing.hours_included', label: 'Hours included', kind: 'number' },
                    { key: 'billing.overage_rate', label: 'Overage rate €/h', kind: 'number' },
                    { key: 'billing.fixed_amount', label: 'Fixed amount €', kind: 'number' },
                    { key: 'billing.hourly_rate', label: 'Hourly rate €/h', kind: 'number' },
                    { key: 'billing.deadline', label: 'Deadline (fixed)', kind: 'date' },
                    { key: 'excludeFromAi', label: 'Exclude from AI context (privileged)', kind: 'select', options: ['no', 'yes'] },
                    { key: 'notes', label: 'Notes', kind: 'textarea' },
                ];
                case 'client': return [
                    { key: 'name', label: 'Name', kind: 'text' },
                    { key: 'industry', label: 'Industry', kind: 'select', options: ['IT', 'Crypto', 'B2B-Trade', 'Other'] },
                    { key: 'email', label: 'Email', kind: 'text' },
                    { key: 'primary_currency', label: 'Currency', kind: 'select', options: ['EUR', 'USD', 'UAH', 'GBP'] },
                    { key: 'notes', label: 'Notes', kind: 'textarea' },
                ];
                case 'meeting': return [
                    { key: 'title', label: 'Title', kind: 'text' },
                    { key: 'starts_at', label: 'Starts', kind: 'date' },
                    { key: 'ends_at', label: 'Ends', kind: 'date' },
                    { key: 'clientId', label: 'Client', kind: 'select-id', options: clientOpts },
                    { key: 'matterId', label: 'Matter', kind: 'select-id', options: matterOpts },
                    { key: 'video_url', label: 'Video URL', kind: 'text' },
                ];
                default: return [];
            }
        },

        _fieldHtml(f, e) {
            const get = (key) => {
                if (!key.includes('.')) return e[key];
                const [parent, child] = key.split('.');
                return (e[parent] || {})[child];
            };
            let v = get(f.key);
            if (v == null) v = '';
            if (f.key === 'excludeFromAi') v = v === true ? 'yes' : 'no';
            const isoDateInput = (iso) => {
                if (!iso) return '';
                const d = new Date(iso);
                const pad = n => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };
            const label = `<span>${Dom.escape(f.label)}</span>`;
            if (f.kind === 'textarea') {
                return `<label class="set-field set-field-wide"><span>${Dom.escape(f.label)}</span><textarea data-edit-field="${f.key}" rows="3">${Dom.escape(v || '')}</textarea></label>`;
            }
            if (f.kind === 'date') {
                return `<label class="set-field"><span>${Dom.escape(f.label)}</span><input type="datetime-local" data-edit-field="${f.key}" data-edit-type="date" value="${isoDateInput(v)}"></label>`;
            }
            if (f.kind === 'number') {
                return `<label class="set-field"><span>${Dom.escape(f.label)}</span><input type="number" step="any" data-edit-field="${f.key}" data-edit-type="number" value="${v == null ? '' : v}"></label>`;
            }
            if (f.kind === 'select') {
                const opts = f.options.map(o => `<option value="${o}" ${v === o ? 'selected' : ''}>${Dom.escape(o)}</option>`).join('');
                return `<label class="set-field"><span>${Dom.escape(f.label)}</span><select data-edit-field="${f.key}">${opts}</select></label>`;
            }
            if (f.kind === 'select-id') {
                const opts = f.options.map(o => `<option value="${o.id}" ${v === o.id ? 'selected' : ''}>${Dom.escape(o.label)}</option>`).join('');
                return `<label class="set-field"><span>${Dom.escape(f.label)}</span><select data-edit-field="${f.key}">${opts}</select></label>`;
            }
            return `<label class="set-field"><span>${Dom.escape(f.label)}</span><input type="text" data-edit-field="${f.key}" value="${Dom.escape(v == null ? '' : v)}"></label>`;
        },
    },

    // ============================================================
    // VIEW: SETTINGS — preferences, profile (FROM block), data ops
    // ============================================================
    render_settings(root) {
        const s = Store._data.settings;
        const profile = s.profile || {};

        const counts = {
            clients:  Store.getClients().length,
            matters:  Store.getMatters().length,
            tasks:    Store.getTasks().length,
            logs:     Store.getTimeLogs().length,
            invoices: Store.getInvoices().length,
        };

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <h1>${I18n.t('heroSettings')}</h1>
                </div>
            </div>

            <div class="settings-wrap">

                <section class="set-section">
                    <h2>profile</h2>
                    <p class="set-help">Used on the invoice — FROM block, logo, and payment details.</p>

                    <div class="logo-block">
                        <div class="logo-preview">${profile.logo
                            ? `<img src="${Dom.escape(profile.logo)}" alt="logo">`
                            : '<span class="dim">no logo · upload PNG / SVG / JPG</span>'}</div>
                        <div class="logo-actions">
                            <input type="file" id="profile-logo-input" accept="image/png,image/svg+xml,image/jpeg" hidden>
                            <button class="inv-act primary" data-set-action="upload-logo" type="button">Upload logo</button>
                            ${profile.logo ? `<button class="inv-act ghost" data-set-action="clear-logo" type="button">Remove</button>` : ''}
                            <small class="set-help-inline">Recommended: SVG or transparent PNG, 200×80 (or thereabouts). Stored locally in your browser; embeds into the invoice as base64.</small>
                        </div>
                    </div>

                    <div class="set-grid">
                        <label class="set-field">
                            <span>Firm name</span>
                            <input type="text" data-set-profile="name" value="${Dom.escape(profile.name || '')}" placeholder="Sergiy Vasylenko · Legal Practice">
                        </label>
                        <label class="set-field">
                            <span>Email</span>
                            <input type="email" data-set-profile="email" value="${Dom.escape(profile.email || '')}" placeholder="you@firm.eu">
                        </label>
                        <label class="set-field set-field-wide">
                            <span>Address</span>
                            <input type="text" data-set-profile="address" value="${Dom.escape(profile.address || '')}" placeholder="Street, City, ZIP, Country">
                        </label>
                        <label class="set-field">
                            <span>VAT ID</span>
                            <input type="text" data-set-profile="vat_id" value="${Dom.escape(profile.vat_id || '')}" placeholder="ESB12345678">
                        </label>
                        <label class="set-field">
                            <span>Phone (opt)</span>
                            <input type="text" data-set-profile="phone" value="${Dom.escape(profile.phone || '')}" placeholder="+34 600 …">
                        </label>
                    </div>

                    <h3 class="set-subhead">Payment details</h3>
                    <div class="set-grid">
                        <label class="set-field">
                            <span>Bank name</span>
                            <input type="text" data-set-profile="bank_name" value="${Dom.escape(profile.bank_name || '')}" placeholder="BBVA · Banco Santander · …">
                        </label>
                        <label class="set-field">
                            <span>IBAN</span>
                            <input type="text" data-set-profile="iban" value="${Dom.escape(profile.iban || '')}" placeholder="ES76 1234 5678 9012 3456 7890">
                        </label>
                        <label class="set-field">
                            <span>BIC / SWIFT</span>
                            <input type="text" data-set-profile="bic" value="${Dom.escape(profile.bic || '')}" placeholder="BBVAESMM">
                        </label>
                        <label class="set-field">
                            <span>Account holder (opt)</span>
                            <input type="text" data-set-profile="account_holder" value="${Dom.escape(profile.account_holder || '')}" placeholder="if different from firm name">
                        </label>
                        <label class="set-field set-field-wide">
                            <span>Payment terms / footer note</span>
                            <input type="text" data-set-profile="payment_terms" value="${Dom.escape(profile.payment_terms || '')}" placeholder="Due within 30 days. Late fees per Art. 1108 Civil Code.">
                        </label>
                    </div>
                </section>

                <section class="set-section">
                    <h2>preferences</h2>
                    <div class="set-grid">
                        <div class="set-field">
                            <span>Theme</span>
                            <div class="set-toggle">
                                <button class="${s.theme === 'light' ? 'active' : ''}" data-set-theme="light" type="button">light</button>
                                <button class="${s.theme === 'dark' ? 'active' : ''}"  data-set-theme="dark"  type="button">dark</button>
                            </div>
                        </div>
                        <!-- Language is English-only by design — UA toggle hidden. -->
                        <!-- <div class="set-field">
                            <span>Language</span>
                            <div class="set-toggle">
                                <button class="${I18n.lang === 'en' ? 'active' : ''}" data-set-lang="en" type="button">English</button>
                                <button class="${I18n.lang === 'uk' ? 'active' : ''}" data-set-lang="uk" type="button">Українська</button>
                            </div>
                        </div> -->
                        <div class="set-field">
                            <span>AI model</span>
                            <select data-set-pref="model">
                                <option value="claude-sonnet-4-5"  ${s.model === 'claude-sonnet-4-5'  ? 'selected' : ''}>Claude Sonnet 4.5</option>
                                <option value="claude-opus-4"      ${s.model === 'claude-opus-4'      ? 'selected' : ''}>Claude Opus 4</option>
                                <option value="claude-haiku-4-5"   ${s.model === 'claude-haiku-4-5'   ? 'selected' : ''}>Claude Haiku 4.5</option>
                            </select>
                            <small class="set-help-inline">Used by ⌘K parser when Phase 9 ships real AI dispatch.</small>
                        </div>
                        <div class="set-field">
                            <span>Default currency</span>
                            <select data-set-pref="currency">
                                <option value="EUR" ${(s.currency || 'EUR') === 'EUR' ? 'selected' : ''}>€ EUR</option>
                                <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>$ USD</option>
                                <option value="UAH" ${s.currency === 'UAH' ? 'selected' : ''}>₴ UAH</option>
                            </select>
                        </div>
                        <div class="set-field">
                            <span>Browser notifications</span>
                            <div class="set-toggle">
                                <button class="${s.notifications !== false ? 'active' : ''}" data-set-notify="on" type="button">on</button>
                                <button class="${s.notifications === false ? 'active' : ''}" data-set-notify="off" type="button">off</button>
                            </div>
                            <small class="set-help-inline">Reminds you when a task is due in the next 60 minutes. Permission ${('Notification' in window) ? Notification.permission : 'unsupported'}.</small>
                        </div>
                    </div>
                </section>

                <section class="set-section">
                    <h2>integrations</h2>
                    <div class="set-grid">
                        <label class="set-field set-field-wide">
                            <span>Anthropic API key</span>
                            <input type="password" data-set-key="anthropic_api_key" value="${Dom.escape(s.anthropic_api_key || '')}" placeholder="sk-ant-…" autocomplete="off" spellcheck="false">
                            <small class="set-help-inline">Stored in localStorage. Used by «?» queries in the omni-bar. Get one at <a href="https://console.anthropic.com/" target="_blank" rel="noopener" style="color:var(--accent)">console.anthropic.com</a>.</small>
                        </label>
                        <label class="set-field set-field-wide">
                            <span>OpenAI API key (optional)</span>
                            <input type="password" data-set-key="openai_api_key" value="${Dom.escape(s.openai_api_key || '')}" placeholder="sk-…" autocomplete="off" spellcheck="false">
                            <small class="set-help-inline">Used for transcribing voice/meeting recordings via Whisper. Get one at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style="color:var(--accent)">platform.openai.com</a>.</small>
                        </label>
                        <label class="set-field set-field-wide">
                            <span>Google OAuth Client ID</span>
                            <input type="text" data-set-key="google_client_id" value="${Dom.escape(s.google_client_id || '')}" placeholder="123-abc.apps.googleusercontent.com" autocomplete="off" spellcheck="false">
                            <small class="set-help-inline">For Gmail + Calendar integrations. Create one at <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" style="color:var(--accent)">console.cloud.google.com</a> (type: Web application; add your origin <code>${location.origin}</code> as authorised JS origin).</small>
                        </label>
                        <div class="set-field set-field-wide">
                            <span>Gmail</span>
                            <div class="set-int-row">
                                <span class="dim">Read-only Gmail access. AI scans recent messages and proposes tasks.</span>
                                <button class="inv-act ${typeof Gmail !== 'undefined' && Gmail.isConnected() ? 'ghost' : 'primary'}" data-set-action="connect-gmail" type="button">${typeof Gmail !== 'undefined' && Gmail.isConnected() ? '✓ Connected' : 'Connect Gmail'}</button>
                            </div>
                        </div>
                        <div class="set-field set-field-wide">
                            <span>Google Calendar</span>
                            <div class="set-int-row">
                                <span class="dim">Two-way sync of meetings. Pulls events into the Calendar view, pushes ordify meetings on demand.</span>
                                <button class="inv-act ${typeof GCal !== 'undefined' && GCal.isConnected() ? 'ghost' : 'primary'}" data-set-action="connect-gcal" type="button">${typeof GCal !== 'undefined' && GCal.isConnected() ? '✓ Connected' : 'Connect Calendar'}</button>
                            </div>
                        </div>
                        <div class="set-field set-field-wide">
                            <span>Google Sheets backup (plain rows)</span>
                            <div class="set-int-row">
                                <span class="dim">5 visible tabs in your Sheet — Clients, Matters, Tasks, TimeLogs, Invoices — that you can read and edit directly. <strong>Manual</strong> push/pull (auto-push would overwrite your sheet edits).</span>
                                <div style="display:flex;gap:6px;flex-shrink:0">
                                    <button class="inv-act ${typeof Sheets !== 'undefined' && Sheets.isConnected() ? 'ghost' : 'primary'}" data-set-action="connect-sheets" type="button">${typeof Sheets !== 'undefined' && Sheets.isConnected() ? '✓ Connected' : 'Connect Sheets'}</button>
                                    <button class="inv-act ghost" data-set-action="sheets-push" type="button" title="Overwrite Sheet with current data">↑ Push</button>
                                    <button class="inv-act ghost" data-set-action="sheets-pull" type="button" title="Replace local data with Sheet contents">↓ Pull</button>
                                </div>
                            </div>
                            ${s.sheets_last_sync ? `<small class="set-help-inline">Last sync: ${Dom.escape(s.sheets_last_sync)}${s.sheets_spreadsheet_id ? ` · <a href="https://docs.google.com/spreadsheets/d/${Dom.escape(s.sheets_spreadsheet_id)}" target="_blank" rel="noopener" style="color:var(--accent)">open in Google Sheets ↗</a>` : ''}</small>` : ''}
                        </div>
                        <div class="set-field">
                            <span>Auto-push to Sheets</span>
                            <div class="set-toggle">
                                <button class="${s.auto_sync === true ? 'active' : ''}" data-set-pref-toggle="auto_sync,true" type="button">on</button>
                                <button class="${s.auto_sync !== true ? 'active' : ''}" data-set-pref-toggle="auto_sync,false" type="button">off</button>
                            </div>
                            <small class="set-help-inline">Pushes 30s after any write. Default OFF — turning ON means edits made directly in Sheets get overwritten on the next ordify write. Turn ON only if you edit only in ordify.</small>
                        </div>
                        <div class="set-field set-field-wide">
                            <span>Google Calendar</span>
                            <div class="set-int-row">
                                <span class="dim">Two-way sync of meetings and task deadlines.</span>
                                <button class="inv-act ghost" data-set-action="connect-google" type="button">Connect — phase 9</button>
                            </div>
                        </div>
                        <div class="set-field set-field-wide">
                            <span>Google Sheets</span>
                            <div class="set-int-row">
                                <span class="dim">Encrypted blob backup + sync.</span>
                                <button class="inv-act ghost" data-set-action="connect-sheets" type="button">Connect — phase 10</button>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="set-section">
                    <h2>ai usage</h2>
                    ${this._renderAiUsage()}
                </section>

                <section class="set-section">
                    <h2>snapshots</h2>
                    <p class="set-help">Local IndexedDB backup taken once per day. Last 7 days kept.</p>
                    <div id="snapshots-list" class="set-counts"><span class="dim">loading…</span></div>
                </section>

                <section class="set-section">
                    <h2>data</h2>
                    <div class="set-counts">
                        <span><b>${counts.clients}</b> clients</span>
                        <span><b>${counts.matters}</b> matters</span>
                        <span><b>${counts.tasks}</b> tasks</span>
                        <span><b>${counts.logs}</b> timelogs</span>
                        <span><b>${counts.invoices}</b> invoices</span>
                    </div>
                    <div class="storage-bar ${Store.storagePct() >= 80 ? 'warn' : ''} ${Store.storagePct() >= 95 ? 'critical' : ''}">
                        <div class="lbl">localStorage · ${(Store.storageSize() / 1024).toFixed(0)} KB / ${(Store.storageQuota() / 1024 / 1024).toFixed(0)} MB · ${Store.storagePct()}%</div>
                        <div class="bar"><i style="width:${Math.min(100, Store.storagePct())}%"></i></div>
                        ${Store.storagePct() >= 80 ? `<div class="hint">⚠ Approaching quota — export to JSON or push to Sheets to avoid silent failure.</div>` : ''}
                    </div>
                    <div class="set-actions">
                        <button class="inv-act" data-set-action="export" type="button">⤓ Export JSON</button>
                        <button class="inv-act" data-set-action="import" type="button">⤒ Import JSON</button>
                        <button class="inv-act ghost" data-set-action="export-csv" type="button">⤓ Export CSV</button>
                        <button class="inv-act ghost" data-set-action="clear-all" type="button" style="border-color:var(--vermillion);color:var(--vermillion)">Clear all data</button>
                        <button class="inv-act ghost" data-set-action="reset" type="button" style="border-color:var(--vermillion);color:var(--vermillion)">Reset to seed</button>
                    </div>
                </section>

            </div>
        `;

        // Profile fields → save on blur
        root.querySelectorAll('[data-set-profile]').forEach(inp => {
            inp.addEventListener('blur', () => {
                const key = inp.dataset.setProfile;
                if (!Store._data.settings.profile) Store._data.settings.profile = {};
                Store._data.settings.profile[key] = inp.value.trim();
                Store.flush();
                App.Omni._flash(`profile · ${key} saved`);
            });
        });
        // Theme
        root.querySelectorAll('[data-set-theme]').forEach(b => b.addEventListener('click', () => {
            this.setTheme(b.dataset.setTheme);
            this.render_settings(root);
        }));
        // Lang
        root.querySelectorAll('[data-set-lang]').forEach(b => b.addEventListener('click', () => {
            this.setLang(b.dataset.setLang);
            this.render_settings(root);
        }));
        // Pref selects
        root.querySelectorAll('[data-set-pref]').forEach(sel => sel.addEventListener('change', () => {
            Store.setSetting(sel.dataset.setPref, sel.value);
            App.Omni._flash(`${sel.dataset.setPref} · ${sel.value}`);
        }));
        // Pref toggles (boolean flags)
        root.querySelectorAll('[data-set-pref-toggle]').forEach(b => b.addEventListener('click', () => {
            const [key, val] = b.dataset.setPrefToggle.split(',');
            Store.setSetting(key, val === 'true');
            App.Omni._flash(`${key} · ${val}`);
            this.render_settings(root);
        }));
        // Snapshots list (async)
        const snapHost = root.querySelector('#snapshots-list');
        if (snapHost && typeof Snapshots !== 'undefined') {
            Snapshots.list().then(items => {
                snapHost.innerHTML = items.length
                    ? items.map(s => `<button class="inv-act ghost" data-snapshot-restore="${s.date}" type="button" title="${s.takenAt} · ${s.counts.tasks} tasks · ${s.counts.matters} matters">${s.date}</button>`).join('')
                    : '<span class="dim" style="color:var(--fg-faint)">No snapshots yet — they appear once a day.</span>';
                snapHost.querySelectorAll('[data-snapshot-restore]').forEach(b => b.addEventListener('click', async () => {
                    const date = b.dataset.snapshotRestore;
                    if (!confirm(`Restore snapshot from ${date}?\nThis will replace your current data. (A new snapshot will be taken before the restore so you can roll back.)`)) return;
                    try {
                        await Snapshots.restore(date);
                        App.Omni._flash(`restored · ${date}`);
                        this.show('today');
                        this.renderSidebar();
                    } catch (e) {
                        App.Omni._flash('restore · ' + e.message);
                    }
                }));
            }).catch(() => { snapHost.innerHTML = '<span class="dim">no snapshots</span>'; });
        }
        // Notifications toggle
        root.querySelectorAll('[data-set-notify]').forEach(b => b.addEventListener('click', async () => {
            const turnOn = b.dataset.setNotify === 'on';
            Store.setSetting('notifications', turnOn);
            if (turnOn) {
                await this.Notify.request();
                this.Notify.startWatcher();
            } else {
                this.Notify.stopWatcher();
                App.Omni._flash('notifications off');
            }
            this.render_settings(root);
        }));
        // API key inputs (saved on blur, masked)
        root.querySelectorAll('[data-set-key]').forEach(inp => {
            inp.addEventListener('blur', () => {
                const key = inp.dataset.setKey;
                const v = inp.value.trim();
                Store.setSetting(key, v);
                App.Omni._flash(v ? `${key} saved` : `${key} cleared`);
            });
        });
        // Actions
        root.querySelectorAll('[data-set-action]').forEach(b => b.addEventListener('click', () => {
            const action = b.dataset.setAction;
            if (action === 'export') {
                const blob = new Blob([JSON.stringify(Store._data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ordify-export-${new Date().toISOString().slice(0,10)}.json`;
                document.body.appendChild(a); a.click(); a.remove();
                URL.revokeObjectURL(url);
                App.Omni._flash('exported');
            } else if (action === 'import') {
                const inp = document.createElement('input');
                inp.type = 'file'; inp.accept = '.json,application/json';
                inp.onchange = () => {
                    const file = inp.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const data = JSON.parse(String(reader.result));
                            Store._data = Store._normalize(data);
                            Store.flush();
                            App.Omni._flash('imported');
                            this.show('today');
                            this.renderSidebar();
                        } catch (e) {
                            App.Omni._flash('invalid json');
                        }
                    };
                    reader.readAsText(file);
                };
                inp.click();
            } else if (action === 'export-csv') {
                this._exportCsvBundle();
                return;
            } else if (action === 'stress') {
                if (!confirm('Generate 200 sample tasks + 100 timelogs? Useful for performance / UI testing.\nThey will be tagged "stress" so you can bulk-delete later.')) return;
                const matters = Store.getMatters();
                if (!matters.length) { App.Omni._flash('seed first — no matters'); return; }
                const verbs = ['Review', 'Draft', 'File', 'Send', 'Prepare', 'Research', 'Negotiate', 'Sign', 'Annotate', 'Translate', 'Submit', 'Update', 'Reconcile', 'Confirm', 'Close', 'Open'];
                const nouns = ['NDA', 'cap table', 'engagement letter', 'shareholder consent', 'memo', 'compliance brief', 'tax filing', 'corporate resolution', 'KYC pack', 'signature block', 'invoice', 'subscription doc', 'amendment', 'side letter', 'opinion'];
                const t0 = performance.now();
                for (let i = 0; i < 200; i++) {
                    const m = matters[i % matters.length];
                    const v = verbs[Math.floor(Math.random() * verbs.length)];
                    const n = nouns[Math.floor(Math.random() * nouns.length)];
                    const dueOffset = Math.floor(Math.random() * 60) - 30;  // ±30 days
                    const d = new Date(); d.setDate(d.getDate() + dueOffset); d.setHours(14, 0, 0, 0);
                    Store._data.tasks.push({
                        id: 'stress-t-' + i,
                        created: new Date().toISOString(), updated: new Date().toISOString(),
                        title: `${v} ${n} #${i + 1}`,
                        clientId: m.clientId, matterId: m.id,
                        deadline: d.toISOString(),
                        status: Math.random() < 0.2 ? 'done' : 'todo',
                        priority: ['urgent', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
                        tags: ['stress'],
                    });
                }
                for (let i = 0; i < 100; i++) {
                    const m = matters[i % matters.length];
                    const ago = Math.floor(Math.random() * 30);
                    const d = new Date(); d.setDate(d.getDate() - ago);
                    Store._data.timeLogs.push({
                        id: 'stress-tl-' + i,
                        date: d.toISOString(),
                        matterId: m.id,
                        hours: Math.round(Math.random() * 250) / 100,
                        billable: Math.random() < 0.85,
                        source: 'stress',
                        note: 'stress',
                    });
                }
                Store.flush();
                this.renderSidebar();
                this.show('today');
                const ms = Math.round(performance.now() - t0);
                App.Omni._flash(`+200 tasks · +100 logs · ${ms}ms`);
                return;
            } else if (action === 'stress-purge') {
                const tBefore = Store._data.tasks.length;
                const lBefore = Store._data.timeLogs.length;
                Store._data.tasks = Store._data.tasks.filter(t => !(t.tags || []).includes('stress'));
                Store._data.timeLogs = Store._data.timeLogs.filter(l => l.source !== 'stress');
                const dt = tBefore - Store._data.tasks.length;
                const dl = lBefore - Store._data.timeLogs.length;
                Store.flush();
                this.renderSidebar();
                this.show('today');
                App.Omni._flash(`removed · ${dt} tasks · ${dl} logs`);
                return;
            } else if (action === 'clear-all') {
                if (!confirm('CLEAR ALL DATA?\n\nDeletes all clients, matters, tasks, timelogs, invoices, attachments, recordings, and snapshots.\nKeeps your settings (API keys, profile, OAuth, passphrase).\n\nThis CANNOT be undone — push to Sheets or export JSON first if you want a backup.')) return;
                Store.clearAllData();
                this.currentMatterId = null;
                this.currentClientId = null;
                this._cursorTaskId = null;
                this._inboxScan = { messages: [], analysis: {}, dismissed: new Set(), lastScanAt: 0 };
                this._gcalEvents = {};
                App.Omni._flash('cleared · start fresh');
                this.renderSidebar();
                this.show('today');
                return;
            } else if (action === 'reset') {
                if (!confirm('Reset all data to seed? This cannot be undone.')) return;
                Store.reset();
                App.Omni._flash('reset to seed');
                this.renderSidebar();
                this.show('today');
            } else if (action === 'upload-logo') {
                const inp = document.getElementById('profile-logo-input');
                if (!inp) return;
                inp.value = '';
                inp.onchange = () => {
                    const file = inp.files?.[0];
                    if (!file) return;
                    if (file.size > 500 * 1024) {
                        if (!confirm(`Logo is ${(file.size/1024).toFixed(0)} KB — large logos make every invoice JSON heavier. Continue?`)) return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                        if (!Store._data.settings.profile) Store._data.settings.profile = {};
                        Store._data.settings.profile.logo = reader.result;
                        Store.flush();
                        App.Omni._flash('logo saved');
                        this.render_settings(root);
                    };
                    reader.readAsDataURL(file);
                };
                inp.click();
            } else if (action === 'clear-logo') {
                if (!confirm('Remove the logo?')) return;
                if (Store._data.settings.profile) delete Store._data.settings.profile.logo;
                Store.flush();
                App.Omni._flash('logo removed');
                this.render_settings(root);
            } else if (action === 'connect-gmail') {
                if (!Store.getSetting('google_client_id')) {
                    App.Omni._flash('add Google Client ID first');
                    return;
                }
                Gmail.connect()
                    .then(() => {
                        App.Omni._flash('gmail connected');
                        this.render_settings(root);
                    })
                    .catch(err => App.Omni._flash('gmail · ' + err.message));
            } else if (action === 'connect-sheets') {
                if (!Store.getSetting('google_client_id')) {
                    App.Omni._flash('add Google Client ID first');
                    return;
                }
                Sheets.connect()
                    .then(() => { App.Omni._flash('sheets connected'); this.render_settings(root); })
                    .catch(err => App.Omni._flash('sheets · ' + err.message));
            } else if (action === 'sheets-push') {
                Sheets.pushSafe()
                    .then(ts => {
                        Store.setSetting('sheets_last_sync', ts);
                        App.Omni._flash('pushed ↑ ' + new Date(ts).toLocaleTimeString());
                        this.render_settings(root);
                    })
                    .catch(err => {
                        if (err.code === 'CONFLICT') {
                            const ok = confirm(`⚠ Conflict\n\nRemote sheet was changed by another device at ${new Date(err.remote).toLocaleString()}\nYour last seen sync was ${new Date(err.lastSeen).toLocaleString()}\n\nOverwrite remote with your local data?`);
                            if (!ok) { App.Omni._flash('push cancelled'); return; }
                            Sheets.push().then(ts => {
                                Store.setSetting('sheets_last_sync', ts);
                                Store.setSetting('sheets_last_seen_remote', ts);
                                App.Omni._flash('forced push ↑');
                                this.render_settings(root);
                            }).catch(e2 => App.Omni._flash('push · ' + e2.message));
                        } else {
                            App.Omni._flash('push · ' + err.message);
                        }
                    });
            } else if (action === 'sheets-pull') {
                if (!confirm('Pull will replace your local data with the version on Sheets. Continue?')) return;
                Sheets.pull()
                    .then(ts => {
                        Store.setSetting('sheets_last_sync', ts);
                        App.Omni._flash('pulled ↓ ' + new Date(ts).toLocaleTimeString());
                        this.renderSidebar();
                        this.show('today');
                    })
                    .catch(err => App.Omni._flash('pull · ' + err.message));
            } else if (action === 'connect-gcal') {
                if (!Store.getSetting('google_client_id')) {
                    App.Omni._flash('add Google Client ID first');
                    return;
                }
                GCal.connect()
                    .then(() => {
                        App.Omni._flash('calendar connected');
                        this.render_settings(root);
                    })
                    .catch(err => App.Omni._flash('calendar · ' + err.message));
            } else if (action.startsWith('connect-')) {
                App.Omni._flash(`${action.replace('connect-', '')} — coming in phase 9/10`);
            }
        }));
    },

    // ============================================================
    // VIEW: CALENDAR — month grid with tasks (by deadline) + meetings
    // ============================================================
    render_calendar(root) {
        const today = new Date(); today.setHours(0,0,0,0);
        // Cursor anchors the visible period. If switching to day-mode and the
        // cursor sits on a month-1st (left over from month-mode), snap to today
        // so the user lands on a sensible date.
        let cursor = this.calCursor ? new Date(this.calCursor) : new Date(today);
        cursor.setHours(0,0,0,0);
        if (this.calMode === 'day') {
            const isMonthStart = cursor.getDate() === 1;
            const isLongAgo = Math.abs(cursor.getTime() - today.getTime()) > 30 * 86_400_000;
            if (isMonthStart && isLongAgo) cursor = new Date(today);
        }
        if (this.calMode === 'month') cursor.setDate(1);
        if (this.calMode === 'week') {
            const dow = (cursor.getDay() + 6) % 7;
            cursor.setDate(cursor.getDate() - dow);
        }
        this.calCursor = cursor.toISOString();
        this._calRoot = root;

        // Common: collect events with optional date-range filter
        const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const collectEvents = (rangeStart, rangeEnd) => {
            const byDay = {};
            const inRange = (ms) => !rangeStart || (ms >= rangeStart && ms < rangeEnd);
            for (const t of Store.getTasks()) {
                if (!t.deadline) continue;
                const ms = new Date(t.deadline).getTime();
                if (!inRange(ms)) continue;
                const k = dayKey(new Date(t.deadline));
                (byDay[k] = byDay[k] || []).push({ kind: 'task', task: t, ts: ms });
            }
            for (const m of Store.getMeetings()) {
                const ms = new Date(m.starts_at).getTime();
                if (!inRange(ms)) continue;
                const k = dayKey(new Date(m.starts_at));
                (byDay[k] = byDay[k] || []).push({ kind: 'meeting', meeting: m, ts: ms });
            }
            const cachedGcal = this._gcalEvents ? Object.values(this._gcalEvents).flat() : [];
            for (const ev of cachedGcal) {
                if (!ev.starts_at) continue;
                const ms = new Date(ev.starts_at).getTime();
                if (!inRange(ms)) continue;
                const k = dayKey(new Date(ev.starts_at));
                (byDay[k] = byDay[k] || []).push({ kind: 'gcal', meeting: ev, ts: ms });
            }
            // Sort each day's events chronologically
            for (const k of Object.keys(byDay)) byDay[k].sort((a, b) => a.ts - b.ts);
            return byDay;
        };

        const heroTitle = (() => {
            if (this.calMode === 'day') {
                return new Intl.DateTimeFormat('en', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(cursor).toLowerCase();
            }
            if (this.calMode === 'week') {
                const end = new Date(cursor); end.setDate(end.getDate() + 6);
                const w = this._weekNumber ? this._weekNumber(cursor) : '';
                const sm = new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' }).format(cursor);
                const em = new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' }).format(end);
                return `week ${w} · ${sm.toLowerCase()} — ${em.toLowerCase()} ${end.getFullYear()}`;
            }
            const monthName = new Intl.DateTimeFormat('en', { month: 'long' }).format(cursor);
            return `${monthName.toLowerCase()} ${cursor.getFullYear()}`;
        })();

        const modeBtn = (key, label) => `<button class="${this.calMode === key ? 'active' : ''}" data-cal-mode="${key}" type="button">${label}</button>`;

        const heroHtml = `
            <div class="hero">
                <div class="left">
                    <h1>${heroTitle}</h1>
                </div>
                <div class="right">
                    <button class="link-btn quiet" data-cal="google" type="button" title="Connect / refresh Google Calendar">
                        <span class="dot" style="background:${typeof GCal !== 'undefined' && GCal.isConnected() ? 'var(--accent)' : 'var(--fg-faint)'}"></span>
                        ${typeof GCal !== 'undefined' && GCal.isConnected() ? 'google · synced' : 'google · connect'}
                    </button>
                    <div class="mode-toggle" role="group" aria-label="Calendar mode">
                        ${modeBtn('day',   'Day')}
                        ${modeBtn('week',  'Week')}
                        ${modeBtn('month', 'Month')}
                    </div>
                    <div class="mode-toggle" role="group" aria-label="Navigation">
                        <button data-cal="prev"  type="button" aria-label="Previous">‹</button>
                        <button data-cal="today" type="button">today</button>
                        <button data-cal="next"  type="button" aria-label="Next">›</button>
                    </div>
                </div>
            </div>
        `;

        let body = '';
        if (this.calMode === 'month') body = this._renderCalendarMonth(cursor, today, dayKey, collectEvents);
        else if (this.calMode === 'week') body = this._renderCalendarWeek(cursor, today, dayKey, collectEvents);
        else                              body = this._renderCalendarDay(cursor, today, dayKey, collectEvents);

        root.innerHTML = heroHtml + body;

        // Mode-toggle click — switching mode resets cursor to today unless the
        // current cursor is already in a sensible range for the new mode.
        root.querySelectorAll('[data-cal-mode]').forEach(b => b.addEventListener('click', () => {
            const m = b.dataset.calMode;
            if (this.calMode !== m) {
                // If switching to day mode from a broader view, snap to today
                if (m === 'day' || m === 'week') this.calCursor = null;
                this.calMode = m;
                localStorage.setItem('ordify-cal-mode', m);
                this.render_calendar(root);
            }
        }));

        // Navigation: prev/next/today/google
        root.querySelectorAll('[data-cal]').forEach(b => b.addEventListener('click', async () => {
            const dir = b.dataset.cal;
            if (dir === 'google') {
                if (!Store.getSetting('google_client_id')) { App.Omni._flash('add Google Client ID in settings'); return; }
                if (!GCal.isConnected()) {
                    try { await GCal.connect(); App.Omni._flash('calendar connected'); }
                    catch (e) { App.Omni._flash('cal · ' + e.message); return; }
                }
                this._loadGcalForMonth(root);
                return;
            }
            const c = new Date(this.calCursor);
            if (dir === 'prev') {
                if (this.calMode === 'month') c.setMonth(c.getMonth() - 1);
                else if (this.calMode === 'week') c.setDate(c.getDate() - 7);
                else c.setDate(c.getDate() - 1);
                this.calCursor = c.toISOString();
            }
            if (dir === 'next') {
                if (this.calMode === 'month') c.setMonth(c.getMonth() + 1);
                else if (this.calMode === 'week') c.setDate(c.getDate() + 7);
                else c.setDate(c.getDate() + 1);
                this.calCursor = c.toISOString();
            }
            if (dir === 'today') { this.calCursor = null; }
            this.render_calendar(root);
        }));

        // Click on day cell (month view) → switch to Day mode for that date
        root.querySelectorAll('[data-cal-day]').forEach(el => el.addEventListener('click', (e) => {
            // ignore clicks on event chips / play buttons
            if (e.target.closest('.cal-evt') || e.target.closest('button')) return;
            const iso = el.dataset.calDay;
            if (!iso) return;
            this.calCursor = new Date(iso).toISOString();
            this.calMode = 'day';
            localStorage.setItem('ordify-cal-mode', 'day');
            this.render_calendar(root);
        }));

        // Click on event → open Edit modal (task or meeting)
        root.querySelectorAll('[data-cal-evt]').forEach(el => el.addEventListener('click', (e) => {
            if (e.target.closest('.play-mini')) return;
            const kind = el.dataset.calEvt;
            const id = el.dataset.evtId;
            if (kind === 'task')    this.Edit.open('task', id);
            if (kind === 'meeting') this.Edit.open('meeting', id);
            // gcal events are read-only here for now
        }));

        // Auto-pull Google events
        if (typeof GCal !== 'undefined' && GCal.isConnected()) {
            this._loadGcalForMonth(root);
        }
    },

    /** Helper: render a single chronological event chip used by all 3 modes. */
    _calEventChip(e, opts = {}) {
        const compact = opts.compact;
        if (e.kind === 'meeting' || e.kind === 'gcal') {
            const m = e.meeting;
            const t = new Date(m.starts_at);
            const hm = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
            const isG = e.kind === 'gcal';
            const idAttr = isG ? '' : `data-cal-evt="meeting" data-evt-id="${m.id}"`;
            return `<div class="cal-evt cal-evt-meet ${isG ? 'cal-evt-gcal' : ''}" ${idAttr} title="${Dom.escape(m.title)} · ${hm}">
                <span class="t">${hm}</span>
                ${isG ? '<span class="g-tag">g</span>' : ''}
                <span class="ttl">${Dom.escape(m.title)}</span>
            </div>`;
        }
        const t = e.task;
        const dl = new Date(t.deadline);
        const isOverdue = dl.getTime() < Date.now() && t.status !== 'done';
        const isDueSoon = !isOverdue && (dl.getTime() - Date.now()) < 24 * 3600 * 1000;
        const isDone = t.status === 'done';
        const cls = isDone ? 'done' : isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : '';
        const runCls = App.Timer.rowClass(t.id);
        const hm = `${String(dl.getHours()).padStart(2,'0')}:${String(dl.getMinutes()).padStart(2,'0')}`;
        const matter = t.matterId ? Store.getMatter(t.matterId) : null;
        return `<div class="cal-evt cal-evt-task ${cls}${runCls}" data-cal-evt="task" data-evt-id="${t.id}" title="${Dom.escape(t.title)} · ${hm}">
            <span class="t">${hm}</span>
            ${isDone ? '' : App.Timer.playButtonHtml(t.id)}
            <span class="ttl">${Dom.escape(t.title)}${!compact && matter ? ` <span class="ctx">· ${Dom.escape(matter.name)}</span>` : ''}</span>
        </div>`;
    },

    _renderCalendarMonth(cursor, today, dayKey, collectEvents) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const monthEnd = new Date(year, month + 1, 0);
        const totalDays = monthEnd.getDate();
        const startDow = (cursor.getDay() + 6) % 7;
        const totalCells = Math.ceil((startDow + totalDays) / 7) * 7;

        const monthStartMs = new Date(year, month, 1).getTime();
        const monthEndMs   = new Date(year, month + 1, 1).getTime();
        const byDay = collectEvents(monthStartMs, monthEndMs);

        const dows = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        const cells = [];
        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - startDow + 1;
            const cellDate = new Date(year, month, dayNum);
            const inMonth = dayNum >= 1 && dayNum <= totalDays;
            const isToday = cellDate.getTime() === today.getTime();
            const events = byDay[dayKey(cellDate)] || [];
            cells.push({ date: cellDate, inMonth, isToday, events, dow: i % 7 });
        }

        const cellHtml = (c) => {
            const cls = ['cal-cell'];
            if (!c.inMonth) cls.push('out');
            if (c.isToday)  cls.push('today');
            if (c.dow >= 5) cls.push('weekend');
            const evtsHtml = c.events.slice(0, 4).map(e => this._calEventChip(e, { compact: true })).join('');
            const more = c.events.length > 4 ? `<div class="cal-more">+${c.events.length - 4} more</div>` : '';
            return `<div class="${cls.join(' ')}" data-cal-day="${c.date.toISOString()}">
                <div class="cal-day-num">${c.date.getDate()}</div>
                <div class="cal-evts">${evtsHtml}${more}</div>
            </div>`;
        };

        return `<div class="cal-grid-wrap">
            <div class="cal-dow-row">${dows.map(d => `<div class="cal-dow">${d}</div>`).join('')}</div>
            <div class="cal-grid">${cells.map(cellHtml).join('')}</div>
        </div>`;
    },

    _renderCalendarWeek(cursor, today, dayKey, collectEvents) {
        const startMs = cursor.getTime();
        const endMs = startMs + 7 * 86_400_000;
        const byDay = collectEvents(startMs, endMs);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(cursor); d.setDate(d.getDate() + i);
            const isToday = d.getTime() === today.getTime();
            const events = byDay[dayKey(d)] || [];
            days.push({ date: d, isToday, events });
        }
        const dows = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

        return `<div class="cal-week">
            ${days.map((c, i) => `<div class="cal-week-col ${c.isToday ? 'today' : ''} ${i >= 5 ? 'weekend' : ''}" data-cal-day="${c.date.toISOString()}">
                <div class="cal-week-head">
                    <span class="dow">${dows[i]}</span>
                    <span class="num">${c.date.getDate()}</span>
                </div>
                <div class="cal-week-events">
                    ${c.events.length
                        ? c.events.map(e => this._calEventChip(e)).join('')
                        : '<div class="cal-week-empty">—</div>'}
                </div>
            </div>`).join('')}
        </div>`;
    },

    _renderCalendarDay(cursor, today, dayKey, collectEvents) {
        const startMs = (() => { const d = new Date(cursor); d.setHours(0,0,0,0); return d.getTime(); })();
        const endMs = startMs + 86_400_000;
        const byDay = collectEvents(startMs, endMs);
        const events = byDay[dayKey(cursor)] || [];

        const isToday = cursor.getTime() === today.getTime();
        // Group by hour band
        const grouped = {};
        for (const e of events) {
            const t = new Date(e.ts);
            const h = t.getHours();
            (grouped[h] = grouped[h] || []).push(e);
        }
        const hours = [];
        for (let h = 7; h <= 21; h++) hours.push(h);

        const eventsCount = events.length;

        const rows = hours.map(h => {
            const items = grouped[h] || [];
            return `<div class="cal-day-row${items.length ? ' has-events' : ''}">
                <div class="cal-day-hour">${String(h).padStart(2, '0')}:00</div>
                <div class="cal-day-cell">${items.map(e => this._calEventChip(e)).join('')}</div>
            </div>`;
        }).join('');

        const earlyOrLate = events.filter(e => {
            const h = new Date(e.ts).getHours();
            return h < 7 || h > 21;
        });
        const earlyHtml = earlyOrLate.length
            ? `<div class="cal-day-row has-events"><div class="cal-day-hour">other</div><div class="cal-day-cell">${earlyOrLate.map(e => this._calEventChip(e)).join('')}</div></div>`
            : '';

        return `<div class="cal-day-wrap">
            <div class="cal-day-head">
                <span class="cal-day-count">${eventsCount} event${eventsCount === 1 ? '' : 's'}</span>
                ${isToday ? '<span class="cal-day-today">today</span>' : ''}
            </div>
            <div class="cal-day-list">
                ${earlyHtml}
                ${rows}
            </div>
            ${eventsCount === 0 ? '<div class="empty-state"><div class="es-title">Nothing scheduled.</div></div>' : ''}
        </div>`;
    },

    async _loadGcalForMonth(root) {
        const cur = new Date(this.calCursor);
        // Pull a generous window to cover Day/Week/Month modes
        const start = new Date(cur.getFullYear(), cur.getMonth() - 1, 1).toISOString();
        const end   = new Date(cur.getFullYear(), cur.getMonth() + 2, 1).toISOString();
        try {
            const events = await GCal.listEvents(start, end);
            this._gcalEvents = this._gcalEvents || {};
            this._gcalEvents[`${cur.getFullYear()}-${cur.getMonth()}`] = events;
            App.Omni._flash(`gcal · ${events.length} events`);
            this.render_calendar(root);
        } catch (e) {
            App.Omni._flash('gcal · ' + e.message);
        }
    },

    // ============================================================
    // NAVIGATION HELPERS — open detail views with state
    // ============================================================
    openMatter(id) {
        this.currentMatterId = id;
        this.show('matter');
    },
    openClient(id) {
        this.currentClientId = id;
        this.show('client');
    },

    // ============================================================
    // VIEW: MATTER — detail with billing variant (sub / fix / hourly)
    // ============================================================
    render_matter(root) {
        const matter = this.currentMatterId ? Store.getMatter(this.currentMatterId) : null;
        if (!matter) {
            root.innerHTML = `<div class="hero"><div class="left"><h1>matter not found</h1></div></div>`;
            return;
        }
        const client = matter.clientId ? Store.getClient(matter.clientId) : null;
        const mode = matter.billing?.mode || 'hourly';
        const tasks = Store.getTasks().filter(t => t.matterId === matter.id);
        const openTasks = tasks.filter(t => t.status !== 'done');
        const logs = Store.getTimeLogsForMatter(matter.id);
        const totalHours = logs.reduce((s, l) => s + (l.hours || 0), 0);

        const fmtDate = (d) => {
            if (!d) return '—';
            const x = new Date(d);
            return `${String(x.getDate()).padStart(2,'0')}.${String(x.getMonth()+1).padStart(2,'0')}.${x.getFullYear()}`;
        };
        const fmtHM = (h) => {
            if (!h) return '0:00';
            const total = Math.round(h * 60);
            return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        };

        // ----- BILLING BLOCK (3 variants) -----
        let billingBlock = '';
        if (mode === 'subscription') {
            const scope = Store.getSubscriptionScope(matter.id) || { used: 0, included: matter.billing.hours_included || 0 };
            const pct = scope.included ? Math.min(100, scope.used / scope.included * 100) : 0;
            const overUsed = Math.max(0, scope.used - scope.included);
            const overage = overUsed * (matter.billing.overage_rate || 0);
            const scopeCls = pct >= 100 ? 'over' : pct >= 70 ? 'warn' : '';
            billingBlock = `<div class="matter-billing matter-billing-sub ${scopeCls}">
                <div class="mb-row">
                    <div class="mb-stat">
                        <div class="lbl">SUBSCRIPTION · MONTHLY</div>
                        <div class="val">€${(matter.billing.period_fee || 0).toLocaleString('en-US')}</div>
                    </div>
                    <div class="mb-stat">
                        <div class="lbl">SCOPE · CURRENT PERIOD</div>
                        <div class="val">${scope.used.toFixed(1)} <span class="dim">/ ${scope.included || '∞'} h</span></div>
                        <div class="bar"><i style="width:${pct}%"></i></div>
                    </div>
                    <div class="mb-stat">
                        <div class="lbl">OVERAGE · @ €${matter.billing.overage_rate || 0}/h</div>
                        <div class="val">${overUsed > 0 ? '€' + Math.round(overage) : '<span class="dim">none</span>'}</div>
                    </div>
                </div>
            </div>`;
        } else if (mode === 'fixed') {
            const isDone = matter.status === 'done';
            const dl = matter.billing.deadline || matter.deadline;
            billingBlock = `<div class="matter-billing matter-billing-fix">
                <div class="mb-row">
                    <div class="mb-stat">
                        <div class="lbl">FIXED FEE</div>
                        <div class="val">€${(matter.billing.fixed_amount || 0).toLocaleString('en-US')}</div>
                    </div>
                    <div class="mb-stat">
                        <div class="lbl">DEADLINE</div>
                        <div class="val">${fmtDate(dl)}</div>
                    </div>
                    <div class="mb-stat">
                        <div class="lbl">DELIVERY</div>
                        <div class="val">${isDone ? '<span class="ok">✓ delivered</span>' : '<span class="dim">in progress</span>'}</div>
                    </div>
                    <div class="mb-stat">
                        <div class="lbl">HOURS LOGGED · TOTAL</div>
                        <div class="val">${fmtHM(totalHours)}</div>
                    </div>
                </div>
            </div>`;
        } else {
            // hourly
            const rate = matter.billing.hourly_rate || 0;
            const accrued = totalHours * rate;
            // Unbilled = logs not yet on any sent invoice. Crude: count logs without invoiceId.
            const unbilledLogs = logs.filter(l => !l.invoiceId);
            const unbilledHours = unbilledLogs.reduce((s, l) => s + (l.hours || 0), 0);
            const unbilled = unbilledHours * rate;
            billingBlock = `<div class="matter-billing matter-billing-hrly">
                <div class="mb-row">
                    <div class="mb-stat">
                        <div class="lbl">RATE</div>
                        <div class="val">€${rate}<span class="dim">/h</span></div>
                    </div>
                    <div class="mb-stat">
                        <div class="lbl">HOURS LOGGED · TOTAL</div>
                        <div class="val">${fmtHM(totalHours)}</div>
                    </div>
                    <div class="mb-stat">
                        <div class="lbl">ACCRUED · TOTAL</div>
                        <div class="val">€${Math.round(accrued).toLocaleString('en-US')}</div>
                    </div>
                    <div class="mb-stat">
                        <div class="lbl">UNBILLED</div>
                        <div class="val accent">€${Math.round(unbilled).toLocaleString('en-US')}<span class="dim"> · ${fmtHM(unbilledHours)}</span></div>
                    </div>
                </div>
            </div>`;
        }

        // ----- TASKS LIST -----
        const tasksHtml = openTasks.length
            ? openTasks.map(t => {
                const dl = t.deadline ? new Date(t.deadline) : null;
                const isOverdue = dl && dl.getTime() < Date.now();
                const isDueSoon = dl && !isOverdue && (dl.getTime() - Date.now()) < 24 * 3600 * 1000;
                const dlText = dl ? fmtDate(dl) : '—';
                const dlCls = isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : '';
                const runCls = App.Timer.rowClass(t.id);
                return `<tr class="${runCls}" data-task-id="${t.id}">
                    <td class="title-cell">${Dom.escape(t.title)}</td>
                    <td class="deadline-cell ${dlCls}">${dlText}</td>
                    <td class="play-col">${App.Timer.playButtonHtml(t.id)}</td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="3" class="empty-cell">No open tasks on this matter.</td></tr>`;

        // ----- RECENT TIMELOGS -----
        const recentLogs = logs.slice().sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        ).slice(0, 10);
        const logsHtml = recentLogs.length
            ? recentLogs.map(l => {
                const t = l.taskId ? Store.getTask(l.taskId) : null;
                return `<tr data-log-id="${l.id}">
                    <td class="check-col"><input type="checkbox" style="accent-color:var(--accent)"></td>
                    <td class="num mono">${fmtDate(l.date)}</td>
                    <td>${t ? Dom.escape(t.title) : '<span class="fade">—</span>'} ${l.billable === false ? '<span class="fade">· non-bill</span>' : ''}</td>
                    <td class="num">${fmtHM(l.hours)}</td>
                    <td class="num">${l.source === 'timer' ? 'timer' : 'manual'}</td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="5" class="empty-cell">No timelogs yet.</td></tr>`;

        const modeLabel = mode === 'subscription' ? 'SUBSCRIPTION'
                        : mode === 'fixed' ? 'FIXED FEE' : 'HOURLY';

        root.innerHTML = `
            <div class="hero ${matter.status === 'done' ? 'matter-done' : ''}">
                <div class="left">
                    <h1>${Dom.escape(matter.name || '')}${matter.status === 'done' ? ' <span class="status-tag-done">DONE</span>' : ''}</h1>
                    <span class="hero-meta">
                        <button class="link-btn" data-go="client" data-id="${matter.clientId}" type="button">${Dom.escape(client?.name || '—')}</button>
                        · ${modeLabel}
                    </span>
                </div>
                <div class="right">
                    <button class="inv-act ghost" data-edit-matter type="button">✎ Edit</button>
                    <button class="inv-act ${matter.status === 'done' ? 'ghost' : 'primary'}" data-toggle-matter-done type="button">${matter.status === 'done' ? '↶ Reopen' : '✓ Mark complete'}</button>
                    <button class="inv-act ghost" data-gen-invoice type="button">⎙ Generate invoice</button>
                    <button class="link-btn quiet" data-back-tasks type="button">‹ all tasks</button>
                </div>
            </div>

            ${billingBlock}

            ${matter.notes ? `<div class="notes-block"><div class="notes-head">notes</div><div class="notes-body">${Dom.escape(matter.notes)}</div></div>` : ''}

            ${this._renderAttachments({ ownerType: 'matter', ownerId: matter.id })}

            <div class="time-section">
                <div class="time-section-head">
                    tasks · ${openTasks.length}
                    <button class="inv-act ghost" data-quick-add-task type="button" style="margin-left:auto">+ task</button>
                </div>
                <table class="time-table">
                    <colgroup><col><col style="width:130px"><col style="width:48px"></colgroup>
                    <thead><tr><th>Title</th><th>Deadline</th><th></th></tr></thead>
                    <tbody>${tasksHtml}</tbody>
                </table>
            </div>

            <div class="time-section">
                <div class="time-section-head">recent time · ${logs.length} log${logs.length === 1 ? '' : 's'} · ${fmtHM(totalHours)} total</div>
                <table class="time-table">
                    <colgroup><col style="width:36px"><col style="width:110px"><col><col style="width:80px"><col style="width:80px"></colgroup>
                    <thead><tr><th></th><th>Date</th><th>Task</th><th class="num">Hours</th><th class="num">Source</th></tr></thead>
                    <tbody>${logsHtml}</tbody>
                </table>
            </div>
        `;

        // Wire client link
        root.querySelectorAll('[data-go="client"]').forEach(b => b.addEventListener('click', () => {
            this.openClient(b.dataset.id);
        }));
        this._bindAttachments(root);
        root.querySelectorAll('[data-back-tasks]').forEach(b => b.addEventListener('click', () => this.show('inbox')));
        root.querySelectorAll('[data-edit-matter]').forEach(b => b.addEventListener('click', () => this.Edit.open('matter', this.currentMatterId)));
        root.querySelectorAll('[data-toggle-matter-done]').forEach(b => b.addEventListener('click', () => {
            const m = Store.getMatter(this.currentMatterId);
            if (!m) return;
            const isDone = m.status === 'done';
            if (!isDone) {
                const openTaskCount = Store.getTasks().filter(t => t.matterId === m.id && t.status !== 'done').length;
                const msg = openTaskCount
                    ? `Mark «${m.name}» complete?\n\n${openTaskCount} task${openTaskCount === 1 ? ' is' : 's are'} still open. They will stay but the matter goes to "done" status.`
                    : `Mark «${m.name}» complete?`;
                if (!confirm(msg)) return;
            }
            m.status = isDone ? 'active' : 'done';
            m.updated = new Date().toISOString();
            if (m.status === 'done') m.completed_at = new Date().toISOString();
            else delete m.completed_at;
            Store.flush();
            App.Omni._flash(isDone ? `↶ reopened · ${m.name.slice(0, 30)}` : `✓ done · ${m.name.slice(0, 30)}`);
            this.show('matter');
            this.renderSidebar();
        }));
        root.querySelectorAll('[data-quick-add-task]').forEach(b => b.addEventListener('click', () => {
            const title = prompt('New task for ' + (Store.getMatter(this.currentMatterId)?.name || 'matter') + ':');
            if (!title?.trim()) return;
            const m = Store.getMatter(this.currentMatterId);
            const newTask = Store.addTask({
                title: title.trim(),
                clientId: m?.clientId || null,
                matterId: this.currentMatterId,
                status: 'todo',
                priority: 'medium',
            });
            App.Omni._flash(`+ task · ${newTask.title.slice(0, 30)}`);
            this.show('matter');
        }));
        root.querySelectorAll('[data-gen-invoice]').forEach(b => b.addEventListener('click', () => {
            const m = Store.getMatter(this.currentMatterId);
            if (!m) return;
            const inv = Store.generateInvoiceFromMatter(m.id);
            if (!inv) { App.Omni._flash('could not generate'); return; }
            this.invoiceExpandedId = inv.id;
            App.Omni._flash(`draft · ${inv.number} · €${Math.round(inv.total)}`);
            this.show('invoices');
        }));
    },

    // ============================================================
    // VIEW: CLIENT — detail with matters list + recent activity
    // ============================================================
    render_client(root) {
        const client = this.currentClientId ? Store.getClient(this.currentClientId) : null;
        if (!client) {
            root.innerHTML = `<div class="hero"><div class="left"><h1>client not found</h1></div></div>`;
            return;
        }
        const matters = Store.getMatters(client.id);
        const tasks = Store.getTasks().filter(t => t.clientId === client.id);
        const openTasks = tasks.filter(t => t.status !== 'done').length;
        const allLogs = Store.getTimeLogs().filter(l => {
            const m = l.matterId ? Store.getMatter(l.matterId) : null;
            return m && m.clientId === client.id;
        });
        const totalHours = allLogs.reduce((s, l) => s + (l.hours || 0), 0);
        const invoices = Store.getInvoices(client.id);
        const outstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0);
        const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);

        const fmtHM = (h) => {
            if (!h) return '0:00';
            const total = Math.round(h * 60);
            return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        };

        const mattersHtml = matters.length
            ? matters.map(m => {
                const mode = m.billing?.mode || 'hourly';
                const modeLbl = mode === 'subscription' ? `Sub €${m.billing.period_fee || 0}/mo`
                              : mode === 'fixed' ? `Fixed €${m.billing.fixed_amount || 0}`
                              : `Hourly €${m.billing.hourly_rate || 0}/h`;
                const mTasks = tasks.filter(t => t.matterId === m.id && t.status !== 'done').length;
                const mLogs  = Store.getTimeLogsForMatter(m.id);
                const mHours = mLogs.reduce((s, l) => s + (l.hours || 0), 0);
                return `<tr data-matter-id="${m.id}">
                    <td>${Dom.escape(m.name || '')}</td>
                    <td class="mode-cell">${modeLbl}</td>
                    <td class="num">${mTasks}</td>
                    <td class="num">${fmtHM(mHours)}</td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="4" class="empty-cell">No matters yet.</td></tr>`;

        const invoicesHtml = invoices.length
            ? invoices.slice().sort((a,b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()).map(inv => {
                return `<tr>
                    <td><span class="inv-dot status-${inv.status}"></span></td>
                    <td class="inv-num"><a class="cell-link" data-open="invoice" data-id="${inv.id}">${Dom.escape(inv.number)}</a></td>
                    <td class="num">€${(inv.total || 0).toLocaleString('en-US')}</td>
                    <td class="mode-cell">${inv.status}</td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="4" class="empty-cell">No invoices yet.</td></tr>`;

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <h1>${Dom.escape(client.name)}</h1>
                    <span class="hero-meta">${client.industry || '—'} · ${matters.length} matter${matters.length === 1 ? '' : 's'} · ${openTasks} open · ${fmtHM(totalHours)} logged</span>
                </div>
                <div class="right">
                    <button class="inv-act ghost" data-time-report type="button">⎙ Time report</button>
                    <button class="inv-act ghost" data-edit-client type="button">✎ Edit</button>
                    <span class="hero-meta">€${Math.round(outstanding).toLocaleString('en-US')} outstanding · €${Math.round(paid).toLocaleString('en-US')} paid</span>
                </div>
            </div>

            ${this._renderTimeReport(client)}

            <div class="time-section">
                <div class="time-section-head">
                    matters · ${matters.length}
                    <button class="inv-act ghost" data-quick-add-matter type="button" style="margin-left:auto">+ matter</button>
                </div>
                <table class="time-table client-matters">
                    <colgroup><col><col style="width:170px"><col style="width:90px"><col style="width:90px"></colgroup>
                    <thead><tr><th>Matter</th><th>Mode</th><th class="num">Open</th><th class="num">Hours</th></tr></thead>
                    <tbody>${mattersHtml}</tbody>
                </table>
            </div>

            <div class="time-section">
                <div class="time-section-head">invoices · ${invoices.length}</div>
                <table class="time-table">
                    <colgroup><col style="width:24px"><col style="width:170px"><col style="width:120px"><col></colgroup>
                    <thead><tr><th></th><th>Number</th><th class="num">Total</th><th>Status</th></tr></thead>
                    <tbody>${invoicesHtml}</tbody>
                </table>
            </div>
        `;

        // Click matter row → render_matter
        root.querySelectorAll('.client-matters tr[data-matter-id]').forEach(tr => {
            tr.addEventListener('click', () => this.openMatter(tr.dataset.matterId));
        });
        root.querySelectorAll('[data-edit-client]').forEach(b => b.addEventListener('click', () => this.Edit.open('client', this.currentClientId)));
        root.querySelectorAll('[data-quick-add-matter]').forEach(b => b.addEventListener('click', () => {
            const name = prompt('Matter name (e.g. "Series B prep" or "MiCA registration"):');
            if (!name?.trim()) return;
            const m = Store.addMatter({
                name: name.trim(),
                clientId: this.currentClientId,
                status: 'active',
                billing: { mode: 'hourly', hourly_rate: 100 },
            });
            App.Omni._flash(`+ matter · ${m.name}`);
            this.openMatter(m.id);
            // Open edit modal so user can adjust billing mode + rate
            setTimeout(() => this.Edit.open('matter', m.id), 80);
        }));
        root.querySelectorAll('[data-time-report]').forEach(b => b.addEventListener('click', () => {
            document.body.classList.add('printing-time-report');
            setTimeout(() => {
                window.print();
                setTimeout(() => document.body.classList.remove('printing-time-report'), 200);
            }, 80);
        }));
    },

    /** Hidden printable time report — surfaced only via window.print() with .printing-time-report on body. */
    _renderTimeReport(client) {
        const matters = Store.getMatters(client.id);
        const allLogs = Store.getTimeLogs().filter(l => {
            const m = l.matterId ? Store.getMatter(l.matterId) : null;
            return m && m.clientId === client.id;
        });
        const fmtHM = (h) => {
            const total = Math.round((h || 0) * 60);
            return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        };
        const fmtDate = (d) => {
            const x = new Date(d);
            return `${String(x.getDate()).padStart(2,'0')}.${String(x.getMonth()+1).padStart(2,'0')}.${x.getFullYear()}`;
        };
        const totalHours = allLogs.reduce((s, l) => s + (l.hours || 0), 0);
        const profile = Store.getSetting('profile') || {};
        const reportDate = new Date();

        const matterBlocks = matters.map(m => {
            const ml = allLogs.filter(l => l.matterId === m.id);
            if (!ml.length) return '';
            const mh = ml.reduce((s, l) => s + (l.hours || 0), 0);
            const rate = m.billing?.mode === 'hourly' ? (m.billing.hourly_rate || 0) : 0;
            const amount = rate ? mh * rate : 0;
            const rows = ml.slice().sort((a, b) => new Date(a.date) - new Date(b.date)).map(l => {
                const t = l.taskId ? Store.getTask(l.taskId) : null;
                return `<tr>
                    <td>${fmtDate(l.date)}</td>
                    <td>${t ? Dom.escape(t.title) : '<em>—</em>'}</td>
                    <td class="num">${fmtHM(l.hours)}</td>
                </tr>`;
            }).join('');
            return `
                <div class="tr-matter-block">
                    <h3>${Dom.escape(m.name)}</h3>
                    <div class="tr-meta">${(m.billing?.mode || 'hourly').toUpperCase()}${rate ? ` · €${rate}/h` : ''} · total ${fmtHM(mh)}${amount ? ` · €${Math.round(amount)}` : ''}</div>
                    <table class="tr-table">
                        <thead><tr><th>Date</th><th>Task</th><th class="num">Hours</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }).join('');

        return `<div class="time-report" id="time-report">
            <div class="tr-head">
                <div>
                    <div class="tr-eyebrow">TIME REPORT</div>
                    <div class="tr-from">${Dom.escape(profile.name || 'your firm')}</div>
                    <div class="tr-from-meta">${Dom.escape(profile.email || '')}${profile.address ? ' · ' + Dom.escape(profile.address) : ''}</div>
                </div>
                <div class="tr-to">
                    <div class="tr-lbl">FOR</div>
                    <div class="tr-client">${Dom.escape(client.name)}</div>
                    <div class="tr-from-meta">${Dom.escape(client.email || '')}</div>
                </div>
                <div class="tr-summary">
                    <div class="tr-lbl">SUMMARY</div>
                    <div class="tr-total">${fmtHM(totalHours)}</div>
                    <div class="tr-from-meta">${matters.length} matter${matters.length === 1 ? '' : 's'} · generated ${fmtDate(reportDate)}</div>
                </div>
            </div>
            ${matterBlocks || '<p class="tr-empty">No logged time yet.</p>'}
        </div>`;
    },

    // ============================================================
    // VIEW: INVOICES — minimal list view (status · number · client · total · due)
    // ============================================================
    render_invoices(root) {
        const all = Store.getInvoices().slice();
        // Sort: drafts on top, then by issued_at desc
        const order = { draft: 0, sent: 1, paid: 2 };
        all.sort((a, b) => {
            const oa = order[a.status] ?? 9, ob = order[b.status] ?? 9;
            if (oa !== ob) return oa - ob;
            return new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime();
        });

        const totalOutstanding = all.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0);
        const totalPaid = all.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);

        const fmtDate = (d) => {
            const x = new Date(d);
            return `${String(x.getDate()).padStart(2,'0')}.${String(x.getMonth()+1).padStart(2,'0')}.${x.getFullYear()}`;
        };
        const dueText = (i) => {
            if (i.status === 'paid') return `paid ${fmtDate(i.paid_at || i.issued_at)}`;
            if (i.status === 'draft') return 'not sent';
            const dueMs = new Date(i.due_at).getTime();
            const days = Math.round((dueMs - Date.now()) / (24 * 3600 * 1000));
            if (days < 0)  return `overdue ${-days}d`;
            if (days === 0) return 'due today';
            return `due in ${days}d`;
        };

        const rows = all.length ? all.map(inv => {
            const client = inv.clientId ? Store.getClient(inv.clientId) : null;
            const isDraft   = inv.status === 'draft';
            const isPaid    = inv.status === 'paid';
            const dueMs     = inv.due_at ? new Date(inv.due_at).getTime() : null;
            const isOverdue = !isPaid && !isDraft && dueMs && dueMs < Date.now();
            const dueCls = isOverdue ? 'overdue' : (isPaid ? 'paid' : (isDraft ? 'draft' : ''));
            const expanded = this.invoiceExpandedId === inv.id;

            const rowHtml = `<tr class="inv-row${expanded ? ' expanded' : ''}" data-invoice-id="${inv.id}">
                <td><span class="inv-dot status-${inv.status}"></span></td>
                <td class="inv-num">${Dom.escape(inv.number)}</td>
                <td>${client ? `<a class="cell-link" data-open="client" data-id="${client.id}">${Dom.escape(client.name)}</a>` : '<span class="fade">—</span>'}</td>
                <td class="inv-lines">${inv.lines.length} line${inv.lines.length === 1 ? '' : 's'}</td>
                <td class="num">€${(inv.total || 0).toLocaleString('en-US')}</td>
                <td class="due ${dueCls}">${dueText(inv)}</td>
            </tr>`;
            const detailHtml = expanded
                ? `<tr class="inv-detail-row"><td colspan="6">${this._renderInvoiceDoc(inv, client)}</td></tr>`
                : '';
            return rowHtml + detailHtml;
        }).join('') : `<tr><td colspan="6" class="empty-cell">No invoices yet.</td></tr>`;

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <h1>${I18n.t('heroInvoices')}</h1>
                    <span class="hero-meta">€${Math.round(totalOutstanding).toLocaleString('en-US')} ${I18n.t('outstanding')} · €${Math.round(totalPaid).toLocaleString('en-US')} ${I18n.t('paid')}</span>
                </div>
            </div>
            <div class="time-section">
                <table class="time-table inv-table">
                    <colgroup>
                        <col style="width:24px">
                        <col style="width:170px">
                        <col>
                        <col style="width:90px">
                        <col style="width:100px">
                        <col style="width:130px">
                    </colgroup>
                    <thead><tr>
                        <th></th>
                        <th>Number</th>
                        <th>Client</th>
                        <th>Lines</th>
                        <th class="num">Total</th>
                        <th>Status</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        // Toggle row expansion
        root.querySelectorAll('.inv-table tbody tr.inv-row').forEach(tr => {
            tr.addEventListener('click', () => {
                const id = tr.dataset.invoiceId;
                this.invoiceExpandedId = (this.invoiceExpandedId === id) ? null : id;
                this.render_invoices(root);
            });
        });
        // Action buttons inside the detail panel (mark sent / mark paid)
        root.querySelectorAll('[data-inv-action]').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = b.dataset.invId;
                const action = b.dataset.invAction;
                const inv = Store.getInvoice(id);
                if (!inv) return;
                const now = new Date().toISOString();
                if (action === 'email') {
                    const client = inv.clientId ? Store.getClient(inv.clientId) : null;
                    const profile = Store.getSetting('profile') || {};
                    const fmtDate = (d) => {
                        if (!d) return '—';
                        const x = new Date(d);
                        return `${String(x.getDate()).padStart(2,'0')}.${String(x.getMonth()+1).padStart(2,'0')}.${x.getFullYear()}`;
                    };
                    const subject = encodeURIComponent(`Invoice ${inv.number} from ${profile.name || 'your firm'}`);
                    const linesText = inv.lines.map(l => `  • ${l.description} — €${l.amount}`).join('\n');
                    const body = encodeURIComponent([
                        `Dear ${client?.name || 'client'},`,
                        '',
                        `Please find invoice ${inv.number} attached.`,
                        '',
                        `Issued: ${fmtDate(inv.issued_at)}`,
                        `Due:    ${fmtDate(inv.due_at)}`,
                        `Total:  €${(inv.total || 0).toLocaleString('en-US')}`,
                        '',
                        'Lines:',
                        linesText,
                        '',
                        `Best regards,`,
                        profile.name || '',
                    ].join('\n'));
                    const to = encodeURIComponent(client?.email || '');
                    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
                    App.Omni._flash('opened mail client · attach the PDF manually');
                    return;
                }
                if (action === 'print') {
                    // Make sure the row is expanded so the doc is in DOM
                    if (this.invoiceExpandedId !== inv.id) {
                        this.invoiceExpandedId = inv.id;
                        this.render_invoices(root);
                    }
                    document.body.classList.add('printing-invoice');
                    document.body.dataset.printInv = inv.id;
                    setTimeout(() => {
                        window.print();
                        // Clean up after the print dialog closes (some browsers fire it sync)
                        setTimeout(() => {
                            document.body.classList.remove('printing-invoice');
                            delete document.body.dataset.printInv;
                        }, 200);
                    }, 80);
                    return;
                }
                if (action === 'send')  { inv.status = 'sent';  inv.sent_at = now; }
                if (action === 'paid')  { inv.status = 'paid';  inv.paid_at = now; if (!inv.sent_at) inv.sent_at = now; }
                if (action === 'unpaid'){ inv.status = 'sent';  inv.paid_at = null; }
                Store.flush();
                this.render_invoices(root);
            });
        });
    },

    /** Editorial invoice document — minimal, plum AMOUNT DUE block, FROM/BILL TO grid. */
    _renderInvoiceDoc(inv, client) {
        const fmtDate = (d) => {
            if (!d) return '—';
            const x = new Date(d);
            return `${String(x.getDate()).padStart(2,'0')} ${new Intl.DateTimeFormat('en', { month: 'short' }).format(x).toLowerCase()} ${x.getFullYear()}`;
        };
        const matterName = (mid) => {
            const m = mid ? Store.getMatter(mid) : null;
            return m ? (m.title || m.name || '') : '';
        };
        const lineRow = (l) => {
            const detail = l.type === 'subscription'   ? '<span class="ltype">SUB</span>'
                         : l.type === 'fixed_milestone'? '<span class="ltype">FIX</span>'
                         : l.type === 'hourly_bundle'  ? '<span class="ltype">HRLY</span>'
                         : '';
            const sub = l.type === 'hourly_bundle'
                ? `<div class="lsub">${l.hours} h × €${l.rate}/h</div>`
                : (matterName(l.matterId) ? `<div class="lsub">${Dom.escape(matterName(l.matterId))}</div>` : '');
            return `<tr>
                <td class="ldesc">${detail}<div class="ltext">${Dom.escape(l.description)}</div>${sub}</td>
                <td class="lamt">€${(l.amount || 0).toLocaleString('en-US')}</td>
            </tr>`;
        };

        const actions = [];
        actions.push(`<button class="inv-act ghost" data-inv-action="print" data-inv-id="${inv.id}" type="button">⎙ Print / PDF</button>`);
        actions.push(`<button class="inv-act ghost" data-inv-action="email" data-inv-id="${inv.id}" type="button">✉ Email</button>`);
        if (inv.status === 'draft') actions.push(`<button class="inv-act primary" data-inv-action="send" data-inv-id="${inv.id}" type="button">Mark sent</button>`);
        if (inv.status === 'sent')  actions.push(`<button class="inv-act primary" data-inv-action="paid" data-inv-id="${inv.id}" type="button">Mark paid</button>`);
        if (inv.status === 'paid')  actions.push(`<button class="inv-act ghost"   data-inv-action="unpaid" data-inv-id="${inv.id}" type="button">Mark unpaid</button>`);

        const profile = Store.getSetting('profile') || {};
        const logoBlock = profile.logo
            ? `<div class="inv-doc-logo"><img src="${Dom.escape(profile.logo)}" alt="logo"></div>`
            : '';
        const fromBlock = `
            <div class="party">
                ${Dom.escape(profile.name || 'your firm')}<br>
                ${profile.address ? `<span class="dim">${Dom.escape(profile.address)}</span><br>` : ''}
                ${profile.email ? `<span class="dim">${Dom.escape(profile.email)}</span>` : ''}
                ${profile.phone ? `<br><span class="dim">${Dom.escape(profile.phone)}</span>` : ''}
                ${profile.vat_id ? `<br><span class="dim">VAT ${Dom.escape(profile.vat_id)}</span>` : ''}
            </div>`;
        const billToBlock = `
            <div class="party">
                ${Dom.escape(client?.name || '—')}<br>
                ${client?.email ? `<span class="dim">${Dom.escape(client.email)}</span>` : ''}
            </div>`;
        const paymentBlock = (profile.iban || profile.bank_name) ? `
            <div class="inv-doc-payment">
                <div class="lbl">PAYMENT</div>
                <div class="pay-grid">
                    ${profile.bank_name ? `<div><span class="k">Bank</span><span class="v">${Dom.escape(profile.bank_name)}</span></div>` : ''}
                    ${profile.account_holder ? `<div><span class="k">Beneficiary</span><span class="v">${Dom.escape(profile.account_holder)}</span></div>` : ''}
                    ${profile.iban ? `<div><span class="k">IBAN</span><span class="v mono">${Dom.escape(profile.iban)}</span></div>` : ''}
                    ${profile.bic ? `<div><span class="k">BIC / SWIFT</span><span class="v mono">${Dom.escape(profile.bic)}</span></div>` : ''}
                    <div><span class="k">Reference</span><span class="v mono">${Dom.escape(inv.number)}</span></div>
                </div>
            </div>` : '';

        return `<div class="inv-doc">
            <div class="inv-doc-head">
                <div class="inv-doc-head-left">
                    ${logoBlock}
                    <div>
                        <div class="inv-doc-eyebrow">INVOICE</div>
                        <div class="inv-doc-num">${Dom.escape(inv.number)}</div>
                    </div>
                </div>
                <div class="inv-doc-due">
                    <div class="lbl">AMOUNT DUE</div>
                    <div class="amt">€${(inv.total || 0).toLocaleString('en-US')}</div>
                    <div class="when">${inv.status === 'paid' ? 'paid ' + fmtDate(inv.paid_at) : 'due ' + fmtDate(inv.due_at)}</div>
                </div>
            </div>
            <div class="inv-doc-grid">
                <div>
                    <div class="lbl">FROM</div>
                    ${fromBlock}
                </div>
                <div>
                    <div class="lbl">BILL TO</div>
                    ${billToBlock}
                </div>
                <div>
                    <div class="lbl">ISSUED · DUE</div>
                    <div class="party">${fmtDate(inv.issued_at)}<br><span class="dim">due ${fmtDate(inv.due_at)}</span></div>
                </div>
            </div>
            <table class="inv-doc-lines">
                <tbody>${inv.lines.map(lineRow).join('')}</tbody>
            </table>
            <div class="inv-doc-totals">
                <div><span class="lbl">SUBTOTAL</span><span>€${(inv.subtotal || 0).toLocaleString('en-US')}</span></div>
                ${inv.vat_pct ? `<div><span class="lbl">VAT ${inv.vat_pct}%</span><span>€${(inv.vat_amount || 0).toLocaleString('en-US')}</span></div>` : ''}
                <div class="grand"><span class="lbl">TOTAL</span><span>€${(inv.total || 0).toLocaleString('en-US')}</span></div>
            </div>

            ${paymentBlock}

            ${profile.payment_terms ? `<div class="inv-doc-footnote">${Dom.escape(profile.payment_terms)}</div>` : ''}

            ${actions.length ? `<div class="inv-doc-actions">${actions.join('')}</div>` : ''}
        </div>`;
    },

    // ============================================================
    // VIEW: TIME — by-task and by-matter rollups from real timelogs
    // (per the hifi-08 minimalist spec)
    // ============================================================
    render_time(root) {
        const logs = Store.getTimeLogs();
        const now = new Date();

        const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); };
        const startOfWeek = (d) => {
            const x = new Date(d); x.setHours(0,0,0,0);
            const day = (x.getDay() + 6) % 7;            // Monday-based
            x.setDate(x.getDate() - day);
            return x.getTime();
        };
        const startOfMonth = (d) => { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(1); return x.getTime(); };
        const dayMs   = startOfDay(now);
        const weekMs  = startOfWeek(now);
        const monthMs = startOfMonth(now);

        const sum = (arr) => arr.reduce((s, l) => s + (l.hours || 0), 0);
        const since = (ms) => logs.filter(l => l.date && new Date(l.date).getTime() >= ms);

        const todayHrs = sum(since(dayMs));
        const weekHrs  = sum(since(weekMs));

        // Compute effective rate (sum amounts / sum hours) for projection display.
        const matters = Store.getMatters();
        const matterHoursWeek = (mid) => sum(since(weekMs).filter(l => l.matterId === mid));
        const matterHoursMonth = (mid) => sum(since(monthMs).filter(l => l.matterId === mid));
        const matterAmount = (m) => {
            const mode = m.billing?.mode || 'hourly';
            if (mode === 'fixed')        return m.billing.fixed_amount || 0;
            if (mode === 'subscription') return m.billing.period_fee || 0;
            return matterHoursWeek(m.id) * (m.billing?.hourly_rate || 0);
        };
        const projectedWeek = matters.reduce((s, m) => {
            const mode = m.billing?.mode || 'hourly';
            if (mode === 'hourly') return s + matterHoursWeek(m.id) * (m.billing?.hourly_rate || 0);
            return s; // fixed/sub are already monthly figures, not per-week
        }, 0);

        // -----------------------------------------------------------
        //  BY TASK — running task is highlighted lime
        // -----------------------------------------------------------
        const taskRows = Store.getTasks()
            .map(t => {
                const taskLogs = logs.filter(l => l.taskId === t.id);
                const today = sum(taskLogs.filter(l => new Date(l.date).getTime() >= dayMs));
                const week  = sum(taskLogs.filter(l => new Date(l.date).getTime() >= weekMs));
                if (today === 0 && week === 0 && App.Timer.rowClass(t.id) === '') return null;
                const matter = t.matterId ? Store.getMatter(t.matterId) : null;
                const rate = matter?.billing?.mode === 'hourly' ? (matter.billing.hourly_rate || 0) : 0;
                const amount = rate ? week * rate : 0;
                return { task: t, matter, today, week, amount, mode: matter?.billing?.mode };
            })
            .filter(Boolean)
            .sort((a, b) => b.week - a.week);

        const fmtHM = (h) => {
            if (!h) return '—';
            const total = Math.round(h * 60);
            const hh = Math.floor(total / 60);
            const mm = total % 60;
            return `${hh}:${String(mm).padStart(2, '0')}`;
        };

        const taskTbody = taskRows.length
            ? taskRows.map(r => {
                const runningCls = App.Timer.rowClass(r.task.id);
                const matterText = r.matter
                    ? `<a class="cell-link" data-open="matter" data-id="${r.matter.id}">${Dom.escape(r.matter.name || '')}</a>`
                    : '<span class="fade">—</span>';
                const amountText = r.mode === 'fixed' ? '<span class="fade">fixed</span>'
                                 : r.mode === 'subscription' ? '<span class="fade">scope</span>'
                                 : (r.amount ? '€' + Math.round(r.amount) : '<span class="fade">—</span>');
                return `<tr class="${runningCls}" data-task-id="${r.task.id}">
                    <td class="title-cell">${Dom.escape(r.task.title)}</td>
                    <td class="matter-cell">${matterText}</td>
                    <td class="num">${fmtHM(r.today)}</td>
                    <td class="num">${fmtHM(r.week)}</td>
                    <td class="num">${amountText}</td>
                    <td class="play-col">${App.Timer.playButtonHtml(r.task.id)}</td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="6" class="empty-cell">No tracked work yet — click ▶ on any task to start.</td></tr>`;

        const taskTotalToday = taskRows.reduce((s, r) => s + r.today, 0);
        const taskTotalWeek  = taskRows.reduce((s, r) => s + r.week, 0);
        const taskTotalAmt   = taskRows.reduce((s, r) => s + r.amount, 0);
        const taskFoot = taskRows.length
            ? `<tfoot><tr>
                <td colspan="2">Total · ${taskRows.length} task${taskRows.length > 1 ? 's' : ''}</td>
                <td class="num">${fmtHM(taskTotalToday)}</td>
                <td class="num">${fmtHM(taskTotalWeek)}</td>
                <td class="num">${taskTotalAmt ? '€' + Math.round(taskTotalAmt) : '—'}</td>
                <td></td>
            </tr></tfoot>`
            : '';

        // -----------------------------------------------------------
        //  BY MATTER
        // -----------------------------------------------------------
        const matterRows = matters.map(m => {
            const week = matterHoursWeek(m.id);
            const month = matterHoursMonth(m.id);
            if (week === 0 && month === 0) return null;
            const client = m.clientId ? Store.getClient(m.clientId) : null;
            const mode = m.billing?.mode || 'hourly';
            const amount = matterAmount(m);
            let scope = '';
            let scopeCls = '';
            if (mode === 'subscription') {
                const sc = Store.getSubscriptionScope(m.id);
                if (sc && sc.included) {
                    const pct = sc.used / sc.included * 100;
                    scope = `${sc.used.toFixed(1)} / ${sc.included} h`;
                    if (pct >= 100)      scopeCls = 'over';
                    else if (pct >= 70)  scopeCls = 'warn';
                }
            } else if (mode === 'fixed') {
                scope = '<span class="fade">fixed total</span>';
            } else {
                scope = `${week.toFixed(1)} h logged`;
            }
            const modeLabel = mode === 'subscription' ? `Sub €${m.billing.period_fee || 0}/mo`
                            : mode === 'fixed' ? `Fixed €${m.billing.fixed_amount || 0}`
                            : `Hourly €${m.billing.hourly_rate || 0}/h`;
            return { matter: m, client, mode, modeLabel, week, month, amount, scope, scopeCls };
        }).filter(Boolean).sort((a, b) => b.week - a.week);

        const matterTbody = matterRows.length
            ? matterRows.map(r => `<tr>
                <td class="matter-cell">
                    <div><a class="cell-link" data-open="matter" data-id="${r.matter.id}">${Dom.escape(r.matter.name || '')}</a></div>
                    <div class="sub">${r.client ? `<a class="cell-link" data-open="client" data-id="${r.client.id}">${Dom.escape(r.client.name)}</a>` : '—'}</div>
                </td>
                <td class="mode-cell">${r.modeLabel}</td>
                <td class="num">${fmtHM(r.week)}</td>
                <td class="num">${fmtHM(r.month)}</td>
                <td class="num amt">${r.amount ? '€' + Math.round(r.amount) : '—'}</td>
                <td class="scope ${r.scopeCls}">${r.scope}</td>
            </tr>`).join('')
            : `<tr><td colspan="6" class="empty-cell">No matter activity this period.</td></tr>`;

        // -----------------------------------------------------------
        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <h1>${I18n.t('heroTime')}</h1>
                    <span class="hero-meta">${fmtHM(todayHrs)} ${I18n.t('today')} · ${fmtHM(weekHrs)} ${I18n.t('week')} · €${Math.round(projectedWeek)} hourly</span>
                </div>
                <div class="right">
                    <button class="inv-act ghost" data-add-log type="button">+ Log time</button>
                </div>
            </div>

            <div id="add-log-form" class="add-log-form" hidden>
                <div class="alf-row">
                    <label><span>Hours</span><input type="number" step="0.25" min="0" id="alf-hours" placeholder="0.5"></label>
                    <label><span>Date</span><input type="date" id="alf-date" value="${(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}"></label>
                    <label><span>Matter</span>
                        <select id="alf-matter">
                            <option value="">— pick matter —</option>
                            ${Store.getActiveMatters().map(m => {
                                const c = Store.getClient(m.clientId);
                                return `<option value="${m.id}">${Dom.escape((c?.name || '?') + ' · ' + m.name)}</option>`;
                            }).join('')}
                        </select>
                    </label>
                    <label><span>Task (opt)</span>
                        <select id="alf-task">
                            <option value="">— none —</option>
                        </select>
                    </label>
                </div>
                <div class="alf-row">
                    <label class="alf-wide"><span>Note</span><input type="text" id="alf-note" placeholder="brief description"></label>
                    <label class="alf-checkbox"><input type="checkbox" id="alf-billable" checked> billable</label>
                    <button class="inv-act primary" id="alf-save" type="button">Save log</button>
                    <button class="inv-act ghost" id="alf-cancel" type="button">Cancel</button>
                </div>
            </div>

            <div class="time-section">
                <div class="time-section-head">${I18n.t('secByTask')}</div>
                <table class="time-table">
                    <colgroup><col><col style="width:200px"><col style="width:80px"><col style="width:80px"><col style="width:90px"><col style="width:48px"></colgroup>
                    <thead><tr>
                        <th>Task</th>
                        <th>Matter</th>
                        <th class="num">Today</th>
                        <th class="num">Week</th>
                        <th class="num">Amount</th>
                        <th></th>
                    </tr></thead>
                    <tbody>${taskTbody}</tbody>
                    ${taskFoot}
                </table>
            </div>

            <div class="time-section">
                <div class="time-section-head">${I18n.t('secByMatter')}</div>
                <table class="time-table">
                    <colgroup><col><col style="width:160px"><col style="width:80px"><col style="width:80px"><col style="width:100px"><col style="width:160px"></colgroup>
                    <thead><tr>
                        <th>Matter</th>
                        <th>Mode</th>
                        <th class="num">Week</th>
                        <th class="num">Month</th>
                        <th class="num">Amount</th>
                        <th>Scope</th>
                    </tr></thead>
                    <tbody>${matterTbody}</tbody>
                </table>
            </div>
        `;
        this._wireAddLogForm(root);
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
                </div>
            </div>

            ${this._todayActiveTimerBlock()}

            ${this._renderInboxScanPlate()}

            ${renderFire()}

            ${renderBlock(morning, 'MORNING', '09:00 — 12:00')}
            ${renderBlock(afternoon, 'AFTERNOON', '13:00 — 18:00')}
            ${done.length ? `<div class="time-bar done"><span>DONE · ${this._pad(done.length)}</span><span>EARLIER TODAY</span></div>` : ''}
            ${done.length ? (isBoard
                ? `<div class="board-grid">${done.map(it => this._renderCard(it)).join('')}</div>`
                : done.map(it => this._renderRow(it)).join('')) : ''}

            ${this._renderAiFooter()}
        `;

        root.querySelectorAll('[data-go="capture"]').forEach(b => b.addEventListener('click', () => this.Omni.focus()));
        root.querySelectorAll('[data-stop-running]').forEach(b => b.addEventListener('click', () => this.Timer.stop()));
        // Inbox-scan plate handlers
        root.querySelectorAll('[data-iscan-accept]').forEach(b => b.addEventListener('click', () => {
            const msgId = b.dataset.msgId;
            const idx = parseInt(b.dataset.taskIdx, 10);
            const a = this._inboxScan.analysis[msgId];
            const f = a?.tasks?.[idx];
            if (!f) return;
            Store.addTask({
                title: f.title || '(from email)',
                deadline: f.deadline || null,
                priority: f.priority || 'medium',
                clientId: f.clientId || null,
                matterId: f.matterId || null,
                status: 'todo',
                tags: ['email'],
            });
            App.Omni._flash(`+ task · ${(f.title || '').slice(0, 30)}`);
            // Remove that task from analysis so the row updates count
            a.tasks.splice(idx, 1);
            this.show('today');
            this.renderSidebar();
        }));
        root.querySelectorAll('[data-iscan-dismiss]').forEach(b => b.addEventListener('click', () => {
            this._inboxScan.dismissed.add(b.dataset.msgId);
            this.show('today');
        }));
        root.querySelectorAll('[data-iscan-clear]').forEach(b => b.addEventListener('click', () => {
            this._inboxScan.messages.forEach(m => this._inboxScan.dismissed.add(m.id));
            this.show('today');
        }));
        root.querySelectorAll('[data-iscan-rescan]').forEach(b => b.addEventListener('click', () => {
            this._inboxScan = { messages: [], analysis: {}, dismissed: this._inboxScan.dismissed, lastScanAt: 0 };
            this._kickoffInboxScan();
            App.Omni._flash('scanning inbox…');
        }));
        // Kick off background scan once per 10 minutes
        this._kickoffInboxScan();
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
        return `<div class="task-card ${cls}${App.Timer.rowClass(t.id)}" data-task-id="${t.id}" draggable="true">
            <div class="top">
                <span>${t.id.toUpperCase()}</span>
                <span style="color:${dueColor};font-weight:700">${dueText}</span>
            </div>
            <div class="title">${Dom.escape(t.title)}</div>
            <div class="ctx">${this._matterContextHtml(t.matterId, t.clientId).replace(/<[^>]+>/g, '')}</div>
            <div class="foot">
                <div class="check ${t.status === 'done' ? 'done' : ''}" data-task-id="${t.id}" role="button" tabindex="0" aria-label="Toggle done" title="${t.status === 'done' ? 'Reopen task' : 'Mark task done'}"></div>
                <span class="badge ${alarmCls}">${alarmLabel}</span>
                ${this._tagBadgesHtml(t.tags)}
                <span class="foot-spacer"></span>
                ${App.Timer.playButtonHtml(t.id)}
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
        return `<div class="task-card ${isDone ? 'done' : ''}${App.Timer.rowClass(t.id)}" data-task-id="${t.id}" draggable="true">
            <div class="top">
                <span>${t.id.toUpperCase()}</span>
                <span>${t.deadline ? this._fmtHM(new Date(t.deadline)) : ''}</span>
            </div>
            <div class="title">${Dom.escape(t.title)}</div>
            <div class="ctx">${this._matterContextHtml(t.matterId, t.clientId).replace(/<[^>]+>/g, '')}</div>
            <div class="foot">
                <div class="check ${isDone ? 'done' : ''}" data-task-id="${t.id}" role="button" tabindex="0" aria-label="Toggle done" title="${isDone ? 'Reopen task' : 'Mark task done'}"></div>
                ${showPrio ? `<span class="card-prio ${t.priority === 'urgent' ? 'p0' : 'p1'}">${prio}</span>` : ''}
                ${this._tagBadgesHtml(t.tags)}
                <span class="foot-spacer"></span>
                ${isDone ? '' : App.Timer.playButtonHtml(t.id)}
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
        return `<div class="fire-row ${cls}${App.Timer.rowClass(t.id)}" data-task-id="${t.id}">
            <span class="idx">${t.id.toUpperCase()}</span>
            <div class="check ${t.status === 'done' ? 'done' : ''}" data-task-id="${t.id}" role="button" tabindex="0" aria-label="Toggle done" title="${t.status === 'done' ? 'Reopen task' : 'Mark task done'}"></div>
            <div class="body">
                <div class="title">${Dom.escape(t.title)}</div>
                <div class="meta">
                    ${this._matterContextHtml(t.matterId, t.clientId)}
                    ${alarmBadge}
                    ${this._tagBadgesHtml(t.tags)}
                </div>
            </div>
            <span class="due">${dueText}</span>
            ${App.Timer.playButtonHtml(t.id)}
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
        return `<div class="row ${isDone ? 'done' : ''}${App.Timer.rowClass(t.id)}" data-task-id="${t.id}">
            <span class="idx">${t.id.toUpperCase()}</span>
            <div class="check ${isDone ? 'done' : ''}" data-task-id="${t.id}" role="button" tabindex="0" aria-label="Toggle done" title="${isDone ? 'Reopen task' : 'Mark task done'}"></div>
            <div class="body">
                <div class="title">${Dom.escape(t.title)}</div>
                ${!isDone ? `<div class="meta">${this._matterContextHtml(t.matterId, t.clientId)}${this._tagBadgesHtml(t.tags)}</div>` : ''}
            </div>
            <div class="right-cluster">
                ${showPrio ? `<span class="badge ${prioCls}" style="font-family:var(--font-mono);font-size:9px;padding:3px 6px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;border:1px solid ${t.priority==='urgent'?'var(--vermillion)':'var(--ink)'};${t.priority==='urgent'?'background:var(--vermillion);color:var(--bg)':'background:var(--ink);color:var(--bg)'}">${prio}</span>` : ''}
                <span class="due">${t.deadline ? this._fmtHM(new Date(t.deadline)) : ''}</span>
                ${isDone ? '' : App.Timer.playButtonHtml(t.id)}
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
            <span class="msg">Open laptop → focus on what burns first. <strong>⌘K</strong> · capture, log time, ask — all in the bar above.</span>
            <button class="btn-fmin" type="button">Got it</button>
        </div>`;
    },

    /** Toggle a task done/undone via single click. Status `in_progress`
       is preserved if the user set it explicitly via Edit modal — clicking
       in_progress jumps straight to done. */
    cycleTask(id) {
        const t = Store.getTask(id);
        if (!t) return;
        const next = t.status === 'done' ? 'todo' : 'done';
        Store.updateTask(id, { status: next });
        App.Omni._flash(next === 'done' ? `✓ done · ${t.title.slice(0, 30)}` : `↶ reopened · ${t.title.slice(0, 30)}`);
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
        const allTasksRaw = Store.getTasks();
        const allTasks = this.inboxShowDone ? allTasksRaw : allTasksRaw.filter(t => t.status !== 'done');
        const doneCount = allTasksRaw.filter(t => t.status === 'done').length;
        const total = allTasks.length;
        const group = this.inboxGroup;
        const isTable = this.inboxMode === 'table';

        const groupBtn = (key, label) => `<button class="${group === key ? 'active' : ''}" data-group="${key}" type="button">${label}</button>`;
        const modeBtn  = (key, label) => `<button class="${this.inboxMode === key ? 'active' : ''}" data-imode="${key}" type="button">${label}</button>`;

        let body;
        if (isTable) {
            body = this._inboxTable(allTasks);
        } else if (group === 'flat') {
            body = this._inboxFlat(allTasks);
        } else if (group === 'matter') {
            body = this._inboxByMatter(allTasks);
        } else {
            body = this._inboxByClient(allTasks);
        }

        // Group toggle is meaningless in table mode — table is a flat sortable view.
        const groupToggle = isTable ? '' : `
            <div class="mode-toggle" role="group" aria-label="Group by">
                ${groupBtn('flat',   '▤ Flat')}
                ${groupBtn('matter', '⊟ By Matter')}
                ${groupBtn('client', '👤 By Client')}
            </div>`;

        root.innerHTML = `
            <div class="hero">
                <div class="left">
                    <span class="eyebrow">VIEW 02 · TASKS · ${total} OPEN</span>
                    <h1>${I18n.t('allWork')}</h1>
                </div>
                <div class="right">
                    ${groupToggle}
                    <div class="mode-toggle" role="group" aria-label="View mode">
                        ${modeBtn('table', '▦ Table')}
                        ${modeBtn('list',  '▤ List')}
                        ${modeBtn('board', '⊞ Board')}
                    </div>
                    <button class="link-btn quiet" data-toggle-done type="button">${this.inboxShowDone ? I18n.t('doneShown') : I18n.t('showDone') + ' · ' + doneCount}</button>
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
        root.querySelectorAll('[data-toggle-done]').forEach(b => b.addEventListener('click', () => {
            this.inboxShowDone = !this.inboxShowDone;
            this.render_inbox(root);
        }));
        // Toggle list/board/table mode
        root.querySelectorAll('[data-imode]').forEach(b => b.addEventListener('click', () => {
            const m = b.dataset.imode;
            if (this.inboxMode !== m) {
                this.inboxMode = m;
                localStorage.setItem('ordify-inbox-mode', m);
                this.render_inbox(root);
            }
        }));
        // Sortable headers (only present in table mode)
        root.querySelectorAll('.task-table th[data-sort-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                const cur = this.inboxSort;
                this.inboxSort = (cur.col === col)
                    ? { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
                    : { col, dir: 'asc' };
                localStorage.setItem('ordify-inbox-sort', JSON.stringify(this.inboxSort));
                this.render_inbox(root);
            });
        });
        root.querySelectorAll('[data-go="capture"]').forEach(b => b.addEventListener('click', () => this.Omni.focus()));
        root.addEventListener('click', (e) => {
            const check = e.target.closest('.check[data-task-id]');
            if (check) {
                e.stopPropagation();
                this.cycleTask(check.dataset.taskId);
            }
        });
    },

    /**
     * Sortable table view — locked column spec from hifi-06:
     *   ☐ · CLIENT · Matter · Title(▶) · Deadline · Pri
     * Click a header to sort; second click flips direction.
     */
    _inboxTable(tasks) {
        if (!tasks.length) return this._inboxEmpty();

        const sort = this.inboxSort;
        const rows = tasks.slice();
        const cmp = this._inboxCompare.bind(this);
        rows.sort((a, b) => {
            const v = cmp(a, b, sort.col);
            return sort.dir === 'asc' ? v : -v;
        });

        const isSorted = (col) => sort.col === col;
        const arrow = (col) => isSorted(col) ? `<span class="sort-arrow">${sort.dir === 'asc' ? '▲' : '▼'}</span>` : '';
        const cls = (col) => 'sortable' + (isSorted(col) ? ' sorted' : '');

        const head = `
            <thead>
                <tr>
                    <th class="check-col"></th>
                    <th class="${cls('client')}"  data-sort-col="client">Client ${arrow('client')}</th>
                    <th class="${cls('matter')}"  data-sort-col="matter">Matter ${arrow('matter')}</th>
                    <th class="${cls('title')} title-col"   data-sort-col="title">Title ${arrow('title')}</th>
                    <th class="${cls('deadline')}" data-sort-col="deadline">Deadline ${arrow('deadline')}</th>
                    <th class="${cls('pri')} pri-col" data-sort-col="pri">Pri ${arrow('pri')}</th>
                    <th class="play-col"></th>
                </tr>
            </thead>`;

        const body = '<tbody>' + rows.map(t => this._inboxTableRow(t)).join('') + '</tbody>';

        return `<div class="task-table-wrap"><table class="task-table">${head}${body}</table></div>`;
    },

    _inboxTableRow(t) {
        const client = t.clientId ? Store.getClient(t.clientId) : null;
        const matter = t.matterId ? Store.getMatter(t.matterId) : null;
        const swatchColor = this._clientSwatchColor(t.clientId);
        const clientCell = client
            ? `<span class="swatch-tiny" style="background:${swatchColor}"></span><a class="cell-link" data-open="client" data-id="${client.id}">${Dom.escape(client.name)}</a>`
            : '<span class="fade">—</span>';
        const matterCell = matter
            ? `<a class="cell-link" data-open="matter" data-id="${matter.id}">${Dom.escape(matter.title || matter.name || '')}</a>`
            : (client ? '<span class="fade">— (no matter)</span>' : '<span class="fade">— (orphan)</span>');

        // Status class — drives left-rule color (overdue / due-soon / meeting-not-applicable here)
        let rowCls = '';
        let deadlineCellCls = 'deadline-cell';
        let deadlineText = '—';
        if (t.deadline) {
            const dl = new Date(t.deadline);
            const ms = dl.getTime();
            const now = Date.now();
            const day = 24 * 3600 * 1000;
            if (ms < now) {
                rowCls = 'is-overdue';
                deadlineCellCls += ' overdue';
                deadlineText = `${this._fmtDM(dl)} · ${this._hoursAgo(dl)} late`;
            } else if (ms - now < day) {
                rowCls = 'is-due-soon';
                deadlineCellCls += ' due-soon';
                deadlineText = `today ${this._fmtHM(dl)}`;
            } else {
                deadlineText = `${this._fmtDM(dl)} ${this._fmtHM(dl)}`;
            }
        }

        const prioMap = {
            urgent: { code: 'P0', cls: 'p0' },
            high:   { code: 'P1', cls: 'p1' },
            medium: { code: 'P2', cls: '' },
            low:    { code: 'P3', cls: '' },
        };
        const p = prioMap[t.priority] || prioMap.medium;

        const runningCls = App.Timer.rowClass(t.id);

        return `<tr class="${rowCls}${runningCls}" data-task-id="${t.id}">
            <td class="check-col">
                <input type="checkbox" class="bulk-cb" aria-label="Select task" style="cursor:pointer;accent-color:var(--accent)">
                <div class="check ${t.status === 'done' ? 'done' : ''}" data-task-id="${t.id}" title="Mark done"></div>
            </td>
            <td class="client-cell">${clientCell}</td>
            <td>${matterCell}</td>
            <td class="title-cell">${Dom.escape(t.title)}</td>
            <td class="${deadlineCellCls}">${deadlineText}</td>
            <td><span class="pri ${p.cls}">${p.code}</span></td>
            <td class="play-col">${App.Timer.playButtonHtml(t.id)}</td>
        </tr>`;
    },

    _inboxCompare(a, b, col) {
        const get = (t) => {
            switch (col) {
                case 'client':   { const c = t.clientId ? Store.getClient(t.clientId) : null; return c?.name || '￿'; }
                case 'matter':   { const m = t.matterId ? Store.getMatter(t.matterId) : null; return m?.title || m?.name || '￿'; }
                case 'title':    return t.title || '';
                case 'deadline': return t.deadline ? new Date(t.deadline).getTime() : Number.MAX_SAFE_INTEGER;
                case 'pri':      { const o = { urgent: 0, high: 1, medium: 2, low: 3 }; return o[t.priority] ?? 2; }
            }
            return '';
        };
        const av = get(a); const bv = get(b);
        if (typeof av === 'number' && typeof bv === 'number') return av - bv;
        return String(av).localeCompare(String(bv));
    },

    _clientSwatchColor(clientId) {
        // Match the sidebar palette used in renderSidebar.
        const swatches = ['var(--accent)', 'var(--cobalt)', 'var(--saffron)', 'var(--ink)', 'var(--lime)', 'var(--magenta)'];
        const clients = Store.getClients();
        const i = clients.findIndex(c => c.id === clientId);
        return i >= 0 ? swatches[i % swatches.length] : 'var(--fg-faint)';
    },

    _fmtDM(d) {
        return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
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
            <div class="matter-card-body dnd-target" data-drop-matter="${matter.id}">
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
        return `<div class="empty-state">
            <div class="es-title">Inbox is empty.</div>
            <div>Type in the bar above to capture a task. Try <code>register US LLC for Acme by may 15, fixed €2400</code> with <code>⌘K</code> for a structured preview.</div>
            <div class="es-hint">⌘K · capture · log time · ask</div>
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
