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
    attachBtn: null,
    panel: null,
    busy: false,
    proposals: [],   // [{ op, data, summary, accepted }]
    listening: false,

    init() {
        Omni.el        = $('#omni');
        Omni.input     = $('#omni-input');
        Omni.micBtn    = $('#omni-mic');
        Omni.aiBtn     = $('#omni-ai');
        Omni.attachBtn = $('#omni-attach');
        Omni.panel     = $('#omni-panel');

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
        if (Omni.attachBtn) Omni.attachBtn.addEventListener('click', () => Omni.attach());

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
        if (results.length) { Omni._go(results[0]); Omni.clear(); }
        else toast('No matches');
    },

    /* Tasks have no page of their own — land on Today and open the task. */
    _go({ path, taskId }) {
        navigate(path);
        if (taskId) setTimeout(() => openTaskForm(taskId), 0);
    },

    _search(q) {
        const out = [];
        state.clients.filter(c => !c.deletedAt).forEach(c => {
            if ((c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q))
                out.push({ kind: 'client', label: c.name, sub: c.email||'', path: 'clients/'+c.id });
        });
        state.matters.filter(m => !m.deletedAt).forEach(m => {
            if ((m.title||'').toLowerCase().includes(q))
                out.push({ kind: 'project', label: m.title, sub: clientById(m.clientId)?.name||'', path: 'matters/'+m.id });
        });
        state.tasks.filter(t => !t.deletedAt).forEach(t => {
            if ((t.title||'').toLowerCase().includes(q))
                out.push({ kind: 'task', label: t.title, sub: matterById(t.matterId)?.title||'',
                           path: 'today', taskId: t.id });
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
                <li class="omni-row" data-go="${esc(r.path)}" data-task="${esc(r.taskId || '')}">
                    <span class="kind">${esc(r.kind)}</span>
                    <span class="lbl">${esc(r.label)}</span>
                    <span class="sub">${esc(r.sub)}</span>
                </li>
            `).join('')}</ul>` : ''}
        `;
        Omni.panel.hidden = false;
        $$('.omni-row', Omni.panel).forEach(li => {
            li.addEventListener('click', () => {
                Omni._go({ path: li.dataset.go, taskId: li.dataset.task || null });
                Omni.clear();
            });
        });
    },

    /* ---- attach a file (document / image) → AI extracts actions ---- */
    attach() {
        if (!state.profile.anthropicKey) {
            Omni._renderError('Add your Anthropic API key in Settings to use file attachments. <a href="#/settings">Open settings →</a>');
            return;
        }
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.docx,application/pdf,image/*,text/plain,audio/*,video/*';
        inp.onchange = async () => {
            const f = inp.files && inp.files[0];
            if (!f) return;
            if (Omni.busy) return;
            Omni.busy = true;
            Omni.input.value = '📎 ' + f.name;
            Omni._renderLoading();
            try {
                const result = await AI.parseFile(f);
                Omni.proposals = (result.actions || []).map(a => ({ ...a, accepted: false }));
                Omni._renderProposals(result);
            } catch (e) {
                console.error('attach parse failed', e);
                Omni._renderError('AI request failed: ' + esc(e.message || 'error'));
            } finally {
                Omni.busy = false;
            }
        };
        inp.click();
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
                        ${Omni._gapPickerHtml(p, i)}
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
        // matter picker → repopulate the dependent task picker
        Omni.panel.querySelectorAll('select[data-gap="matter"]').forEach(sel => {
            sel.addEventListener('change', () => {
                const taskSel = Omni.panel.querySelector(`select[data-gap="task"][data-i="${sel.dataset.i}"]`);
                if (!taskSel) return;
                if (!sel.value || sel.value === '__new__') {
                    taskSel.innerHTML = '<option value="">— no specific task —</option>';
                    taskSel.disabled = true;
                } else {
                    taskSel.innerHTML = Omni._taskOptionsHtml(sel.value);
                    taskSel.disabled = false;
                }
            });
        });
    },

    _handleProposalAction(action, idx) {
        if (action === 'discard') { Omni.clear(); return; }
        if (action === 'accept-all') {
            let ok = 0;
            Omni.proposals.forEach((p, i) => { if (Omni._applyProposal(i)) ok++; });
            render();
            if (ok) toast(`Applied ${ok} action${ok === 1 ? '' : 's'}`);
            if (ok === Omni.proposals.length) {
                Omni.clear();
            } else {
                // some failed — reflect state, keep panel open for retry
                Omni.proposals.forEach((p, i) => {
                    if (p.accepted) {
                        const li = Omni.panel.querySelector(`.proposal[data-i="${i}"]`);
                        if (li) li.classList.add('done');
                    }
                });
            }
            return;
        }
        if (action === 'accept') {
            const ok = Omni._applyProposal(Number(idx));
            if (ok) {
                const li = Omni.panel.querySelector(`.proposal[data-i="${idx}"]`);
                if (li) li.classList.add('done');
                render();
            }
            return;
        }
        if (action === 'skip') {
            const li = Omni.panel.querySelector(`.proposal[data-i="${idx}"]`);
            if (li) li.classList.add('skipped');
        }
    },

    _applyProposal(i) {
        const p = Omni.proposals[i];
        if (!p || p.accepted) return false;

        // Resolve any inline gap pickers (matter / task) before applying.
        if (Omni._gapsFor(p).includes('matter')) {
            const li = Omni.panel.querySelector(`.proposal[data-i="${i}"]`);
            const mSel = li && li.querySelector('select[data-gap="matter"]');
            const tSel = li && li.querySelector('select[data-gap="task"]');
            if (!mSel || !mSel.value) {
                toast('Pick a project first', 'error');
                return false;
            }
            if (mSel.value === '__new__') {
                const title = (prompt('New project name:', 'General') || '').trim();
                if (!title) return false;
                p.data.matterName = title;
                delete p.data.matterId;
            } else {
                p.data.matterId = mSel.value;
                delete p.data.matterName;
            }
            p.data.taskId = (tSel && tSel.value) ? tSel.value : null;
        }

        try {
            AI.applyAction(p);
            p.accepted = true;
            return true;
        } catch (e) {
            console.error('apply failed', e);
            toast('Failed: ' + e.message, 'error');
            return false;
        }
    },

    _opLabel(op) {
        return ({
            createClient: 'New client',
            updateClient: 'Update client',
            createMatter: 'New project',
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
            case 'logTime':       return `${d.minutes || 0} min${d.clientName?' · '+d.clientName:''}`;
            case 'createInvoice': return `Invoice for ${d.matterName || d.matterId || '?'}`;
            case 'completeTask':  return `Done: ${d.taskTitle || d.taskId || '?'}`;
            default:              return JSON.stringify(d).slice(0, 120);
        }
    },

    /* Which required fields a proposal still needs the user to pick. */
    _gapsFor(p) {
        const gaps = [];
        if (p.op === 'logTime' && !p.accepted) {
            const d = p.data || {};
            const hasMatter =
                (d.matterId && matterById(d.matterId)) ||
                (d.matterName && state.matters.find(m =>
                    !m.deletedAt && m.title && m.title.toLowerCase() === d.matterName.toLowerCase()));
            if (!hasMatter) gaps.push('matter');
        }
        return gaps;
    },

    _taskOptionsHtml(matterId) {
        let opts = '<option value="">— no specific task —</option>';
        if (matterId && matterId !== '__new__') {
            const tasks = state.tasks.filter(t =>
                !t.deletedAt && t.matterId === matterId && t.status !== 'done');
            opts += tasks.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
        }
        return opts;
    },

    /* Inline matter + task pickers shown inside a proposal that has a gap. */
    _gapPickerHtml(p, i) {
        if (!Omni._gapsFor(p).includes('matter')) return '';
        const d = p.data || {};
        let client = d.clientId ? clientById(d.clientId) : null;
        if (!client && d.clientName) {
            client = state.clients.find(c =>
                !c.deletedAt && c.name && c.name.toLowerCase() === d.clientName.toLowerCase());
        }
        const matters = client
            ? state.matters.filter(m => !m.deletedAt && m.clientId === client.id)
            : [];
        const matterOpts = matters.map((m, idx) =>
            `<option value="${esc(m.id)}" ${idx === 0 ? 'selected' : ''}>${esc(m.title)}</option>`).join('');
        const newSelected = matters.length ? '' : 'selected';
        const firstId = matters.length ? matters[0].id : '';
        return `
            <div class="op-gap">
                <label>Matter
                    <select data-gap="matter" data-i="${i}">
                        ${matterOpts}
                        <option value="__new__" ${newSelected}>＋ New project…</option>
                    </select>
                </label>
                <label>Task
                    <select data-gap="task" data-i="${i}" ${matters.length ? '' : 'disabled'}>
                        ${Omni._taskOptionsHtml(firstId)}
                    </select>
                </label>
                ${!client ? `<div class="op-gap-note">New client “${esc(d.clientName || '?')}” will be created.</div>` : ''}
            </div>`;
    }
};

/* =========================================================================
 * 2. AI — Claude API client + action applier
 * ========================================================================= */

const AI = {
    /* Ask Anthropic which models this key can use, rather than shipping a
     * hardcoded list that rots — models retire on Anthropic's schedule and a
     * dropdown offering a dead one turns a 404 into a hunt for a bug that
     * isn't there. Returns [] on any failure so Settings falls back quietly. */
    async listModels() {
        if (!state.profile.anthropicKey) return [];
        try {
            const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
                headers: {
                    'x-api-key': state.profile.anthropicKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            });
            if (!res.ok) return [];
            const data = await res.json();
            return (data.data || [])
                .map(m => ({ id: m.id, name: m.display_name || m.id }))
                .filter(m => m.id);
        } catch (e) {
            console.warn('Anthropic model list unavailable', e);
            return [];
        }
    },

    /* Turn an HTTP failure into something the user can act on. A retired
     * model is the likeliest cause of a 404 here and the fix is one dropdown
     * away. */
    _httpError(status, body, model) {
        if (status === 404) {
            return new Error(`Model "${model}" no longer exists. Pick another in Settings.`);
        }
        if (status === 401 || status === 403) {
            return new Error('Anthropic rejected the API key. Check it in Settings.');
        }
        if (status === 429) {
            return new Error('Rate limited by Anthropic — try again in a moment.');
        }
        if (status >= 500) {
            return new Error(`Anthropic is having trouble (HTTP ${status}) — try again shortly.`);
        }
        return new Error(`HTTP ${status}: ${String(body).slice(0, 200)}`);
    },

    SYSTEM_PROMPT: `You are an action-extraction assistant for "ordify", a practice manager for solo lawyers.

The user types or dictates in English, Russian, or Ukrainian. Your job is to read their input and output a JSON list of structured actions to perform on the data model.

DATA MODEL:
- Client: { name, email?, phone?, taxId?, address?, notes? }
- Matter: { clientId or clientName, title, status: "open"|"on-hold"|"closed", rate?, description? }
- Task:   { matterId or matterName, title, due? (ISO date YYYY-MM-DD), priority: "low"|"normal"|"high", assigneeEmail? (only if the user explicitly delegates to a person), notes? }
- TimeLog:{ matterId or matterName (optional — omit if unknown), date (ISO YYYY-MM-DD), minutes, notes? }
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
- Use { "clarify": "question" } ONLY when you genuinely cannot tell what the user wants. Do NOT use clarify just because a matter or task is unknown.
- For "logTime": ALWAYS return the logTime action with whatever you know (clientName or clientId, minutes, date, notes). If the matter is unknown, simply omit matterId/matterName — the app will ask the user to pick the matter and task. Never block a time log on a missing matter.
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

        const model = state.profile.anthropicModel || 'claude-opus-4-8';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': state.profile.anthropicKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model,
                max_tokens: 1500,
                system: AI.SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userMsg }]
            })
        });
        if (!res.ok) {
            const err = await res.text().catch(()=>'');
            throw AI._httpError(res.status, err, model);
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

    /* Send a file (docx / PDF / image / txt) to Claude and return the same
     * { actions, transcript?, clarify? } shape as parseInput. */
    async parseFile(file) {
        const today = todayISO();
        const ctx = AI._buildContext();
        const name = (file.name || '').toLowerCase();
        const intro = `TODAY: ${today}\n\nCONTEXT:\n${ctx}\n\nUSER INPUT (from file ${file.name}):`;
        let content;
        if (name.endsWith('.docx')) {
            if (typeof DocImport === 'undefined') throw new Error('docx reader not loaded');
            const text = await DocImport._docxText(file);
            if (!text.trim()) throw new Error('No readable text in the .docx');
            content = intro + '\n\n' + text.slice(0, 14000);
        } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
            const b64 = await DocImport._b64(file);
            content = [
                { type: 'text', text: intro + ' read the attached PDF.' },
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
            ];
        } else if ((file.type || '').startsWith('image/')) {
            const b64 = await DocImport._b64(file);
            content = [
                { type: 'text', text: intro + ' read the attached image.' },
                { type: 'image', source: { type: 'base64', media_type: file.type, data: b64 } }
            ];
        } else if (file.type === 'text/plain' || name.endsWith('.txt')) {
            const text = await file.text();
            content = intro + '\n\n' + text.slice(0, 14000);
        } else if ((file.type || '').startsWith('audio/') || (file.type || '').startsWith('video/')) {
            // Claude can't read audio/video — route to Gemini, which can.
            return await Gemini.parseAV(file);
        } else {
            throw new Error('Unsupported file. Use .docx, PDF, image, .txt, audio or video.');
        }
        const model = state.profile.anthropicModel || 'claude-opus-4-8';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': state.profile.anthropicKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model,
                max_tokens: 1500,
                system: AI.SYSTEM_PROMPT,
                messages: [{ role: 'user', content }]
            })
        });
        if (!res.ok) {
            const err = await res.text().catch(() => '');
            throw AI._httpError(res.status, err, model);
        }
        const json = await res.json();
        const txt = (json.content && json.content[0] && json.content[0].text) || '';
        const cleaned = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try { return JSON.parse(cleaned); }
        catch (e) { throw new Error('AI returned a non-JSON response'); }
    },

    /* Read one email's body and extract the lawyer's action items. */
    async extractEmailTasks(subject, body) {
        const sys = `This email was received by a solo lawyer. Read it and extract the concrete action items the lawyer must do.

Return ONLY raw JSON, no markdown fences:
{ "tasks": [ { "title": "", "due": null, "priority": "normal", "notes": "" } ] }
Rules:
- "title": a short, actionable task in English (keep case numbers, names and references as-is). NOT the email subject verbatim — the actual thing to do.
- "due": ISO date YYYY-MM-DD if a deadline is stated or clearly implied; otherwise null. Resolve relative dates against TODAY.
- "priority": "high" if urgent or deadline-driven, otherwise "normal".
- "notes": one short line of context.
- If the email needs no action (newsletter, receipt, FYI, automated notice), return { "tasks": [] }.
- At most 4 tasks. Output raw JSON only.`;
        const userMsg = `TODAY: ${todayISO()}\n\nSUBJECT: ${subject}\n\nBODY:\n${body}`;
        const model = state.profile.anthropicModel || 'claude-opus-4-8';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': state.profile.anthropicKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                system: sys,
                messages: [{ role: 'user', content: userMsg }]
            })
        });
        if (!res.ok) {
            const err = await res.text().catch(() => '');
            throw AI._httpError(res.status, err, model);
        }
        const json = await res.json();
        const content = (json.content && json.content[0] && json.content[0].text) || '';
        const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        let parsed;
        try { parsed = JSON.parse(cleaned); }
        catch (e) { throw new Error('AI returned an unreadable response'); }
        return Array.isArray(parsed.tasks) ? parsed.tasks : [];
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
            return c;
        }
        return null;
    },

    _resolveMatter(d, opts) {
        opts = opts || {};
        if (d.matterId && d.matterId !== '__new__') {
            const m = matterById(d.matterId);
            if (m) return m;
        }
        if (d.matterName) {
            const found = state.matters.find(m => !m.deletedAt && m.title?.toLowerCase() === d.matterName.toLowerCase());
            if (found) return found;
            if (opts.create) {
                const c = AI._resolveClient(d);
                const m = {
                    id: uuid(),
                    clientId: c ? c.id : null,
                    title: d.matterName,
                    status: 'open',
                    rate: null,
                    description: '',
                    openedAt: new Date().toISOString()
                };
                state.matters.push(m);
                return m;
            }
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
    },

    _applyUpdateClient(d) {
        const c = clientById(d.clientId) || state.clients.find(x => !x.deletedAt && x.name?.toLowerCase() === (d.name||'').toLowerCase());
        if (!c) throw new Error('Client not found');
        Object.assign(c, d);
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
    },

    _applyUpdateMatter(d) {
        const m = AI._resolveMatter(d);
        if (!m) throw new Error('Matter not found');
        Object.assign(m, d);
    },

    _applyCreateTask(d) {
        const m = AI._resolveMatter(d, { create: true });
        const t = {
            id: uuid(),
            matterId: m?.id || null,
            clientId: m?.clientId || null,
            title: d.title || 'Untitled task',
            due: d.due || null,
            priority: d.priority || 'normal',
            assigneeEmail: (d.assigneeEmail || '').toLowerCase() || null,
            notes: d.notes || '',
            status: 'todo',
            createdAt: new Date().toISOString()
        };
        Tasks.put(t);
    },

    _applyUpdateTask(d) {
        const t = (d.taskId && taskById(d.taskId)) || state.tasks.find(x => !x.deletedAt && x.title?.toLowerCase() === (d.taskTitle||'').toLowerCase());
        if (!t) throw new Error('Task not found');
        Object.assign(t, d);
        Tasks.put(t);
    },

    _applyCompleteTask(d) {
        const t = (d.taskId && taskById(d.taskId)) || state.tasks.find(x => !x.deletedAt && x.title?.toLowerCase() === (d.taskTitle||'').toLowerCase());
        if (!t) throw new Error('Task not found');
        t.status = 'done';
        t.completedAt = new Date().toISOString();
        Tasks.put(t);
    },

    _applyLogTime(d) {
        const m = AI._resolveMatter(d, { create: true });
        if (!m) throw new Error('Pick a matter for this time log');
        const date = d.date || todayISO();
        const startedAt = new Date(date + 'T09:00:00').toISOString();
        const minutes = Number(d.minutes) || 0;
        if (minutes < 1) throw new Error('Minutes must be ≥ 1');
        const log = {
            id: uuid(),
            taskId: d.taskId || null,
            matterId: m.id,
            clientId: m.clientId,
            startedAt,
            endedAt: new Date(new Date(startedAt).getTime() + minutes * 60000).toISOString(),
            minutes,
            notes: d.notes || '',
            invoiceId: null
        };
        state.logs.push(log);
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
    }
};

/* =========================================================================
 * 2c. GEMINI — handles audio and video (Claude can't read those)
 *
 * Same { actions, transcript?, clarify? } JSON shape as AI.parseInput,
 * so the omni proposal panel renders the result identically.
 * ========================================================================= */

const Gemini = {
    /* Ask Google which models this key can actually use. Hardcoding a list
     * ages badly — Google retires models on its own schedule, and a dropdown
     * offering a dead one sends the user hunting for a bug that is really a
     * 404. Returns [] on any failure so Settings can fall back quietly. */
    async listModels() {
        if (!state.profile.geminiKey) return [];
        try {
            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                headers: { 'x-goog-api-key': state.profile.geminiKey }
            });
            if (!res.ok) return [];
            const data = await res.json();
            return (data.models || [])
                .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
                .map(m => (m.name || '').replace(/^models\//, ''))
                .filter(n => n && !/embedding|aqa|imagen|veo/i.test(n))
                .sort();
        } catch (e) {
            console.warn('Gemini model list unavailable', e);
            return [];
        }
    },

    async parseAV(file) {
        if (!state.profile.geminiKey) {
            throw new Error('Add your Gemini API key in Settings to upload audio or video.');
        }
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > 18) {
            throw new Error(`File is ${sizeMB.toFixed(1)} MB — Gemini inline limit is ~20 MB. Trim it down or split it.`);
        }
        const b64 = await DocImport._b64(file);
        const model = state.profile.geminiModel || 'gemini-2.0-flash';
        const kind = (file.type || '').startsWith('video/') ? 'video' : 'audio';
        const sys = AI.SYSTEM_PROMPT;
        const userText = `TODAY: ${todayISO()}

CONTEXT:
${AI._buildContext()}

USER INPUT — listen to / watch the attached ${kind} (file: ${file.name}) and extract the user's intended actions per the system rules above. Respond with the same JSON shape: { "actions": [...], "transcript"?: "...", "clarify"?: "..." }.`;
        const payload = {
            contents: [{
                role: 'user',
                parts: [
                    { text: sys + '\n\n---\n\n' + userText },
                    { inline_data: { mime_type: file.type, data: b64 } }
                ]
            }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
                maxOutputTokens: 1500
            }
        };
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-goog-api-key': state.profile.geminiKey
                },
                body: JSON.stringify(payload)
            }
        );
        if (!res.ok) {
            const err = await res.text().catch(() => '');
            // A raw 429 body is a wall of JSON that says nothing about what to
            // do. The usual cause is not "you used it all up" but a model with
            // no free-tier allowance at all, which is fixable in Settings.
            if (res.status === 429) {
                throw new Error(`${model} is out of quota. Pick another model in Settings — `
                    + `free-tier allowances differ per model — or check `
                    + `aistudio.google.com/usage.`);
            }
            if (res.status === 403 || res.status === 401) {
                throw new Error('Gemini rejected the API key. Check it in Settings.');
            }
            if (res.status === 404) {
                throw new Error(`Model "${model}" does not exist any more. Pick another in Settings.`);
            }
            throw new Error(`Gemini HTTP ${res.status}: ${err.slice(0, 200)}`);
        }
        const json = await res.json();
        const txt = (json.candidates && json.candidates[0]
                     && json.candidates[0].content
                     && json.candidates[0].content.parts
                     && json.candidates[0].content.parts[0]
                     && json.candidates[0].content.parts[0].text) || '';
        const cleaned = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        try { return JSON.parse(cleaned); }
        catch (e) { throw new Error('Gemini returned a non-JSON response'); }
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

    /* A phone hands the microphone to one consumer at a time. Running
     * MediaRecorder and SpeechRecognition together — which is fine on
     * desktop Chrome, where recognition is served out of band — starves
     * recognition on mobile: it starts, hears nothing, ends empty, and the
     * button looks broken. So on a phone we pick exactly one path. */
    isMobile() {
        return matchMedia('(pointer: coarse)').matches
            || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    },

    async start() {
        if (!Recorder.supported() && !Recorder.canRecordAudio()) {
            toast('Voice input not supported in this browser. Use Chrome or Edge.', 'error');
            return;
        }

        const mobile = Recorder.isMobile();
        // Record-and-transcribe beats live recognition on a phone, but it
        // needs Gemini to read the audio afterwards.
        Recorder.avMode = mobile && !!state.profile.geminiKey && Recorder.canRecordAudio();
        const useRecognition = Recorder.supported() && !Recorder.avMode;
        const useMediaRecorder = Recorder.canRecordAudio() && (!mobile || Recorder.avMode);

        if (mobile && !Recorder.avMode && !Recorder.supported()) {
            toast('Add a Gemini API key in Settings to dictate on this phone.', 'error');
            return;
        }

        // Acquire mic for both speech recognition AND raw audio recording
        let stream = null;
        if (useMediaRecorder) {
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
                        const fname = `dictation-${stamp}.webm`;
                        await Attach.add({
                            blob, name: fname, mime: blob.type, kind: 'audio', ...ctx
                        });
                        // do not toast here; the AI completion toast is more useful

                        // On a phone nothing was transcribed live — the recording
                        // itself is the input, so hand it to Gemini now.
                        if (Recorder.avMode) {
                            Omni.busy = true;
                            Omni._renderLoading();
                            try {
                                const file = new File([blob], fname, { type: blob.type || 'audio/webm' });
                                const result = await AI.parseFile(file);
                                Omni.proposals = (result.actions || []).map(a => ({ ...a, accepted: false }));
                                Omni._renderProposals(result);
                            } catch (e) {
                                console.error('dictation parse failed', e);
                                Omni._renderError('Could not read the recording: ' + esc(e.message || 'error'));
                            } finally {
                                Omni.busy = false;
                            }
                        }
                    } else if (Recorder.avMode) {
                        toast('Nothing recorded — check the microphone permission', 'error');
                    }
                };
                media.start();
                Recorder.media = media;
            } catch (e) {
                console.warn('MediaRecorder unavailable', e);
            }
        }

        // Speech recognition for live transcription
        if (useRecognition) {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            const rec = new SR();
            rec.lang = Recorder.resolveLang();
            // mobile engines ignore `continuous` and cut off at the first
            // pause; asking for it there only makes the end event unreliable
            rec.continuous = !mobile;
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
                } else {
                    // Silence here is what "the mic does nothing" feels like:
                    // say so, and point at the fix that actually works.
                    toast(mobile
                        ? 'Heard nothing. Add a Gemini API key in Settings — dictation is far more reliable on phones.'
                        : 'Heard nothing — try again, closer to the mic.', 'error');
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
        // Focusing the field on a phone raises the on-screen keyboard over the
        // mic button you need to press again to stop.
        if (!mobile) Omni.input.focus();
        toast(Recorder.avMode
            ? 'Recording — tap the mic again to stop'
            : `Listening (${Recorder.resolveLang()})…`);
    },

    /** Resolve the dictation lang setting to a real BCP-47 tag. */
    resolveLang() {
        const setting = state.profile.dictationLang || 'auto';
        if (setting !== 'auto') return setting;
        const supported = ['uk-UA','ru-RU','en-US','pl-PL'];
        const nav = (navigator.language || 'uk-UA');
        const navBase = nav.toLowerCase().split('-')[0];
        // exact match first
        const exact = supported.find(s => s.toLowerCase() === nav.toLowerCase());
        if (exact) return exact;
        // base-language match (e.g. "ru" -> "ru-RU")
        const base = supported.find(s => s.toLowerCase().split('-')[0] === navBase);
        if (base) return base;
        // also peek at navigator.languages array for the next best supported
        for (const l of (navigator.languages || [])) {
            const lb = l.toLowerCase().split('-')[0];
            const m = supported.find(s => s.toLowerCase().split('-')[0] === lb);
            if (m) return m;
        }
        return 'uk-UA';
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
        // drop the instances so a stale recognizer can't fire onend into the
        // next session
        Recorder.rec = null;
        Recorder.media = null;
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
