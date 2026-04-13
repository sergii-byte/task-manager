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
        const systemPrompt = `You are a legal assistant for a task manager app called LegalFlow. The app has a hierarchy: Clients (people) → Companies → Projects → Tasks.

${context}

The user describes what they want in free form (any language — Ukrainian, English, Russian, etc). You must determine what they want to create and return a JSON object.

IMPORTANT: Determine the "action" based on what user says:

1. If user wants to add a CLIENT (person): action = "create_client"
   Return: { "action": "create_client", "name": "...", "email": "..." (optional), "telegram": "..." (optional), "notes": "..." (optional) }

2. If user wants to add a COMPANY for a client: action = "create_company"
   Return: { "action": "create_company", "name": "...", "ownerId": "..." (client ID if you can determine), "ownerName": "..." (for display), "notes": "..." (optional) }

3. If user wants to add a PROJECT: action = "create_project"
   Return: { "action": "create_project", "name": "...", "clientId": "..." (company ID if known), "clientName": "..." (for display), "projectType": "licensing"|"corporate"|"contracts"|"compliance" (if applicable), "jurisdiction": "..." (if mentioned), "status": "active", "deadline": "YYYY-MM-DD" (if mentioned) }

4. If user wants to add a TASK: action = "create_task"
   Return: { "action": "create_task", "title": "...", "notes": "...", "priority": "low"|"medium"|"high", "deadline": "YYYY-MM-DD" (if mentioned), "isProcedural": true/false, "projectId": "..." (if you can determine from context), "projectName": "..." (for display), "tagIds": [...], "subtasks": ["...", "..."] (if complex task) }

5. If user wants to create MULTIPLE things at once (e.g. "add client John with company XYZ and project licensing"): action = "create_chain"
   Return: { "action": "create_chain", "items": [ {each item as above} ] }

Rules:
- If the user mentions a specific existing client/company/project by name, match it to the IDs from context
- If creating a task and no project exists yet, suggest create_chain with the full chain
- Dates: convert relative dates ("friday", "next week", "через 3 дня") to YYYY-MM-DD format
- Priority: default to "medium" unless user indicates urgency
- isProcedural: true if it's a court/regulatory/filing deadline
- NEVER suggest Russia as jurisdiction
- Respond with ONLY valid JSON, no markdown, no explanations`;

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
