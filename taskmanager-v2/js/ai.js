// ordify.me — AI dispatcher (Phase 9)
//
// Routes the omni-bar `?query` intent to the Anthropic Messages API.
// API key lives in localStorage (settings.anthropic_api_key) — the
// browser request uses `anthropic-dangerous-direct-browser-access: true`
// per Anthropic's spec for client-side calls.
//
// Phase 10+ may move this through a server proxy to keep the key off
// the device, but for a single-user local app that's overkill.

const AI = {
    /**
     * Build a compact context summary of the current Store, so the model
     * can answer questions like "когда дедлайн acme" or "show this week
     * billable" with reference to real data.
     *
     * Kept small (≤ ~2 KB) so it fits cheap models without burning tokens.
     */
    buildContext() {
        const fmt = (d) => d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '—';

        const clients = Store.getClients();
        const matters = Store.getMatters();
        const allTasks = Store.getTasks();
        const openTasks = allTasks.filter(t => t.status !== 'done');
        const meetings = Store.getMeetings();
        const invoices = Store.getInvoices();
        const now = Date.now();

        const lines = [];
        lines.push(`# CURRENT DATA`);
        lines.push(`Today: ${new Date().toISOString().slice(0, 10)}`);
        lines.push('');

        lines.push(`## Clients (${clients.length})`);
        for (const c of clients) {
            lines.push(`- ${c.name} (${c.industry || 'n/a'}, id=${c.id})`);
        }
        lines.push('');

        // Filter matters that opted out of AI context (privileged work)
        const includedMatters = matters.filter(m => !m.excludeFromAi);
        const excludedIds = new Set(matters.filter(m => m.excludeFromAi).map(m => m.id));
        if (excludedIds.size) {
            lines.push(`## ${excludedIds.size} matter(s) excluded from AI context (privileged)`);
            lines.push('');
        }

        lines.push(`## Matters (${includedMatters.length})`);
        for (const m of includedMatters) {
            const cl = Store.getClient(m.clientId);
            const b = m.billing || {};
            const mode = b.mode || 'hourly';
            const detail = mode === 'subscription' ? `€${b.period_fee || 0}/mo · ${b.hours_included || 0}h incl`
                         : mode === 'fixed'        ? `€${b.fixed_amount || 0} fixed`
                                                   : `€${b.hourly_rate || 0}/h`;
            lines.push(`- ${m.name} [${cl?.name || '?'}, ${mode}, ${detail}, id=${m.id}]`);
        }
        lines.push('');

        const visibleTasks = openTasks.filter(t => !t.matterId || !excludedIds.has(t.matterId));
        lines.push(`## Open tasks (${visibleTasks.length})`);
        for (const t of visibleTasks.slice(0, 30)) {
            const cl = t.clientId ? Store.getClient(t.clientId) : null;
            const ma = t.matterId ? Store.getMatter(t.matterId) : null;
            const dl = t.deadline ? fmt(t.deadline) : 'no deadline';
            const overdue = t.deadline && new Date(t.deadline).getTime() < now ? ' OVERDUE' : '';
            lines.push(`- "${t.title}" [${cl?.name || 'orphan'}, ${ma?.name || 'no matter'}, due ${dl}${overdue}, ${t.priority || 'medium'}]`);
        }
        lines.push('');

        const upcomingMeetings = meetings
            .filter(m => new Date(m.starts_at).getTime() >= now)
            .slice(0, 5);
        if (upcomingMeetings.length) {
            lines.push(`## Upcoming meetings`);
            for (const m of upcomingMeetings) {
                const cl = m.clientId ? Store.getClient(m.clientId) : null;
                lines.push(`- "${m.title}" ${fmt(m.starts_at)} [${cl?.name || '?'}]`);
            }
            lines.push('');
        }

        if (invoices.length) {
            const outstanding = invoices.filter(i => i.status !== 'paid');
            lines.push(`## Invoices`);
            for (const inv of invoices) {
                const cl = inv.clientId ? Store.getClient(inv.clientId) : null;
                lines.push(`- ${inv.number} ${inv.status.toUpperCase()} €${inv.total} [${cl?.name || '?'}, due ${fmt(inv.due_at)}]`);
            }
            lines.push(`Outstanding: €${outstanding.reduce((s, i) => s + (i.total || 0), 0)}`);
            lines.push('');
        }

        return lines.join('\n');
    },

    /** Approx prices per 1M tokens (Anthropic public, EUR-converted-ish). Update if needed. */
    PRICING: {
        'claude-sonnet-4-5': { in: 3, out: 15 },
        'claude-opus-4':     { in: 15, out: 75 },
        'claude-haiku-4-5':  { in: 1, out: 5 },
    },

    /** Append usage to settings.ai_usage and return current totals. */
    _trackUsage(model, usage) {
        const u = Store._data.settings.ai_usage || { events: [], total_in: 0, total_out: 0, total_cost: 0 };
        const inTok  = usage?.input_tokens  || 0;
        const outTok = usage?.output_tokens || 0;
        const price = this.PRICING[model] || { in: 3, out: 15 };
        const cost = (inTok / 1_000_000) * price.in + (outTok / 1_000_000) * price.out;
        u.events.push({ at: new Date().toISOString(), model, in: inTok, out: outTok, cost });
        if (u.events.length > 500) u.events = u.events.slice(-500);
        u.total_in += inTok;
        u.total_out += outTok;
        u.total_cost = (u.total_cost || 0) + cost;
        Store._data.settings.ai_usage = u;
        Store.flush();
        return u;
    },

    SYSTEM_PROMPT: [
        'You are ordify, a quiet, factual assistant for an international lawyer (IT/Crypto/B2B-Trade practice).',
        'Answer in 1–4 short sentences. No filler. Reference specific clients/matters/tasks by name.',
        'If the user asks something the data does not cover, say so briefly and suggest what they should add.',
        'Match the language of the question (English, Ukrainian, or Russian).',
    ].join(' '),

    /**
     * Send a single-turn question to the Messages API.
     *
     * @param {string} prompt    The user's question (already stripped of leading "?")
     * @param {object} [opts]
     * @param {string} [opts.system]   Override system prompt
     * @param {string} [opts.model]    Override model id
     * @returns {Promise<string>}      Plain-text answer
     */
    async query(prompt, opts = {}) {
        const key = Store.getSetting('anthropic_api_key');
        if (!key) {
            throw new Error('No API key. Add one in Settings.');
        }
        const model = opts.model || Store.getSetting('model') || 'claude-sonnet-4-5';
        const system = (opts.system || this.SYSTEM_PROMPT) + '\n\n' + this.buildContext();

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                system,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!res.ok) {
            let detail = '';
            try { detail = (await res.json())?.error?.message || ''; } catch (_) { /* ignore */ }
            throw new Error(`API ${res.status}${detail ? ': ' + detail : ''}`);
        }

        const data = await res.json();
        this._trackUsage(model, data.usage);
        const text = data.content?.[0]?.text;
        if (!text) throw new Error('Empty response');
        return text;
    },
};

    /**
     * Parse a multi-step capture into a structured commit payload.
     * Returns { kind, summary, fields, questions[] } or { kind: 'ambiguous', ... }.
     *
     * Schema is intentionally narrow — task / matter / meeting / client / log.
     * Things outside the schema return kind='ambiguous' with a clarifying summary.
     */
    async parseStructured(text) {
        const key = Store.getSetting('anthropic_api_key');
        if (!key) throw new Error('No API key. Add one in Settings.');

        const system = [
            'You are a structured-input parser for ordify, a legal practice manager.',
            'Convert the user\'s text into a JSON object describing what they want to create or do.',
            '',
            'Schema:',
            '{',
            '  "kind": "task" | "matter" | "meeting" | "client" | "log" | "ambiguous",',
            '  "summary": "one short sentence describing what will be created",',
            '  "fields": { ...kind-specific fields },',
            '  "questions": [ optional clarifying questions if ambiguous ]',
            '}',
            '',
            'Field shapes:',
            '  task   → { title, clientId?, matterId?, deadline? (ISO), priority? (urgent|high|medium|low) }',
            '  matter → { name, clientId, billing: { mode: "subscription"|"fixed"|"hourly", period_fee?, fixed_amount?, hourly_rate?, hours_included?, overage_rate? } }',
            '  meeting → { title, starts_at (ISO), ends_at? (ISO), clientId?, matterId?, video_url? }',
            '  client → { name, industry?, email? }',
            '  log    → { hours, taskId?, matterId?, note? }',
            '',
            'Use existing client/matter IDs when the input clearly references them (by name/synonym).',
            'For new clients/matters that don\'t exist, leave the id blank — just include the name in fields.',
            'Today\'s date is ' + new Date().toISOString().slice(0, 10) + '. Resolve relative dates to absolute ISO.',
            '',
            this.buildContext(),
            '',
            'OUTPUT ONLY VALID JSON. No prose, no markdown fences. The very first character must be `{`.',
        ].join('\n');

        const model = Store.getSetting('model') || 'claude-sonnet-4-5';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                system,
                messages: [{ role: 'user', content: text }],
            }),
        });
        if (!res.ok) {
            let detail = '';
            try { detail = (await res.json())?.error?.message || ''; } catch (_) { /* ignore */ }
            throw new Error(`API ${res.status}${detail ? ': ' + detail : ''}`);
        }
        const data = await res.json();
        this._trackUsage(model, data.usage);
        const raw = (data.content?.[0]?.text || '').trim();
        // Strip ```json fences if the model added them despite instructions
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            throw new Error('Bad JSON from model: ' + cleaned.slice(0, 80));
        }
    },
};

    /**
     * Analyse an email and return structured tasks/meetings/notes extracted from it.
     * Returns: { tasks: [...], meetings: [...], summary }
     */
    async parseEmail({ from, subject, body, date }) {
        const key = Store.getSetting('anthropic_api_key');
        if (!key) throw new Error('No API key. Add one in Settings.');

        const system = [
            'You analyse emails for an international lawyer (IT/Crypto/B2B-Trade) and extract structured action items.',
            '',
            'Return JSON with this exact shape:',
            '{',
            '  "summary": "one short sentence describing what the email asks",',
            '  "tasks":    [ { title, deadline?, priority?, clientId?, matterId? } ],',
            '  "meetings": [ { title, starts_at, ends_at?, clientId?, matterId? } ]',
            '}',
            '',
            'Rules:',
            '- Extract only concrete actions the lawyer must do — not generic context.',
            '- Use existing client/matter IDs when the sender or content clearly maps to them.',
            '- Today is ' + new Date().toISOString().slice(0, 10) + '. Resolve relative dates to ISO 8601.',
            '- Empty arrays are fine if there\'s no actionable item.',
            '- Output ONLY valid JSON. First character must be `{`.',
            '',
            this.buildContext(),
        ].join('\n');

        const userMsg = `From: ${from}\nDate: ${date}\nSubject: ${subject}\n\n${body}`;
        const model = Store.getSetting('model') || 'claude-sonnet-4-5';

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                system,
                messages: [{ role: 'user', content: userMsg }],
            }),
        });
        if (!res.ok) {
            let detail = '';
            try { detail = (await res.json())?.error?.message || ''; } catch (_) {}
            throw new Error(`API ${res.status}${detail ? ': ' + detail : ''}`);
        }
        const data = await res.json();
        this._trackUsage(model, data.usage);
        const raw = (data.content?.[0]?.text || '').trim();
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            throw new Error('Bad JSON from model: ' + cleaned.slice(0, 80));
        }
    },

    /**
     * Transcribe an audio/video Blob via OpenAI Whisper (gpt-4o-transcribe).
     * Returns { text, language? }.
     */
    async transcribe(blob, filename = 'recording.webm') {
        const key = Store.getSetting('openai_api_key');
        if (!key) throw new Error('No OpenAI API key. Add one in Settings (used for Whisper).');
        const fd = new FormData();
        fd.append('file', blob, filename);
        fd.append('model', 'whisper-1');
        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}` },
            body: fd,
        });
        if (!res.ok) {
            let detail = '';
            try { detail = (await res.json())?.error?.message || ''; } catch (_) {}
            throw new Error(`Whisper ${res.status}${detail ? ': ' + detail : ''}`);
        }
        const data = await res.json();
        return { text: data.text || '', language: data.language || null };
    },

    /** Summarise a transcript and pull out actionable tasks via Anthropic. */
    async summarizeTranscript(transcript, ctx = {}) {
        const key = Store.getSetting('anthropic_api_key');
        if (!key) throw new Error('No Anthropic API key. Add one in Settings.');
        const system = [
            'You summarise a recorded call or meeting for an international lawyer.',
            'Output JSON: { "summary": "...", "tasks": [{ title, deadline?, priority? }] }',
            'Keep summary 2–4 sentences. Tasks are concrete actions the lawyer must do.',
            'Today: ' + new Date().toISOString().slice(0, 10),
            this.buildContext(),
            'OUTPUT ONLY VALID JSON.',
        ].join('\n');
        const userMsg = `${ctx.note ? 'Context: ' + ctx.note + '\n\n' : ''}Transcript:\n${transcript}`;
        const model = Store.getSetting('model') || 'claude-sonnet-4-5';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({ model, max_tokens: 800, system, messages: [{ role: 'user', content: userMsg }] }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        this._trackUsage(model, data.usage);
        const raw = (data.content?.[0]?.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        try { return JSON.parse(raw); }
        catch (_) { return { summary: raw, tasks: [] }; }
    },
};

window.AI = AI;
