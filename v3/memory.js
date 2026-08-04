/* ordify · memory
 *
 * What the assistant knows about how *you* work, kept between sessions.
 *
 * Context tells the model what exists right now. Memory tells it the things
 * that stay true and that no list of nodes can express: that "Дмитро" means
 * Dmytro Romanchenko, that a Delaware package is always a fixed fee, that you
 * never want a task called "call" without knowing who. Without it every
 * session starts from zero and you correct the same mis-reading forever.
 *
 * Three rules, all of them about not poisoning the well:
 *
 *   1. A memory is written only from a correction you made, or a sentence
 *      where you asked for it. The model never decides on its own that
 *      something is worth keeping about you.
 *   2. Every memory is visible and deletable in Settings. A wrong fact that
 *      you cannot see is worse than no memory at all, because it bends every
 *      future reading and never explains why.
 *   3. Memory informs reading; it never acts. Nothing is created, closed or
 *      rescheduled because a memory said so — proposals still go through the
 *      sheet you confirm.
 *
 * Records live in the same store as everything else, so when sign-in arrives
 * they sync with the practice rather than being stranded in one browser.
 */
'use strict';

const Memory = {
    items: [],
    MAX: 60,

    async load() {
        try {
            const all = await Store.all('memo');
            Memory.items = all.filter(m => !m.deletedAt).sort(Memory._rank);
        } catch (e) {
            console.warn('memory unavailable this session', e);
            Memory.items = [];
        }
        return Memory.items;
    },

    /* Most-reaffirmed first, then most recent. Correcting the same misreading
       twice is the strongest signal there is that a fact matters, so restating
       one lifts it rather than filing a near-duplicate beneath it. */
    _rank(a, b) {
        return (b.uses || 0) - (a.uses || 0) ||
               String(b.at || '').localeCompare(String(a.at || ''));
    },

    /* Two ways of saying the same thing are one memory. Without this, every
       repeat of a correction stacks another near-duplicate into the prompt
       until the useful ones are crowded out. */
    _key(text) {
        return String(text || '').toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    async remember(text, why = '') {
        const clean = String(text || '').trim();
        if (clean.length < 3) return null;
        const key = Memory._key(clean);

        const existing = Memory.items.find(m => Memory._key(m.text) === key);
        if (existing) {                       // re-stating it is a vote, not a copy
            existing.uses = (existing.uses || 0) + 1;
            existing.at = new Date().toISOString();
            await Store.put('memo', existing, ['uses', 'at']);
            Memory.items.sort(Memory._rank);
            return existing;
        }

        const memo = {
            id: uid(), text: clean, why: String(why || '').trim(),
            at: new Date().toISOString(), uses: 0, deletedAt: null
        };
        Memory.items.unshift(memo);
        await Store.put('memo', memo);
        await Memory._trim();
        return memo;
    },

    async forget(id) {
        const i = Memory.items.findIndex(m => m.id === id);
        if (i < 0) return false;
        Memory.items.splice(i, 1);
        await Store.remove('memo', id);       // marked, not erased — the bin rule
        return true;
    },

    /* A prompt has a budget. When it is full the least-leaned-on memory goes,
       which is also the one most likely to have been a bad guess. */
    async _trim() {
        if (Memory.items.length <= Memory.MAX) return;
        const doomed = Memory.items.slice().sort(Memory._rank).slice(Memory.MAX);
        for (const m of doomed) await Memory.forget(m.id);
    },

    block() {
        if (!Memory.items.length) return '';
        return Memory.items.map(m => '- ' + m.text).join('\n');
    }
};

if (typeof module !== 'undefined') module.exports = { Memory };
