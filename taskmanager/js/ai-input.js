const AiInput = {
    apiKey: localStorage.getItem('taskflow_claude_key') || '',
    recognition: null,
    isRecording: false,

    // --- Voice Input ---
    toggleMic() {
        if (this.isRecording) {
            this.stopMic();
        } else {
            this.startMic();
        }
    },

    startMic() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Ваш браузер не поддерживает голосовой ввод. Используйте Chrome или Edge.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ru-RU';
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
                // Auto-restart if still recording
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
            alert('Укажите Claude API Key в настройках');
            App.showSettings();
            return;
        }

        // Show loading
        const sendBtn = document.getElementById('qi-send');
        sendBtn.disabled = true;
        input.placeholder = 'AI обрабатывает...';

        try {
            const context = this.buildContext();
            const response = await this.callClaude(text, context);
            const parsed = this.parseResponse(response);

            App._pendingAiData = parsed;
            App.showAiPreview(parsed);
        } catch (e) {
            console.error('AI error:', e);
            alert('Ошибка AI: ' + e.message);
        } finally {
            sendBtn.disabled = false;
            input.placeholder = 'Опишите задачу текстом или голосом — AI поможет оформить...';
        }
    },

    buildContext() {
        const owners = Store.getOwners();
        const clients = Store.getClients();
        const projects = Store.getProjects();
        const tags = Store.getTags();

        let context = 'Текущая структура данных:\n';

        owners.forEach(o => {
            context += `\nБенефициар: "${o.name}" (id: ${o.id})\n`;
            const ownerClients = clients.filter(c => c.ownerId === o.id);
            ownerClients.forEach(c => {
                context += `  Компания: "${c.name}" (id: ${c.id})\n`;
                const clientProjects = projects.filter(p => p.clientId === c.id);
                clientProjects.forEach(p => {
                    context += `    Проект: "${p.name}" (id: ${p.id}, тип: ${p.projectType || 'не указан'}, юрисдикция: ${p.jurisdiction || 'не указана'})\n`;
                });
            });
        });

        if (tags.length) {
            context += '\nДоступные теги: ' + tags.map(t => `"${t.name}" (id: ${t.id})`).join(', ') + '\n';
        }

        if (App.currentProjectId) {
            context += `\nТекущий выбранный проект ID: ${App.currentProjectId}\n`;
        }

        const today = new Date().toISOString().split('T')[0];
        context += `\nСегодня: ${today}\n`;

        return context;
    },

    async callClaude(userText, context) {
        const systemPrompt = `Ты — юридический ассистент для task manager. Твоя задача — парсить текст пользователя и создавать структурированную задачу.

${context}

Пользователь описывает задачу в свободной форме. Ты должен вернуть JSON объект с полями:
- title: чёткое название задачи (краткое, 3-10 слов)
- notes: описание/детали если есть
- priority: "low", "medium", или "high"
- deadline: дата в формате YYYY-MM-DD если упоминается
- isProcedural: true если это процессуальный/регуляторный срок
- projectId: ID проекта если можешь определить из контекста
- project: название проекта (для отображения)
- tagIds: массив ID тегов которые подходят
- tags: массив названий тегов (для отображения)
- subtasks: массив подзадач если задача сложная (каждая — строка с названием)

Отвечай ТОЛЬКО валидным JSON, без markdown, без пояснений.`;

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
            // Try to extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('No JSON found');
        } catch (e) {
            // Fallback: use raw text as title
            return { title: text.slice(0, 100), notes: text };
        }
    },
};
