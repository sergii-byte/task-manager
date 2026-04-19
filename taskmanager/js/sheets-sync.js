const SheetsSync = {
    CLIENT_ID: '',
    SHEET_ID: '',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
    tokenClient: null,
    isAuthorized: false,
    _gapiLoaded: false,
    _gsiLoaded: false,

    SHEET_NAMES: {
        clients: 'Clients',
        projects: 'Projects',
        tasks: 'Tasks',
        tags: 'Tags',
        timeLogs: 'TimeLogs',
    },

    // `updated` column MUST be present for timestamp-aware merge. Without it, mergeAll
     // treats remote as older and remote edits silently lose. Same for `created` on timeLogs.
    HEADERS: {
        clients: ['id', 'name', 'email', 'telegram', 'companies', 'notes', 'created', 'updated'],
        projects: ['id', 'clientId', 'name', 'company', 'projectType', 'jurisdiction', 'status', 'pricingType', 'rate', 'fixedPrice', 'deadline', 'notes', 'created', 'updated'],
        tasks: ['id', 'projectId', 'clientId', 'company', 'title', 'status', 'priority', 'deadline', 'isProcedural', 'tags', 'hoursLogged', 'notes', 'dependsOn', 'completedAt', 'created', 'updated'],
        tags: ['id', 'name', 'color', 'created', 'updated'],
        timeLogs: ['id', 'taskId', 'hours', 'description', 'date', 'created', 'updated'],
    },

    init() {
        this.CLIENT_ID = localStorage.getItem('taskflow_gapi_client_id') || '';
        this.SHEET_ID = localStorage.getItem('taskflow_sheet_id') || '';
    },

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    },

    async _ensureLoaded() {
        if (!this._gapiLoaded) {
            await this._loadScript('https://apis.google.com/js/api.js');
            this._gapiLoaded = true;
        }
        if (!this._gsiLoaded) {
            await this._loadScript('https://accounts.google.com/gsi/client');
            this._gsiLoaded = true;
        }
    },

    // i18n helper: read from I18n if the key exists, else use the fallback literal
    _t(key, fallback) {
        const s = (typeof I18n !== 'undefined' && typeof I18n.t === 'function') ? I18n.t(key) : '';
        if (s && s !== key) return s;
        return fallback;
    },

    async authorize() {
        if (!this.CLIENT_ID) {
            this.setStatus(this._t('syncNeedClientId', 'Set Client ID in settings'), 'error');
            return;
        }

        this.setStatus(this._t('syncLoadingApi', 'Loading Google API...'));
        await this._ensureLoaded();

        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (response) => {
                if (response.error) {
                    this.setStatus(this._t('syncAuthError', 'Authorization error') + ': ' + response.error, 'error');
                    return;
                }
                this.isAuthorized = true;
                this.setStatus(this._t('syncConnected', 'Connected to Google'), 'success');
                this.loadGapi();
            },
        });

        this.tokenClient.requestAccessToken();
    },

    loadGapi() {
        gapi.load('client', async () => {
            await gapi.client.init({});
            await gapi.client.load('sheets', 'v4');
            this.setStatus(this._t('syncApiReady', 'Google Sheets API ready'), 'success');
        });
    },

    setStatus(msg, type) {
        const el = document.getElementById('sync-status');
        if (el) {
            el.textContent = msg;
            el.className = 'sync-status' + (type ? ' ' + type : '');
        }
    },

    async createSpreadsheet() {
        const sheets = Object.values(this.SHEET_NAMES).map(name => ({ properties: { title: name } }));
        const response = await gapi.client.sheets.spreadsheets.create({
            resource: { properties: { title: 'Ordify Data' }, sheets },
        });

        this.SHEET_ID = response.result.spreadsheetId;
        localStorage.setItem('taskflow_sheet_id', this.SHEET_ID);
        document.getElementById('setting-sheet-id').value = this.SHEET_ID;

        for (const [key, headers] of Object.entries(this.HEADERS)) {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.SHEET_ID,
                range: `${this.SHEET_NAMES[key]}!A1`,
                valueInputOption: 'RAW',
                resource: { values: [headers] },
            });
        }

        return this.SHEET_ID;
    },

    _getErrorMessage(e) {
        if (e?.result?.error?.message) return e.result.error.message;
        if (e?.message) return e.message;
        if (e?.error) return typeof e.error === 'string' ? e.error : JSON.stringify(e.error);
        if (typeof e === 'string') return e;
        return JSON.stringify(e);
    },

    async _ensureGapiReady() {
        if (!this.isAuthorized) {
            this.setStatus(this._t('syncNeedConnect', 'Connect Google first'), 'error');
            return false;
        }
        if (!window.gapi?.client?.sheets) {
            this.setStatus(this._t('syncApiLoading', 'Google Sheets API loading...'), 'info');
            try {
                await this._ensureLoaded();
                await new Promise((resolve, reject) => {
                    gapi.load('client', async () => {
                        try {
                            await gapi.client.init({});
                            await gapi.client.load('sheets', 'v4');
                            resolve();
                        } catch (e) { reject(e); }
                    });
                });
            } catch (e) {
                this.setStatus(this._t('syncApiLoadFail', 'Failed to load Google Sheets API') + ': ' + this._getErrorMessage(e), 'error');
                return false;
            }
        }
        return true;
    },

    async pushAll() {
        if (!(await this._ensureGapiReady())) return;

        const syncBtn = document.getElementById('sync-btn');
        syncBtn.classList.add('syncing');

        try {
            if (!this.SHEET_ID) {
                await this.createSpreadsheet();
                this.setStatus(this._t('syncCreated', 'New spreadsheet created'), 'success');
            }

            const data = Store.getAll();

            for (const [key, headers] of Object.entries(this.HEADERS)) {
                const items = data[key] || [];
                const rows = items.map(item => headers.map(h => {
                    const val = item[h];
                    if (Array.isArray(val)) return JSON.stringify(val);
                    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                    return val || '';
                }));
                const values = [headers, ...rows];

                await gapi.client.sheets.spreadsheets.values.clear({
                    spreadsheetId: this.SHEET_ID,
                    range: this.SHEET_NAMES[key],
                });

                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: this.SHEET_ID,
                    range: `${this.SHEET_NAMES[key]}!A1`,
                    valueInputOption: 'RAW',
                    resource: { values },
                });
            }

            const counts = Object.keys(this.SHEET_NAMES).map(k => `${(data[k]||[]).length} ${k}`).join(', ');
            this.setStatus(`${this._t('syncPushed', 'Pushed')}: ${counts}`, 'success');
        } catch (e) {
            this.setStatus(this._t('syncError', 'Error') + ': ' + this._getErrorMessage(e), 'error');
            console.error('Push error:', e);
        } finally {
            syncBtn.classList.remove('syncing');
        }
    },

    async pullAll() {
        if (!(await this._ensureGapiReady())) return;
        if (!this.SHEET_ID) { this.setStatus(this._t('syncNeedSheetId', 'Set Sheet ID'), 'error'); return; }

        const syncBtn = document.getElementById('sync-btn');
        syncBtn.classList.add('syncing');

        try {
            const result = {};

            for (const [key, headers] of Object.entries(this.HEADERS)) {
                const response = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: this.SHEET_ID,
                    range: this.SHEET_NAMES[key],
                });

                const rows = response.result.values || [];
                if (rows.length <= 1) { result[key] = []; continue; }

                const sheetHeaders = rows[0];
                result[key] = rows.slice(1).map(row => {
                    const obj = {};
                    sheetHeaders.forEach((h, i) => {
                        // Sheets may return numbers/booleans natively — coerce to string
                        // BEFORE any .startsWith / comparison to avoid runtime crashes.
                        let raw = row[i];
                        if (raw === undefined || raw === null) raw = '';
                        let val = typeof raw === 'string' ? raw : String(raw);
                        if (val.length && (val.charAt(0) === '[' || val.charAt(0) === '{')) {
                            try { val = JSON.parse(val); } catch(e) {}
                        }
                        if (val === 'TRUE' || val === 'true') val = true;
                        else if (val === 'FALSE' || val === 'false') val = false;
                        if (['hours', 'hoursLogged', 'rate', 'fixedPrice'].includes(h) && val !== '' && typeof val !== 'boolean') {
                            val = parseFloat(val) || 0;
                        }
                        // Keep empty strings for `updated` / `created` so merge still sees them
                        // as defined (mergeAll handles missing-updated via fallback to created).
                        if (val !== '' || h === 'updated' || h === 'created') obj[h] = val;
                    });
                    return obj;
                }).filter(obj => obj.id);
            }

            // Timestamp-aware merge: remote wins only where its `updated` is newer.
            // Previously this called replaceAll, which wiped local edits that hadn't
            // been pushed yet and stripped merge metadata.
            const counts = Store.mergeAll ? Store.mergeAll(result) : (Store.replaceAll(result), null);
            const summary = counts
                ? `+${counts.added} / \u21BB${counts.updated} / =${counts.unchanged}`
                : Object.keys(this.SHEET_NAMES).map(k => `${(result[k]||[]).length} ${k}`).join(', ');
            this.setStatus(`${this._t('syncPulled', 'Pulled')}: ${summary}`, 'success');

            // Decoupled: emit an event, let the app decide how to re-render.
            document.dispatchEvent(new CustomEvent('ordify:synced', { detail: { counts } }));
        } catch (e) {
            this.setStatus(this._t('syncError', 'Error') + ': ' + this._getErrorMessage(e), 'error');
            console.error('Pull error:', e);
        } finally {
            syncBtn.classList.remove('syncing');
        }
    },
};

SheetsSync.init();
