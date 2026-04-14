const AiInput = {
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
            App.toast('Browser does not support voice input. Use Chrome or Edge.', 'error');
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
        const owners = Store.getOwners();
        const clients = Store.getClients();
        const projects = Store.getProjects();
        const tags = Store.getTags();

        let context = 'Current data structure:\n';

        if (owners.length === 0) {
            context += '\nNo clients yet (empty system).\n';
        } else {
            owners.forEach(o => {
                context += `\nClient: "${o.name}" (id: ${o.id})\n`;
                const ownerClients = clients.filter(c => c.ownerId === o.id);
                ownerClients.forEach(c => {
                    context += `  Company: "${c.name}" (id: ${c.id})\n`;
                    const clientProjects = projects.filter(p => p.clientId === c.id);
                    clientProjects.forEach(p => {
                        context += `    Project: "${p.name}" (id: ${p.id}, type: ${p.projectType || 'not set'}, jurisdiction: ${p.jurisdiction || 'not set'})\n`;
                    });
                });
            });
        }

        if (tags.length) {
            context += '\nAvailable tags: ' + tags.map(t => `"${t.name}" (id: ${t.id})`).join(', ') + '\n';
        }

        if (App.currentProjectId) context += `\nCurrently selected project ID: ${App.currentProjectId}\n`;
        if (App.currentClientId) context += `Currently selected company ID: ${App.currentClientId}\n`;
        if (App.currentOwnerId) context += `Currently selected client ID: ${App.currentOwnerId}\n`;

        const today = new Date().toISOString().split('T')[0];
        context += `\nToday: ${today}\n`;

        return context;
    },

    async callClaude(userText, context) {
        const systemPrompt = `You are an assistant for LegalFlow, a task manager for an international lawyer. Hierarchy: Clients (people) → Companies → Projects → Tasks. Time can be logged on Tasks.

${context}

The user describes intentions in free form (Ukrainian, English, Russian — any language, often via voice transcription so may be a bit messy). Your job: figure out EVERYTHING they want done and return a JSON object describing it.

=== ACTIONS ===

1. create_client — add a person (the actual paying client)
   { "action": "create_client", "name": "...", "email"?, "telegram"?, "notes"? }

2. create_company — add a legal entity belonging to a client
   { "action": "create_company", "name": "...", "ownerId"? (existing client id), "ownerName"? (for display), "notes"? }

3. create_project — add a project under a company
   { "action": "create_project", "name": "...", "clientId"? (company id), "clientName"? (for display), "projectType"?: "licensing"|"corporate"|"contracts"|"compliance", "jurisdiction"?, "status"?: "active", "deadline"?: "YYYY-MM-DD" }

4. create_task — add a task
   { "action": "create_task", "title": "...", "notes"?, "priority"?: "low"|"medium"|"high", "deadline"?: "YYYY-MM-DD", "isProcedural"?: bool, "projectId"? (existing project id), "projectName"? (for display), "tagIds"?: [], "subtasks"?: [] }

5. log_hours — log time spent on a task
   { "action": "log_hours", "hours": <number>, "taskId"? (existing task id), "taskName"? (to match an existing task by name OR the name of a task created earlier in the same chain), "description"? }

6. create_chain — MULTIPLE actions in one go (USE THIS LIBERALLY!)
   { "action": "create_chain", "items": [ {each item is one of the above actions, in order} ] }

=== CRITICAL RULES ===

- If the user packs more than one intent into a single sentence ("create project X and log Y hours", "add client A with company B and project C", "create task and set deadline tomorrow") — you MUST return create_chain with each step as a separate item. Never collapse multiple intents into a single create_task.

- Inside a chain, items can reference earlier-created entities by name. The chain runs in order, and the runtime auto-links: a create_project after a create_company uses that company; a create_task after a create_project uses that project; a log_hours after a create_task logs against that task.

- If the user names an existing entity (client, company, project, task), match it to the id from context above. If they name something NOT in context, the chain must CREATE it before referencing it.

- Tasks may exist without a project (Inbox) — only omit projectId if user clearly didn't tie it to anything.

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

User: "add client John Smith with company Acme Ltd and a licensing project for the UK"
Response:
{"action":"create_chain","items":[
  {"action":"create_client","name":"John Smith"},
  {"action":"create_company","name":"Acme Ltd","ownerName":"John Smith"},
  {"action":"create_project","name":"Licensing","clientName":"Acme Ltd","projectType":"licensing","jurisdiction":"UK"}
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
                model: 'claude-haiku-4-5-20251001',
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
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw new Error('No JSON found');
        } catch (e) {
            return { action: 'create_task', title: text.slice(0, 100), notes: text };
        }
    },
};
