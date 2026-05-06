// ordify.me — i18n (EN + UK). Strings are added per phase, not all at once.
const I18n = {
    lang: 'en',
    strings: {
        en: {
            // Sidebar
            navViews: 'VIEWS',
            navClients: 'CLIENTS',
            navCapture: 'Capture',
            navToday: 'Today',
            navInbox: 'Tasks',
            navCalendar: 'Calendar',
            navMatters: 'Matters',
            navTime: 'Time',
            navInvoices: 'Invoices',
            // Empty Today
            emptyTodayEyebrow: 'VIEW 02 · TODAY',
            emptyTodayTitle: 'today, focused.',
            emptyTodayBody: 'No tasks yet. Capture one — type or speak — and ordify will sort it into a client and a matter.',
            captureCta: '+ Capture',
        },
        uk: {
            navViews: 'РОЗДІЛИ',
            navClients: 'КЛІЄНТИ',
            navCapture: 'Захопити',
            navToday: 'Сьогодні',
            navInbox: 'Задачі',
            navCalendar: 'Календар',
            navMatters: 'Справи',
            navTime: 'Час',
            navInvoices: 'Інвойси',
            emptyTodayEyebrow: 'РОЗДІЛ 02 · СЬОГОДНІ',
            emptyTodayTitle: 'сьогодні, у фокусі.',
            emptyTodayBody: 'Задач ще немає. Опиши одну — текстом чи голосом — і ordify розкладе її на клієнта та справу.',
            captureCta: '+ Захопити',
        },
    },
    t(key) {
        const dict = this.strings[this.lang] || this.strings.en;
        return dict[key] != null ? dict[key] : (this.strings.en[key] || key);
    },
    setLang(lang) {
        if (!this.strings[lang]) return;
        this.lang = lang;
        document.documentElement.lang = lang;
        localStorage.setItem('ordify-lang', lang);
    },
    init() {
        const stored = localStorage.getItem('ordify-lang');
        if (stored && this.strings[stored]) this.lang = stored;
    },
};

window.I18n = I18n;
