// Local data store with localStorage persistence
// Schema v3: 3-level hierarchy + `updated` timestamps for conflict-aware sync
//   Client (person) ──> Project ──> Task
//   Company is an optional string on Project AND Task.
//   On task save, if task has projectId, task.company MUST mirror project.company
//   (normalized). If no projectId, task.company is freestanding.
//   On project company rename, tasks of that project get their company updated.
const Store = {
    SCHEMA_VERSION: 3,
    _data: { clients: [], projects: [], tasks: [], tags: [], timeLogs: [], schemaVersion: 3 },
    _key: 'taskflow_data',

    init() {
        const saved = localStorage.getItem(this._key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const ver = parsed.schemaVersion || 1;
                if (ver < 2) {
                    // v1 → wipe (already approved in earlier migration)
                    localStorage.removeItem(this._key);
                    console.log('[Store] Schema upgraded from v1 — old data cleared');
                } else if (ver < 3) {
                    // v2 → v3: additive migration (add `updated` to every item)
                    const now = new Date().toISOString();
                    const touch = (arr) => (arr || []).forEach(it => { if (!it.updated) it.updated = it.created || now; });
                    touch(parsed.clients); touch(parsed.projects); touch(parsed.tasks);
                    touch(parsed.tags); touch(parsed.timeLogs);
                    parsed.schemaVersion = 3;
                    this._data = parsed;
                    console.log('[Store] Schema migrated v2 → v3 (added `updated` timestamps)');
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
    _now() { return new Date().toISOString(); },

    // --- Clients (the human / paying client) ---
    // Shape: { id, name, email, telegram, notes, companies: [string], created }
    getClients() { return this._data.clients; },
    getClient(id) { return this._data.clients.find(c => c.id === id); },
    addClient(data) {
        const now = this._now();
        const c = {
            id: this.id(),
            created: now,
            updated: now,
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
            const prev = this._data.clients[i];
            const prevCompanies = Array.isArray(prev.companies) ? prev.companies : [];
            this._data.clients[i] = { ...prev, ...data, updated: this._now() };
            if (!Array.isArray(this._data.clients[i].companies)) this._data.clients[i].companies = [];
            // If any company was renamed (removed from list while a similar one was added),
            // we can't auto-detect renames reliably — but we CAN propagate removals to
            // projects + tasks. Skip for now: rename is handled via updateProject.
            // Company deletions: if a company was removed from the list, blank it on any
            // task/project that still references it (explicit orphan cleanup).
            const nowCompanies = this._data.clients[i].companies;
            const removed = prevCompanies.filter(c => !nowCompanies.some(n => (n||'').toLowerCase() === (c||'').toLowerCase()));
            if (removed.length) {
                removed.forEach(co => {
                    this._data.projects.forEach(p => {
                        if (p.clientId === id && (p.company || '').toLowerCase() === co.toLowerCase()) {
                            p.company = '';
                            p.updated = this._now();
                        }
                    });
                    this._data.tasks.forEach(t => {
                        if (t.clientId === id && (t.company || '').toLowerCase() === co.toLowerCase()) {
                            t.company = '';
                            t.updated = this._now();
                        }
                    });
                });
            }
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
            client.updated = this._now();
            this.save();
        }
    },

    // Rename a company across a client's projects and tasks (and his list)
    renameCompanyForClient(clientId, oldName, newName) {
        if (!oldName || !newName || oldName === newName) return;
        const client = this.getClient(clientId);
        if (!client) return;
        const cos = Array.isArray(client.companies) ? client.companies : [];
        const idx = cos.findIndex(n => (n || '').toLowerCase() === oldName.toLowerCase());
        if (idx !== -1) cos[idx] = newName;
        client.companies = cos;
        client.updated = this._now();
        this._data.projects.forEach(p => {
            if (p.clientId === clientId && (p.company || '').toLowerCase() === oldName.toLowerCase()) {
                p.company = newName;
                p.updated = this._now();
            }
        });
        this._data.tasks.forEach(t => {
            if (t.clientId === clientId && (t.company || '').toLowerCase() === oldName.toLowerCase()) {
                t.company = newName;
                t.updated = this._now();
            }
        });
        this.save();
    },

    // --- Projects ---
    // Shape: { id, clientId, name, company?: string, projectType, jurisdiction, status, deadline, notes, pricingType, rate, fixedAmount, created }
    getProjects(clientId) {
        if (clientId) return this._data.projects.filter(p => p.clientId === clientId);
        return this._data.projects;
    },
    getProject(id) { return this._data.projects.find(p => p.id === id); },
    addProject(data) {
        const now = this._now();
        const p = {
            id: this.id(),
            created: now,
            updated: now,
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
            const prev = this._data.projects[i];
            const prevCompany = prev.company || '';
            this._data.projects[i] = { ...prev, ...data, updated: this._now() };
            const p = this._data.projects[i];
            if (p.clientId && p.company) this.addCompanyToClient(p.clientId, p.company);
            // Propagate company change to all tasks of this project (normalization)
            if (prevCompany !== (p.company || '')) {
                const now = this._now();
                this._data.tasks.forEach(t => {
                    if (t.projectId === id) {
                        t.company = p.company || '';
                        t.updated = now;
                    }
                });
            }
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
        const now = this._now();
        const t = {
            id: this.id(),
            created: now,
            updated: now,
            status: 'todo',
            priority: 'medium',
            tags: [],
            hoursLogged: 0,
            company: '',
            ...data,
        };
        // Normalize: if task attached to a project, force its company to match the project's
        if (t.projectId) {
            const proj = this.getProject(t.projectId);
            if (proj) {
                t.clientId = proj.clientId || t.clientId || '';
                t.company = proj.company || '';
            }
        }
        // Auto-register standalone company on client (no project)
        if (t.clientId && t.company) this.addCompanyToClient(t.clientId, t.company);
        this._data.tasks.push(t);
        this.save();
        return t;
    },
    updateTask(id, data) {
        const i = this._data.tasks.findIndex(t => t.id === id);
        if (i !== -1) {
            const merged = { ...this._data.tasks[i], ...data, updated: this._now() };
            // Normalize: if task has projectId, force company from project
            if (merged.projectId) {
                const proj = this.getProject(merged.projectId);
                if (proj) {
                    merged.clientId = proj.clientId || merged.clientId || '';
                    merged.company  = proj.company || '';
                }
            }
            if (merged.clientId && merged.company) this.addCompanyToClient(merged.clientId, merged.company);
            this._data.tasks[i] = merged;
            this.save();
        }
    },
    deleteTask(id) {
        this._data.timeLogs = this._data.timeLogs.filter(t => t.taskId !== id);
        this._data.tasks = this._data.tasks.filter(t => t.id !== id);
        this.save();
    },

    // --- Tags ---
    getTags() { return this._data.tags; },
    addTag(data) {
        const now = this._now();
        const t = { id: this.id(), created: now, updated: now, ...data };
        this._data.tags.push(t);
        this.save();
        return t;
    },
    deleteTag(id) {
        this._data.tasks.forEach(t => {
            if ((t.tags || []).includes(id)) {
                t.tags = (t.tags || []).filter(tid => tid !== id);
                t.updated = this._now();
            }
        });
        this._data.tags = this._data.tags.filter(t => t.id !== id);
        this.save();
    },

    // --- Time Logs ---
    getTimeLogs(taskId) {
        if (taskId) return this._data.timeLogs.filter(t => t.taskId === taskId);
        return this._data.timeLogs;
    },
    addTimeLog(data) {
        const now = this._now();
        const l = { id: this.id(), date: now, created: now, updated: now, ...data };
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
        const soon = new Date(now); soon.setDate(soon.getDate() + 7);
        const proceduralSoon = tasks.filter(t => t.isProcedural && t.deadline && t.status !== 'done' && new Date(t.deadline) <= soon).length;
        return {
            clients: this._data.clients.length,
            companies: companyCount,
            projects: this._data.projects.length,
            totalTasks: tasks.length,
            todo: tasks.filter(t => t.status === 'todo').length,
            inProgress: tasks.filter(t => t.status === 'in_progress').length,
            done: tasks.filter(t => t.status === 'done').length,
            overdue: tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'done').length,
            proceduralSoon,
            totalHours: Math.round(totalHours * 100) / 100,
        };
    },

    // --- Reports aggregation ---
    // For a [from, to] date range (ISO dates), group hours per client + project.
    // Returns: { from, to, clients: [{ clientId, clientName, totalHours, projects: [{ projectId, projectName, company, hours, rate, pricingType, fixedPrice, billable }] }], grandTotal }
    getHoursReport(fromISO, toISO) {
        const from = fromISO ? new Date(fromISO + 'T00:00:00') : new Date(0);
        const to = toISO ? new Date(toISO + 'T23:59:59.999') : new Date(8640000000000000);
        const logs = this._data.timeLogs.filter(l => {
            const d = new Date(l.date);
            return d >= from && d <= to && parseFloat(l.hours) > 0;
        });
        // taskId → hours
        const taskHours = new Map();
        logs.forEach(l => {
            const h = parseFloat(l.hours) || 0;
            taskHours.set(l.taskId, (taskHours.get(l.taskId) || 0) + h);
        });

        // Group: clientId → projectId → hours
        const byClient = new Map();
        const bareClientHours = new Map(); // client-level tasks (no project)
        const orphanTaskHours = new Map(); // tasks we couldn't resolve to a client

        taskHours.forEach((hours, taskId) => {
            const task = this.getTask(taskId);
            if (!task) return;
            let clientId = task.clientId || '';
            let projectId = task.projectId || '';
            if (projectId) {
                const p = this.getProject(projectId);
                if (p) clientId = p.clientId || clientId;
            }
            if (!clientId) {
                orphanTaskHours.set(taskId, (orphanTaskHours.get(taskId) || 0) + hours);
                return;
            }
            if (!projectId) {
                // Client-level task (Inbox for this client)
                const m = bareClientHours.get(clientId) || new Map();
                m.set(taskId, (m.get(taskId) || 0) + hours);
                bareClientHours.set(clientId, m);
                return;
            }
            if (!byClient.has(clientId)) byClient.set(clientId, new Map());
            const projMap = byClient.get(clientId);
            if (!projMap.has(projectId)) projMap.set(projectId, { hours: 0, tasks: new Map() });
            const entry = projMap.get(projectId);
            entry.hours += hours;
            entry.tasks.set(taskId, (entry.tasks.get(taskId) || 0) + hours);
        });

        // Build output
        const clientIds = new Set([...byClient.keys(), ...bareClientHours.keys()]);
        const clients = [];
        clientIds.forEach(cid => {
            const client = this.getClient(cid);
            if (!client) return;
            const projects = [];
            const projMap = byClient.get(cid) || new Map();
            projMap.forEach((entry, pid) => {
                const proj = this.getProject(pid);
                if (!proj) return;
                const rate = parseFloat(proj.rate) || 0;
                const fixedPrice = parseFloat(proj.fixedPrice) || 0;
                const pricingType = proj.pricingType || 'hourly';
                const billable = pricingType === 'fixed' ? fixedPrice : Math.round(entry.hours * rate * 100) / 100;
                const taskList = [];
                entry.tasks.forEach((h, tid) => {
                    const t = this.getTask(tid);
                    if (t) taskList.push({ id: tid, title: t.title || '', hours: Math.round(h * 100) / 100 });
                });
                taskList.sort((a, b) => b.hours - a.hours);
                projects.push({
                    projectId: pid,
                    projectName: proj.name || '',
                    company: proj.company || '',
                    hours: Math.round(entry.hours * 100) / 100,
                    rate, fixedPrice, pricingType, billable,
                    tasks: taskList,
                });
            });

            // Bare client-level tasks → synthesize a pseudo-"project" entry
            const bare = bareClientHours.get(cid);
            if (bare && bare.size) {
                const tasksArr = [];
                let totalBare = 0;
                bare.forEach((h, tid) => {
                    const t = this.getTask(tid);
                    if (!t) return;
                    totalBare += h;
                    tasksArr.push({ id: tid, title: t.title || '', hours: Math.round(h * 100) / 100 });
                });
                if (tasksArr.length) {
                    tasksArr.sort((a, b) => b.hours - a.hours);
                    projects.push({
                        projectId: null,
                        projectName: null,      // renderer will use translated "Client-level tasks"
                        company: '',
                        hours: Math.round(totalBare * 100) / 100,
                        rate: 0, fixedPrice: 0, pricingType: 'hourly', billable: 0,
                        tasks: tasksArr,
                    });
                }
            }

            projects.sort((a, b) => b.hours - a.hours);
            const totalHours = projects.reduce((s, p) => s + p.hours, 0);
            const totalBillable = projects.reduce((s, p) => s + (p.billable || 0), 0);
            clients.push({
                clientId: cid,
                clientName: client.name || '',
                totalHours: Math.round(totalHours * 100) / 100,
                totalBillable: Math.round(totalBillable * 100) / 100,
                projects,
            });
        });

        clients.sort((a, b) => b.totalHours - a.totalHours);
        const grandTotal = clients.reduce((s, c) => s + c.totalHours, 0);
        const grandBillable = clients.reduce((s, c) => s + c.totalBillable, 0);
        return {
            from: fromISO || '',
            to: toISO || '',
            clients,
            grandTotal: Math.round(grandTotal * 100) / 100,
            grandBillable: Math.round(grandBillable * 100) / 100,
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

    // Timestamp-aware merge for bidirectional sync.
    // Incoming data is merged with local — the newer `updated` wins per item.
    // Items that exist only in one side are kept. Returns counts: { added, updated, unchanged }.
    mergeAll(remote) {
        const counts = { added: 0, updated: 0, unchanged: 0, kept: 0 };
        const keys = ['clients', 'projects', 'tasks', 'tags', 'timeLogs'];
        keys.forEach(k => {
            const localArr = Array.isArray(this._data[k]) ? this._data[k] : [];
            const remoteArr = Array.isArray(remote[k]) ? remote[k] : [];
            const byId = new Map(localArr.map(it => [it.id, it]));
            remoteArr.forEach(rem => {
                if (!rem.id) return;
                const loc = byId.get(rem.id);
                if (!loc) {
                    byId.set(rem.id, rem);
                    counts.added++;
                } else {
                    const locT = new Date(loc.updated || loc.created || 0).getTime();
                    const remT = new Date(rem.updated || rem.created || 0).getTime();
                    if (remT > locT) {
                        byId.set(rem.id, rem);
                        counts.updated++;
                    } else {
                        counts.unchanged++;
                    }
                }
            });
            counts.kept += Array.from(byId.values()).length - remoteArr.length;
            this._data[k] = Array.from(byId.values());
        });
        this._data.schemaVersion = this.SCHEMA_VERSION;
        this.save();
        return counts;
    },

    getAll() { return JSON.parse(JSON.stringify(this._data)); },
};

Store.init();
