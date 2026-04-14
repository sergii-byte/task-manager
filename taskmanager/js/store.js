// Local data store with localStorage persistence
const Store = {
    _data: { owners: [], clients: [], projects: [], tasks: [], tags: [], timeLogs: [] },
    _key: 'taskflow_data',

    init() {
        const saved = localStorage.getItem(this._key);
        if (saved) {
            try { this._data = JSON.parse(saved); } catch(e) { /* use defaults */ }
        }
        const keys = ['owners', 'clients', 'projects', 'tasks', 'tags', 'timeLogs'];
        keys.forEach(k => { if (!Array.isArray(this._data[k])) this._data[k] = []; });
    },

    save() { localStorage.setItem(this._key, JSON.stringify(this._data)); },

    id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

    // --- Owners (UBO) ---
    getOwners() { return this._data.owners; },
    getOwner(id) { return this._data.owners.find(o => o.id === id); },
    addOwner(data) {
        const o = { id: this.id(), created: new Date().toISOString(), ...data };
        this._data.owners.push(o);
        this.save();
        return o;
    },
    updateOwner(id, data) {
        const i = this._data.owners.findIndex(o => o.id === id);
        if (i !== -1) { this._data.owners[i] = { ...this._data.owners[i], ...data }; this.save(); }
    },
    deleteOwner(id) {
        const clientIds = this._data.clients.filter(c => c.ownerId === id).map(c => c.id);
        const projectIds = this._data.projects.filter(p => clientIds.includes(p.clientId)).map(p => p.id);
        this._data.timeLogs = this._data.timeLogs.filter(t => !projectIds.includes(Store.getTask(t.taskId)?.projectId));
        this._data.tasks = this._data.tasks.filter(t => !projectIds.includes(t.projectId));
        this._data.projects = this._data.projects.filter(p => !clientIds.includes(p.clientId));
        this._data.clients = this._data.clients.filter(c => c.ownerId !== id);
        this._data.owners = this._data.owners.filter(o => o.id !== id);
        this.save();
    },

    // --- Clients (Companies) ---
    getClients(ownerId) {
        if (ownerId) return this._data.clients.filter(c => c.ownerId === ownerId);
        return this._data.clients;
    },
    getClient(id) { return this._data.clients.find(c => c.id === id); },
    addClient(data) {
        const c = { id: this.id(), created: new Date().toISOString(), ...data };
        this._data.clients.push(c);
        this.save();
        return c;
    },
    updateClient(id, data) {
        const i = this._data.clients.findIndex(c => c.id === id);
        if (i !== -1) { this._data.clients[i] = { ...this._data.clients[i], ...data }; this.save(); }
    },
    deleteClient(id) {
        const projectIds = this._data.projects.filter(p => p.clientId === id).map(p => p.id);
        this._data.tasks = this._data.tasks.filter(t => !projectIds.includes(t.projectId));
        this._data.projects = this._data.projects.filter(p => p.clientId !== id);
        this._data.clients = this._data.clients.filter(c => c.id !== id);
        this.save();
    },

    // --- Projects ---
    getProjects(clientId) {
        if (clientId) return this._data.projects.filter(p => p.clientId === clientId);
        return this._data.projects;
    },
    getProject(id) { return this._data.projects.find(p => p.id === id); },
    addProject(data) {
        const p = { id: this.id(), created: new Date().toISOString(), status: 'active', pricingType: 'hourly', ...data };
        this._data.projects.push(p);
        this.save();
        return p;
    },
    updateProject(id, data) {
        const i = this._data.projects.findIndex(p => p.id === id);
        if (i !== -1) { this._data.projects[i] = { ...this._data.projects[i], ...data }; this.save(); }
    },
    deleteProject(id) {
        this._data.tasks = this._data.tasks.filter(t => t.projectId !== id);
        this._data.projects = this._data.projects.filter(p => p.id !== id);
        this.save();
    },

    // --- Tasks ---
    getTasks(projectId) {
        if (projectId) return this._data.tasks.filter(t => t.projectId === projectId);
        return this._data.tasks;
    },
    getInboxTasks() {
        return this._data.tasks.filter(t => !t.projectId);
    },
    getTasksForOwner(ownerId) {
        const clientIds = this._data.clients.filter(c => c.ownerId === ownerId).map(c => c.id);
        const projectIds = this._data.projects.filter(p => clientIds.includes(p.clientId)).map(p => p.id);
        return this._data.tasks.filter(t => projectIds.includes(t.projectId));
    },
    getTasksForClient(clientId) {
        const projectIds = this._data.projects.filter(p => p.clientId === clientId).map(p => p.id);
        return this._data.tasks.filter(t => projectIds.includes(t.projectId));
    },
    getTask(id) { return this._data.tasks.find(t => t.id === id); },
    addTask(data) {
        const t = { id: this.id(), created: new Date().toISOString(), status: 'todo', priority: 'medium', tags: [], hoursLogged: 0, ...data };
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
        // Update task total
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
        return {
            owners: this._data.owners.length,
            clients: this._data.clients.length,
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
        if (!q) return { owners: [], clients: [], projects: [], tasks: [] };
        const match = (str) => (str || '').toLowerCase().includes(q);
        return {
            owners: this._data.owners.filter(o => match(o.name) || match(o.email) || match(o.telegram)),
            clients: this._data.clients.filter(c => match(c.name) || match(c.email) || match(c.telegram) || match(c.notes)),
            projects: this._data.projects.filter(p => match(p.name) || match(p.notes)),
            tasks: this._data.tasks.filter(t => match(t.title) || match(t.notes)),
        };
    },

    // Bulk ops for sync
    replaceAll(data) { this._data = data; this.save(); },
    getAll() { return JSON.parse(JSON.stringify(this._data)); },
};

Store.init();
