// ordify.me — Google Sheets backup (Phase 10, B-mode plain rows)
//
// Strategy: keep 5 named tabs in a single private spreadsheet — Clients,
// Matters, Tasks, TimeLogs, Invoices. Each tab is a normal table the user
// can read and edit in Google Sheets directly.
//
// Push  — overwrites all 5 tabs with the current Store state.
// Pull  — reads all 5 tabs and replaces local Store entities.
// Auto-push is OFF by default in this mode (manual sync to avoid clobbering
// user-edits made directly in the Sheet).
//
// For users who prefer maximum privacy, a separate "encrypted blob" mode
// remains available via `pushEncrypted()` / `pullEncrypted()` (kept for
// back-compat — existing single-cell Sheets continue to work).

const Sheets = {
    SCOPE: 'https://www.googleapis.com/auth/drive.file',
    DRIVE_BASE: 'https://www.googleapis.com/drive/v3',
    SHEETS_BASE: 'https://sheets.googleapis.com/v4/spreadsheets',

    // === Tab schemas — column order is the contract with the spreadsheet ===
    SCHEMAS: {
        Clients: ['id', 'name', 'email', 'industry', 'primary_currency', 'notes', 'created', 'updated', 'deletedAt'],
        Matters: [
            'id', 'clientId', 'name', 'status', 'industry', 'excludeFromAi',
            'billing_mode', 'billing_period_fee', 'billing_hours_included', 'billing_overage_rate',
            'billing_fixed_amount', 'billing_hourly_rate', 'billing_deadline',
            'notes', 'completed_at', 'created', 'updated', 'deletedAt',
        ],
        Tasks: [
            'id', 'clientId', 'matterId', 'title', 'deadline', 'priority', 'status',
            'tags', 'notes', 'recurrence_freq', 'recurrence_interval',
            'created', 'updated', 'deletedAt',
        ],
        TimeLogs: ['id', 'taskId', 'matterId', 'date', 'hours', 'billable', 'source', 'note', 'invoiceId'],
        Invoices: [
            'id', 'clientId', 'number', 'status',
            'issued_at', 'due_at', 'sent_at', 'paid_at',
            'currency', 'vat_pct', 'subtotal', 'vat_amount', 'total',
            'lines_json', 'notes', 'footer',
            'created', 'updated', 'deletedAt',
        ],
    },

    isConnected() {
        return Google.isConnected(this.SCOPE);
    },

    async connect() {
        await Google.requestToken(this.SCOPE);
        let id = Store.getSetting('sheets_spreadsheet_id');
        if (!id) {
            id = await this._createSpreadsheet();
            Store.setSetting('sheets_spreadsheet_id', id);
        }
        // Ensure all required tabs exist (idempotent)
        await this._ensureTabs(id);
        return id;
    },

    async _createSpreadsheet() {
        const tok = await Google.requestToken(this.SCOPE);
        const sheetsList = Object.keys(this.SCHEMAS).map(title => ({ properties: { title } }));
        const res = await fetch(this.SHEETS_BASE, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                properties: { title: 'ordify · backup' },
                sheets: sheetsList,
            }),
        });
        if (!res.ok) throw new Error(`Sheets create ${res.status}`);
        const data = await res.json();
        return data.spreadsheetId;
    },

    /** Make sure every tab in SCHEMAS exists in the spreadsheet. */
    async _ensureTabs(id) {
        const tok = await Google.requestToken(this.SCOPE);
        const meta = await fetch(`${this.SHEETS_BASE}/${id}?fields=sheets.properties.title`, {
            headers: { Authorization: `Bearer ${tok}` },
        }).then(r => r.json());
        const existing = new Set((meta.sheets || []).map(s => s.properties.title));
        const missing = Object.keys(this.SCHEMAS).filter(t => !existing.has(t));
        if (!missing.length) return;
        const requests = missing.map(title => ({ addSheet: { properties: { title } } }));
        await fetch(`${this.SHEETS_BASE}/${id}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests }),
        });
    },

    /** Push: overwrite all 5 tabs with current Store contents. */
    async push() {
        const id = Store.getSetting('sheets_spreadsheet_id');
        if (!id) throw new Error('Sheet not initialised — Connect Sheets first.');
        const tok = await Google.requestToken(this.SCOPE);
        const data = [
            { range: 'Clients!A1',  values: this._rowsFor('Clients',  Store.getClients({ includeDeleted: true })) },
            { range: 'Matters!A1',  values: this._rowsFor('Matters',  Store.getMatters(null, { includeDeleted: true })) },
            { range: 'Tasks!A1',    values: this._rowsFor('Tasks',    Store.getTasks(null, { includeDeleted: true })) },
            { range: 'TimeLogs!A1', values: this._rowsFor('TimeLogs', Store.getTimeLogs()) },
            { range: 'Invoices!A1', values: this._rowsFor('Invoices', Store.getInvoices(null, { includeDeleted: true })) },
        ];
        // Clear each tab first then write — keeps things clean if rows decreased
        const clearRequests = Object.keys(this.SCHEMAS).map(t => ({
            range: `${t}!A1:Z100000`,
        }));
        await fetch(`${this.SHEETS_BASE}/${id}/values:batchClear`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ranges: clearRequests.map(r => r.range) }),
        });
        const res = await fetch(`${this.SHEETS_BASE}/${id}/values:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                valueInputOption: 'RAW',
                data,
            }),
        });
        if (!res.ok) throw new Error(`Sheets push ${res.status}: ${await res.text()}`);
        const ts = new Date().toISOString();
        Store.setSetting('sheets_last_sync', ts);
        Store.setSetting('sheets_last_seen_remote', ts);
        return ts;
    },

    /** Pull: read all 5 tabs, replace local Store entities. */
    async pull() {
        const id = Store.getSetting('sheets_spreadsheet_id');
        if (!id) throw new Error('Sheet not initialised.');
        const tok = await Google.requestToken(this.SCOPE);
        const ranges = Object.keys(this.SCHEMAS).map(t => `${t}!A1:Z100000`);
        const url = `${this.SHEETS_BASE}/${id}/values:batchGet?` + ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
        if (!res.ok) throw new Error(`Sheets pull ${res.status}`);
        const data = await res.json();
        const valueRanges = data.valueRanges || [];
        const tabNames = Object.keys(this.SCHEMAS);
        const parsed = {};
        for (let i = 0; i < tabNames.length; i++) {
            const tab = tabNames[i];
            const values = valueRanges[i]?.values || [];
            parsed[tab] = this._parseRows(tab, values);
        }

        // Replace Store collections
        Store._data.clients   = parsed.Clients   || [];
        Store._data.matters   = parsed.Matters   || [];
        Store._data.tasks     = parsed.Tasks     || [];
        Store._data.timeLogs  = parsed.TimeLogs  || [];
        Store._data.invoices  = parsed.Invoices  || [];
        const ts = new Date().toISOString();
        Store._data.settings.sheets_last_sync = ts;
        Store._data.settings.sheets_last_seen_remote = ts;
        Store.flush();
        return ts;
    },

    /** Push a single entity — used by auto-sync if user enables it. */
    async pushOne(entityType, entity) {
        // For B mode, partial updates are tricky (need row lookup by id).
        // The simpler approach: full push. Auto-sync should call push() not pushOne().
        return this.push();
    },

    /** Convert an array of entities into rows: [headers, ...data]. */
    _rowsFor(tabName, entities) {
        const cols = this.SCHEMAS[tabName];
        const rows = [cols];   // first row = header
        for (const e of entities) {
            rows.push(cols.map(col => this._valueFor(tabName, col, e)));
        }
        return rows;
    },

    _valueFor(tab, col, e) {
        // Flatten nested billing.* keys for Matter
        if (tab === 'Matters' && col.startsWith('billing_')) {
            const key = col.replace('billing_', '');
            const v = e.billing?.[key];
            return v == null ? '' : String(v);
        }
        // Flatten recurrence.* for Tasks
        if (tab === 'Tasks' && col.startsWith('recurrence_')) {
            const key = col.replace('recurrence_', '');
            const v = e.recurrence?.[key];
            return v == null ? '' : String(v);
        }
        // Tags as comma-joined string
        if (col === 'tags') return Array.isArray(e.tags) ? e.tags.join(',') : '';
        // Booleans
        if (col === 'billable')      return e.billable === false ? 'false' : 'true';
        if (col === 'excludeFromAi') return e.excludeFromAi ? 'true' : '';
        // Lines as JSON for Invoices (variable-length nested)
        if (tab === 'Invoices' && col === 'lines_json') return JSON.stringify(e.lines || []);
        // Default
        const v = e[col];
        if (v == null) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    },

    /** Convert sheet rows back into entity objects. First row is header. */
    _parseRows(tabName, rows) {
        if (!rows.length) return [];
        const headers = rows[0];
        const expected = this.SCHEMAS[tabName];
        const result = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row.length || !row[0]) continue;   // skip blank rows
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                const col = headers[j];
                const cell = row[j];
                if (cell == null || cell === '') continue;
                this._assignCell(tabName, obj, col, cell);
            }
            // Ensure id exists
            if (!obj.id) continue;
            result.push(obj);
        }
        return result;
    },

    _assignCell(tab, obj, col, cell) {
        // Nested: billing.* / recurrence.*
        if (tab === 'Matters' && col.startsWith('billing_')) {
            if (!obj.billing) obj.billing = {};
            const key = col.replace('billing_', '');
            obj.billing[key] = this._coerce(key, cell);
            return;
        }
        if (tab === 'Tasks' && col.startsWith('recurrence_')) {
            if (!obj.recurrence) obj.recurrence = {};
            const key = col.replace('recurrence_', '');
            obj.recurrence[key] = this._coerce(key, cell);
            return;
        }
        if (col === 'tags') {
            obj.tags = String(cell).split(',').map(s => s.trim()).filter(Boolean);
            return;
        }
        if (col === 'billable')      { obj.billable = String(cell).toLowerCase() !== 'false'; return; }
        if (col === 'excludeFromAi') { obj.excludeFromAi = String(cell).toLowerCase() === 'true'; return; }
        if (col === 'lines_json') {
            try { obj.lines = JSON.parse(cell); } catch (_) { obj.lines = []; }
            return;
        }
        obj[col] = this._coerce(col, cell);
    },

    _coerce(col, val) {
        if (val == null || val === '') return null;
        // Numeric fields
        const numericFields = new Set([
            'hours', 'period_fee', 'hours_included', 'overage_rate', 'fixed_amount', 'hourly_rate',
            'subtotal', 'vat_amount', 'total', 'vat_pct', 'interval',
        ]);
        if (numericFields.has(col)) {
            const n = Number(val);
            return isNaN(n) ? null : n;
        }
        return String(val);
    },

    /** Read just the last-edited timestamp (for conflict detection). */
    async lastSyncedAt() {
        // For plain-mode Sheets we use the spreadsheet's modifiedTime via Drive API
        const id = Store.getSetting('sheets_spreadsheet_id');
        if (!id) return null;
        try {
            const tok = await Google.requestToken(this.SCOPE);
            const r = await fetch(`${this.DRIVE_BASE}/files/${id}?fields=modifiedTime`, {
                headers: { Authorization: `Bearer ${tok}` },
            });
            if (!r.ok) return null;
            return (await r.json()).modifiedTime || null;
        } catch (_) { return null; }
    },

    /** Push, but warn if the sheet was modified externally since last sync. */
    async pushSafe() {
        const remote = await this.lastSyncedAt();
        const lastSeen = Store.getSetting('sheets_last_seen_remote');
        if (remote && lastSeen && new Date(remote).getTime() > new Date(lastSeen).getTime() + 30_000) {
            const err = new Error('Remote sheet was modified since your last sync.');
            err.code = 'CONFLICT';
            err.remote = remote;
            err.lastSeen = lastSeen;
            throw err;
        }
        return this.push();
    },
};

window.Sheets = Sheets;
