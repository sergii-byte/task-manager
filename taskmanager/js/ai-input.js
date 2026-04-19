const AiInput = {
    // Claude model used for all AI calls (quick input + import parsing).
    // Keep as the canonical alias so the API auto-resolves to the latest
    // matching snapshot — change here to swap models globally.
    MODEL: 'claude-sonnet-4-5',
    apiKey: localStorage.getItem('taskflow_claude_key') || '',
    recognition: null,
    isRecording: false,

    // --- Voice Input ---
    toggleMic() {
        if (this.isRecording) this.stopMic();
        else this.startMic();
    },

    startMic() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            App.toast(I18n.t('voiceNotSupported') || 'Browser does not support voice input. Use Chrome or Edge.', 'error');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = I18n.lang === 'uk' ? 'uk-UA' : 'en-US';
        this.recognition.interimResults = true;
        this.recognition.continuous = true;

        const input = document.getElementById('qi-text');
        const micBtn = document.getElementById('qi-mic');
        let finalTranscript = input.value;

        this.recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            input.value = finalTranscript + interim;
        };

        this.recognition.onerror = (event) => {
            console.error('Speech error:', event.error);
            // Surface common failures so the user knows why the mic went silent.
            // 'no-speech' / 'aborted' are routine noise and left silent.
            const err = event.error;
            let key = null;
            if (err === 'not-allowed' || err === 'service-not-allowed') key = 'voiceNotAllowed';
            else if (err === 'network') key = 'voiceNetworkError';
            else if (err === 'audio-capture') key = 'voiceNoMic';
            else if (err === 'language-not-supported') key = 'voiceLangUnsupported';
            if (key) {
                const msg = I18n.t(key);
                if (msg && msg !== key) App.toast(msg, 'error');
                else App.toast('Voice input error: ' + err, 'error');
            }
            this.stopMic();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                try { this.recognition.start(); } catch(e) {}
            }
        };

        this.recognition.start();
        this.isRecording = true;
        micBtn.classList.add('recording');
    },

    stopMic() {
        if (this.recognition) {
            this.isRecording = false;
            this.recognition.stop();
        }
        document.getElementById('qi-mic').classList.remove('recording');
    },

    // --- AI Processing ---
    async process() {
        const input = document.getElementById('qi-text');
        const text = input.value.trim();
        if (!text) return;

        if (this.isRecording) this.stopMic();

        if (!this.apiKey) {
            App.toast(I18n.t('setApiKey'), 'warning');
            App.showSettings();
            return;
        }

        const sendBtn = document.getElementById('qi-send');
        sendBtn.disabled = true;
        sendBtn.classList.add('loading');
        input.placeholder = I18n.t('aiProcessing');

        try {
            const context = this.buildContext();
            const response = await this.callClaude(text, context);
            const parsed = this.parseResponse(response);

            App._pendingAiData = parsed;
            App.showAiPreview(parsed);
        } catch (e) {
            console.error('AI error:', e);
            App.toast('AI error: ' + e.message, 'error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.classList.remove('loading');
            input.placeholder = I18n.t('quickInputPlaceholder');
        }
    },

    buildContext() {
        const clients = Store.getClients();
        const projects = Store.getProjects();
        const tasks = Store.getTasks();
        const tags = Store.getTags();

        let context = 'Current data structure:\n';

        if (clients.length === 0) {
            context += '\nNo clients yet (empty system).\n';
        } else {
            clients.forEach(c => {
                const cos = Array.isArray(c.companies) && c.companies.length ? ` [companies: ${c.companies.join(', ')}]` : '';
                context += `\nClient: "${c.name}" (id: ${c.id})${cos}\n`;
                const clientProjects = projects.filter(p => p.clientId === c.id);
                clientProjects.forEach(p => {
                    const co = p.company ? `, company: "${p.company}"` : '';
                    context += `  Project: "${p.name}" (id: ${p.id}${co}, type: ${p.projectType || 'not set'}, jurisdiction: ${p.jurisdiction || 'not set'})\n`;
                    // Include open tasks so the AI can match task names accurately
                    const projTasks = tasks.filter(t => t.projectId === p.id && t.status !== 'done').slice(0, 10);
                    projTasks.forEach(t => {
                        context += `    Task: "${t.title}" (id: ${t.id}, status: ${t.status || 'todo'})\n`;
                    });
                });
            });

            // Inbox / unassigned tasks
            const inbox = tasks.filter(t => !t.projectId && t.status !== 'done').slice(0, 20);
            if (inbox.length) {
                context += `\nUnassigned open tasks:\n`;
                inbox.forEach(t => {
                    context += `  Task: "${t.title}" (id: ${t.id})\n`;
                });
            }
        }

        if (tags.length) {
            context += '\nAvailable tags: ' + tags.map(t => `"${t.name}" (id: ${t.id})`).join(', ') + '\n';
        }

        if (App.currentProjectId) context += `\nCurrently selected project ID: ${App.currentProjectId}\n`;
        if (App.currentClientId) context += `Currently selected client ID: ${App.currentClientId}\n`;

        const today = new Date().toISOString().split('T')[0];
        context += `\nToday: ${today}\n`;

        return context;
    },

    async callClaude(userText, context) {
        const systemPrompt = `You are an assistant for Ordify, a task manager for an international lawyer. Hierarchy: Client (person) → Project → Task. Time is logged on tasks. A Project optionally has a "company" field — a string naming the legal entity the work is for (e.g. "Acme Ltd"). Companies are NOT separate entities; they are strings attached to a project, and each client has a list of company names aggregated from their projects.

${context}

The user describes intentions in free form (Ukrainian, English, Russian — any language, often via voice transcription so may be messy). Your job: figure out EVERYTHING they want done and return a JSON object describing it.

=== ACTIONS ===

1. create_client — add a person (the actual paying client)
   { "action": "create_client", "name": "...", "email"?, "telegram"?, "notes"?, "companies"?: ["Acme Ltd", ...] }

2. create_project — add a project under a client
   { "action": "create_project", "name": "...", "clientId"? (existing client id), "clientName"? (for match/create), "company"? (optional legal-entity string), "projectType"?: "licensing"|"corporate"|"contracts"|"compliance", "jurisdiction"?, "status"?: "active", "deadline"?: "YYYY-MM-DD" }

3. create_task — add a task
   { "action": "create_task", "title": "...", "notes"?, "priority"?: "low"|"medium"|"high", "deadline"?: "YYYY-MM-DD", "isProcedural"?: bool, "projectId"? (existing project id), "projectName"? (for display), "tagIds"?: [], "subtasks"?: [] }

4. log_hours — log time spent on a task
   { "action": "log_hours", "hours": <number>, "taskId"? (existing task id), "taskName"? (to match an existing task by name OR the name of a task created earlier in the same chain), "description"? }

5. create_chain — MULTIPLE actions in one go (USE THIS LIBERALLY!)
   { "action": "create_chain", "items": [ {each item is one of the above actions, in order} ] }

=== CRITICAL RULES ===

- If the user packs more than one intent into a single sentence ("create project X for client Y and log Z hours", "add task and set deadline tomorrow") — you MUST return create_chain with each step as a separate item. Never collapse multiple intents into a single create_task.

- Inside a chain, items can reference earlier-created entities by name. The chain runs in order and the runtime auto-links: a create_project after a create_client uses that client; a create_task after a create_project uses that project; a log_hours after a create_task logs against that task.

- SMART MATCHING (voice transcripts are noisy!):
  The input often comes from voice recognition and will contain typos, wrong letters, phonetic drift, or half-understood foreign names. When the user names a client/project/task, do NOT treat a one-character or phonetic mismatch as a new entity. Look at the context list above and find the most plausible existing match:
    • "Syndicod" → existing "Syndicode"
    • "Акме" → existing "Acme Ltd"
    • "contract neg" → existing "Contract negotiation"
  When you resolve to an existing entity, use its EXACT name from context (the runtime will fuzzy-match on your behalf, but a closer name helps). If NO existing entity seems plausible, only then treat the name as new.

- If the user names a client NOT in context, the chain must create_client for them first.

- If the user mentions a legal entity / company (e.g. "for Acme Ltd"), attach it as the "company" string field on create_project. Do NOT create a separate company entity — the company is just a field on the project.

- Tasks may exist without a project (Inbox) — only omit projectId/projectName if user clearly didn't tie it to anything.

- Dates: convert "tomorrow", "Friday", "next week", "через 3 дні" etc. to YYYY-MM-DD using Today from context.

- Priority: default "medium". Use "high" only on explicit urgency.

- isProcedural: true ONLY for court/regulatory/filing deadlines.

- NEVER suggest Russia as a jurisdiction.

- Respond with ONLY raw JSON. No markdown fences, no commentary, no explanations.

=== EXAMPLES ===

User: "create project 'This and That' for client Syndicode and log 15 hours for contract negotiation"
Response:
{"action":"create_chain","items":[
  {"action":"create_project","name":"This and That","clientName":"Syndicode"},
  {"action":"create_task","title":"Contract negotiation","projectName":"This and That"},
  {"action":"log_hours","hours":15,"taskName":"Contract negotiation","description":"Contract negotiation"}
]}

User: "add task review NDA tomorrow high priority"
Response:
{"action":"create_task","title":"Review NDA","priority":"high","deadline":"YYYY-MM-DD"}

User: "log 2.5 hours on the NDA review"
Response:
{"action":"log_hours","hours":2.5,"taskName":"NDA review"}

User: "add client John Smith with a licensing project for his company Acme Ltd in the UK"
Response:
{"action":"create_chain","items":[
  {"action":"create_client","name":"John Smith","companies":["Acme Ltd"]},
  {"action":"create_project","name":"Licensing","clientName":"John Smith","company":"Acme Ltd","projectType":"licensing","jurisdiction":"UK"}
]}`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: this.MODEL,
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: userText }],
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.content[0].text;
    },

    parseResponse(text) {
        // Try greedy JSON first (handles rare case where the response has text then JSON).
        // If parse fails, THROW — don't silently fabricate a fake task from what might
        // actually be a Claude refusal, an error message, or a prose reply.
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('AI returned non-JSON response: ' + (text || '').slice(0, 200));
        try {
            return JSON.parse(m[0]);
        } catch (e) {
            throw new Error('AI response failed to parse as JSON: ' + e.message);
        }
    },

    // --- Plan / Transcript import ---
    // mode: 'plan' | 'transcript'
    // projectId: optional — if set, attach all tasks to this project (no create_project)
    async processImport(text, mode, projectId) {
        const context = this.buildContext();
        const targetProject = projectId ? Store.getProject(projectId) : null;

        const planExtra = `
=== PLAN MODE ===
The user pasted a STRUCTURED PLAN (likely from Claude, ChatGPT, or hand-written). It has headings, phases ("Week 1", "Phase 2", "Step 3"), sub-bullets, possibly deadlines and dependencies.

Convert it into ONE create_chain preserving the structure.

RULES:
- Many tasks on a single theme → treat the theme as a PROJECT. If the plan is for a clearly-named matter (e.g. "License Acme in EU", "Incorporate NewCo", "DD on Target X") AND the user did NOT pre-select a target project, start the chain with create_project whose name is that theme. Then every task carries "projectName": "<that theme>".
- If the user pre-selected a target project (marked below), do NOT create a project — use "projectId" for every task.
- Top-level bullets / numbered items → create_task, IN ORDER.
- Sub-bullets / indented sub-steps → task's "notes" field (one per line, "- " prefix).
- Dependencies: if text says "after X", "once X is done", "blocked by X", "requires X finished" → add "dependsOn": ["Exact Prior Task Title"]. Use EXACT titles you used earlier in the chain.
- Deadlines:
  • "Week 1" / "Day 1-7" → today + 7
  • "Week 2" → today + 14, etc.
  • "Phase 1" → today + 14, "Phase 2" → today + 30, "Phase 3" → today + 60
  • Explicit "by May 15", "до 15 травня" → YYYY-MM-DD
  • None mentioned → omit
- Priority: "medium" default. "high" for "urgent", "critical", "blocker", "ASAP".
- isProcedural: ONLY for court/regulatory filings with hard deadlines.`;

        const transcriptExtra = `
=== TRANSCRIPT MODE ===
The user pasted a CALL TRANSCRIPT (client meeting, lawyer-to-lawyer, etc.). It has small talk, questions, digressions.

Extract ONLY the LAWYER'S action items — things THEY (the user) committed to do. Ignore:
- the client's to-dos ("I'll send you the docs" from client → NOT a task)
- pleasantries, status updates, general discussion
- hypotheticals unless there's a clear commitment

If 3+ related tasks for a new matter → start chain with create_project for that matter (same rule as plan mode), unless a target project is pre-selected.

Dependencies & deadlines: same format as plan mode.`;

        const pinnedProject = targetProject
            ? `\n\n=== PRE-SELECTED TARGET ===\nAll tasks MUST use "projectId": "${targetProject.id}" (project: "${targetProject.name}"). Do NOT emit create_project. Do NOT use projectName.\n`
            : '';

        const systemPrompt = `You are an assistant for Ordify, a task manager for an international lawyer. Hierarchy: Client (person) → Project → Task.

${context}

${mode === 'transcript' ? transcriptExtra : planExtra}
${pinnedProject}

=== OUTPUT FORMAT ===

Return ONE create_chain JSON object (always create_chain, even for a single task, for consistency):

{
  "action": "create_chain",
  "items": [
    { "action": "create_project", "name": "...", "clientName": "...", "projectType": "...", "jurisdiction": "..." },
    { "action": "create_task", "title": "...", "notes": "...", "deadline": "YYYY-MM-DD", "priority": "medium", "projectName": "...", "dependsOn": ["..."] }
  ]
}

Actions available: create_client, create_project, create_task, log_hours.

NEVER suggest Russia as a jurisdiction.
Respond with ONLY raw JSON. No markdown fences, no commentary.`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: this.MODEL,
                max_tokens: 8192,
                system: systemPrompt,
                messages: [{ role: 'user', content: text }],
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }
        const data = await response.json();
        const parsed = this.parseResponse(data.content[0].text);

        // Always return a create_chain (wrap single actions).
        if (parsed.action !== 'create_chain') {
            return { action: 'create_chain', items: [parsed] };
        }
        return parsed;
    },
};
