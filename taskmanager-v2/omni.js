/* ordify · omni-input + AI parser + Web Speech dictation
 * Single intelligent input: type or dictate → Claude proposes actions → user accepts.
 * Depends on globals from app.js: state, Store, $, $$, esc, uuid, todayISO,
 *   clientById, matterById, taskById, matterRate, profileCurrency, audit, toast,
 *   render, navigate, fmtDate, fmtMinutes
 */
'use strict';

/* =========================================================================
 * 1. OMNI STATE & MOUNT
 * ========================================================================= */

const Omni = {
    el: null,
    input: null,
    micBtn: null,
    aiBtn: null,
    panel: null,
    busy: false,
    proposals: [],   // [{ op, data, summary, accepted }]
    listening: false,

    init() {
        Omni.el     = $('#omni');
        Omni.input  = $('#omni-input');
        Omni.micBtn = $('#omni-mic');
        Omni.aiBtn  = $('#omni-ai');
        Omni.panel  = $('#omni-panel');

        Omni.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.metaKey || e.ctrlKey || Omni._looksLikeNL(Omni.input.value)) {
                    Omni.runAI();
                } else {
                    Omni.runSearch();
                }
            } else if (e.key === 'Escape') {
                Omni.clear();
            }
        });
        Omni.input.addEventListener('input', () => {
            if (Omni.input.value.trim().length >= 2) Omni._renderSearchHints();
            else Omni.panel.hidden = true;
        });
        Omni.aiBtn.addEventListener('click', () => Omni.runAI());
        Omni.micBtn.addEventListener('click', () => Recorder.toggle());

        // global ⌘K / Ctrl+K
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                Omni.input.focus();
                Omni.input.select();
            }
        });

        // close panel on outside click
        document.addEventListener('click', (e) => {
            if (!Omni.el.contains(e.target) && !Omni.panel.contains(e.target)) {
                Omni.panel.hidden = true;
            }
        });
    },

    clear() {
        Omni.input.value = '';
        Omni.proposals = [];
        Omni.panel.hidden = true;
        Omni.panel.innerHTML = '';
    },

    _looksLikeNL(s) {
        // crude: more than 4 words OR contains a verb-ish phrase OR ends with .?!
        const words = s.trim().split(/\s+/);
        if (words.length > 4) return true;
        if (/[.?!]\s*$/.test(s)) return true;
        return false;
    },

    /* ---- search hints ---- */
    runSearch() {
        const q = Omni.input.value.trim().toLowerCase();
        if (!q) return;
        const results = Omni._search(q);
        if (results.length) { navigate(results[0].path); Omni.clear(); }
        else toast('No matches');
    },

    _search(q) {
        const out = [];
        state.clients.filter(c => !c.deletedAt).forEach(c => {
            if ((c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q))
                out.push({ kind: 'client', label: c.name, sub: c.email||'', path: 'clients/'+c.id });
        });
        state.matters.filter(m => !m.deletedAt).forEach(m => {
            if ((m.title||'').toLowerCase().includes(q))
                out.push({ kind: 'matter', label: m.title, sub: clientById(m.clientId)?.name||'', path: 'matters/'+m.id });
        });
        state.tasks.filter(t => !t.deletedAt).forEach(t => {
            if ((t.title||'').toLowerCase().includes(q))
                out.push({ kind: 'task', label: t.title, sub: matterById(t.matterId)?.title||'', path: 'tasks' });
        });
        state.invoices.filter(i => !i.deletedAt).forEach(i => {
            if ((i.number||'').toLowerCase().includes(q))
                out.push({ kind: 'invoice', label: i.number, sub: clientById(i.clientId)?.name||'', path: 'invoices/'+i.id });
        });
        return out.slice(0, 12);
    },

    _renderSearchHints() {
        const q = Omni.input.value.trim().toLowerCase();
        if (!q) { Omni.panel.hidden = true; return; }
        const results = Omni._search(q);
        const isNL = Omni._looksLikeNL(Omni.input.value);
        Omni.panel.innerHTML = `
            <div class="omni-hint">
                ${isNL
                    ? `Press <kbd>Enter</kbd> to ask AI · <kbd>Esc</kbd> to clear`
                    : `<kbd>Enter</kbd> to jump · <kbd>⌘+Enter</kbd> to ask AI`}
            </div>
            ${results.length ? `<ul class="omni-results">${results.map((r,i) => `
                <li class="omni-row" data-go="${esc(r.path)}">
                    <span class="kind">${esc(r.kind)}</span>
                    <span class="lbl">${esc(r.label)}</span>
                    <span class="sub">${esc(r.sub)}</span>
                </li>
            `).join('')}</ul>` : ''}
        `;
        Omni.panel.hidden = false;
        $$('.omni-row', Omni.panel).forEach(li => {
            li.addEventListener('click', () => { navigate(li.dataset.go); Omni.clear(); });
        });
    },

    /* ---- AI parse ---- */
    async runAI() {
        const text = Omni.input.value.trim();
        if (!text) return;
        if (!state.profile.anthropicKey) {
            Omni._renderError(`Add your Anthropic API key in Settings to use AI parsing. <a href="#/settings">Open settings →</a>`);
            return;
        }
        if (Omni.busy) return;
        Omni.busy = true;
        Omni._renderLoading();
        try {
            const result = await AI.parseInput(text);
            Omni.proposals = (result.actions || []).map(a => ({ ...a, accepted: false }));
            Omni._renderProposals(result);
        } catch (e) {
            console.error('AI parse failed', e);
            Omni._renderError('AI request failed: ' + esc(e.message));
        } finally {
            Omni.busy = false;
        }
    },

    _renderLoading() {
        Omni.panel.innerHTML = `<div class="omni-loading"><span class="spinner"></span> Asking Claude…</div>`;
        Omni.panel.hidden = false;
    },

    _renderError(msg) {
        Omni.panel.innerHTML = `<div class="omni-error">${msg}</div>`;
        Omni.panel.hidden = false;
    },

    _renderProposals(result) {
        if (result.clarify) {
            Omni.panel.innerHTML = `
                <div class="omni-clarify">
                    <strong>Need clarification</strong>
                    <p>${esc(result.clarify)}</p>
                </div>`;
            Omni.panel.hidden = false;
            return;
        }
        if (!Omni.proposals.length) {
            Omni.panel.innerHTML = `<div class="omni-error">Claude couldn't extract any actions. Try rephrasing.</div>`;
            Omni.panel.hidden = false;
            return;
        }
        Omni.panel.innerHTML = `
            <div class="omni-head">
                <strong>${Omni.proposals.length} proposed action${Omni.proposals.length===1?'':'s'}</strong>
                <span class="grow"></span>
                <button class="btn sm" data-omni="accept-all">Accept all</button>
                <button class="btn sm ghost" data-omni="discard">Discard</button>
            </div>
            <ul class="omni-proposals">
                ${Omni.proposals.map((p, i) => `
                    <li class="proposal" data-i="${i}">
                        <div class="op-tag op-${esc(p.op)}">${esc(Omni._opLabel(p.op))}</div>
                        <div class="op-summary">${esc(p.summary || Omni._defaultSummary(p))}</div>
                        ${p.reason ? `<div class="op-reason">${esc(p.reason)}</div>` : ''}
                        <div class="op-actions">
                            <button class="btn sm primary" data-omni="accept" data-i="${i}">Accept</button>
                            <button class="btn sm ghost" data-omni="skip" data-i="${i}">Skip</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
            ${result.transcript ? `<details class="omni-transcript"><summary>Source transcript</summary><div>${esc(result.transcript)}</div></details>` : ''}
        `;
        Omni.panel.hidden = false;
        Omni.panel.querySelectorAll('[data-omni]').forEach(b => {
            b.addEventListener('click', () => Omni._handleProposalAction(b.dataset.omni, b.dataset.i));
        });
    },

    _handleProposalAction(action, idx) {
        if (action === 'discard') { Omni.clear(); return; }
        if (action === 'accept-all') {
            Omni.proposals.forEach((p,i) => Omni._applyProposal(i));
            toast(`Applied ${Omni.proposals.length} action${Omni.proposals.length===1?'':'s'}`);
            Omni.clear();
            render();
            return;
        }
        if (action === 'accept') {
            Omni._applyProposal(Number(idx));
            // mark visually
            const li = Omni.panel.querySelector(`.proposal[data-i="${idx}"]`);
            if (li) li.classList.add('done');
            render();
            return;
        }
        if (action === 'skip') {
            const li = Omni.panel.querySelector(`.proposal[data-i="${idx}"]`);
            if (li) li.classList.add('skipped');
        }
    },

    _applyProposal(i) {
        const p = Omni.proposals[i];
        if (!p || p.accepted) return;
        try {
            AI.applyAction(p);
            p.accepted = true;
        } catch (e) {
            console.error('apply failed', e);
            toast('Failed: ' + e.message, 'error');
        }
    },

    _opLabel(op) {
        return ({
            createClient: 'New client',
            updateClient: 'Update client',
            createMatter: 'New matter',
            updateMatter: 'Update matter',
            createTask:   'New task',
            updateTask:   'Update task',
            completeTask: 'Complete task',
            logTime:      'Log time',
            createInvoice:'New invoice'
        })[op] || op;
    },

    _defaultSummary(p) {
        const d = p.data || {};
        switch (p.op) {
            case 'createClient':  return d.name || '—';
            case 'createMatter':  return `${d.title || '—'} for ${d.clientName || d.clientId || '?'}`;
            case 'createTask':    return `${d.title || '—'}${d.due?` · due ${d.due}`:''}`;
            case 'logTime':       return `${d.minutes || 0} min on ${d.matterName || d.matterId || '?'}`;
            case 'createInvoice': return `Invoice for ${d.matterName || d.matterId || '?'}`;
            case 'completeTask':  return `Done: ${d.taskTitle || d.taskId || '?'}`;
            default:              return JSON.stringify(d).slice(0, 120);
        }
    }
};

/* =========================================================================
 * 2. AI — Claude API client + action applier
 * ========================================================================= */

const AI = {
    SYSTEM_PROMPT: `You are an action-extraction assistant for "ordify", a practice manager for solo lawyers.

The user types or dictates in English, Russian, or Ukrainian. Your job is to read their input and output a JSON list of structured actions to perform on the data model.

DATA MODEL:
- Client: { name, email?, phone?, taxId?, address?, notes? }
- Matter: { clientId or clientName, title, status: "open"|"on-hold"|"closed", rate?, description? }
- Task:   { matterId or matterName, title, due? (ISO date YYYY-MM-DD), priority: "low"|"normal"|"high", notes? }
- TimeLog:{ matterId or matterName, date (ISO YYYY-MM-DD), minutes, notes? }
- Invoice:{ matterId or matterName, dateIssued (ISO), dateDue?, notes? }

ALLOWED ACTIONS (op values):
- "createClient"  data: Client fields
- "createMatter"  data: Matter fields (use clientName if client doesn't yet exist)
- "createTask"    data: Task fields
- "completeTask"  data: { taskId or taskTitle }
- "logTime"       data: TimeLog fields
- "createInvoice" data: Invoice fields

OUTPUT RULES:
- Output ONLY valid JSON: { "actions": [...], "transcript"?: "...", "clarify"?: "..." }
- ALL data field values MUST be in English, even if the user spoke Russian/Ukrainian. Translate proper nouns conservatively (keep names like "Іван Шевченко" → "Ivan Shevchenko").
- Each action MUST include a "summary" field — one short English sentence describing what will happen.
- If the user references a client/matter that exists in CONTEXT below, use its id (e.g. "matterId": "id-abc"). Otherwise use a name field (clientName, matterName) and order actions so creates come first.
- If user input is ambiguous (e.g. "log time on the contract" but multiple matters match), return { "clarify": "question" } instead of guessing.
- Dates must be ISO YYYY-MM-DD. Resolve relative dates ("tomorrow", "next Friday", "завтра") against TODAY.
- For dictated free-form text, also include a "transcript" field with the cleaned-up source text.
- Do NOT invent emails, phone numbers, or tax IDs — only include them if explicit in input.
- If nothing actionable, return { "actions": [], "clarify": "What would you like to do?" }.
- Never wrap the JSON in markdown fences. Output raw JSON.`,

    async parseInput(text) {
        const ctx = AI._buildContext();
        const userMsg = `TODAY: ${todayISO()}

CONTEXT:
${ctx}

USER INPUT:
${text}`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': state.profile.anthropicKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: state.profile.anthropicModel || 'claude-3-5-haiku-latest',
                max_tokens: 1500,
                system: AI.SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userMsg }]
            })
        });
        if (!res.ok) {
            const err = await res.text().catch(()=>'');
            throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
        }
        const json = await res.json();
        const content = json.content?.[0]?.text || '';
        let parsed;
        try {
            // strip code fences if present
            const cleaned = content.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            throw new Error('AI returned non-JSON response: ' + content.slice(0, 200));
        }
        return parsed;
    },

    _buildContext() {
        const clients = state.clients.filter(c => !c.deletedAt).slice(0, 50)
            .map(c => `- client "${c.id}": ${c.name}`).join('\n');
        const matters = state.matters.filter(m => !m.deletedAt).slice(0, 60)
            .map(m => `- matter "${m.id}": ${m.title} (client: ${clientById(m.clientId)?.name||'?'})`).join('\n');
        const openTasks = state.tasks.filter(t => !t.deletedAt && t.status !== 'done').slice(0, 40)
            .map(t => `- task "${t.id}": ${t.title}`).join('\n');
        return [clients, matters, openTasks].filter(Boolean).join('\n') || '(no records yet)';
    },

    /* ---- Action appliers ---- */

    applyAction(p) {
        const handlers = {
            createClient:  AI._applyCreateClient,
            updateClient:  AI._applyUpdateClient,
            createMatter:  AI._applyCreateMatter,
            updateMatter:  AI._applyUpdateMatter,
            createTask:    AI._applyCreateTask,
            updateTask:    AI._applyUpdateTask,
            completeTask:  AI._applyCompleteTask,
            logTime:       AI._applyLogTime,
            createInvoice: AI._applyCreateInvoice
        };
        const h = handlers[p.op];
        if (!h) throw new Error('Unknown op: ' + p.op);
        h(p.data || {});
        Store.save();
    },

    _resolveClient(d) {
        if (d.clientId) return clientById(d.clientId);
        if (d.clientName) {
            const found = state.clients.find(c => !c.deletedAt && c.name?.toLowerCase() === d.clientName.toLowerCase());
            if (found) return found;
            // create on the fly
            const c = {
                id: uuid(), name: d.clientName, createdAt: new Date().toISOString()
            };
            state.clients.push(c);
            audit('createClient', c.id, `auto-created "${c.name}" via AI`);
            return c;
        }
        return null;
    },

    _resolveMatter(d) {
        if (d.matterId) return matterById(d.matterId);
        if (d.matterName) {
            const found = state.matters.find(m => !m.deletedAt && m.title?.toLowerCase() === d.matterName.toLowerCase());
            if (found) return found;
        }
        return null;
    },

    _applyCreateClient(d) {
        const c = {
            id: uuid(),
            name: d.name || 'Unnamed client',
            email: d.email || '', phone: d.phone || '',
            address: d.address || '', taxId: d.taxId || '',
            notes: d.notes || '',
            createdAt: new Date().toISOString()
        };
        state.clients.push(c);
        audit('createClient', c.id, c.name);
    },

    _applyUpdateClient(d) {
        const c = clientById(d.clientId) || state.clients.find(x => !x.deletedAt && x.name?.toLowerCase() === (d.name||'').toLowerCase());
        if (!c) throw new Error('Client not found');
        Object.assign(c, d);
        audit('updateClient', c.id, c.name);
    },

    _applyCreateMatter(d) {
        const c = AI._resolveClient(d);
        if (!c) throw new Error('Client missing for matter');
        const m = {
            id: uuid(),
            clientId: c.id,
            title: d.title || 'Untitled matter',
            status: d.status || 'open',
            rate: d.rate ?? null,
            description: d.description || '',
            openedAt: new Date().toISOString()
        };
        state.matters.push(m);
        audit('createMatter', m.id, `${m.title} (${c.name})`);
    },

    _applyUpdateMatter(d) {
        const m = AI._resolveMatter(d);
        if (!m) throw new Error('Matter not found');
        Object.assign(m, d);
        audit('updateMatter', m.id, m.title);
    },

    _applyCreateTask(d) {
        const m = AI._resolveMatter(d);
        const t = {
            id: uuid(),
            matterId: m?.id || null,
            clientId: m?.clientId || null,
            title: d.title || 'Untitled task',
            due: d.due || null,
            priority: d.priority || 'normal',
            notes: d.notes || '',
            status: 'todo',
            createdAt: new Date().toISOString()
        };
        state.tasks.push(t);
        audit('createTask', t.id, t.title);
    },

    _applyUpdateTask(d) {
        const t = (d.taskId && taskById(d.taskId)) || state.tasks.find(x => !x.deletedAt && x.title?.toLowerCase() === (d.taskTitle||'').toLowerCase());
        if (!t) throw new Error('Task not found');
        Object.assign(t, d);
        audit('updateTask', t.id, t.title);
    },

    _applyCompleteTask(d) {
        const t = (d.taskId && taskById(d.taskId)) || state.tasks.find(x => !x.deletedAt && x.title?.toLowerCase() === (d.taskTitle||'').toLowerCase());
        if (!t) throw new Error('Task not found');
        t.status = 'done';
        t.completedAt = new Date().toISOString();
        audit('completeTask', t.id, t.title);
    },

    _applyLogTime(d) {
        const m = AI._resolveMatter(d);
        if (!m) throw new Error('Matter not found for time log');
        const date = d.date || todayISO();
        const startedAt = new Date(date + 'T09:00:00').toISOString();
        const minutes = Number(d.minutes) || 0;
        if (minutes < 1) throw new Error('Minutes must be ≥ 1');
        const log = {
            id: uuid(),
            taskId: null,
            matterId: m.id,
            clientId: m.clientId,
            startedAt,
            endedAt: new Date(new Date(startedAt).getTime() + minutes * 60000).toISOString(),
            minutes,
            notes: d.notes || '',
            invoiceId: null
        };
        state.logs.push(log);
        audit('logTime', log.id, `${minutes}m on ${m.title}`);
    },

    _applyCreateInvoice(d) {
        const m = AI._resolveMatter(d);
        if (!m) throw new Error('Matter not found for invoice');
        const unbilled = state.logs.filter(l => l.matterId === m.id && !l.invoiceId);
        if (!unbilled.length) throw new Error('No unbilled time on this matter');
        const rate = matterRate(m);
        const items = unbilled.map(l => {
            const hours = +(l.minutes / 60).toFixed(2);
            return {
                description: `${fmtDate(l.startedAt)}${l.notes?' — '+l.notes:''}`,
                hours, rate, amount: +(hours * rate).toFixed(2)
            };
        });
        const number = state.profile.invoiceNumberPrefix + String(state.profile.invoiceNumberCounter).padStart(4, '0');
        const inv = {
            id: uuid(), number,
            clientId: m.clientId, matterId: m.id,
            dateIssued: d.dateIssued || todayISO(),
            dateDue: d.dateDue || null,
            currency: profileCurrency(),
            items, notes: d.notes || '', status: 'draft'
        };
        state.invoices.push(inv);
        state.profile.invoiceNumberCounter += 1;
        unbilled.forEach(l => l.invoiceId = inv.id);
        audit('createInvoice', inv.id, `${number} (${m.title})`);
    }
};

/* =========================================================================
 * 3. RECORDER — Web Speech API dictation
 * ========================================================================= */

const Recorder = {
    rec: null,           // SpeechRecognition instance
    media: null,         // MediaRecorder instance (audio capture)
    stream: null,        // MediaStream (for stop)
    chunks: [],          // audio data chunks
    listening: false,
    finalText: '',
    interimText: '',
    startedAt: null,

    supported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    },

    canRecordAudio() {
        return !!(navigator.mediaDevices && window.MediaRecorder);
    },

    toggle() {
        if (Recorder.listening) Recorder.stop();
        else Recorder.start();
    },

    async start() {
        if (!Recorder.supported() && !Recorder.canRecordAudio()) {
            toast('Voice input not supported in this browser. Use Chrome or Edge.', 'error');
            return;
        }

        // Acquire mic for both speech recognition AND raw audio recording
        let stream = null;
        if (Recorder.canRecordAudio()) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                Recorder.stream = stream;
                const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
                             MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
                const media = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
                Recorder.chunks = [];
                media.ondataavailable = (e) => { if (e.data && e.data.size > 0) Recorder.chunks.push(e.data); };
                media.onstop = async () => {
                    const blob = new Blob(Recorder.chunks, { type: media.mimeType || 'audio/webm' });
                    if (blob.size > 0) {
                        const ctx = Attach._currentContext();
                        const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
                        await Attach.add({
                            blob,
                            name: `dictation-${stamp}.webm`,
                            mime: blob.type,
                            kind: 'audio',
                            ...ctx
                        });
                        // do not toast here; the AI completion toast is more useful
                    }
                };
                media.start();
                Recorder.media = media;
            } catch (e) {
                console.warn('MediaRecorder unavailable', e);
            }
        }

        // Speech recognition for live transcription
        if (Recorder.supported()) {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            const rec = new SR();
            rec.lang = state.profile.dictationLang || 'uk-UA';
            rec.continuous = true;
            rec.interimResults = true;

            Recorder.finalText = '';
            Recorder.interimText = '';
            Recorder.startedAt = Date.now();

            rec.onresult = (e) => {
                let interim = '', final = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const r = e.results[i];
                    if (r.isFinal) final += r[0].transcript + ' ';
                    else interim += r[0].transcript;
                }
                if (final) Recorder.finalText += final;
                Recorder.interimText = interim;
                const combined = (Recorder.finalText + Recorder.interimText).trim();
                Omni.input.value = combined;
            };
            rec.onerror = (e) => {
                console.warn('Speech recognition error', e);
                if (e.error === 'not-allowed') toast('Microphone permission denied', 'error');
                else if (e.error === 'no-speech') {}
                else toast('Recognition error: ' + e.error, 'error');
                Recorder._setListening(false);
            };
            rec.onend = () => {
                Recorder._setListening(false);
                const txt = (Recorder.finalText + Recorder.interimText).trim();
                if (txt) {
                    Omni.input.value = txt;
                    Omni.runAI();
                }
            };
            try {
                rec.start();
                Recorder.rec = rec;
            } catch (err) {
                console.error('rec.start failed', err);
                toast('Could not start recognition: ' + err.message, 'error');
            }
        }

        Recorder._setListening(true);
        Omni.input.focus();
        const lang = state.profile.dictationLang || 'uk-UA';
        toast(`Listening (${lang})…`);
    },

    stop() {
        if (Recorder.rec) {
            try { Recorder.rec.stop(); } catch (e) {}
        }
        if (Recorder.media && Recorder.media.state !== 'inactive') {
            try { Recorder.media.stop(); } catch (e) {}
        }
        if (Recorder.stream) {
            Recorder.stream.getTracks().forEach(t => t.stop());
            Recorder.stream = null;
        }
        Recorder._setListening(false);
    },

    _setListening(v) {
        Recorder.listening = v;
        if (Omni.micBtn) Omni.micBtn.classList.toggle('on', v);
    }
};

/* =========================================================================
 * 4. BOOT
 * ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    // wait until app.js boot has run (state loaded, DOM populated)
    setTimeout(() => {
        Omni.init();
        if (!Recorder.supported() && Omni.micBtn) {
            Omni.micBtn.disabled = true;
            Omni.micBtn.title = 'Voice input requires Chrome or Edge';
        }
    }, 50);
});
