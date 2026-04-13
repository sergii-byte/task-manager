const App = {
    currentView: 'dashboard',
    currentOwnerId: null,
    currentClientId: null,
    currentProjectId: null,
    taskFilter: 'all',
    editingId: null,
    calMonth: new Date().getMonth(),
    calYear: new Date().getFullYear(),
    activeTimer: null,

    init() {
        // Restore theme
        const theme = localStorage.getItem('taskflow_theme') || 'light';
        this.setTheme(theme, true);
        // Restore language
        this.applyI18n();
        this.renderSidebar();
        this.showDashboard();
        this.bindEvents();
        this.restoreTimer();
    },

    // --- Theme ---
    setTheme(theme, skipSave) {
        document.documentElement.setAttribute('data-theme', theme);
        if (!skipSave) localStorage.setItem('taskflow_theme', theme);
        document.getElementById('theme-light')?.classList.toggle('active', theme === 'light');
        document.getElementById('theme-dark')?.classList.toggle('active', theme === 'dark');
    },

    // --- i18n ---
    t(key) { return I18n.t(key); },

    applyI18n() {
        const lang = I18n.lang;
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const val = I18n.t(key);
            if (val) el.textContent = val;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            const val = I18n.t(key);
            if (val) el.placeholder = val;
        });
        document.getElementById('lang-en')?.classList.toggle('active', lang === 'en');
        document.getElementById('lang-uk')?.classList.toggle('active', lang === 'uk');
    },

    // --- Events ---
    bindEvents() {
        document.getElementById('sync-btn').addEventListener('click', () => {
            if (SheetsSync.isAuthorized) {
                SheetsSync.pushAll().then(() => SheetsSync.pullAll());
            } else {
                App.showSettings();
            }
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                App.taskFilter = btn.dataset.filter;
                App.renderTasks();
            });
        });
    },

    // --- Sidebar ---
    renderSidebar() {
        const owners = Store.getOwners();
        const list = document.getElementById('owners-list');

        if (owners.length === 0) {
            list.innerHTML = `<li class="nav-item" style="color:var(--text-3);font-size:12px;cursor:default;padding:6px 12px">${this.t('noClients')}</li>`;
            return;
        }

        let html = '';
        owners.forEach(o => {
            const clients = Store.getClients(o.id);
            const isActive = this.currentOwnerId === o.id && this.currentView === 'owner';
            html += `<li class="nav-item${isActive ? ' active' : ''}" onclick="App.selectOwner('${o.id}')">
                <span>${this.esc(o.name)}</span>
                <span class="badge">${clients.length}</span>
            </li>`;
            if (this.currentOwnerId === o.id && clients.length > 0) {
                html += '<ul class="nav-list nav-sub">';
                clients.forEach(c => {
                    const isClientActive = this.currentClientId === c.id;
                    html += `<li class="nav-item${isClientActive ? ' active' : ''}" onclick="event.stopPropagation(); App.selectClient('${c.id}')">
                        <span>${this.esc(c.name)}</span>
                    </li>`;
                });
                html += '</ul>';
            }
        });
        list.innerHTML = html;
        document.querySelectorAll('#sidebar .nav-item[data-view]').forEach(el => {
            el.classList.toggle('active', el.dataset.view === this.currentView);
        });
    },

    // --- Views ---
    showView(name) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const el = document.getElementById('view-' + name);
        if (el) el.classList.add('active');
        this.currentView = name;
        document.querySelectorAll('#sidebar .nav-item[data-view]').forEach(el => {
            el.classList.toggle('active', el.dataset.view === name);
        });
    },

    // --- Dashboard ---
    showDashboard() {
        this.currentOwnerId = null;
        this.currentClientId = null;
        this.currentProjectId = null;
        this.showView('dashboard');
        this.renderDashboard();
        this.renderSidebar();
    },

    renderDashboard() {
        const stats = Store.getStats();
        document.getElementById('dashboard-stats').innerHTML = `
            <div class="stat-card"><div class="stat-value">${stats.owners}</div><div class="stat-label">${this.t('statClients')}</div></div>
            <div class="stat-card"><div class="stat-value">${stats.clients}</div><div class="stat-label">${this.t('statCompanies')}</div></div>
            <div class="stat-card"><div class="stat-value">${stats.inProgress}</div><div class="stat-label">${this.t('statInProgress')}</div></div>
            <div class="stat-card"><div class="stat-value" style="color:${stats.overdue ? 'var(--red)' : ''}">${stats.overdue}</div><div class="stat-label">${this.t('statOverdue')}</div></div>
            <div class="stat-card"><div class="stat-value">${stats.totalHours}h</div><div class="stat-label">${this.t('statHours')}</div></div>
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
        document.getElementById('recent-tasks').innerHTML = recent.length
            ? recent.map(t => this.renderTaskItem(t, true)).join('')
            : `<div class="empty-state">
                <div class="empty-icon">⚖</div>
                <p>${this.t('noTasksYet')}</p>
                <button class="cta-btn" onclick="App.showModal('owner')">+ ${this.t('newClient')}</button>
            </div>`;

        this.renderCalendarMini('dashboard-calendar');
    },

    // --- Calendar ---
    showCalendar() {
        this.currentOwnerId = null; this.currentClientId = null; this.currentProjectId = null;
        this.showView('calendar');
        this.renderCalendarFull();
        this.renderSidebar();
    },

    renderCalendarMini(containerId) {
        const el = document.getElementById(containerId);
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
            let cls = 'cal-day';
            if (isToday) cls += ' today';
            if (dl?.procedural) cls += ' has-procedural';
            else if (dl?.count) cls += ' has-deadline';
            daysHtml += `<div class="${cls}" title="${dl ? dl.count + ' tasks' : ''}">${d}</div>`;
        }

        const totalCells = startDow + daysInMonth;
        const remaining = (7 - (totalCells % 7)) % 7;
        for (let i = 1; i <= remaining; i++) daysHtml += `<div class="cal-day other-month">${i}</div>`;

        el.innerHTML = `
            <div class="cal-header">
                <button class="icon-btn" onclick="App.calMonth--; if(App.calMonth<0){App.calMonth=11;App.calYear--;} App.renderCalendarMini('${containerId}')">‹</button>
                <span>${monthNames[month]} ${year}</span>
                <button class="icon-btn" onclick="App.calMonth++; if(App.calMonth>11){App.calMonth=0;App.calYear++;} App.renderCalendarMini('${containerId}')">›</button>
            </div>
            <div class="cal-grid">${daysHtml}</div>
        `;
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

    // --- Client (was Owner/UBO) ---
    selectOwner(id) {
        this.currentOwnerId = id; this.currentClientId = null; this.currentProjectId = null;
        this.showView('owner');
        this.renderOwner();
        this.renderSidebar();
    },

    renderOwner() {
        const owner = Store.getOwner(this.currentOwnerId);
        if (!owner) return this.showDashboard();
        document.getElementById('owner-name').textContent = owner.name;
        const infoParts = [];
        if (owner.email) infoParts.push(`<span><strong>Email:</strong> ${this.esc(owner.email)}</span>`);
        if (owner.telegram) infoParts.push(`<span><strong>Telegram:</strong> ${this.esc(owner.telegram)}</span>`);
        if (owner.notes) infoParts.push(`<span><strong>${this.t('notes')}:</strong> ${this.esc(owner.notes)}</span>`);
        document.getElementById('owner-info').innerHTML = infoParts.join('') || `<span>${this.t('noContactInfo')}</span>`;

        const clients = Store.getClients(this.currentOwnerId);
        if (clients.length === 0) {
            document.getElementById('clients-grid').innerHTML = `<div class="empty-state">
                <div class="empty-icon">🏢</div>
                <p>${this.t('noCompanies')}</p>
                <button class="cta-btn" onclick="App.showModal('client')">+ ${this.t('newCompany')}</button>
            </div>`;
            return;
        }

        document.getElementById('clients-grid').innerHTML = clients.map(c => {
            const projects = Store.getProjects(c.id);
            const allTasks = projects.flatMap(p => Store.getTasks(p.id));
            const done = allTasks.filter(t => t.status === 'done').length;
            const pct = allTasks.length ? Math.round(done / allTasks.length * 100) : 0;
            return `<div class="card" onclick="App.selectClient('${c.id}')">
                <h3>${this.esc(c.name)}</h3>
                <div class="card-meta">
                    <span>${projects.length} ${this.t('projects')}</span>
                    <span>${done}/${allTasks.length} ${this.t('tasks')}</span>
                </div>
                <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
    },

    // --- Company (was Client) ---
    selectClient(id) {
        const client = Store.getClient(id);
        if (!client) return;
        this.currentClientId = id; this.currentOwnerId = client.ownerId; this.currentProjectId = null;
        this.showView('client');
        this.renderClient();
        this.renderSidebar();
    },

    renderClient() {
        const client = Store.getClient(this.currentClientId);
        if (!client) return this.showDashboard();
        const owner = Store.getOwner(client.ownerId);
        document.getElementById('client-name').textContent = client.name;
        document.getElementById('client-breadcrumb').textContent = owner ? `← ${owner.name}` : '';
        document.getElementById('client-breadcrumb').onclick = () => this.selectOwner(client.ownerId);

        const infoParts = [];
        if (client.email) infoParts.push(`<span><strong>Email:</strong> ${this.esc(client.email)}</span>`);
        if (client.telegram) infoParts.push(`<span><strong>Telegram:</strong> ${this.esc(client.telegram)}</span>`);
        if (client.notes) infoParts.push(`<span><strong>${this.t('notes')}:</strong> ${this.esc(client.notes)}</span>`);
        document.getElementById('client-info').innerHTML = infoParts.join('') || `<span>${this.t('noInfo')}</span>`;

        const projects = Store.getProjects(this.currentClientId);
        if (projects.length === 0) {
            document.getElementById('projects-grid').innerHTML = `<div class="empty-state">
                <div class="empty-icon">📁</div>
                <p>${this.t('noProjects')}</p>
                <button class="cta-btn" onclick="App.showModal('project')">+ ${this.t('newProject')}</button>
            </div>`;
            return;
        }

        const statusL = { active: this.t('statusActive'), on_hold: this.t('statusOnHold'), completed: this.t('statusCompleted') };
        const typeL = { licensing: this.t('typeLicensing'), corporate: this.t('typeCorporate'), contracts: this.t('typeContracts'), compliance: this.t('typeCompliance') };

        document.getElementById('projects-grid').innerHTML = projects.map(p => {
            const tasks = Store.getTasks(p.id);
            const done = tasks.filter(t => t.status === 'done').length;
            const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
            return `<div class="card" onclick="App.selectProject('${p.id}')">
                <h3>${this.esc(p.name)}</h3>
                <div class="card-meta">
                    <span>${statusL[p.status] || p.status}${p.projectType ? ' · ' + (typeL[p.projectType] || p.projectType) : ''}</span>
                    <span>${done}/${tasks.length}</span>
                </div>
                ${p.jurisdiction ? `<div class="card-meta"><span>🌐 ${this.esc(p.jurisdiction)}</span></div>` : ''}
                ${p.deadline ? `<div class="card-meta"><span class="${this.deadlineClass(p.deadline)}">${this.t('deadlineLabel')}: ${this.formatDate(p.deadline)}</span></div>` : ''}
                <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
    },

    // --- Project ---
    selectProject(id) {
        const project = Store.getProject(id);
        if (!project) return;
        this.currentProjectId = id;
        this.currentClientId = project.clientId;
        const client = Store.getClient(project.clientId);
        if (client) this.currentOwnerId = client.ownerId;
        this.showView('project');
        this.renderProject();
        this.renderSidebar();
    },

    renderProject() {
        const project = Store.getProject(this.currentProjectId);
        if (!project) return this.showDashboard();
        const client = Store.getClient(project.clientId);
        const owner = client ? Store.getOwner(client.ownerId) : null;
        document.getElementById('project-name').textContent = project.name;
        const crumbs = [owner?.name, client?.name].filter(Boolean).join(' → ');
        document.getElementById('project-breadcrumb').textContent = crumbs ? `← ${crumbs}` : '';
        document.getElementById('project-breadcrumb').onclick = () => this.selectClient(project.clientId);

        const statusL = { active: this.t('statusActive'), on_hold: this.t('statusOnHold'), completed: this.t('statusCompleted') };
        const typeL = { licensing: this.t('typeLicensing'), corporate: this.t('typeCorporate'), contracts: this.t('typeContracts'), compliance: this.t('typeCompliance') };
        const infoParts = [`<span><strong>${this.t('statusLabel')}:</strong> ${statusL[project.status] || project.status}</span>`];
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
                ${this.taskFilter === 'all' ? `<button class="cta-btn" onclick="App.showModal('task')">+ ${this.t('newTask')}</button>` : ''}
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

    renderTaskItem(task, showContext = false) {
        const checkClass = task.status === 'done' ? 'checked' : task.status === 'in_progress' ? 'in-progress' : '';
        const meta = [];

        if (showContext) {
            const project = Store.getProject(task.projectId);
            const client = project ? Store.getClient(project.clientId) : null;
            if (client && project) meta.push(`${this.esc(client.name)} → ${this.esc(project.name)}`);
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
            ? `<span class="task-timer active" id="timer-display">⏱ ${this.formatTimerElapsed()}</span>`
            : (task.hoursLogged ? `<span class="task-timer">${task.hoursLogged}h</span>` : '');

        return `<div class="task-item${task.status === 'done' ? ' done' : ''}" data-id="${task.id}">
            <div class="task-checkbox ${checkClass}" onclick="App.cycleTaskStatus('${task.id}')"></div>
            <div class="priority-dot priority-${task.priority || 'medium'}"></div>
            <div class="task-body">
                <div class="task-title" onclick="App.editTask('${task.id}')">${this.esc(task.title)}</div>
                <div class="task-meta">${meta.join(' · ')}${tags ? ` <div class="task-tags">${tags}</div>` : ''}</div>
            </div>
            ${timerHtml}
            <div class="task-actions">
                <button class="icon-btn" onclick="App.toggleTimer('${task.id}')" title="Timer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${this.activeTimer?.taskId === task.id ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>'}</svg>
                </button>
                <button class="icon-btn" onclick="App.editTask('${task.id}')" title="Edit">✎</button>
                <button class="icon-btn" onclick="App.deleteTask('${task.id}')" title="Delete">✕</button>
            </div>
        </div>`;
    },

    cycleTaskStatus(id) {
        const task = Store.getTask(id);
        if (!task) return;
        const cycle = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
        Store.updateTask(id, { status: cycle[task.status] || 'todo' });
        this.refresh();
    },

    // --- Timer ---
    toggleTimer(taskId) {
        if (this.activeTimer?.taskId === taskId) this.stopTimer();
        else { if (this.activeTimer) this.stopTimer(); this.startTimer(taskId); }
    },

    startTimer(taskId) {
        const startTime = Date.now();
        this.activeTimer = { taskId, startTime };
        localStorage.setItem('taskflow_timer', JSON.stringify({ taskId, startTime }));
        this.activeTimer.interval = setInterval(() => this.updateTimerDisplay(), 1000);
        this.refresh();
    },

    stopTimer() {
        if (!this.activeTimer) return;
        clearInterval(this.activeTimer.interval);
        const elapsed = (Date.now() - this.activeTimer.startTime) / 3600000;
        if (elapsed > 0.01) Store.addTimeLog({ taskId: this.activeTimer.taskId, hours: Math.round(elapsed * 100) / 100, description: this.t('timer') });
        localStorage.removeItem('taskflow_timer');
        this.activeTimer = null;
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
        if (el && this.activeTimer) el.textContent = '⏱ ' + this.formatTimerElapsed();
    },

    formatTimerElapsed() {
        if (!this.activeTimer) return '0:00';
        const sec = Math.floor((Date.now() - this.activeTimer.startTime) / 1000);
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
    },

    // --- Search ---
    onSearch(query) {
        const results = Store.search(query);
        const container = document.getElementById('search-results');
        if (!query.trim()) { container.classList.remove('open'); return; }
        let html = '';
        if (results.owners.length) {
            html += `<div class="search-group-title">${this.t('clients')}</div>`;
            html += results.owners.map(o => `<div class="search-item" onclick="App.selectOwner('${o.id}')">${this.esc(o.name)}</div>`).join('');
        }
        if (results.clients.length) {
            html += `<div class="search-group-title">${this.t('statCompanies')}</div>`;
            html += results.clients.map(c => `<div class="search-item" onclick="App.selectClient('${c.id}')">${this.esc(c.name)}</div>`).join('');
        }
        if (results.projects.length) {
            html += `<div class="search-group-title">${this.t('projects')}</div>`;
            html += results.projects.map(p => `<div class="search-item" onclick="App.selectProject('${p.id}')">${this.esc(p.name)}</div>`).join('');
        }
        if (results.tasks.length) {
            html += `<div class="search-group-title">${this.t('tasks')}</div>`;
            html += results.tasks.map(t => `<div class="search-item" onclick="App.selectProject('${t.projectId}')">${this.esc(t.title)}</div>`).join('');
        }
        container.innerHTML = html || `<div class="search-item" style="color:var(--text-3)">—</div>`;
        container.classList.add('open');
    },

    onSearchFocus() { if (document.getElementById('search-input').value.trim()) document.getElementById('search-results').classList.add('open'); },
    onSearchBlur() { document.getElementById('search-results').classList.remove('open'); },

    // --- Modals ---
    showModal(type, editId) {
        this.editingId = editId || null;
        const overlay = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('modal-form');
        const isEdit = !!editId;

        if (type === 'owner') {
            const o = isEdit ? Store.getOwner(editId) : {};
            title.textContent = isEdit ? this.t('editClient') : this.t('newClient');
            form.innerHTML = `
                <div class="form-group"><label>${this.t('clientName')}</label><input name="name" required value="${this.esc(o.name || '')}"></div>
                <div class="form-row">
                    <div class="form-group"><label>${this.t('email')}</label><input name="email" type="email" value="${this.esc(o.email || '')}"></div>
                    <div class="form-group"><label>${this.t('telegram')}</label><input name="telegram" value="${this.esc(o.telegram || '')}" placeholder="@username"></div>
                </div>
                <div class="form-group"><label>${this.t('notes')}</label><textarea name="notes">${this.esc(o.notes || '')}</textarea></div>
                <div class="form-actions">
                    <button type="button" class="btn btn-glass" onclick="App.closeModal()">${this.t('cancel')}</button>
                    <button type="submit" class="btn">${isEdit ? this.t('save') : this.t('create')}</button>
                </div>`;
            form.onsubmit = (e) => { e.preventDefault(); App.saveOwner(e.target); };
        }

        else if (type === 'client') {
            const c = isEdit ? Store.getClient(editId) : {};
            title.textContent = isEdit ? this.t('editCompany') : this.t('newCompany');
            form.innerHTML = `
                <div class="form-group"><label>${this.t('companyName')}</label><input name="name" required value="${this.esc(c.name || '')}"></div>
                <div class="form-row">
                    <div class="form-group"><label>${this.t('email')}</label><input name="email" type="email" value="${this.esc(c.email || '')}"></div>
                    <div class="form-group"><label>${this.t('telegram')}</label><input name="telegram" value="${this.esc(c.telegram || '')}" placeholder="@username"></div>
                </div>
                <div class="form-group"><label>${this.t('notes')}</label><textarea name="notes">${this.esc(c.notes || '')}</textarea></div>
                <div class="form-actions">
                    <button type="button" class="btn btn-glass" onclick="App.closeModal()">${this.t('cancel')}</button>
                    <button type="submit" class="btn">${isEdit ? this.t('save') : this.t('create')}</button>
                </div>`;
            form.onsubmit = (e) => { e.preventDefault(); App.saveClient_form(e.target); };
        }

        else if (type === 'project') {
            const p = isEdit ? Store.getProject(editId) : {};
            title.textContent = isEdit ? this.t('editProject') : this.t('newProject');
            form.innerHTML = `
                <div class="form-group"><label>${this.t('projectName')}</label><input name="name" required value="${this.esc(p.name || '')}"></div>
                <div class="form-row">
                    <div class="form-group"><label>${this.t('projectType')}</label>
                        <select name="projectType">
                            <option value="">—</option>
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
                    <button type="button" class="btn btn-glass" onclick="App.closeModal()">${this.t('cancel')}</button>
                    <button type="submit" class="btn">${isEdit ? this.t('save') : this.t('create')}</button>
                </div>`;
            form.onsubmit = (e) => { e.preventDefault(); App.saveProject_form(e.target); };
        }

        else if (type === 'task') {
            const t = isEdit ? Store.getTask(editId) : {};
            const allTags = Store.getTags();
            const taskTags = t.tags || [];
            const tagsHtml = allTags.map(tag =>
                `<label class="form-check"><input type="checkbox" name="tag_${tag.id}" ${taskTags.includes(tag.id)?'checked':''}> <span class="tag" style="background:${tag.color}22;color:${tag.color}">${this.esc(tag.name)}</span></label>`
            ).join(' ');

            title.textContent = isEdit ? this.t('editTask') : this.t('newTask');
            form.innerHTML = `
                <div class="form-group"><label>${this.t('taskTitle')}</label><input name="title" required value="${this.esc(t.title || '')}"></div>
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
                    <div class="form-group"><label>${this.t('deadline')}</label><input name="deadline" type="date" value="${t.deadline || ''}"></div>
                    <div class="form-group" style="display:flex;align-items:end;padding-bottom:14px;">
                        <label class="form-check"><input type="checkbox" name="isProcedural" ${t.isProcedural?'checked':''}> ${this.t('proceduralDeadline')}</label>
                    </div>
                </div>
                ${allTags.length ? `<div class="form-group"><label>${this.t('tags')}</label><div style="display:flex;gap:8px;flex-wrap:wrap">${tagsHtml}</div></div>` : ''}
                <div class="form-group"><label>${this.t('notes')}</label><textarea name="notes">${this.esc(t.notes || '')}</textarea></div>
                ${isEdit ? `<div class="form-group"><label>${this.t('addHoursManual')}</label><input name="addHours" type="number" step="0.25" placeholder="0.5" min="0"></div>` : ''}
                <div class="form-actions">
                    <button type="button" class="btn btn-glass" onclick="App.closeModal()">${this.t('cancel')}</button>
                    <button type="submit" class="btn">${isEdit ? this.t('save') : this.t('create')}</button>
                </div>`;
            form.onsubmit = (e) => { e.preventDefault(); App.saveTask_form(e.target); };
        }

        overlay.classList.add('open');
        form.querySelector('input:not([type=checkbox]), select')?.focus();
    },

    closeModal(e) {
        if (e && e.target !== e.currentTarget) return;
        document.getElementById('modal-overlay').classList.remove('open');
        this.editingId = null;
    },

    // --- Save ---
    saveOwner(form) {
        const data = Object.fromEntries(new FormData(form));
        if (this.editingId) { Store.updateOwner(this.editingId, data); }
        else { const o = Store.addOwner(data); this.selectOwner(o.id); }
        this.closeModal(); this.renderSidebar();
        if (this.currentView === 'owner') this.renderOwner();
    },

    saveClient_form(form) {
        const data = Object.fromEntries(new FormData(form));
        if (this.editingId) { Store.updateClient(this.editingId, data); }
        else { data.ownerId = this.currentOwnerId; const c = Store.addClient(data); this.selectClient(c.id); }
        this.closeModal(); this.renderSidebar();
        if (this.currentView === 'client') this.renderClient();
        if (this.currentView === 'owner') this.renderOwner();
    },

    saveProject_form(form) {
        const data = Object.fromEntries(new FormData(form));
        if (this.editingId) { Store.updateProject(this.editingId, data); }
        else { data.clientId = this.currentClientId; Store.addProject(data); }
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
        if (this.editingId) {
            const addHours = parseFloat(data.addHours); delete data.addHours;
            if (addHours > 0) Store.addTimeLog({ taskId: this.editingId, hours: addHours, description: this.t('manualEntry') });
            Store.updateTask(this.editingId, data);
        } else {
            data.projectId = this.currentProjectId; delete data.addHours;
            Store.addTask(data);
        }
        this.closeModal(); this.refresh();
    },

    // --- Edit / Delete ---
    editOwner() { this.showModal('owner', this.currentOwnerId); },
    editClient() { this.showModal('client', this.currentClientId); },
    editProject() { this.showModal('project', this.currentProjectId); },
    editTask(id) { this.showModal('task', id); },

    deleteOwner() { if (confirm(this.t('confirmDeleteClient'))) { Store.deleteOwner(this.currentOwnerId); this.showDashboard(); } },
    deleteClient() { if (confirm(this.t('confirmDeleteCompany'))) { Store.deleteClient(this.currentClientId); this.selectOwner(this.currentOwnerId); } },
    deleteProject() { if (confirm(this.t('confirmDeleteProject'))) { Store.deleteProject(this.currentProjectId); this.selectClient(this.currentClientId); } },
    deleteTask(id) { if (confirm(this.t('confirmDeleteTask'))) { Store.deleteTask(id); this.refresh(); } },

    // --- Settings ---
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
        SheetsSync.setStatus(this.t('saved'), 'success');
    },

    // --- Tags ---
    showTagsManager() { this.renderTagsList(); document.getElementById('tags-overlay').classList.add('open'); },
    closeTagsManager(e) { if (e && e.target !== e.currentTarget) return; document.getElementById('tags-overlay').classList.remove('open'); },
    renderTagsList() {
        const tags = Store.getTags();
        document.getElementById('tags-list-manager').innerHTML = tags.length
            ? tags.map(t => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
                <span class="tag" style="background:${t.color}22;color:${t.color}">${this.esc(t.name)}</span>
                <button class="icon-btn" onclick="Store.deleteTag('${t.id}'); App.renderTagsList();" style="font-size:12px">✕</button>
            </div>`).join('')
            : `<p style="color:var(--text-3);font-size:13px">${this.t('noTags')}</p>`;
    },
    addTag() {
        const name = document.getElementById('new-tag-name').value.trim();
        const color = document.getElementById('new-tag-color').value;
        if (!name) return;
        Store.addTag({ name, color });
        document.getElementById('new-tag-name').value = '';
        this.renderTagsList();
    },

    // --- AI Preview ---
    showAiPreview(data) {
        const container = document.getElementById('ai-preview-content');
        container.innerHTML = `<div class="ai-preview">
            <div class="ai-preview-label">${this.t('aiSuggestion')}</div>
            <div class="ai-preview-content">
                <div class="ai-field"><span class="ai-field-label">${this.t('taskTitle')}:</span> <strong>${this.esc(data.title)}</strong></div>
                ${data.project ? `<div class="ai-field"><span class="ai-field-label">Project:</span> ${this.esc(data.project)}</div>` : ''}
                ${data.priority ? `<div class="ai-field"><span class="ai-field-label">${this.t('priority')}:</span> ${data.priority}</div>` : ''}
                ${data.deadline ? `<div class="ai-field"><span class="ai-field-label">${this.t('deadline')}:</span> ${data.deadline}</div>` : ''}
                ${data.isProcedural ? `<div class="ai-field"><span class="procedural-badge">${this.t('procedural')}</span></div>` : ''}
                ${data.subtasks?.length ? `<div class="ai-field"><span class="ai-field-label">Subtasks:</span><ul style="margin:4px 0 0 16px;font-size:12px">${data.subtasks.map(s=>'<li>'+this.esc(s)+'</li>').join('')}</ul></div>` : ''}
            </div>
        </div>`;
        document.getElementById('ai-preview-actions').innerHTML = `
            <button class="btn btn-glass" onclick="App.closeAiPreview()">${this.t('cancel')}</button>
            <button class="btn btn-glass" onclick="App.editAiResult()">${this.t('edit')}</button>
            <button class="btn" onclick="App.acceptAiResult()">${this.t('accept')}</button>
        `;
        document.getElementById('ai-overlay').classList.add('open');
    },

    closeAiPreview(e) { if (e && e.target !== e.currentTarget) return; document.getElementById('ai-overlay').classList.remove('open'); },

    _pendingAiData: null,

    editAiResult() {
        if (!this._pendingAiData) return;
        this.closeAiPreview();
        this.showModal('task');
        const form = document.getElementById('modal-form');
        const d = this._pendingAiData;
        if (d.title) form.querySelector('[name=title]').value = d.title;
        if (d.priority) form.querySelector('[name=priority]').value = d.priority;
        if (d.deadline) form.querySelector('[name=deadline]').value = d.deadline;
        if (d.isProcedural) { const cb = form.querySelector('[name=isProcedural]'); if (cb) cb.checked = true; }
        if (d.notes) form.querySelector('[name=notes]').value = d.notes;
    },

    acceptAiResult() {
        if (!this._pendingAiData) return;
        const d = this._pendingAiData;
        let projectId = this.currentProjectId || d.projectId;
        if (!projectId) { alert(this.t('selectProjectFirst')); this.closeAiPreview(); return; }
        Store.addTask({ projectId, title: d.title, priority: d.priority || 'medium', deadline: d.deadline || '', isProcedural: d.isProcedural || false, notes: d.notes || '', tags: d.tagIds || [] });
        if (d.subtasks?.length) d.subtasks.forEach(sub => Store.addTask({ projectId, title: sub, priority: 'medium' }));
        this._pendingAiData = null;
        this.closeAiPreview();
        document.getElementById('qi-text').value = '';
        this.refresh();
    },

    // --- Helpers ---
    refresh() {
        this.applyI18n();
        if (this.currentView === 'dashboard') this.renderDashboard();
        else if (this.currentView === 'calendar') this.renderCalendarFull();
        else if (this.currentView === 'owner') this.renderOwner();
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
