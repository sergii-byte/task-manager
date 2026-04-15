// Inline SVG icons — stroke-based, currentColor, matches existing sync/search style
const Icons = {
    _svg: (body, size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
    users(s)     { return this._svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', s); },
    building(s)  { return this._svg('<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/>', s); },
    clock(s)     { return this._svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', s); },
    hourglass(s) { return this._svg('<path d="M6 2h12M6 22h12M6 2v4a6 6 0 0 0 12 0V2M6 22v-4a6 6 0 0 1 12 0v4"/>', s); },
    alert(s)     { return this._svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', s); },
    check(s)     { return this._svg('<polyline points="20 6 9 17 4 12"/>', s); },
    folder(s)    { return this._svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>', s); },
    mail(s)      { return this._svg('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1 .9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>', s); },
    send(s)      { return this._svg('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>', s); },
    note(s)      { return this._svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', s); },
    globe(s)     { return this._svg('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>', s); },
    user(s)      { return this._svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', s); },
    inbox(s)     { return this._svg('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>', s); },
    edit(s)      { return this._svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>', s); },
    trash(s)     { return this._svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', s); },
    calendar(s)  { return this._svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', s); },
    scale(s)     { return this._svg('<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M7.5 9.5h9"/><path d="M7.5 13.5h6"/><path d="M7.5 17.5h3"/>', s); },
    logo(s)      { return this._svg('<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M7.5 9.5h9"/><path d="M7.5 13.5h6"/><path d="M7.5 17.5h3"/>', s); },
};

const App = {
    currentView: 'dashboard',
    currentClientId: null,   // client = person (the paying human)
    currentProjectId: null,
    taskFilter: 'all',
    editingId: null,
    calMonth: new Date().getMonth(),
    calYear: new Date().getFullYear(),
    activeTimer: null,

    init() {
        const theme = localStorage.getItem('taskflow_theme') || 'light';
        this.setTheme(theme, true);
        this.applyI18n();
        this.renderSidebar();
        this.showDashboard();
        this.bindEvents();
        this.restoreTimer();
    },

    // ===== Toast Notifications =====
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = { success: '\u2713', error: '\u2717', warning: '\u26A0', info: '\u2139' };
        const el = document.createElement('div');
        el.className = 'toast ' + type;
        el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('toast-out');
            setTimeout(() => el.remove(), 300);
        }, 3000);
    },

    // ===== Custom Confirm Dialog =====
    confirm(title, text) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `<div class="confirm-dialog">
                <div class="confirm-icon">\u26A0</div>
                <div class="confirm-title">${title}</div>
                <div class="confirm-text">${text}</div>
                <div class="confirm-actions">
                    <button class="btn btn-glass" id="confirm-no">${this.t('cancel')}</button>
                    <button class="btn btn-danger" id="confirm-yes">${this.t('delete')}</button>
                </div>
            </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector('#confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
            overlay.querySelector('#confirm-no').onclick = () => { overlay.remove(); resolve(false); };
            overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
        });
    },

    // ===== Theme =====
    setTheme(theme, skipSave) {
        document.documentElement.setAttribute('data-theme', theme);
        if (!skipSave) localStorage.setItem('taskflow_theme', theme);
        document.getElementById('theme-light')?.classList.toggle('active', theme === 'light');
        document.getElementById('theme-dark')?.classList.toggle('active', theme === 'dark');
    },

    // ===== i18n =====
    t(key) { return I18n.t(key); },

    applyI18n() {
        const lang = I18n.lang;
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const val = I18n.t(el.dataset.i18n);
            if (val) el.textContent = val;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const val = I18n.t(el.dataset.i18nPlaceholder);
            if (val) el.placeholder = val;
        });
        document.getElementById('lang-en')?.classList.toggle('active', lang === 'en');
        document.getElementById('lang-uk')?.classList.toggle('active', lang === 'uk');
    },

    // ===== Events =====
    bindEvents() {
        // Sidebar nav
        this._on('nav-dashboard', 'click', () => this.showDashboard());
        this._on('nav-calendar', 'click', () => this.showCalendar());
        this._on('nav-inbox', 'click', () => this.showInbox());
        this._on('add-client-btn', 'click', () => this.showModal('client'));

        // Sync
        this._on('sync-btn', 'click', () => {
            if (SheetsSync.isAuthorized) {
                SheetsSync.pushAll().then(() => SheetsSync.pullAll());
            } else {
                this.showSettings();
            }
        });

        // Quick input
        this._on('qi-text', 'keydown', (e) => { if (e.key === 'Enter') AiInput.process(); });
        this._on('qi-mic', 'click', () => AiInput.toggleMic());
        this._on('qi-send', 'click', () => AiInput.process());

        // Theme toggles
        this._on('theme-light', 'click', () => this.setTheme('light'));
        this._on('theme-dark', 'click', () => this.setTheme('dark'));

        // Language toggles
        this._on('lang-en', 'click', () => { I18n.setLang('en'); this.applyI18n(); this.refresh(); });
        this._on('lang-uk', 'click', () => { I18n.setLang('uk'); this.applyI18n(); this.refresh(); });

        // Sidebar footer buttons
        this._on('btn-settings', 'click', () => this.showSettings());
        this._on('btn-tags', 'click', () => this.showTagsManager());

        // View action buttons
        this._on('btn-edit-client', 'click', () => this.editClient());
        this._on('btn-delete-client', 'click', () => this.deleteClient());
        this._on('btn-add-task-client', 'click', () => this.showModal('task'));
        this._on('btn-add-project', 'click', () => this.showModal('project'));
        this._on('btn-add-task', 'click', () => this.showModal('task'));
        this._on('btn-edit-project', 'click', () => this.editProject());
        this._on('btn-delete-project', 'click', () => this.deleteProject());
        this._on('btn-add-task-inbox', 'click', () => this.showModal('task'));

        // Modal close buttons
        this._on('modal-close-btn', 'click', () => this.closeModal());
        this._on('modal-overlay', 'click', (e) => { if (e.target.id === 'modal-overlay') this.closeModal(); });
        this._on('ai-close-btn', 'click', () => this.closeAiPreview());
        this._on('ai-overlay', 'click', (e) => { if (e.target.id === 'ai-overlay') this.closeAiPreview(); });
        this._on('settings-close-btn', 'click', () => this.closeSettings());
        this._on('settings-overlay', 'click', (e) => { if (e.target.id === 'settings-overlay') this.closeSettings(); });
        this._on('tags-close-btn', 'click', () => this.closeTagsManager());
        this._on('tags-overlay', 'click', (e) => { if (e.target.id === 'tags-overlay') this.closeTagsManager(); });

        // Settings actions
        this._on('btn-save-settings', 'click', () => this.saveSettings());
        this._on('btn-connect-google', 'click', () => SheetsSync.authorize());
        this._on('btn-upload', 'click', () => SheetsSync.pushAll());
        this._on('btn-download', 'click', () => SheetsSync.pullAll());

        // Tags
        this._on('btn-add-tag', 'click', () => this.addTag());

        // Task filters (delegated)
        document.getElementById('tasks-filters')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.taskFilter = btn.dataset.filter;
            this.renderTasks();
        });

        // Search
        const searchInput = document.getElementById('search-input');
        searchInput?.addEventListener('input', () => this.onSearch(searchInput.value));
        searchInput?.addEventListener('focus', () => this.onSearchFocus());
        searchInput?.addEventListener('blur', () => setTimeout(() => this.onSearchBlur(), 200));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal(); this.closeAiPreview(); this.closeSettings(); this.closeTagsManager(); this.closeSidebar();
            }
        });

        // Delegated clicks for dynamic elements in main
        document.getElementById('main').addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            const id = target.dataset.id;
            switch (action) {
                case 'cycle-status': this.cycleTaskStatus(id); break;
                case 'edit-task': this.editTask(id); break;
                case 'delete-task': this.deleteTask(id); break;
                case 'toggle-timer': this.toggleTimer(id); break;
                case 'select-client': this.selectClient(id); break;
                case 'select-project': this.selectProject(id); break;
                case 'show-modal': this.showModal(target.dataset.type); break;
                case 'assign-project': this.editTask(id); break;
                case 'show-list': this.showList(target.dataset.list); break;
            }
        });

        // Sidebar delegated clicks
        document.getElementById('clients-list').addEventListener('click', (e) => {
            const item = e.target.closest('[data-action]');
            if (!item) return;
            e.stopPropagation();
            if (item.dataset.action === 'select-client') this.selectClient(item.dataset.id);
            if (item.dataset.action === 'select-project') this.selectProject(item.dataset.id);
        });
    },

    _on(id, event, fn) {
        document.getElementById(id)?.addEventListener(event, fn);
    },

    // ===== Mobile Sidebar =====
    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-backdrop').classList.toggle('open');
    },
    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-backdrop').classList.remove('open');
    },

    // ===== Sidebar =====
    renderSidebar() {
        const clients = Store.getClients();
        const list = document.getElementById('clients-list');

        if (clients.length === 0) {
            list.innerHTML = `<li class="nav-item" style="color:var(--text-3);font-size:12px;cursor:default;padding:8px 12px">${this.t('noClients')}</li>`;
        } else {
            let html = '';
            clients.forEach(c => {
                const projects = Store.getProjects(c.id);
                const isActive = this.currentClientId === c.id && this.currentView === 'client';
                const initials = this.getInitials(c.name);
                html += `<li class="nav-item${isActive ? ' active' : ''}" data-action="select-client" data-id="${c.id}">
                    <span style="display:flex;align-items:center"><span class="client-avatar">${initials}</span>${this.esc(c.name)}</span>
                    <span class="badge">${projects.length}</span>
                </li>`;
                if (this.currentClientId === c.id && projects.length > 0) {
                    html += '<ul class="nav-list nav-sub">';
                    projects.forEach(p => {
                        const isProjActive = this.currentProjectId === p.id;
                        const label = p.company ? `<span style="color:var(--text-3);font-size:11px">${this.esc(p.company)} \u00B7 </span>${this.esc(p.name)}` : this.esc(p.name);
                        html += `<li class="nav-item${isProjActive ? ' active' : ''}" data-action="select-project" data-id="${p.id}">
                            <span>${label}</span>
                        </li>`;
                    });
                    html += '</ul>';
                }
            });
            list.innerHTML = html;
        }

        // Update nav active states
        document.getElementById('nav-dashboard')?.classList.toggle('active', this.currentView === 'dashboard');
        document.getElementById('nav-calendar')?.classList.toggle('active', this.currentView === 'calendar');
        document.getElementById('nav-inbox')?.classList.toggle('active', this.currentView === 'inbox');

        // Inbox count
        const inboxCount = Store.getInboxTasks().length;
        const inboxBadge = document.getElementById('inbox-count');
        if (inboxBadge) {
            inboxBadge.textContent = inboxCount || '';
            inboxBadge.style.display = inboxCount ? '' : 'none';
        }
    },

    getInitials(name) {
        return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    },

    // ===== Views =====
    showView(name) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const el = document.getElementById('view-' + name);
        if (el) el.classList.add('active');
        this.currentView = name;
    },

    // ===== Dashboard =====
    showDashboard() {
        this.currentClientId = null;
        this.currentProjectId = null;
        this.showView('dashboard');
        this.renderDashboard();
        this.renderSidebar();
        this.closeSidebar();
    },

    renderDashboard() {
        const stats = Store.getStats();
        document.getElementById('dashboard-stats').innerHTML = `
            <div class="stat-card clickable" data-action="show-list" data-list="clients"><div class="stat-icon">${Icons.users(18)}</div><div class="stat-value">${stats.clients}</div><div class="stat-label">${this.t('statClients')}</div></div>
            <div class="stat-card clickable" data-action="show-list" data-list="companies"><div class="stat-icon">${Icons.building(18)}</div><div class="stat-value">${stats.companies}</div><div class="stat-label">${this.t('statCompanies')}</div></div>
            <div class="stat-card clickable" data-action="show-list" data-list="in_progress"><div class="stat-icon">${Icons.hourglass(18)}</div><div class="stat-value">${stats.inProgress}</div><div class="stat-label">${this.t('statInProgress')}</div></div>
            <div class="stat-card clickable" data-action="show-list" data-list="overdue"><div class="stat-icon ${stats.overdue ? 'stat-icon-alert' : ''}">${Icons.alert(18)}</div><div class="stat-value" style="color:${stats.overdue ? 'var(--red)' : ''}">${stats.overdue}</div><div class="stat-label">${this.t('statOverdue')}</div></div>
            <div class="stat-card clickable" data-action="show-list" data-list="hours"><div class="stat-icon">${Icons.clock(18)}</div><div class="stat-value">${stats.totalHours}h</div><div class="stat-label">${this.t('statHours')}</div></div>
        `;

        const allTasks = Store.getTasks();
        const procedural = allTasks.filter(t => t.isProcedural && t.deadline && t.status !== 'done')
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        document.getElementById('proc-count').textContent = procedural.length;
        document.getElementById('procedural-tasks').innerHTML = procedural.length
            ? procedural.map(t => this.renderTaskItem(t, true)).join('')
            : `<div class="empty-state"><p>${this.t('noProceduralDeadlines')}</p></div>`;

        const inProgress = allTasks.filter(t => t.status === 'in_progress');
        document.getElementById('inprog-count').textContent = inProgress.length;
        document.getElementById('inprogress-tasks').innerHTML = inProgress.length
            ? inProgress.map(t => this.renderTaskItem(t, true)).join('')
            : `<div class="empty-state"><p>${this.t('noTasksInProgress')}</p></div>`;

        const recent = [...allTasks].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 8);
        const clients = Store.getClients();

        if (clients.length === 0) {
            document.getElementById('recent-tasks').innerHTML = `<div class="empty-state">
                <div class="empty-icon">${Icons.scale(40)}</div>
                <p>${this.t('welcomeMessage')}</p>
                <button class="cta-btn" data-action="show-modal" data-type="client">\u002B ${this.t('newClient')}</button>
            </div>`;
        } else if (recent.length === 0) {
            document.getElementById('recent-tasks').innerHTML = `<div class="empty-state">
                <div class="empty-icon">${Icons.scale(40)}</div>
                <p>${this.t('noTasksYet')}</p>
            </div>`;
        } else {
            document.getElementById('recent-tasks').innerHTML = recent.map(t => this.renderTaskItem(t, true)).join('');
        }

        this.renderCalendarMini('dashboard-calendar');
    },

    // ===== Inbox =====
    showInbox() {
        this.currentClientId = null; this.currentProjectId = null;
        this.showView('inbox');
        this.renderInbox();
        this.renderSidebar();
        this.closeSidebar();
    },

    renderInbox() {
        const tasks = Store.getInboxTasks();
        const container = document.getElementById('inbox-tasks');
        if (tasks.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <div class="empty-icon">${Icons.inbox(40)}</div>
                <p>${this.t('noInboxTasks')}</p>
                <button class="cta-btn" data-action="show-modal" data-type="task">\u002B ${this.t('newTask')}</button>
            </div>`;
            return;
        }
        const sorted = [...tasks].sort((a, b) => new Date(b.created) - new Date(a.created));
        container.innerHTML = sorted.map(t => this.renderTaskItem(t, false, true)).join('');
    },

    // ===== Generic list view (reached from dashboard stat cards) =====
    showList(type) {
        this.currentClientId = null;
        this.currentProjectId = null;
        this.currentListType = type;
        this.showView('list');
        this.renderList();
        this.renderSidebar();
        this.closeSidebar();
    },

    renderList() {
        const type = this.currentListType;
        const titleEl = document.getElementById('list-title');
        const subtitleEl = document.getElementById('list-subtitle');
        const bodyEl = document.getElementById('list-body');
        const actionsEl = document.getElementById('list-actions');
        actionsEl.innerHTML = '';

        if (type === 'clients') {
            titleEl.textContent = this.t('allClients');
            subtitleEl.textContent = this.t('allClientsSubtitle');
            actionsEl.innerHTML = `<button class="btn btn-sm" data-action="show-modal" data-type="client">+ ${this.t('newClient')}</button>`;

            const clients = Store.getClients();
            if (clients.length === 0) {
                bodyEl.innerHTML = `<div class="empty-state">
                    <div class="empty-icon">${Icons.users(40)}</div>
                    <p>${this.t('noClients')}</p>
                    <button class="cta-btn" data-action="show-modal" data-type="client">+ ${this.t('newClient')}</button>
                </div>`;
                return;
            }
            bodyEl.innerHTML = '<div class="cards-grid">' + clients.map(c => {
                const projects = Store.getProjects(c.id);
                const tasks = Store.getTasksForClient(c.id);
                const done = tasks.filter(t => t.status === 'done').length;
                const companies = Array.isArray(c.companies) ? c.companies : [];
                const initials = this.getInitials(c.name);
                return `<div class="card" data-action="select-client" data-id="${c.id}">
                    <h3><span class="client-avatar">${initials}</span>${this.esc(c.name)}</h3>
                    ${companies.length ? `<div class="card-meta"><span class="meta-label">${this.t('companies')}:</span> <span>${companies.slice(0, 3).map(n => this.esc(n)).join(', ')}${companies.length > 3 ? ' +' + (companies.length - 3) : ''}</span></div>` : ''}
                    <div class="card-meta">
                        <span>${projects.length} ${this.t('projects').toLowerCase()}</span>
                        <span>${done}/${tasks.length} ${this.t('tasks').toLowerCase()}</span>
                    </div>
                </div>`;
            }).join('') + '</div>';
            return;
        }

        if (type === 'companies') {
            titleEl.textContent = this.t('allCompanies');
            subtitleEl.textContent = this.t('allCompaniesSubtitle');

            // Aggregate: company name → [{client, projects}]
            const map = new Map();
            Store.getClients().forEach(c => {
                (c.companies || []).forEach(name => {
                    if (!name) return;
                    const key = name.trim();
                    if (!map.has(key)) map.set(key, { name: key, clients: [], projects: [] });
                    map.get(key).clients.push(c);
                });
            });
            Store.getProjects().forEach(p => {
                if (!p.company) return;
                const key = p.company.trim();
                if (!map.has(key)) map.set(key, { name: key, clients: [], projects: [] });
                map.get(key).projects.push(p);
            });

            const entries = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
            if (entries.length === 0) {
                bodyEl.innerHTML = `<div class="empty-state">
                    <div class="empty-icon">${Icons.building(40)}</div>
                    <p>${this.t('noCompaniesYet')}</p>
                </div>`;
                return;
            }
            bodyEl.innerHTML = '<div class="cards-grid">' + entries.map(e => {
                const uniqueClients = [...new Set(e.clients.map(c => c.id))].map(id => Store.getClient(id)).filter(Boolean);
                const projList = e.projects.slice(0, 3).map(p => `<span class="pill">${this.esc(p.name)}</span>`).join(' ');
                const moreProj = e.projects.length > 3 ? ` <span style="color:var(--text-3);font-size:11px">+${e.projects.length - 3}</span>` : '';
                return `<div class="card">
                    <h3>${this.esc(e.name)}</h3>
                    <div class="card-meta"><span>${uniqueClients.length} ${this.t('clientsLower')}</span><span>${e.projects.length} ${this.t('projects').toLowerCase()}</span></div>
                    ${uniqueClients.length ? `<div class="card-meta" style="flex-wrap:wrap;gap:6px">${uniqueClients.map(c => `<span class="pill clickable-pill" data-action="select-client" data-id="${c.id}">${this.esc(c.name)}</span>`).join('')}</div>` : ''}
                    ${e.projects.length ? `<div class="card-meta" style="flex-wrap:wrap;gap:6px">${projList}${moreProj}</div>` : ''}
                </div>`;
            }).join('') + '</div>';
            return;
        }

        if (type === 'in_progress') {
            titleEl.textContent = this.t('inProgress');
            subtitleEl.textContent = this.t('inProgressSubtitle');
            const tasks = Store.getTasks().filter(t => t.status === 'in_progress');
            if (tasks.length === 0) {
                bodyEl.innerHTML = `<div class="empty-state"><div class="empty-icon">${Icons.hourglass(40)}</div><p>${this.t('noTasksInProgress')}</p></div>`;
                return;
            }
            const sorted = [...tasks].sort((a, b) => {
                if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
                if (a.deadline) return -1;
                if (b.deadline) return 1;
                return new Date(b.created) - new Date(a.created);
            });
            bodyEl.innerHTML = '<div class="tasks-list">' + sorted.map(t => this.renderTaskItem(t, true)).join('') + '</div>';
            return;
        }

        if (type === 'overdue') {
            titleEl.textContent = this.t('statOverdue');
            subtitleEl.textContent = this.t('overdueSubtitle');
            const now = new Date();
            const tasks = Store.getTasks().filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'done');
            if (tasks.length === 0) {
                bodyEl.innerHTML = `<div class="empty-state"><div class="empty-icon" style="color:var(--green,#6a8e5e)">${Icons.check(40)}</div><p>${this.t('noOverdueTasks')}</p></div>`;
                return;
            }
            const sorted = [...tasks].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
            bodyEl.innerHTML = '<div class="tasks-list">' + sorted.map(t => this.renderTaskItem(t, true)).join('') + '</div>';
            return;
        }

        if (type === 'hours') {
            titleEl.textContent = this.t('hoursLogged');
            subtitleEl.textContent = this.t('hoursSubtitle');

            // Aggregate hours per client / project / task
            const tasks = Store.getTasks();
            const loggedTasks = tasks.filter(t => (parseFloat(t.hoursLogged) || 0) > 0)
                .sort((a, b) => (parseFloat(b.hoursLogged) || 0) - (parseFloat(a.hoursLogged) || 0));

            // Per-client totals
            const clientTotals = new Map();
            tasks.forEach(t => {
                const hours = parseFloat(t.hoursLogged) || 0;
                if (!hours) return;
                let clientId = t.clientId;
                if (!clientId && t.projectId) {
                    const p = Store.getProject(t.projectId);
                    if (p) clientId = p.clientId;
                }
                if (!clientId) return;
                clientTotals.set(clientId, (clientTotals.get(clientId) || 0) + hours);
            });
            const clientRows = [...clientTotals.entries()]
                .map(([id, h]) => ({ client: Store.getClient(id), hours: h }))
                .filter(r => r.client)
                .sort((a, b) => b.hours - a.hours);

            const stats = Store.getStats();

            let html = `<div class="section">
                <div class="section-title">${this.t('totalHoursLabel')}: <strong>${stats.totalHours}h</strong></div>
            </div>`;

            if (clientRows.length) {
                html += `<div class="section"><div class="section-title">${this.t('byClient')}</div><div class="cards-grid">` +
                    clientRows.map(r => `<div class="card" data-action="select-client" data-id="${r.client.id}">
                        <h3><span class="client-avatar">${this.getInitials(r.client.name)}</span>${this.esc(r.client.name)}</h3>
                        <div class="card-meta"><span><strong>${Math.round(r.hours * 100) / 100}h</strong></span></div>
                    </div>`).join('') + '</div></div>';
            }

            if (loggedTasks.length) {
                html += `<div class="section" style="margin-top:24px"><div class="section-title">${this.t('taskBreakdown')} <span class="count">${loggedTasks.length}</span></div><div class="tasks-list">` +
                    loggedTasks.map(t => this.renderTaskItem(t, true)).join('') + '</div></div>';
            } else {
                html += `<div class="empty-state"><p>${this.t('noHoursLogged')}</p></div>`;
            }

            bodyEl.innerHTML = html;
            return;
        }

        // Fallback
        bodyEl.innerHTML = `<div class="empty-state"><p>Unknown list type: ${this.esc(type)}</p></div>`;
    },

    // ===== Calendar =====
    showCalendar() {
        this.currentClientId = null; this.currentProjectId = null;
        this.showView('calendar');
        this.renderCalendarFull();
        this.renderSidebar();
        this.closeSidebar();
    },

    renderCalendarMini(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const year = this.calYear, month = this.calMonth;
        const monthNames = I18n.t('monthNames');
        const dayLabels = I18n.t('dayLabels');
        const deadlines = this.getDeadlinesForMonth(year, month);
        const firstDay = new Date(year, month, 1);
        let startDow = firstDay.getDay();
        startDow = startDow === 0 ? 6 : startDow - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        let daysHtml = dayLabels.map(d => `<div class="cal-day-label">${d}</div>`).join('');
        const prevDays = new Date(year, month, 0).getDate();
        for (let i = startDow - 1; i >= 0; i--) daysHtml += `<div class="cal-day other-month">${prevDays - i}</div>`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            const dl = deadlines[dateStr];
            let cls = 'cal-day clickable';
            if (isToday) cls += ' today';
            if (dl?.procedural) cls += ' has-procedural';
            else if (dl?.count) cls += ' has-deadline';
            daysHtml += `<div class="${cls}" data-date="${dateStr}" title="${dl ? dl.count + ' tasks' : '+ task'}">${d}</div>`;
        }

        const totalCells = startDow + daysInMonth;
        const remaining = (7 - (totalCells % 7)) % 7;
        for (let i = 1; i <= remaining; i++) daysHtml += `<div class="cal-day other-month">${i}</div>`;

        el.innerHTML = `
            <div class="cal-header">
                <button class="icon-btn" data-cal-prev="${containerId}">\u2039</button>
                <span>${monthNames[month]} ${year}</span>
                <button class="icon-btn" data-cal-next="${containerId}">\u203A</button>
            </div>
            <div class="cal-grid">${daysHtml}</div>
        `;

        el.querySelector('[data-cal-prev]')?.addEventListener('click', () => {
            this.calMonth--;
            if (this.calMonth < 0) { this.calMonth = 11; this.calYear--; }
            this.renderCalendarMini(containerId);
        });
        el.querySelector('[data-cal-next]')?.addEventListener('click', () => {
            this.calMonth++;
            if (this.calMonth > 11) { this.calMonth = 0; this.calYear++; }
            this.renderCalendarMini(containerId);
        });

        el.querySelectorAll('.cal-day.clickable').forEach(dayEl => {
            dayEl.addEventListener('click', () => {
                const date = dayEl.dataset.date;
                if (date) this.showDayDetail(date);
            });
        });
    },

    // ===== Day detail popover =====
    showDayDetail(dateStr) {
        const tasks = Store.getTasks().filter(t => t.deadline === dateStr);
        const d = new Date(dateStr + 'T00:00:00');
        const locale = I18n.lang === 'uk' ? 'uk-UA' : 'en-GB';
        const dateLabel = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay open';
        overlay.id = 'day-detail-overlay';

        let tasksHtml = '';
        if (tasks.length === 0) {
            tasksHtml = `<div class="empty-state" style="padding:20px 0">
                <p style="color:var(--text-3);font-size:13px">${this.t('noDeadlines')}</p>
            </div>`;
        } else {
            const sorted = [...tasks].sort((a, b) => {
                if (a.status === 'done' && b.status !== 'done') return 1;
                if (b.status === 'done' && a.status !== 'done') return -1;
                if (a.isProcedural && !b.isProcedural) return -1;
                if (!a.isProcedural && b.isProcedural) return 1;
                return 0;
            });
            tasksHtml = `<div class="tasks-list">${sorted.map(t => this.renderTaskItem(t, true)).join('')}</div>`;
        }

        overlay.innerHTML = `<div class="modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>${this.esc(dateLabel)}</h3>
                <button class="icon-btn" id="day-detail-close">\u00D7</button>
            </div>
            <div class="modal-body">
                <div style="font-size:12px;color:var(--text-3);margin-bottom:10px">${tasks.length} ${this.t('tasks')}</div>
                ${tasksHtml}
                <div class="form-actions" style="margin-top:16px">
                    <button type="button" class="btn btn-glass" id="day-detail-cancel">${this.t('cancel')}</button>
                    <button type="button" class="btn" id="day-detail-add">\u002B ${this.t('newTask')}</button>
                </div>
            </div>
        </div>`;

        document.body.appendChild(overlay);
        overlay.querySelector('#day-detail-close').onclick = () => overlay.remove();
        overlay.querySelector('#day-detail-cancel').onclick = () => overlay.remove();
        overlay.querySelector('#day-detail-add').onclick = () => {
            overlay.remove();
            this.showModal('task', null, { deadline: dateStr });
        };
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        overlay.querySelector('.tasks-list')?.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            const id = target.dataset.id;
            switch (action) {
                case 'cycle-status':
                    this.cycleTaskStatus(id);
                    overlay.remove();
                    this.showDayDetail(dateStr);
                    break;
                case 'edit-task':
                    overlay.remove();
                    this.editTask(id);
                    break;
                case 'delete-task':
                    this.deleteTask(id).then(() => {
                        overlay.remove();
                        this.showDayDetail(dateStr);
                    });
                    break;
                case 'toggle-timer':
                    this.toggleTimer(id);
                    break;
            }
        });
    },

    renderCalendarFull() {
        this.renderCalendarMini('calendar-full');
        const allTasks = Store.getTasks();
        const withDeadline = allTasks.filter(t => t.deadline && t.status !== 'done')
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        document.getElementById('calendar-tasks').innerHTML = withDeadline.length
            ? withDeadline.map(t => this.renderTaskItem(t, true)).join('')
            : `<div class="empty-state"><p>${this.t('noDeadlines')}</p></div>`;
    },

    getDeadlinesForMonth(year, month) {
        const tasks = Store.getTasks();
        const map = {};
        tasks.forEach(t => {
            if (!t.deadline || t.status === 'done') return;
            const d = new Date(t.deadline);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const key = t.deadline;
                if (!map[key]) map[key] = { count: 0, procedural: false };
                map[key].count++;
                if (t.isProcedural) map[key].procedural = true;
            }
        });
        return map;
    },

    // ===== Client (the person) =====
    selectClient(id) {
        const client = Store.getClient(id);
        if (!client) return;
        this.currentClientId = id;
        this.currentProjectId = null;
        this.showView('client');
        this.renderClient();
        this.renderSidebar();
        this.closeSidebar();
    },

    renderClient() {
        const client = Store.getClient(this.currentClientId);
        if (!client) return this.showDashboard();
        document.getElementById('client-name').textContent = client.name;

        // Contact info
        const infoParts = [];
        if (client.email) infoParts.push(`<span><strong>Email:</strong> ${this.esc(client.email)}</span>`);
        if (client.telegram) infoParts.push(`<span><strong>Telegram:</strong> ${this.esc(client.telegram)}</span>`);
        if (client.notes) infoParts.push(`<span><strong>${this.t('notes')}:</strong> ${this.esc(client.notes)}</span>`);
        document.getElementById('client-info').innerHTML = infoParts.join('') || `<span style="color:var(--text-3)">${this.t('noContactInfo')}</span>`;

        // Companies bar (chips)
        const companies = Array.isArray(client.companies) ? client.companies : [];
        const companiesEl = document.getElementById('client-companies-bar');
        if (companies.length) {
            companiesEl.innerHTML = `<span class="companies-label">${this.t('companies')}</span>` +
                companies.map(name => `<span class="company-chip">${this.esc(name)}</span>`).join('');
        } else {
            companiesEl.innerHTML = '';
        }

        // Projects grouped by company (or ungrouped if none have company)
        const projects = Store.getProjects(this.currentClientId);
        const grid = document.getElementById('projects-grid');

        if (projects.length === 0) {
            grid.innerHTML = `<div class="empty-state">
                <div class="empty-icon">${Icons.folder(40)}</div>
                <p>${this.t('noProjects')}</p>
                <button class="cta-btn" data-action="show-modal" data-type="project">\u002B ${this.t('newProject')}</button>
            </div>`;
        } else {
            // Group: company name string → projects
            const groups = new Map();
            const NO_COMPANY = '__none__';
            projects.forEach(p => {
                const key = p.company && p.company.trim() ? p.company : NO_COMPANY;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(p);
            });

            const statusL = { active: this.t('statusActive'), on_hold: this.t('statusOnHold'), completed: this.t('statusCompleted') };
            const typeL = { licensing: this.t('typeLicensing'), corporate: this.t('typeCorporate'), contracts: this.t('typeContracts'), compliance: this.t('typeCompliance') };

            const renderCard = (p) => {
                const tasks = Store.getTasks(p.id);
                const done = tasks.filter(t => t.status === 'done').length;
                const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
                return `<div class="card" data-action="select-project" data-id="${p.id}">
                    <h3>${this.esc(p.name)}</h3>
                    <div class="card-meta">
                        <span><span class="status-badge ${p.status}"><span class="status-dot ${p.status}"></span> ${statusL[p.status] || p.status}</span></span>
                        <span>${done}/${tasks.length}</span>
                    </div>
                    ${p.projectType ? `<div class="card-meta"><span>${typeL[p.projectType] || p.projectType}</span></div>` : ''}
                    ${p.jurisdiction ? `<div class="card-meta"><span class="meta-label">${this.t('jurisdiction')}:</span> <span>${this.esc(p.jurisdiction)}</span></div>` : ''}
                    ${p.deadline ? `<div class="card-meta"><span class="${this.deadlineClass(p.deadline)}">${this.t('deadlineLabel')}: ${this.formatDate(p.deadline)}</span></div>` : ''}
                    <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
                </div>`;
            };

            // If everything fits in NO_COMPANY, skip headings
            if (groups.size === 1 && groups.has(NO_COMPANY)) {
                grid.innerHTML = projects.map(renderCard).join('');
            } else {
                let html = '';
                // Order: named companies first (in client.companies order), then NO_COMPANY
                const orderedKeys = [];
                (client.companies || []).forEach(name => {
                    if (groups.has(name) && !orderedKeys.includes(name)) orderedKeys.push(name);
                });
                // Any groups not in client.companies list
                for (const key of groups.keys()) {
                    if (key !== NO_COMPANY && !orderedKeys.includes(key)) orderedKeys.push(key);
                }
                if (groups.has(NO_COMPANY)) orderedKeys.push(NO_COMPANY);

                orderedKeys.forEach(key => {
                    const items = groups.get(key) || [];
                    if (!items.length) return;
                    const label = key === NO_COMPANY ? this.t('noCompanyLabel') : this.esc(key);
                    html += `<div class="company-group-label">${label}</div>`;
                    html += `<div class="cards-grid-inner">${items.map(renderCard).join('')}</div>`;
                });
                grid.innerHTML = html;
            }
        }

        // Direct client tasks
        const directTasks = Store.getDirectClientTasks(this.currentClientId);
        const section = document.getElementById('client-tasks-section');
        if (directTasks.length) {
            const sorted = [...directTasks].sort((a, b) => new Date(b.created) - new Date(a.created));
            section.innerHTML = `<div class="section-title">${this.t('tasks')} <span class="count">${directTasks.length}</span></div>
                <div class="tasks-list">${sorted.map(t => this.renderTaskItem(t)).join('')}</div>`;
        } else {
            section.innerHTML = '';
        }
    },

    // ===== Project =====
    selectProject(id) {
        const project = Store.getProject(id);
        if (!project) return;
        this.currentProjectId = id;
        this.currentClientId = project.clientId;
        this.showView('project');
        this.renderProject();
        this.renderSidebar();
        this.closeSidebar();
    },

    renderProject() {
        const project = Store.getProject(this.currentProjectId);
        if (!project) return this.showDashboard();
        const client = Store.getClient(project.clientId);
        document.getElementById('project-name').textContent = project.name;
        const crumbs = [client?.name, project.company].filter(Boolean).join(' \u2192 ');

        const bc = document.getElementById('project-breadcrumb');
        bc.textContent = crumbs ? `\u2190 ${crumbs}` : '';
        bc.onclick = () => this.selectClient(project.clientId);

        const statusL = { active: this.t('statusActive'), on_hold: this.t('statusOnHold'), completed: this.t('statusCompleted') };
        const typeL = { licensing: this.t('typeLicensing'), corporate: this.t('typeCorporate'), contracts: this.t('typeContracts'), compliance: this.t('typeCompliance') };
        const infoParts = [`<span><span class="status-badge ${project.status}"><span class="status-dot ${project.status}"></span> ${statusL[project.status] || project.status}</span></span>`];
        if (project.company) infoParts.push(`<span><strong>${this.t('companyLabel')}:</strong> ${this.esc(project.company)}</span>`);
        if (project.projectType) infoParts.push(`<span><strong>${this.t('typeLabel')}:</strong> ${typeL[project.projectType] || project.projectType}</span>`);
        if (project.jurisdiction) infoParts.push(`<span><strong>${this.t('jurisdictionLabel')}:</strong> ${this.esc(project.jurisdiction)}</span>`);
        if (project.deadline) infoParts.push(`<span class="${this.deadlineClass(project.deadline)}"><strong>${this.t('deadlineLabel')}:</strong> ${this.formatDate(project.deadline)}</span>`);
        document.getElementById('project-info').innerHTML = infoParts.join('');
        this.renderTasks();
    },

    renderTasks() {
        const tasks = Store.getTasks(this.currentProjectId);
        const filtered = this.taskFilter === 'all' ? tasks : tasks.filter(t => t.status === this.taskFilter);

        if (filtered.length === 0) {
            const msg = this.taskFilter !== 'all' ? this.t('noTasksWithStatus') : this.t('noTasks');
            document.getElementById('tasks-list').innerHTML = `<div class="empty-state">
                <p>${msg}</p>
                ${this.taskFilter === 'all' ? `<button class="cta-btn" data-action="show-modal" data-type="task">\u002B ${this.t('newTask')}</button>` : ''}
            </div>`;
            return;
        }

        const priOrder = { high: 0, medium: 1, low: 2 };
        filtered.sort((a, b) => {
            if (a.status === 'done' && b.status !== 'done') return 1;
            if (b.status === 'done' && a.status !== 'done') return -1;
            if (a.isProcedural && !b.isProcedural) return -1;
            if (!a.isProcedural && b.isProcedural) return 1;
            const pa = priOrder[a.priority] ?? 1, pb = priOrder[b.priority] ?? 1;
            if (pa !== pb) return pa - pb;
            if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
            if (a.deadline) return -1;
            return 1;
        });

        document.getElementById('tasks-list').innerHTML = filtered.map(t => this.renderTaskItem(t)).join('');
    },

    renderTaskItem(task, showContext = false, showAssign = false) {
        const checkClass = task.status === 'done' ? 'checked' : task.status === 'in_progress' ? 'in-progress' : '';
        const meta = [];

        if (showContext) {
            // Build hierarchy path: Client (person) → [Company] → Project
            if (task.projectId) {
                const project = Store.getProject(task.projectId);
                const client = project ? Store.getClient(project.clientId) : null;
                const parts = [client?.name, project?.company, project?.name].filter(Boolean).map(n => this.esc(n));
                if (parts.length) meta.push(parts.join(' \u2192 '));
            } else if (task.clientId) {
                const client = Store.getClient(task.clientId);
                if (client) meta.push(this.esc(client.name));
            } else {
                meta.push(`<span style="color:var(--accent)">${this.t('inbox')}</span>`);
            }
        }

        if (task.deadline) {
            let dlHtml = `<span class="${this.deadlineClass(task.deadline)}">${this.formatDate(task.deadline)}</span>`;
            if (task.isProcedural) dlHtml += ` <span class="procedural-badge">${this.t('procedural')}</span>`;
            meta.push(dlHtml);
        }

        const tags = (task.tags || []).map(tid => {
            const tag = Store.getTags().find(t => t.id === tid);
            return tag ? `<span class="tag" style="background:${tag.color}22;color:${tag.color}">${this.esc(tag.name)}</span>` : '';
        }).filter(Boolean).join('');

        const timerHtml = this.activeTimer?.taskId === task.id
            ? `<span class="task-timer active" id="timer-display">${this.formatTimerElapsed()}</span>`
            : (task.hoursLogged ? `<span class="task-timer">${task.hoursLogged}h</span>` : '');

        return `<div class="task-item${task.status === 'done' ? ' done' : ''}" data-id="${task.id}">
            <div class="task-checkbox ${checkClass}" data-action="cycle-status" data-id="${task.id}"></div>
            <div class="priority-dot priority-${task.priority || 'medium'}"></div>
            <div class="task-body">
                <div class="task-title" data-action="edit-task" data-id="${task.id}">${this.esc(task.title)}</div>
                <div class="task-meta">${meta.join(' \u00B7 ')}${tags ? ` <div class="task-tags">${tags}</div>` : ''}</div>
            </div>
            ${timerHtml}
            <div class="task-actions">
                ${showAssign && !task.projectId ? `<button class="icon-btn" data-action="assign-project" data-id="${task.id}" title="${this.t('assignToProject')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                </button>` : ''}
                <button class="icon-btn" data-action="toggle-timer" data-id="${task.id}" title="Timer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${this.activeTimer?.taskId === task.id ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>'}</svg>
                </button>
                <button class="icon-btn" data-action="edit-task" data-id="${task.id}" title="Edit">${Icons.edit(14)}</button>
                <button class="icon-btn" data-action="delete-task" data-id="${task.id}" title="Delete">${Icons.trash(14)}</button>
            </div>
        </div>`;
    },

    cycleTaskStatus(id) {
        const task = Store.getTask(id);
        if (!task) return;
        const cycle = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
        const next = cycle[task.status] || 'todo';
        Store.updateTask(id, { status: next });
        const statusNames = { todo: 'To Do', in_progress: this.t('statInProgress'), done: this.t('filterDone') };
        this.toast(`${this.t('taskTitle')}: ${statusNames[next]}`, next === 'done' ? 'success' : 'info');
        this.refresh();
    },

    // ===== Timer =====
    toggleTimer(taskId) {
        if (this.activeTimer?.taskId === taskId) this.stopTimer();
        else { if (this.activeTimer) this.stopTimer(); this.startTimer(taskId); }
    },

    startTimer(taskId) {
        const startTime = Date.now();
        this.activeTimer = { taskId, startTime };
        localStorage.setItem('taskflow_timer', JSON.stringify({ taskId, startTime }));
        this.activeTimer.interval = setInterval(() => this.updateTimerDisplay(), 1000);
        this.toast(this.t('timerStarted'), 'info');
        this.refresh();
    },

    stopTimer() {
        if (!this.activeTimer) return;
        clearInterval(this.activeTimer.interval);
        const elapsed = (Date.now() - this.activeTimer.startTime) / 3600000;
        if (elapsed > 0.01) Store.addTimeLog({ taskId: this.activeTimer.taskId, hours: Math.round(elapsed * 100) / 100, description: this.t('timer') });
        localStorage.removeItem('taskflow_timer');
        this.activeTimer = null;
        this.toast(this.t('timerStopped'), 'success');
        this.refresh();
    },

    restoreTimer() {
        const saved = localStorage.getItem('taskflow_timer');
        if (saved) {
            try {
                const { taskId, startTime } = JSON.parse(saved);
                if (Store.getTask(taskId)) {
                    this.activeTimer = { taskId, startTime };
                    this.activeTimer.interval = setInterval(() => this.updateTimerDisplay(), 1000);
                }
            } catch(e) { localStorage.removeItem('taskflow_timer'); }
        }
    },

    updateTimerDisplay() {
        const el = document.getElementById('timer-display');
        if (el && this.activeTimer) el.textContent = this.formatTimerElapsed();
    },

    formatTimerElapsed() {
        if (!this.activeTimer) return '0:00';
        const sec = Math.floor((Date.now() - this.activeTimer.startTime) / 1000);
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
    },

    // ===== Search =====
    onSearch(query) {
        const results = Store.search(query);
        const container = document.getElementById('search-results');
        if (!query.trim()) { container.classList.remove('open'); return; }
        let html = '';
        if (results.clients.length) {
            html += `<div class="search-group-title">${this.t('clients')}</div>`;
            html += results.clients.map(c => `<div class="search-item" data-action="select-client" data-id="${c.id}">${this.esc(c.name)}</div>`).join('');
        }
        if (results.projects.length) {
            html += `<div class="search-group-title">${this.t('projects')}</div>`;
            html += results.projects.map(p => `<div class="search-item" data-action="select-project" data-id="${p.id}">${this.esc(p.name)}</div>`).join('');
        }
        if (results.tasks.length) {
            html += `<div class="search-group-title">${this.t('tasks')}</div>`;
            html += results.tasks.map(t => `<div class="search-item" data-action="select-project" data-id="${t.projectId || ''}">${this.esc(t.title)}</div>`).join('');
        }
        container.innerHTML = html || `<div class="search-item" style="color:var(--text-3)">\u2014</div>`;
        container.classList.add('open');

        container.querySelectorAll('[data-action]').forEach(el => {
            el.addEventListener('click', () => {
                const action = el.dataset.action;
                const id = el.dataset.id;
                if (action === 'select-client') this.selectClient(id);
                else if (action === 'select-project' && id) this.selectProject(id);
                container.classList.remove('open');
                document.getElementById('search-input').value = '';
            });
        });
    },

    onSearchFocus() { if (document.getElementById('search-input').value.trim()) document.getElementById('search-results').classList.add('open'); },
    onSearchBlur() { document.getElementById('search-results').classList.remove('open'); },

    // ===== Modals =====
    showModal(type, editId, prefill) {
        this.editingId = editId || null;
        this._modalPrefill = prefill || {};
        const overlay = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('modal-form');
        const isEdit = !!editId;

        if (type === 'client') {
            const c = isEdit ? Store.getClient(editId) : {};
            const companies = Array.isArray(c.companies) ? c.companies : [];
            title.textContent = isEdit ? this.t('editClient') : this.t('newClient');
            form.innerHTML = `
                <div class="form-group"><label>${this.t('clientName')}</label><input name="name" required value="${this.esc(c.name || '')}" placeholder="${this.t('clientNamePlaceholder') || ''}"></div>
                <div class="form-row">
                    <div class="form-group"><label>${this.t('email')}</label><input name="email" type="email" value="${this.esc(c.email || '')}" placeholder="name@example.com"></div>
                    <div class="form-group"><label>${this.t('telegram')}</label><input name="telegram" value="${this.esc(c.telegram || '')}" placeholder="@username"></div>
                </div>
                <div class="form-group">
                    <label>${this.t('companiesLabel')}</label>
                    <div class="companies-editor" id="companies-editor"></div>
                    <input type="text" id="new-company-input" placeholder="${this.t('addCompanyPlaceholder')}" style="margin-top:6px;">
                    <div style="font-size:11px;color:var(--text-3);margin-top:4px">${this.t('companiesHelp')}</div>
                </div>
                <div class="form-group"><label>${this.t('notes')}</label><textarea name="notes" placeholder="${this.t('notesPlaceholder') || ''}">${this.esc(c.notes || '')}</textarea></div>
                <div class="form-actions">
                    <button type="button" class="btn btn-glass" data-form-cancel>${this.t('cancel')}</button>
                    <button type="submit" class="btn">${isEdit ? this.t('save') : this.t('create')}</button>
                </div>`;

            // Companies editor: chips + add/remove
            const editor = form.querySelector('#companies-editor');
            const workingCompanies = [...companies];
            const renderChips = () => {
                editor.innerHTML = workingCompanies.length
                    ? workingCompanies.map((name, i) => `<span class="company-chip editable" data-idx="${i}">${this.esc(name)} <button type="button" class="chip-remove" data-idx="${i}">\u00D7</button></span>`).join('')
                    : `<span style="color:var(--text-3);font-size:12px">${this.t('noCompaniesYet')}</span>`;
                editor.querySelectorAll('.chip-remove').forEach(btn => {
                    btn.addEventListener('click', () => {
                        workingCompanies.splice(parseInt(btn.dataset.idx), 1);
                        renderChips();
                    });
                });
            };
            renderChips();

            const newInput = form.querySelector('#new-company-input');
            const commitCompany = () => {
                const v = newInput.value.trim();
                if (!v) return;
                if (!workingCompanies.some(n => n.toLowerCase() === v.toLowerCase())) {
                    workingCompanies.push(v);
                }
                newInput.value = '';
                renderChips();
            };
            newInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    commitCompany();
                }
            });

            form.onsubmit = (e) => {
                e.preventDefault();
                // Commit any pending text in the company input
                if (newInput.value.trim()) commitCompany();
                this.saveClient_form(e.target, workingCompanies);
            };
        }

        else if (type === 'project') {
            const p = isEdit ? Store.getProject(editId) : {};
            const clientId = isEdit ? p.clientId : this.currentClientId;
            const client = clientId ? Store.getClient(clientId) : null;
            const clientCompanies = client && Array.isArray(client.companies) ? client.companies : [];
            title.textContent = isEdit ? this.t('editProject') : this.t('newProject');

            const companyOptions = [`<option value=""${!p.company ? ' selected' : ''}>${this.t('noCompanyOption')}</option>`]
                .concat(clientCompanies.map(name => `<option value="${this.esc(name)}"${p.company === name ? ' selected' : ''}>${this.esc(name)}</option>`))
                .concat([`<option value="__new__">${this.t('addNewCompanyOption')}</option>`])
                .join('');

            form.innerHTML = `
                <div class="form-group"><label>${this.t('projectName')}</label><input name="name" required value="${this.esc(p.name || '')}"></div>
                <div class="form-group"><label>${this.t('companyLabel')}</label>
                    <select name="companySelect" id="project-company-select">${companyOptions}</select>
                    <input type="text" name="companyNew" id="project-company-new" placeholder="${this.t('newCompanyName') || 'New company name'}" style="display:none;margin-top:6px;">
                </div>
                <div class="form-row">
                    <div class="form-group"><label>${this.t('projectType')}</label>
                        <select name="projectType">
                            <option value="">\u2014</option>
                            <option value="licensing"${p.projectType==='licensing'?' selected':''}>${this.t('typeLicensing')}</option>
                            <option value="corporate"${p.projectType==='corporate'?' selected':''}>${this.t('typeCorporate')}</option>
                            <option value="contracts"${p.projectType==='contracts'?' selected':''}>${this.t('typeContracts')}</option>
                            <option value="compliance"${p.projectType==='compliance'?' selected':''}>${this.t('typeCompliance')}</option>
                        </select>
                    </div>
                    <div class="form-group"><label>${this.t('jurisdiction')}</label><input name="jurisdiction" value="${this.esc(p.jurisdiction || '')}" placeholder="UK, EU, BVI..."></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>${this.t('status')}</label>
                        <select name="status">
                            <option value="active"${p.status==='active'?' selected':''}>${this.t('statusActive')}</option>
                            <option value="on_hold"${p.status==='on_hold'?' selected':''}>${this.t('statusOnHold')}</option>
                            <option value="completed"${p.status==='completed'?' selected':''}>${this.t('statusCompleted')}</option>
                        </select>
                    </div>
                    <div class="form-group"><label>${this.t('deadline')}</label><input name="deadline" type="date" value="${p.deadline || ''}"></div>
                </div>
                <div class="form-group"><label>${this.t('notes')}</label><textarea name="notes">${this.esc(p.notes || '')}</textarea></div>
                <div class="form-actions">
                    <button type="button" class="btn btn-glass" data-form-cancel>${this.t('cancel')}</button>
                    <button type="submit" class="btn">${isEdit ? this.t('save') : this.t('create')}</button>
                </div>`;

            // Toggle the "new company" input when the user picks __new__
            const selectEl = form.querySelector('#project-company-select');
            const newEl = form.querySelector('#project-company-new');
            selectEl.addEventListener('change', () => {
                if (selectEl.value === '__new__') {
                    newEl.style.display = '';
                    newEl.focus();
                } else {
                    newEl.style.display = 'none';
                    newEl.value = '';
                }
            });

            form.onsubmit = (e) => { e.preventDefault(); this.saveProject_form(e.target); };
        }

        else if (type === 'task') {
            const t = isEdit ? Store.getTask(editId) : {};
            const pf = this._modalPrefill;
            const allTags = Store.getTags();
            const taskTags = t.tags || [];
            const tagsHtml = allTags.map(tag =>
                `<label class="form-check"><input type="checkbox" name="tag_${tag.id}" ${taskTags.includes(tag.id)?'checked':''}> <span class="tag" style="background:${tag.color}22;color:${tag.color}">${this.esc(tag.name)}</span></label>`
            ).join(' ');

            // Unified target selector: "inbox:" | "client:<id>" | "project:<id>"
            let currentTarget = 'inbox:';
            if (isEdit) {
                if (t.projectId) currentTarget = 'project:' + t.projectId;
                else if (t.clientId) currentTarget = 'client:' + t.clientId;
            } else if (this.currentProjectId) currentTarget = 'project:' + this.currentProjectId;
            else if (this.currentClientId) currentTarget = 'client:' + this.currentClientId;

            const clients = Store.getClients();
            let targetOpts = `<option value="inbox:"${currentTarget === 'inbox:' ? ' selected' : ''}>${this.t('noProject')}</option>`;
            clients.forEach(c => {
                targetOpts += `<optgroup label="${this.esc(c.name)}">`;
                const clientVal = 'client:' + c.id;
                targetOpts += `<option value="${clientVal}"${currentTarget === clientVal ? ' selected' : ''}>${this.t('clientLabel')}: ${this.esc(c.name)}</option>`;
                const projects = Store.getProjects(c.id);
                projects.forEach(p => {
                    const projectVal = 'project:' + p.id;
                    const labelPrefix = p.company ? `${p.company} \u00B7 ` : '';
                    targetOpts += `<option value="${projectVal}"${currentTarget === projectVal ? ' selected' : ''}>\u00A0\u00A0\u00A0\u00A0${this.esc(labelPrefix + p.name)}</option>`;
                });
                targetOpts += `</optgroup>`;
            });
            const projectSelectHtml = `<div class="form-group"><label>${this.t('assignToProject')}</label><select name="taskTarget">${targetOpts}</select></div>`;

            const deadlineVal = pf.deadline || t.deadline || '';

            title.textContent = isEdit ? this.t('editTask') : this.t('newTask');
            form.innerHTML = `
                <div class="form-group"><label>${this.t('taskTitle')}</label><input name="title" required value="${this.esc(t.title || '')}"></div>
                ${projectSelectHtml}
                <div class="form-row">
                    <div class="form-group"><label>${this.t('status')}</label>
                        <select name="status">
                            <option value="todo"${t.status==='todo'?' selected':''}>${this.t('filterTodo')}</option>
                            <option value="in_progress"${t.status==='in_progress'?' selected':''}>${this.t('filterInProgress')}</option>
                            <option value="done"${t.status==='done'?' selected':''}>${this.t('filterDone')}</option>
                        </select>
                    </div>
                    <div class="form-group"><label>${this.t('priority')}</label>
                        <select name="priority">
                            <option value="low"${t.priority==='low'?' selected':''}>${this.t('priorityLow')}</option>
                            <option value="medium"${(t.priority==='medium'||!t.priority)?' selected':''}>${this.t('priorityMedium')}</option>
                            <option value="high"${t.priority==='high'?' selected':''}>${this.t('priorityHigh')}</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>${this.t('deadline')}</label><input name="deadline" type="date" value="${deadlineVal}"></div>
                    <div class="form-group" style="display:flex;align-items:end;padding-bottom:14px;">
                        <label class="form-check"><input type="checkbox" name="isProcedural" ${t.isProcedural?'checked':''}> ${this.t('proceduralDeadline')}</label>
                    </div>
                </div>
                ${allTags.length ? `<div class="form-group"><label>${this.t('tags')}</label><div style="display:flex;gap:8px;flex-wrap:wrap">${tagsHtml}</div></div>` : ''}
                <div class="form-group"><label>${this.t('notes')}</label><textarea name="notes">${this.esc(t.notes || '')}</textarea></div>
                ${isEdit ? `<div class="form-group"><label>${this.t('addHoursManual')}</label><input name="addHours" type="number" step="0.25" placeholder="0.5" min="0"></div>` : ''}
                <div class="form-actions">
                    <button type="button" class="btn btn-glass" data-form-cancel>${this.t('cancel')}</button>
                    <button type="submit" class="btn">${isEdit ? this.t('save') : this.t('create')}</button>
                </div>`;
            form.onsubmit = (e) => { e.preventDefault(); this.saveTask_form(e.target); };
        }

        overlay.classList.add('open');

        form.querySelectorAll('[data-form-cancel]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        setTimeout(() => form.querySelector('input:not([type=checkbox]), select')?.focus(), 100);
    },

    closeModal(e) {
        if (e && e.target !== e.currentTarget) return;
        document.getElementById('modal-overlay').classList.remove('open');
        this.editingId = null;
    },

    // ===== Save =====
    saveClient_form(form, companies) {
        const data = Object.fromEntries(new FormData(form));
        data.companies = Array.isArray(companies) ? companies : [];
        if (this.editingId) {
            Store.updateClient(this.editingId, data);
            this.toast(this.t('saved'), 'success');
        } else {
            const c = Store.addClient(data);
            this.toast(`${this.t('clientCreated')}: ${data.name}`, 'success');
            this.selectClient(c.id);
        }
        this.closeModal(); this.renderSidebar();
        if (this.currentView === 'client') this.renderClient();
    },

    saveProject_form(form) {
        const fd = new FormData(form);
        const data = Object.fromEntries(fd);
        // Resolve company selector
        let company = data.companySelect || '';
        if (company === '__new__') {
            company = (data.companyNew || '').trim();
        }
        delete data.companySelect;
        delete data.companyNew;
        data.company = company;

        if (this.editingId) {
            Store.updateProject(this.editingId, data);
            this.toast(this.t('saved'), 'success');
        } else {
            data.clientId = this.currentClientId;
            if (!data.clientId) {
                this.toast(this.t('selectClientFirst'), 'warning');
                return;
            }
            Store.addProject(data);
            this.toast(`${this.t('projectCreated')}: ${data.name}`, 'success');
        }
        this.closeModal(); this.renderClient();
    },

    saveTask_form(form) {
        const fd = new FormData(form);
        const data = {}; const tags = [];
        for (const [key, val] of fd.entries()) {
            if (key.startsWith('tag_')) tags.push(key.replace('tag_', ''));
            else data[key] = val;
        }
        data.tags = tags;
        data.isProcedural = !!fd.get('isProcedural');

        // Parse unified target selector
        const target = data.taskTarget || '';
        delete data.taskTarget;
        const [kind, targetId] = target.split(':');
        data.clientId = ''; data.projectId = '';
        if (kind === 'project' && targetId) {
            data.projectId = targetId;
            const proj = Store.getProject(targetId);
            if (proj) data.clientId = proj.clientId;
        } else if (kind === 'client' && targetId) {
            data.clientId = targetId;
        }

        if (this.editingId) {
            const addHours = parseFloat(data.addHours); delete data.addHours;
            if (addHours > 0) Store.addTimeLog({ taskId: this.editingId, hours: addHours, description: this.t('manualEntry') });
            Store.updateTask(this.editingId, data);
            this.toast(this.t('saved'), 'success');
        } else {
            delete data.addHours;
            Store.addTask(data);
            this.toast(`${this.t('taskCreated')}: ${data.title}`, 'success');
        }
        this.closeModal(); this.refresh();
    },

    // ===== Edit / Delete =====
    editClient() { this.showModal('client', this.currentClientId); },
    editProject() { this.showModal('project', this.currentProjectId); },
    editTask(id) { this.showModal('task', id); },

    async deleteClient() {
        const ok = await this.confirm(this.t('confirmDeleteClient'), this.t('confirmDeleteClientText'));
        if (ok) { Store.deleteClient(this.currentClientId); this.toast(this.t('deleted'), 'success'); this.showDashboard(); }
    },
    async deleteProject() {
        const ok = await this.confirm(this.t('confirmDeleteProject'), this.t('confirmDeleteProjectText'));
        if (ok) { Store.deleteProject(this.currentProjectId); this.toast(this.t('deleted'), 'success'); this.selectClient(this.currentClientId); }
    },
    async deleteTask(id) {
        const ok = await this.confirm(this.t('confirmDeleteTask'), this.t('confirmDeleteTaskText'));
        if (ok) { Store.deleteTask(id); this.toast(this.t('deleted'), 'success'); this.refresh(); }
    },

    // ===== Settings =====
    showSettings() {
        document.getElementById('setting-claude-key').value = localStorage.getItem('taskflow_claude_key') || '';
        document.getElementById('setting-client-id').value = SheetsSync.CLIENT_ID;
        document.getElementById('setting-sheet-id').value = SheetsSync.SHEET_ID;
        document.getElementById('settings-overlay').classList.add('open');
    },
    closeSettings(e) { if (e && e.target !== e.currentTarget) return; document.getElementById('settings-overlay').classList.remove('open'); },
    saveSettings() {
        localStorage.setItem('taskflow_claude_key', document.getElementById('setting-claude-key').value.trim());
        localStorage.setItem('taskflow_gapi_client_id', document.getElementById('setting-client-id').value.trim());
        localStorage.setItem('taskflow_sheet_id', document.getElementById('setting-sheet-id').value.trim());
        SheetsSync.CLIENT_ID = document.getElementById('setting-client-id').value.trim();
        SheetsSync.SHEET_ID = document.getElementById('setting-sheet-id').value.trim();
        AiInput.apiKey = document.getElementById('setting-claude-key').value.trim();
        this.toast(this.t('saved'), 'success');
    },

    // ===== Tags =====
    showTagsManager() { this.renderTagsList(); document.getElementById('tags-overlay').classList.add('open'); },
    closeTagsManager(e) { if (e && e.target !== e.currentTarget) return; document.getElementById('tags-overlay').classList.remove('open'); },
    renderTagsList() {
        const tags = Store.getTags();
        const container = document.getElementById('tags-list-manager');
        container.innerHTML = tags.length
            ? tags.map(t => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
                <span class="tag" style="background:${t.color}22;color:${t.color}">${this.esc(t.name)}</span>
                <button class="icon-btn tag-delete" data-tag-id="${t.id}" style="font-size:12px">\u2715</button>
            </div>`).join('')
            : `<p style="color:var(--text-3);font-size:13px">${this.t('noTags')}</p>`;

        container.querySelectorAll('.tag-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                Store.deleteTag(btn.dataset.tagId);
                this.renderTagsList();
            });
        });
    },

    addTag() {
        const name = document.getElementById('new-tag-name').value.trim();
        const color = document.getElementById('new-tag-color').value;
        if (!name) return;
        Store.addTag({ name, color });
        document.getElementById('new-tag-name').value = '';
        this.toast(`Tag "${name}" ${this.t('created') || 'created'}`, 'success');
        this.renderTagsList();
    },

    // ===== AI Preview =====
    showAiPreview(data) {
        const container = document.getElementById('ai-preview-content');
        const action = data.action || 'create_task';
        let fieldsHtml = '';

        if (action === 'create_client') {
            fieldsHtml = `
                <div class="ai-field"><span class="ai-field-label">Action:</span> <strong>${this.t('newClient')}</strong></div>
                <div class="ai-field"><span class="ai-field-label">${this.t('clientName')}:</span> <strong>${this.esc(data.name)}</strong></div>
                ${data.email ? `<div class="ai-field"><span class="ai-field-label">Email:</span> ${this.esc(data.email)}</div>` : ''}
                ${data.telegram ? `<div class="ai-field"><span class="ai-field-label">Telegram:</span> ${this.esc(data.telegram)}</div>` : ''}
                ${data.companies?.length ? `<div class="ai-field"><span class="ai-field-label">${this.t('companies')}:</span> ${data.companies.map(c => this.esc(c)).join(', ')}</div>` : ''}
                ${data.notes ? `<div class="ai-field"><span class="ai-field-label">${this.t('notes')}:</span> ${this.esc(data.notes)}</div>` : ''}`;
        } else if (action === 'create_project') {
            fieldsHtml = `
                <div class="ai-field"><span class="ai-field-label">Action:</span> <strong>${this.t('newProject')}</strong></div>
                <div class="ai-field"><span class="ai-field-label">${this.t('projectName')}:</span> <strong>${this.esc(data.name)}</strong></div>
                ${data.clientName ? `<div class="ai-field"><span class="ai-field-label">${this.t('clientLabel')}:</span> ${this.esc(data.clientName)}</div>` : ''}
                ${data.company ? `<div class="ai-field"><span class="ai-field-label">${this.t('companyLabel')}:</span> ${this.esc(data.company)}</div>` : ''}
                ${data.projectType ? `<div class="ai-field"><span class="ai-field-label">${this.t('typeLabel')}:</span> ${data.projectType}</div>` : ''}
                ${data.jurisdiction ? `<div class="ai-field"><span class="ai-field-label">${this.t('jurisdictionLabel')}:</span> ${this.esc(data.jurisdiction)}</div>` : ''}
                ${data.deadline ? `<div class="ai-field"><span class="ai-field-label">${this.t('deadline')}:</span> ${data.deadline}</div>` : ''}`;
        } else if (action === 'log_hours') {
            fieldsHtml = `
                <div class="ai-field"><span class="ai-field-label">Action:</span> <strong>${this.t('logHours')}</strong></div>
                <div class="ai-field"><span class="ai-field-label">${this.t('hours')}:</span> <strong>${this.esc(data.hours)}h</strong></div>
                ${data.taskName ? `<div class="ai-field"><span class="ai-field-label">${this.t('taskTitle')}:</span> ${this.esc(data.taskName)}</div>` : ''}
                ${data.description ? `<div class="ai-field"><span class="ai-field-label">${this.t('notes')}:</span> ${this.esc(data.description)}</div>` : ''}`;
        } else if (action === 'create_chain') {
            const labels = { create_client: this.t('newClient'), create_project: this.t('newProject'), create_task: this.t('newTask'), log_hours: this.t('logHours') };
            fieldsHtml = `<div class="ai-field"><span class="ai-field-label">Action:</span> <strong>${this.t('createMultiple')} (${(data.items || []).length})</strong></div>`;
            (data.items || []).forEach((item, i) => {
                const label = labels[item.action] || item.action;
                fieldsHtml += `<div style="margin:10px 0 2px;padding:6px 10px;background:var(--input-bg);border-radius:6px;font-size:12px">
                    <strong>${i+1}. ${label}</strong>`;
                if (item.action === 'log_hours') {
                    fieldsHtml += ` &mdash; <strong>${this.esc(item.hours)}h</strong>`;
                    if (item.taskName) fieldsHtml += ` on "${this.esc(item.taskName)}"`;
                } else {
                    const name = item.name || item.title || '';
                    if (name) fieldsHtml += ` &mdash; <strong>${this.esc(name)}</strong>`;
                    if (item.clientName) fieldsHtml += ` <span style="color:var(--text-3)">(${this.esc(item.clientName)})</span>`;
                    if (item.company) fieldsHtml += ` <span style="color:var(--text-3)">${this.esc(item.company)}</span>`;
                    if (item.projectName) fieldsHtml += ` <span style="color:var(--text-3)">(\u2192 ${this.esc(item.projectName)})</span>`;
                    if (item.deadline) fieldsHtml += ` <span style="color:var(--text-3)">${this.t('deadline')}: ${item.deadline}</span>`;
                    if (item.priority && item.priority !== 'medium') fieldsHtml += ` <span style="color:var(--text-3)">${item.priority}</span>`;
                }
                fieldsHtml += `</div>`;
            });
        } else {
            // create_task
            fieldsHtml = `
                <div class="ai-field"><span class="ai-field-label">Action:</span> <strong>${this.t('newTask')}</strong></div>
                <div class="ai-field"><span class="ai-field-label">${this.t('taskTitle')}:</span> <strong>${this.esc(data.title)}</strong></div>
                ${data.projectName ? `<div class="ai-field"><span class="ai-field-label">Project:</span> ${this.esc(data.projectName)}</div>` : ''}
                ${data.priority ? `<div class="ai-field"><span class="ai-field-label">${this.t('priority')}:</span> ${data.priority}</div>` : ''}
                ${data.deadline ? `<div class="ai-field"><span class="ai-field-label">${this.t('deadline')}:</span> ${data.deadline}</div>` : ''}
                ${data.isProcedural ? `<div class="ai-field"><span class="procedural-badge">${this.t('procedural')}</span></div>` : ''}
                ${data.notes ? `<div class="ai-field"><span class="ai-field-label">${this.t('notes')}:</span> ${this.esc(data.notes)}</div>` : ''}
                ${data.subtasks?.length ? `<div class="ai-field"><span class="ai-field-label">Subtasks:</span><ul style="margin:4px 0 0 16px;font-size:12px">${data.subtasks.map(s=>'<li>'+this.esc(s)+'</li>').join('')}</ul></div>` : ''}`;
        }

        container.innerHTML = `<div class="ai-preview">
            <div class="ai-preview-label">\u2728 ${this.t('aiSuggestion')}</div>
            <div class="ai-preview-content">${fieldsHtml}</div>
        </div>`;

        const actionsEl = document.getElementById('ai-preview-actions');
        actionsEl.innerHTML = `
            <button class="btn btn-glass" id="ai-btn-cancel">${this.t('cancel')}</button>
            <button class="btn" id="ai-btn-accept">${this.t('accept')}</button>
        `;
        actionsEl.querySelector('#ai-btn-cancel').onclick = () => this.closeAiPreview();
        actionsEl.querySelector('#ai-btn-accept').onclick = () => this.acceptAiResult();

        document.getElementById('ai-overlay').classList.add('open');
    },

    closeAiPreview(e) { if (e && e.target !== e.currentTarget) return; document.getElementById('ai-overlay').classList.remove('open'); },

    _pendingAiData: null,

    // ===== AI chain helpers =====
    _findClientByName(name) {
        if (!name) return null;
        const n = name.toLowerCase().trim();
        return Store.getClients().find(c => (c.name || '').toLowerCase() === n)
            || Store.getClients().find(c => (c.name || '').toLowerCase().includes(n))
            || null;
    },
    _findProjectByName(name, clientId) {
        if (!name) return null;
        const n = name.toLowerCase().trim();
        const all = Store.getProjects(clientId || undefined);
        return all.find(p => (p.name || '').toLowerCase() === n)
            || all.find(p => (p.name || '').toLowerCase().includes(n))
            || null;
    },
    _findTaskByName(name) {
        if (!name) return null;
        const n = name.toLowerCase().trim();
        const all = Store.getTasks();
        return all.find(t => (t.title || '').toLowerCase() === n)
            || all.find(t => (t.title || '').toLowerCase().includes(n))
            || null;
    },
    _resolveTaskId(d) {
        if (d.taskId && Store.getTask(d.taskId)) return d.taskId;
        const found = this._findTaskByName(d.taskName);
        return found ? found.id : null;
    },

    // Run a chain of AI items in order, auto-linking by name.
    _runChain(items) {
        let lastClientId = this.currentClientId;
        let lastProjectId = this.currentProjectId;
        let lastTaskId = null;
        const created = { client: 0, project: 0, task: 0, hours: 0 };
        const skipped = [];

        items.forEach(item => {
            // Tolerate legacy AI responses that still emit create_company
            if (item.action === 'create_company') {
                // Treat as: ensure the client exists and add company string to them
                let cid = null;
                if (item.ownerName) {
                    const c = this._findClientByName(item.ownerName);
                    if (c) cid = c.id;
                    else {
                        const newC = Store.addClient({ name: item.ownerName, companies: [] });
                        cid = newC.id;
                        created.client++;
                    }
                } else if (lastClientId) {
                    cid = lastClientId;
                }
                if (cid && item.name) Store.addCompanyToClient(cid, item.name);
                if (cid) lastClientId = cid;
                return;
            }

            if (item.action === 'create_client') {
                const existing = this._findClientByName(item.name);
                if (existing) {
                    lastClientId = existing.id;
                    // If AI supplied extra companies, fold them in
                    (item.companies || []).forEach(co => Store.addCompanyToClient(existing.id, co));
                    return;
                }
                const c = Store.addClient({
                    name: item.name,
                    email: item.email || '',
                    telegram: item.telegram || '',
                    notes: item.notes || '',
                    companies: Array.isArray(item.companies) ? item.companies : [],
                });
                lastClientId = c.id;
                created.client++;
            }
            else if (item.action === 'create_project') {
                // Resolve client: explicit id → clientName → lastClientId
                let cid = item.clientId && Store.getClient(item.clientId) ? item.clientId : null;
                if (!cid && item.clientName) {
                    const c = this._findClientByName(item.clientName);
                    if (c) cid = c.id;
                    else {
                        // Auto-create client with that name
                        const newC = Store.addClient({ name: item.clientName, companies: [] });
                        cid = newC.id;
                        created.client++;
                    }
                }
                if (!cid) cid = lastClientId;
                if (!cid) { skipped.push(`project "${item.name}" (no client)`); return; }

                const existing = this._findProjectByName(item.name, cid);
                if (existing) {
                    lastProjectId = existing.id;
                    lastClientId = cid;
                    // If AI supplied a company, make sure it's on the client
                    if (item.company) {
                        Store.addCompanyToClient(cid, item.company);
                        if (!existing.company) Store.updateProject(existing.id, { company: item.company });
                    }
                    return;
                }
                const p = Store.addProject({
                    name: item.name,
                    clientId: cid,
                    company: item.company || '',
                    projectType: item.projectType || '',
                    jurisdiction: item.jurisdiction || '',
                    status: item.status || 'active',
                    deadline: item.deadline || '',
                });
                lastProjectId = p.id;
                lastClientId = cid;
                created.project++;
            }
            else if (item.action === 'create_task') {
                let pid = item.projectId && Store.getProject(item.projectId) ? item.projectId : null;
                if (!pid && item.projectName) {
                    const p = this._findProjectByName(item.projectName);
                    if (p) pid = p.id;
                }
                if (!pid) pid = lastProjectId;

                // Dedup: reuse existing same-title task in that project
                const existing = pid
                    ? Store.getTasks(pid).find(t => (t.title || '').toLowerCase() === (item.title || '').toLowerCase())
                    : null;
                if (existing) {
                    lastTaskId = existing.id;
                    return;
                }

                // Fall back: attach to current client directly, else inbox
                const t = Store.addTask({
                    projectId: pid || '',
                    clientId: !pid && lastClientId ? lastClientId : '',
                    title: item.title,
                    priority: item.priority || 'medium',
                    deadline: item.deadline || '',
                    isProcedural: item.isProcedural || false,
                    notes: item.notes || '',
                    tags: item.tagIds || [],
                });
                lastTaskId = t.id;
                created.task++;
                if (item.subtasks?.length) {
                    item.subtasks.forEach(sub => Store.addTask({ projectId: pid || '', title: sub, priority: 'medium' }));
                }
            }
            else if (item.action === 'log_hours') {
                let tid = item.taskId && Store.getTask(item.taskId) ? item.taskId : null;
                if (!tid) tid = lastTaskId;
                if (!tid && item.taskName) {
                    const t = this._findTaskByName(item.taskName);
                    if (t) tid = t.id;
                }
                const hours = parseFloat(item.hours) || 0;
                if (!tid || hours <= 0) { skipped.push(`${hours}h log (no task)`); return; }
                Store.addTimeLog({ taskId: tid, hours, description: item.description || this.t('manualEntry') });
                created.hours += hours;
            }
        });

        return { lastClientId, lastProjectId, lastTaskId, created, skipped };
    },

    acceptAiResult() {
        if (!this._pendingAiData) return;
        const d = this._pendingAiData;
        const action = d.action || 'create_task';

        if (action === 'create_client') {
            const c = Store.addClient({
                name: d.name,
                email: d.email || '',
                telegram: d.telegram || '',
                notes: d.notes || '',
                companies: Array.isArray(d.companies) ? d.companies : [],
            });
            this.toast(`${this.t('clientCreated')}: ${d.name}`, 'success');
            this.selectClient(c.id);
        }

        else if (action === 'create_project') {
            let clientId = d.clientId || this.currentClientId;
            if (!clientId && d.clientName) {
                const found = this._findClientByName(d.clientName);
                if (found) clientId = found.id;
                else {
                    const newC = Store.addClient({ name: d.clientName, companies: [] });
                    clientId = newC.id;
                }
            }
            if (!clientId) {
                const clients = Store.getClients();
                if (clients.length === 1) clientId = clients[0].id;
                else { this.toast(this.t('selectClientFirst'), 'warning'); this.closeAiPreview(); return; }
            }
            const p = Store.addProject({
                name: d.name,
                clientId,
                company: d.company || '',
                projectType: d.projectType || '',
                jurisdiction: d.jurisdiction || '',
                status: d.status || 'active',
                deadline: d.deadline || '',
            });
            this.toast(`${this.t('projectCreated')}: ${d.name}`, 'success');
            this.selectProject(p.id);
        }

        else if (action === 'log_hours') {
            const tid = this._resolveTaskId(d);
            if (!tid) {
                this.toast(this.t('taskNotFound'), 'warning');
                this.closeAiPreview();
                return;
            }
            const hours = parseFloat(d.hours) || 0;
            if (hours <= 0) {
                this.toast(this.t('invalidHours'), 'warning');
                this.closeAiPreview();
                return;
            }
            Store.addTimeLog({ taskId: tid, hours, description: d.description || this.t('manualEntry') });
            this.toast(`${this.t('hoursLogged')}: ${hours}h`, 'success');
        }

        else if (action === 'create_chain') {
            const summary = this._runChain(d.items || []);
            const parts = [];
            if (summary.created.client) parts.push(`${summary.created.client} ${this.t('newClient').toLowerCase()}`);
            if (summary.created.project) parts.push(`${summary.created.project} ${this.t('newProject').toLowerCase()}`);
            if (summary.created.task) parts.push(`${summary.created.task} ${this.t('newTask').toLowerCase()}`);
            if (summary.created.hours) parts.push(`${summary.created.hours}h ${this.t('hoursLogged').toLowerCase()}`);
            this.toast(parts.length ? parts.join(', ') : `${this.t('created')}: ${(d.items || []).length}`, 'success');
            if (summary.skipped.length) this.toast(this.t('chainPartial') + ': ' + summary.skipped.join(', '), 'warning');
            if (summary.lastProjectId) this.selectProject(summary.lastProjectId);
            else if (summary.lastClientId) this.selectClient(summary.lastClientId);
            else this.showDashboard();
        }

        else {
            // create_task
            let projectId = this.currentProjectId || d.projectId || '';
            if (!projectId && d.projectName) {
                const match = Store.getProjects().find(p => p.name.toLowerCase() === d.projectName.toLowerCase());
                if (match) projectId = match.id;
            }
            Store.addTask({
                projectId,
                clientId: !projectId && this.currentClientId ? this.currentClientId : '',
                title: d.title,
                priority: d.priority || 'medium',
                deadline: d.deadline || '',
                isProcedural: d.isProcedural || false,
                notes: d.notes || '',
                tags: d.tagIds || [],
            });
            if (d.subtasks?.length) d.subtasks.forEach(sub => Store.addTask({ projectId, title: sub, priority: 'medium' }));
            this.toast(`${this.t('taskCreated')}: ${d.title}`, 'success');
            if (this.currentProjectId) this.renderProject();
            else if (!projectId) this.showInbox();
        }

        this._pendingAiData = null;
        this.closeAiPreview();
        document.getElementById('qi-text').value = '';
        this.refresh();
    },

    // ===== Helpers =====
    refresh() {
        this.applyI18n();
        if (this.currentView === 'dashboard') this.renderDashboard();
        else if (this.currentView === 'calendar') this.renderCalendarFull();
        else if (this.currentView === 'inbox') this.renderInbox();
        else if (this.currentView === 'client') this.renderClient();
        else if (this.currentView === 'project') this.renderProject();
        this.renderSidebar();
    },

    esc(str) { const div = document.createElement('div'); div.textContent = str || ''; return div.innerHTML; },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const locale = I18n.lang === 'uk' ? 'uk-UA' : 'en-GB';
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    },

    deadlineClass(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const diff = (d - now) / 86400000;
        if (diff < 0) return 'deadline-overdue';
        if (diff <= 3) return 'deadline-soon';
        return '';
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
