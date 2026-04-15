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

    HEADERS: {
        clients: ['id', 'name', 'email', 'telegram', 'companies', 'notes', 'created'],
        projects: ['id', 'clientId', 'name', 'company', 'projectType', 'jurisdiction', 'status', 'pricingType', 'rate', 'fixedPrice', 'deadline', 'notes', 'created'],
        tasks: ['id', 'projectId', 'clientId', 'company', 'title', 'status', 'priority', 'deadline', 'isProcedural', 'tags', 'hoursLogged', 'notes', 'created'],
        tags: ['id', 'name', 'color'],
        timeLogs: ['id', 'taskId', 'hours', 'description', 'date'],
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

    async authorize() {
        if (!this.CLIENT_ID) {
            this.setStatus('Укажите Client ID в настройках', 'error');
            return;
        }

        this.setStatus('Загрузка Google API...');
        await this._ensureLoaded();

        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (response) => {
                if (response.error) {
                    this.setStatus('Ошибка авторизации: ' + response.error, 'error');
                    return;
                }
                this.isAuthorized = true;
                this.setStatus('Подключено к Google!', 'success');
                this.loadGapi();
            },
        });

        this.tokenClient.requestAccessToken();
    },

    loadGapi() {
        gapi.load('client', async () => {
            await gapi.client.init({});
            await gapi.client.load('sheets', 'v4');
            this.setStatus('Google Sheets API готов', 'success');
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
            this.setStatus('Сначала подключите Google (Connect Google)', 'error');
            return false;
        }
        if (!window.gapi?.client?.sheets) {
            this.setStatus('Google Sheets API загружается...', 'info');
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
                this.setStatus('Не удалось загрузить Google Sheets API: ' + this._getErrorMessage(e), 'error');
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
                this.setStatus('Создана новая таблица', 'success');
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
            this.setStatus(`Выгружено: ${counts}`, 'success');
        } catch (e) {
            this.setStatus('Ошибка: ' + this._getErrorMessage(e), 'error');
            console.error('Push error:', e);
        } finally {
            syncBtn.classList.remove('syncing');
        }
    },

    async pullAll() {
        if (!(await this._ensureGapiReady())) return;
        if (!this.SHEET_ID) { this.setStatus('Укажите ID таблицы', 'error'); return; }

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
                        let val = row[i] || '';
                        if (val.startsWith('[')) {
                            try { val = JSON.parse(val); } catch(e) {}
                        }
                        if (val === 'TRUE') val = true;
                        if (val === 'FALSE') val = false;
                        if (['hours', 'hoursLogged', 'rate', 'fixedPrice'].includes(h) && val !== '') {
                            val = parseFloat(val) || 0;
                        }
                        if (val !== '') obj[h] = val;
                    });
                    return obj;
                }).filter(obj => obj.id);
            }

            Store.replaceAll(result);
            const counts = Object.keys(this.SHEET_NAMES).map(k => `${(result[k]||[]).length} ${k}`).join(', ');
            this.setStatus(`Загружено: ${counts}`, 'success');

            App.renderSidebar();
            App.showDashboard();
        } catch (e) {
            this.setStatus('Ошибка: ' + this._getErrorMessage(e), 'error');
            console.error('Pull error:', e);
        } finally {
            syncBtn.classList.remove('syncing');
        }
    },
};

SheetsSync.init();
