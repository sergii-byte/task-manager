// Local data store with localStorage persistence
// Schema v2: 3-level hierarchy
//   Client (person) ──> Project ──> Task
//   Company is an optional string field on Project, aggregated into Client.companies[]
const Store = {
    SCHEMA_VERSION: 2,
    _data: { clients: [], projects: [], tasks: [], tags: [], timeLogs: [], schemaVersion: 2 },
    _key: 'taskflow_data',

    init() {
        const saved = localStorage.getItem(this._key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if ((parsed.schemaVersion || 1) < this.SCHEMA_VERSION) {
                    // Old schema: wipe and start fresh (user-approved)
                    localStorage.removeItem(this._key);
                    console.log('[Store] Schema upgraded to v' + this.SCHEMA_VERSION + ' — old data cleared');
                } else {
                    this._data = parsed;
                }
            } catch(e) { /* use defaults */ }
        }
        const keys = ['clients', 'projects', 'tasks', 'tags', 'timeLogs'];
        keys.forEach(k => { if (!Array.isArray(this._data[k])) this._data[k] = []; });
        this._data.schemaVersion = this.SCHEMA_VERSION;
    },

    save() { localStorage.setItem(this._key, JSON.stringify(this._data)); },

    id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

    // --- Clients (the human / paying client) ---
    // Shape: { id, name, email, telegram, notes, companies: [string], created }
    getClients() { return this._data.clients; },
    getClient(id) { return this._data.clients.find(c => c.id === id); },
    addClient(data) {
        const c = {
            id: this.id(),
            created: new Date().toISOString(),
            companies: [],
            ...data,
        };
        if (!Array.isArray(c.companies)) c.companies = [];
        this._data.clients.push(c);
        this.save();
        return c;
    },
    updateClient(id, data) {
        const i = this._data.clients.findIndex(c => c.id === id);
        if (i !== -1) {
            this._data.clients[i] = { ...this._data.clients[i], ...data };
            if (!Array.isArray(this._data.clients[i].companies)) this._data.clients[i].companies = [];
            this.save();
        }
    },
    deleteClient(id) {
        const projectIds = this._data.projects.filter(p => p.clientId === id).map(p => p.id);
        const taskIdsToDelete = this._data.tasks.filter(t =>
            t.clientId === id || (t.projectId && projectIds.includes(t.projectId))
        ).map(t => t.id);
        this._data.timeLogs = this._data.timeLogs.filter(l => !taskIdsToDelete.includes(l.taskId));
        this._data.tasks = this._data.tasks.filter(t => !taskIdsToDelete.includes(t.id));
        this._data.projects = this._data.projects.filter(p => p.clientId !== id);
        this._data.clients = this._data.clients.filter(c => c.id !== id);
        this.save();
    },
    // Ensure a company name is in the client's company list
    addCompanyToClient(clientId, companyName) {
        if (!companyName) return;
        const client = this.getClient(clientId);
        if (!client) return;
        if (!Array.isArray(client.companies)) client.companies = [];
        const exists = client.companies.some(n => (n || '').toLowerCase() === companyName.toLowerCase());
        if (!exists) {
            client.companies.push(companyName);
            this.save();
        }
    },

    // --- Projects ---
    // Shape: { id, clientId, name, company?: string, projectType, jurisdiction, status, deadline, notes, pricingType, rate, fixedAmount, created }
    getProjects(clientId) {
        if (clientId) return this._data.projects.filter(p => p.clientId === clientId);
        return this._data.projects;
    },
    getProject(id) { return this._data.projects.find(p => p.id === id); },
    addProject(data) {
        const p = {
            id: this.id(),
            created: new Date().toISOString(),
            status: 'active',
            pricingType: 'hourly',
            ...data,
        };
        this._data.projects.push(p);
        // Auto-register company on client
        if (p.clientId && p.company) this.addCompanyToClient(p.clientId, p.company);
        this.save();
        return p;
    },
    updateProject(id, data) {
        const i = this._data.projects.findIndex(p => p.id === id);
        if (i !== -1) {
            this._data.projects[i] = { ...this._data.projects[i], ...data };
            const p = this._data.projects[i];
            if (p.clientId && p.company) this.addCompanyToClient(p.clientId, p.company);
            this.save();
        }
    },
    deleteProject(id) {
        const taskIds = this._data.tasks.filter(t => t.projectId === id).map(t => t.id);
        this._data.timeLogs = this._data.timeLogs.filter(l => !taskIds.includes(l.taskId));
        this._data.tasks = this._data.tasks.filter(t => t.projectId !== id);
        this._data.projects = this._data.projects.filter(p => p.id !== id);
        this.save();
    },

    // --- Tasks ---
    // Shape: { id, projectId?, clientId?, title, status, priority, deadline, isProcedural, notes, tags, hoursLogged, created }
    // Attachment:
    //   - projectId set        => task in a project
    //   - clientId set, no pid => task attached directly to a client (no project)
    //   - neither               => Inbox (free-floating)
    getTasks(projectId) {
        if (projectId) return this._data.tasks.filter(t => t.projectId === projectId);
        return this._data.tasks;
    },
    getInboxTasks() {
        return this._data.tasks.filter(t => !t.projectId && !t.clientId);
    },
    // All tasks under a client: direct client tasks + tasks in their projects
    getTasksForClient(clientId) {
        const projectIds = this._data.projects.filter(p => p.clientId === clientId).map(p => p.id);
        return this._data.tasks.filter(t =>
            t.clientId === clientId || (t.projectId && projectIds.includes(t.projectId))
        );
    },
    getDirectClientTasks(clientId) {
        return this._data.tasks.filter(t => t.clientId === clientId && !t.projectId);
    },
    getTask(id) { return this._data.tasks.find(t => t.id === id); },
    addTask(data) {
        const t = {
            id: this.id(),
            created: new Date().toISOString(),
            status: 'todo',
            priority: 'medium',
            tags: [],
            hoursLogged: 0,
            ...data,
        };
        this._data.tasks.push(t);
        this.save();
        return t;
    },
    updateTask(id, data) {
        const i = this._data.tasks.findIndex(t => t.id === id);
        if (i !== -1) { this._data.tasks[i] = { ...this._data.tasks[i], ...data }; this.save(); }
    },
    deleteTask(id) {
        this._data.timeLogs = this._data.timeLogs.filter(t => t.taskId !== id);
        this._data.tasks = this._data.tasks.filter(t => t.id !== id);
        this.save();
    },

    // --- Tags ---
    getTags() { return this._data.tags; },
    addTag(data) {
        const t = { id: this.id(), ...data };
        this._data.tags.push(t);
        this.save();
        return t;
    },
    deleteTag(id) {
        this._data.tasks.forEach(t => { t.tags = (t.tags || []).filter(tid => tid !== id); });
        this._data.tags = this._data.tags.filter(t => t.id !== id);
        this.save();
    },

    // --- Time Logs ---
    getTimeLogs(taskId) {
        if (taskId) return this._data.timeLogs.filter(t => t.taskId === taskId);
        return this._data.timeLogs;
    },
    addTimeLog(data) {
        const l = { id: this.id(), date: new Date().toISOString(), ...data };
        this._data.timeLogs.push(l);
        const task = this.getTask(data.taskId);
        if (task) {
            const total = this._data.timeLogs
                .filter(t => t.taskId === data.taskId)
                .reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);
            this.updateTask(data.taskId, { hoursLogged: Math.round(total * 100) / 100 });
        }
        this.save();
        return l;
    },
    deleteTimeLog(id) {
        const log = this._data.timeLogs.find(t => t.id === id);
        this._data.timeLogs = this._data.timeLogs.filter(t => t.id !== id);
        if (log) {
            const total = this._data.timeLogs
                .filter(t => t.taskId === log.taskId)
                .reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);
            this.updateTask(log.taskId, { hoursLogged: Math.round(total * 100) / 100 });
        }
        this.save();
    },

    // --- Stats ---
    getStats() {
        const tasks = this._data.tasks;
        const now = new Date();
        const totalHours = this._data.timeLogs.reduce((s, t) => s + (parseFloat(t.hours) || 0), 0);
        const companyCount = this._data.clients.reduce((s, c) => s + ((c.companies || []).length), 0);
        return {
            clients: this._data.clients.length,
            companies: companyCount,
            projects: this._data.projects.length,
            totalTasks: tasks.length,
            todo: tasks.filter(t => t.status === 'todo').length,
            inProgress: tasks.filter(t => t.status === 'in_progress').length,
            done: tasks.filter(t => t.status === 'done').length,
            overdue: tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'done').length,
            totalHours: Math.round(totalHours * 100) / 100,
        };
    },

    // --- Search ---
    search(query) {
        const q = query.toLowerCase().trim();
        if (!q) return { clients: [], projects: [], tasks: [] };
        const match = (str) => (str || '').toLowerCase().includes(q);
        const matchAny = (arr) => (arr || []).some(s => match(s));
        return {
            clients: this._data.clients.filter(c =>
                match(c.name) || match(c.email) || match(c.telegram) || match(c.notes) || matchAny(c.companies)
            ),
            projects: this._data.projects.filter(p => match(p.name) || match(p.notes) || match(p.company)),
            tasks: this._data.tasks.filter(t => match(t.title) || match(t.notes)),
        };
    },

    // Bulk ops for sync
    replaceAll(data) {
        this._data = data;
        if (!this._data.schemaVersion) this._data.schemaVersion = this.SCHEMA_VERSION;
        this.save();
    },
    getAll() { return JSON.parse(JSON.stringify(this._data)); },
};

Store.init();
