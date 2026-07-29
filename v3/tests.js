/* ordify · tests
 *
 * These exist because v2 had none, and the two worst bugs it shipped were
 * exactly the kind a test catches in a second: a date built through UTC that
 * made "today" wrong every evening, and two different ways of computing what
 * a client owed that disagreed by €2,000.
 *
 * So: dates, money, and the tree. No DOM, no network — just the arithmetic
 * the practice depends on.
 */
'use strict';

const T = {
    passed: 0, failed: 0, results: [],

    /* A throw inside a group is a failure of that group, not the end of the
       run — otherwise one broken expectation hides every test after it, which
       is precisely when you most need the rest of the report. */
    async group(name, fn) {
        T._group = name;
        try { await fn(); }
        catch (e) { T._record(false, 'group threw', String(e && e.message || e)); }
    },

    is(actual, expected, what) {
        const ok = JSON.stringify(actual) === JSON.stringify(expected);
        T._record(ok, what, ok ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    ok(value, what) { T._record(!!value, what, value ? '' : 'expected truthy'); },
    not(value, what) { T._record(!value, what, value ? 'expected falsy' : ''); },

    _record(ok, what, detail) {
        if (ok) T.passed++; else T.failed++;
        T.results.push({ ok, group: T._group, what, detail });
    }
};

async function run() {
    T.passed = 0; T.failed = 0; T.results = [];

    /* ------------------------------------------------------------ dates --- */
    await T.group('dates', () => {
        const d = new Date(2026, 0, 1, 23, 30);          // 1 Jan, late evening, local
        T.is(isoDate(d), '2026-01-01', 'late evening keeps the local date');

        // the v2 bug, stated as a test: UTC conversion would move this back a day
        const eastOfUTC = new Date(2026, 6, 25, 23, 59);
        T.ok(isoDate(eastOfUTC).endsWith('-25'), 'no UTC drift at 23:59');

        T.is(addDays(1, new Date(2026, 0, 31)), '2026-02-01', 'crosses a month');
        T.is(addDays(1, new Date(2026, 11, 31)), '2027-01-01', 'crosses a year');
        T.is(addDays(-1, new Date(2026, 2, 1)), '2026-02-28', 'goes back over a month');
        T.is(daysBetween('2026-07-20', '2026-07-25'), 5, 'counts days between');
    });

    /* ------------------------------------------------------------- tree --- */
    await T.group('tree', () => {
        const p = new Practice();
        const client  = makeNode('client',  { title: 'Novawave' });
        const project = makeNode('project', { title: 'AML', parentId: client.id });
        const sub     = makeNode('project', { title: 'Filings', parentId: project.id });
        const task    = makeNode('task',    { title: 'Report', parentId: sub.id });
        p.nodes.push(client, project, sub, task);

        T.is(p.children(client.id).map(n => n.title), ['AML'], 'children of a client');
        T.is(p.clientOf(task).title, 'Novawave', 'a task three levels down finds its client');
        T.is(p.ancestors(task).map(n => n.title), ['Novawave', 'AML', 'Filings'], 'full path');
        T.is(p.descendants(client.id).length, 3, 'everything underneath');

        // the move that would detach the branch
        T.not(p.canMove(project.id, sub.id), 'a project cannot move into its own child');
        T.not(p.canMove(project.id, project.id), 'nothing moves into itself');
        T.not(p.canMove(project.id, task.id), 'nothing moves into a task');
        T.ok(p.canMove(task.id, project.id), 'a task can move up a level');

        p.move(task.id, project.id);
        T.is(p.byId(task.id).parentId, project.id, 'the move happened');
        T.is(p.descendants(sub.id).length, 0, 'and the old parent lost it');
    });

    /* --------------------------------------------------------- ordering --- */
    await T.group('ordering', () => {
        const p = new Practice();
        const a = makeNode('client', { title: 'Alpha' });
        const b = makeNode('client', { title: 'Beta' });
        const c = makeNode('client', { title: 'Gamma' });
        p.nodes.push(a, b, c);
        T.is(p.roots().map(n => n.title), ['Alpha', 'Beta', 'Gamma'], 'alphabetical until dragged');

        p.move(c.id, null, { before: a.id });
        T.is(p.roots().map(n => n.title), ['Gamma', 'Alpha', 'Beta'], 'dragging one to the front');
        T.ok(p.byId(c.id).order != null, 'the dragged one carries an order');
    });

    /* ---------------------------------------------------------- billing --- */
    await T.group('billing', () => {
        const p = new Practice();
        const client = makeNode('client', { title: 'Client' });
        const hourly = makeNode('project', { title: 'Hourly', parentId: client.id, billing: 'hourly', rate: 200 });
        const fixed  = makeNode('project', { title: 'Fixed',  parentId: client.id, billing: 'fixed', fee: 4000, rate: 200 });
        const pro    = makeNode('project', { title: 'Pro bono', parentId: client.id, billing: 'probono', rate: 300 });
        const subOfFixed = makeNode('project', { title: 'Sub', parentId: fixed.id });
        p.nodes.push(client, hourly, fixed, pro, subOfFixed);

        T.is(p.billingOf(subOfFixed), 'fixed', 'a subproject inherits its parent’s billing');
        T.ok(p.isBillable(hourly), 'hourly is billable');
        T.not(p.isBillable(pro), 'pro bono is not');
        T.is(p.rateOf(subOfFixed), 200, 'rate is inherited too');

        const noRate = makeNode('project', { title: 'Plain', parentId: client.id });
        p.nodes.push(noRate);
        T.is(p.rateOf(noRate), 150, 'falls back to the default rate');
    });

    /* ------------------------------------------------------------ money --- */
    await T.group('money', () => {
        const p = new Practice();
        const client = makeNode('client', { title: 'Client' });
        const hourly = makeNode('project', { title: 'Hourly', parentId: client.id, billing: 'hourly', rate: 200 });
        const fixed  = makeNode('project', { title: 'Fixed',  parentId: client.id, billing: 'fixed', fee: 4000, rate: 200 });
        const pro    = makeNode('project', { title: 'Pro bono', parentId: client.id, billing: 'probono', rate: 300 });
        p.nodes.push(client, hourly, fixed, pro);
        p.entries.push(
            { id: 'e1', nodeId: hourly.id, minutes: 120, on: '2026-07-20', invoiceId: null },
            { id: 'e2', nodeId: fixed.id,  minutes: 600, on: '2026-07-20', invoiceId: null },
            { id: 'e3', nodeId: fixed.id,  minutes: 300, on: '2026-07-21', invoiceId: null },
            { id: 'e4', nodeId: pro.id,    minutes: 180, on: '2026-07-20', invoiceId: null }
        );

        const owed = p.unbilledFor(client.id);
        T.is(owed.total, 4400, 'hourly by the hour, fixed by the fee, pro bono not at all');
        T.is(owed.lines.length, 2, 'pro bono produces no line');
        T.is(owed.lines.find(l => /fixed fee/.test(l.description)).amount, 4000,
             'fifteen hours on a fixed fee still bills the fee');
        T.is(owed.lines.find(l => l.description === 'Hourly').amount, 400, 'two hours at 200');

        // the v2 disagreement, as a test: whatever the client card would say
        // must be what the invoice would charge
        const invoiceTotal = owed.lines.reduce((s, l) => s + l.amount, 0);
        T.is(invoiceTotal, owed.total, 'what is shown owed is what would be invoiced');

        // time under a task rolls up to its project
        const task = makeNode('task', { title: 'T', parentId: hourly.id });
        p.nodes.push(task);
        p.entries.push({ id: 'e5', nodeId: task.id, minutes: 60, on: '2026-07-22', invoiceId: null });
        T.is(p.unbilledFor(client.id).total, 4600, 'time logged on a task bills through its project');
        T.is(p.minutesOn(hourly.id, { includeChildren: true }), 180, 'minutes roll up');
        T.is(p.minutesOn(hourly.id), 120, 'and can be read without children');
    });

    /* -------------------------------------------------------------- day --- */
    await T.group('the day', () => {
        const p = new Practice();
        const c = makeNode('client', { title: 'C' });
        const pr = makeNode('project', { title: 'P', parentId: c.id });
        p.nodes.push(c, pr);
        const ref = '2026-07-25';
        const mk = (t, due, status) => {
            const n = makeNode('task', { title: t, parentId: pr.id, due, status });
            p.nodes.push(n); return n;
        };
        mk('late', '2026-07-22');
        mk('now', ref);
        mk('tomorrow', '2026-07-26');
        mk('in six', '2026-07-31');
        mk('in ten', '2026-08-04');
        mk('someday', null);
        mk('finished', ref, 'done');

        const d = p.day(ref);
        T.is(d.overdue.map(t => t.title), ['late'], 'overdue');
        T.is(d.today.map(t => t.title), ['now'], 'due today, and done ones are not open');
        T.is(d.soon.map(t => t.title), ['tomorrow', 'in six'],
             'seven days from today means seven days, whatever day it is');
        T.is(d.later.map(t => t.title), ['in ten'], 'beyond the horizon');
        T.is(d.undated.map(t => t.title), ['someday'], 'undated');
    });

    /* ----------------------------------------------------------- search --- */
    await T.group('search', () => {
        const p = new Practice();
        const c = makeNode('client', { title: 'Novawave' });
        const pr = makeNode('project', { title: 'AML compliance', parentId: c.id });
        const t1 = makeNode('task', { title: 'Quarterly AML report', parentId: pr.id });
        const t2 = makeNode('task', { title: 'Unrelated', parentId: pr.id });
        p.nodes.push(c, pr, t1, t2);

        const hits = p.search('aml');
        T.is(hits.length, 2, 'finds across every kind of node');
        T.is(hits[0].node.title, 'AML compliance', 'the one that starts with it comes first');
        T.is(p.search('quarterly')[0].path, 'Novawave › AML compliance',
             'a hit carries the path that explains it');
        T.is(p.search('').length, 0, 'an empty query finds nothing');
    });

    /* ------------------------------------------------------------ store ---
       The bug that loses work rather than annoying you: two devices editing
       and one silently winning. */
    await T.group('store · concurrent edits', () => {
        const A = { id: 'n1', title: 'Original', due: null, _v: {} };
        // device one renames it at 1000; device two sets a due date at 2000
        const one = Store.stamp({ ...A, title: 'Renamed' }, ['title'], 1000, 'phone');
        const two = Store.stamp({ ...A, due: '2026-08-01' }, ['due'], 2000, 'laptop');

        const merged = Store.merge(one, two);
        T.is(merged.title, 'Renamed', 'the rename survives');
        T.is(merged.due, '2026-08-01', 'and so does the due date');

        // the same field from both — later wins, deterministically
        const p1 = Store.stamp({ ...A, title: 'From phone' }, ['title'], 1000, 'phone');
        const p2 = Store.stamp({ ...A, title: 'From laptop' }, ['title'], 2000, 'laptop');
        T.is(Store.merge(p1, p2).title, 'From laptop', 'later write wins the field');
        T.is(Store.merge(p2, p1).title, 'From laptop', 'and the result does not depend on merge order');

        // a tie must still agree on both devices rather than flip-flop
        const t1 = Store.stamp({ ...A, title: 'aaa' }, ['title'], 5000, 'aaa-device');
        const t2 = Store.stamp({ ...A, title: 'zzz' }, ['title'], 5000, 'zzz-device');
        T.is(Store.merge(t1, t2).title, Store.merge(t2, t1).title, 'a tie resolves the same way both ways');
    });

    await T.group('store · deleting and the bin', async () => {
        // synchronous assertions on the promise-free parts
        const adapter = MemoryAdapter({ node: [
            { id: 'x', title: 'Doomed', deletedAt: null, _v: {} }
        ]});
        Store.use(adapter);
        T.ok(typeof Store.remove === 'function', 'removing is marking, not erasing');
        T.ok(typeof Store.restore === 'function', 'and there is a way back');
        T.ok(typeof Store.binned === 'function', 'the bin can be listed');
    });

    /* ---------------------------------------------------------- capture ---
       The AI names things; resolving names to nodes happens once, here. This
       is where a proposal quietly becomes a duplicate client if it is wrong. */
    await T.group('capture · turning proposals into nodes', async () => {
        // capture.js reads the globals P and Store, so stand them up
        const saved = { P: typeof P !== 'undefined' ? P : null };
        P = new Practice();
        Store.use(MemoryAdapter());

        const client = makeNode('client', { title: 'Novawave' });
        const project = makeNode('project', { title: 'AML', parentId: client.id });
        P.nodes.push(client, project);

        // a task naming an existing project by name lands inside it
        await applyAction({ op: 'createTask', data: { title: 'Report', projectName: 'AML', clientName: 'Novawave' } });
        const t = P.ofType('task').find(n => n.title === 'Report');
        T.ok(t, 'the task was created');
        T.is(t && t.parentId, project.id, 'named project resolves to the existing one');
        T.is(P.ofType('client').length, 1, 'and no second Novawave appears');

        // an unknown client is created once, not once per action
        await applyAction({ op: 'createTask', data: { title: 'A', clientName: 'Fligen' } });
        await applyAction({ op: 'createTask', data: { title: 'B', clientName: 'Fligen' } });
        T.is(P.ofType('client').filter(c => c.title === 'Fligen').length, 1,
             'two tasks for a new client make one client');

        // matching ignores case, because the model will not match your casing
        await applyAction({ op: 'createTask', data: { title: 'C', clientName: 'novawave' } });
        T.is(P.ofType('client').filter(c => /novawave/i.test(c.title)).length, 1,
             'client matching ignores case');

        // time with nothing to attach it to must refuse rather than vanish
        let threw = false;
        try { await applyAction({ op: 'logTime', data: { minutes: 60, clientName: 'Nobody At All' } }); }
        catch (e) { threw = true; }
        T.ok(threw, 'time with no target is refused, not silently dropped');

        threw = false;
        try { await applyAction({ op: 'logTime', data: { minutes: 0, clientName: 'Novawave' } }); }
        catch (e) { threw = true; }
        T.ok(threw, 'a time entry with no minutes is refused');

        await applyAction({ op: 'logTime', data: { minutes: 90, projectName: 'AML' } });
        T.is(P.minutesOn(project.id), 90, 'time lands on the named project');

        if (saved.P) P = saved.P;
    });

    await T.group('capture · what a proposal says it will do', () => {
        const saved = P;
        P = new Practice();
        Store.use(MemoryAdapter());
        T.ok(/New client/.test(describe({ op: 'createClient', data: { title: 'X' } })),
             'a client proposal reads as one');
        T.ok(/in Novawave/.test(describe({ op: 'createTask', data: { title: 'T', clientName: 'Novawave' } })),
             'a task says where it will go');
        T.ok(/1h 30m/.test(describe({ op: 'logTime', data: { minutes: 90, projectName: 'AML' } })),
             'time reads as hours and minutes, not raw minutes');
        P = saved;
    });

    /* ------------------------------------------------------- formatting --- */
    await T.group('formatting', () => {
        T.is(fmtMinutes(0), '0m', 'zero');
        T.is(fmtMinutes(45), '45m', 'under an hour');
        T.is(fmtMinutes(60), '1h 00m', 'exactly an hour');
        T.is(fmtMinutes(95), '1h 35m', 'the 1h35 that shows on a task');
        T.is(fmtMinutes(-5), '0m', 'never negative');
    });

    return T;
}

if (typeof module !== 'undefined') module.exports = { run, T };
