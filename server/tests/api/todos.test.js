const request = require('supertest');

jest.mock('../../ai/groqClient', () => ({ complete: jest.fn() }));
jest.mock('../../services/youtubeService', () => ({
  ...jest.requireActual('../../services/youtubeService'),
  searchVideos: jest.fn(async (query) => [
    { videoId: 'vid00000001', title: `Video for ${query}`, thumbnailUrl: 't.jpg', url: 'https://www.youtube.com/watch?v=vid00000001' },
  ]),
}));

const { complete } = require('../../ai/groqClient');
const { createApp } = require('../../app');
const TodoList = require('../../models/todoList');
const SkillPlan = require('../../models/skillPlan');
const Notification = require('../../models/notification');
const settings = require('../../services/settingsService');
const todos = require('../../services/todoService');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();
afterEach(() => {
  jest.clearAllMocks();
  complete.mockReset();
});

const TODAY = new Date().toISOString().slice(0, 10);
const shift = (n) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

const api = (user = ALICE) => ({
  get: (path) => request(app).get(path).set('Authorization', bearer(user)),
  post: (path, body = {}) => request(app).post(path).set('Authorization', bearer(user)).send(body),
  patch: (path, body = {}) => request(app).patch(path).set('Authorization', bearer(user)).send(body),
  put: (path, body = {}) => request(app).put(path).set('Authorization', bearer(user)).send(body),
  del: (path) => request(app).delete(path).set('Authorization', bearer(user)),
});

async function makeList(user = ALICE, body = {}) {
  const res = await api(user).post('/api/todos', { title: 'DBMS exam prep', items: ['Revise ER diagrams', { text: 'Solve SQL joins', priority: 'high', dueDate: shift(2) }], ...body });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Todo lists', () => {
  it('creates, lists, renames and deletes a list', async () => {
    const list = await makeList();
    expect(list).toMatchObject({ title: 'DBMS exam prep', source: 'manual', total: 2, done: 0, skillPlanId: null });
    expect(list.items[1]).toMatchObject({ text: 'Solve SQL joins', priority: 'high', dueDate: shift(2), done: false, subtasks: [] });

    const all = await api().get('/api/todos');
    expect(all.body.lists).toHaveLength(1);
    expect(all.body.lists[0]).toMatchObject({ title: 'DBMS exam prep', total: 2, nextDue: shift(2) });
    expect(all.body.lists[0].items).toBeUndefined();

    const renamed = await api().patch(`/api/todos/${list._id}`, { title: 'DBMS finals', description: 'Exam on Friday' });
    expect(renamed.body).toMatchObject({ title: 'DBMS finals', description: 'Exam on Friday' });

    expect((await api().del(`/api/todos/${list._id}`)).status).toBe(200);
    expect(await TodoList.countDocuments()).toBe(0);
  });

  it('keeps each student to their own lists', async () => {
    const list = await makeList();
    const itemId = list.items[0]._id;
    expect((await api(BOB).get(`/api/todos/${list._id}`)).status).toBe(404);
    expect((await api(BOB).patch(`/api/todos/${list._id}`, { title: 'Mine now' })).status).toBe(404);
    expect((await api(BOB).post(`/api/todos/${list._id}/items`, { text: 'Sneaky' })).status).toBe(404);
    expect((await api(BOB).patch(`/api/todos/${list._id}/items/${itemId}`, { done: true })).status).toBe(404);
    expect((await api(BOB).del(`/api/todos/${list._id}`)).status).toBe(404);
    expect((await api(BOB).get('/api/todos')).body.lists).toEqual([]);
    expect((await request(app).get('/api/todos')).status).toBe(401);
  });

  it('validates what it stores', async () => {
    expect((await api().post('/api/todos', { title: '' })).status).toBe(400);
    expect((await api().post('/api/todos', { title: 'x'.repeat(121) })).status).toBe(400);
    expect((await api().post('/api/todos', { title: 'T', items: [{ text: 'a', priority: 'urgent' }] })).status).toBe(400);
    expect((await api().post('/api/todos', { title: 'T', items: [{ text: 'a', dueDate: '2026-02-30' }] })).status).toBe(400);
    expect((await api().post('/api/todos', { title: 'T', items: [{ text: { $ne: 1 } }] })).status).toBe(400);
    const list = await makeList();
    expect((await api().patch(`/api/todos/${list._id}/items/${list.items[0]._id}`, { done: 'yes' })).status).toBe(400);
    expect((await api().patch(`/api/todos/${list._id}/items/${list.items[0]._id}`, {})).status).toBe(400);
    expect((await api().get('/api/todos/not-an-id')).status).toBe(400);
  });

  it('caps the tasks in a list', async () => {
    const list = await makeList(ALICE, { items: Array.from({ length: todos.LIMITS.items }, (_, i) => `Task ${i}`) });
    const res = await api().post(`/api/todos/${list._id}/items`, { text: 'One too many' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most 200/);
  });

  it('adds, edits, ticks off and deletes tasks', async () => {
    const list = await makeList();
    const added = await api().post(`/api/todos/${list._id}/items`, { text: 'Normalisation', notes: '1NF to BCNF', subtasks: ['1NF', '2NF'] });
    expect(added.status).toBe(201);
    const item = added.body.items[2];
    expect(item).toMatchObject({ text: 'Normalisation', notes: '1NF to BCNF', subtasks: [{ text: '1NF', done: false }, { text: '2NF', done: false }] });

    const ticked = await api().patch(`/api/todos/${list._id}/items/${item._id}`, { done: true, subtasks: [{ text: '1NF', done: true }, { text: '2NF', done: true }] });
    expect(ticked.body.items[2]).toMatchObject({ done: true, subtasks: [{ done: true }, { done: true }] });
    expect(ticked.body.items[2].doneAt).toBeTruthy();
    expect(ticked.body.done).toBe(1);

    const unticked = await api().patch(`/api/todos/${list._id}/items/${item._id}`, { done: false, priority: null, dueDate: shift(-1) });
    expect(unticked.body.items[2]).toMatchObject({ done: false, doneAt: null, priority: null, dueDate: shift(-1) });
    expect(unticked.body.overdue).toBe(1);

    const removed = await api().del(`/api/todos/${list._id}/items/${item._id}`);
    expect(removed.body.items).toHaveLength(2);
    expect((await api().del(`/api/todos/${list._id}/items/${item._id}`)).status).toBe(404);
  });

  it('reorders tasks, refusing an order that does not match the list', async () => {
    const list = await makeList();
    const [a, b] = list.items.map((i) => i._id);
    const res = await api().put(`/api/todos/${list._id}/order`, { itemIds: [b, a] });
    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i._id)).toEqual([b, a]);
    expect((await api().put(`/api/todos/${list._id}/order`, { itemIds: [a] })).status).toBe(409);
    expect((await api().put(`/api/todos/${list._id}/order`, { itemIds: [a, a] })).status).toBe(400);
    expect((await api().put(`/api/todos/${list._id}/order`, { itemIds: 'x' })).status).toBe(400);
  });

  it('clears completed tasks', async () => {
    const list = await makeList();
    await api().patch(`/api/todos/${list._id}/items/${list.items[0]._id}`, { done: true });
    const res = await api().post(`/api/todos/${list._id}/clear-completed`);
    expect(res.body.items.map((i) => i.text)).toEqual(['Solve SQL joins']);
  });
});

describe('AI drafts', () => {
  it('drafts a list without saving it, turning days into dates', async () => {
    complete.mockResolvedValueOnce('```json\n{"title":"OS exam prep","items":[{"text":"Revise scheduling","priority":"high","dueInDays":1,"subtasks":["FCFS","Round robin"]},{"text":"Practise deadlock problems","priority":"urgent","dueInDays":null}]}\n```');
    const res = await api().post('/api/todos/draft', { prompt: 'OS exam in 3 days, need to revise', today: TODAY });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      title: 'OS exam prep',
      items: [
        { text: 'Revise scheduling', priority: 'high', dueDate: shift(1), subtasks: ['FCFS', 'Round robin'] },
        { text: 'Practise deadlock problems', priority: null, dueDate: null, subtasks: [] },
      ],
    });
    expect(complete.mock.calls[0][0].messages[0].content).toContain('Stay educational:');
    expect(await TodoList.countDocuments()).toBe(0);
  });

  it('passes on a kind decline for an out-of-scope request', async () => {
    complete.mockResolvedValueOnce('{"declined":"I can only help with educational topics."}');
    const res = await api().post('/api/todos/draft', { prompt: 'plan my cousin’s wedding shopping' });
    expect(res.body).toEqual({ declined: 'I can only help with educational topics.' });
  });

  it('reports an unusable model reply instead of an empty list', async () => {
    complete.mockResolvedValueOnce('Sorry, I cannot do that');
    expect((await api().post('/api/todos/draft', { prompt: 'Revise for my exam' })).status).toBe(502);
    expect((await api().post('/api/todos/draft', { prompt: '' })).status).toBe(400);
  });

  it('stops drafting when an admin switches the tool off', async () => {
    await settings.set('features.todos', { enabled: false, message: 'Back soon.', notice: '' }, { actor: { email: 'root@example.com', role: 'superadmin' } });
    const res = await api().post('/api/todos/draft', { prompt: 'Revise for my exam' });
    expect(res.status).not.toBe(200);
    expect(complete).not.toHaveBeenCalled();
    expect((await api().post('/api/todos', { title: 'By hand still works' })).status).toBe(201);
  });
});

describe('Turning a list into a Skill Unlocker plan', () => {
  const planJson = (days) => JSON.stringify(Array.from({ length: days }, (_, i) => ({ day: i + 1, topic: `Topic ${i + 1}`, objective: 'o', videoTitle: 'v' })));
  const convert = (list, body = {}) => api().post(`/api/todos/${list._id}/skill-plan`, {
    skillName: 'DBMS', duration: 10, description: 'Pass the DBMS exam', preferences: { level: 'beginner' }, ...body,
  });

  it('builds a plan that follows the open tasks, and links it', async () => {
    const list = await makeList();
    await api().patch(`/api/todos/${list._id}/items/${list.items[0]._id}`, { subtasks: ['Entities', 'Relationships'] });
    complete.mockResolvedValueOnce(planJson(10));
    const res = await convert(list);
    expect(res.status).toBe(201);
    expect(res.body.plan).toMatchObject({ skillName: 'DBMS', duration: 10 });
    expect(res.body.list.skillPlanId).toBe(res.body.plan._id);

    const prompt = complete.mock.calls[0][0].messages[1].content;
    expect(prompt).toContain('1. Revise ER diagrams (Entities, Relationships)');
    expect(prompt).toContain('2. Solve SQL joins');
    const plan = await SkillPlan.findById(res.body.plan._id).lean();
    expect(plan).toMatchObject({ userId: ALICE.email, skillName: 'DBMS' });
    expect(plan.topics).toBeUndefined();
    expect((await TodoList.findById(list._id).lean()).convertingAt).toBeNull();
  });

  it('refuses a second plan while the first exists, and allows one after it is deleted', async () => {
    const list = await makeList();
    complete.mockResolvedValueOnce(planJson(10));
    const first = await convert(list);
    const again = await convert(list);
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'ALREADY_CONVERTED', details: { planId: first.body.plan._id } });

    await SkillPlan.deleteMany({});
    complete.mockResolvedValueOnce(planJson(10));
    expect((await convert(list)).status).toBe(201);
  });

  it('frees the list when the plan cannot be made', async () => {
    const list = await makeList();
    expect((await convert(list, { duration: 5 })).status).toBe(400);
    complete.mockResolvedValueOnce('not json');
    expect((await convert(list)).status).toBe(502);
    expect((await TodoList.findById(list._id).lean()).convertingAt).toBeNull();
    complete.mockResolvedValueOnce(planJson(10));
    expect((await convert(list)).status).toBe(201);
  });

  it('needs tasks, and only works on the student’s own list', async () => {
    const empty = await makeList(ALICE, { items: [] });
    expect((await convert(empty)).status).toBe(400);
    const list = await makeList();
    const res = await api(BOB).post(`/api/todos/${list._id}/skill-plan`, { skillName: 'DBMS', duration: 10, description: 'x' });
    expect(res.status).toBe(404);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('Due reminders', () => {
  it('reminds once per list for due and overdue tasks, and again for a new due date', async () => {
    const list = await makeList(ALICE, {
      items: [
        { text: 'Overdue task', dueDate: shift(-2) },
        { text: 'Due today', dueDate: TODAY },
        { text: 'Later', dueDate: shift(3) },
        { text: 'Done already', dueDate: shift(-1), done: true },
      ],
    });
    await makeList(BOB, { items: [{ text: 'Bob task', dueDate: TODAY }] });

    const bell = await api().get(`/api/notifications?today=${TODAY}`);
    expect(bell.status).toBe(200);
    expect(bell.body.notifications).toHaveLength(1);
    expect(bell.body.notifications[0]).toMatchObject({ kind: 'todo_due', title: '2 tasks due in “DBMS exam prep”', link: `/todos?open=${list._id}` });
    expect(bell.body.notifications[0].body).toContain('Overdue task');

    await api().get(`/api/notifications?today=${TODAY}`);
    await Promise.all([todos.sweepDueReminders(ALICE.email, TODAY), todos.sweepDueReminders(ALICE.email, TODAY)]);
    expect(await Notification.countDocuments({ userId: ALICE.email })).toBe(1);

    const later = list.items[2];
    await api().patch(`/api/todos/${list._id}/items/${later._id}`, { dueDate: TODAY });
    await api().get(`/api/notifications?today=${TODAY}`);
    const notes = await Notification.find({ userId: ALICE.email }).sort({ createdAt: 1 }).lean();
    expect(notes).toHaveLength(2);
    expect(notes[1].title).toBe('1 task due in “DBMS exam prep”');
    expect(await Notification.countDocuments({ userId: BOB.email })).toBe(0);
  });

  it('ignores a made-up "today" far from the real date', () => {
    expect(todos.readToday('1999-01-01')).toBe(TODAY);
    expect(todos.readToday('nope')).toBe(TODAY);
    expect(todos.readToday(shift(1))).toBe(shift(1));
  });
});

describe('Due reminders keep the lists in place', () => {
  it('does not move a list to the top when a reminder is sent', async () => {
    const due = await makeList(ALICE, { title: 'Older list', items: [{ text: 'Due now', dueDate: TODAY }] });
    await new Promise((ok) => setTimeout(ok, 20));
    await makeList(ALICE, { title: 'Newer list', items: [] });
    const before = (await TodoList.findById(due._id).lean()).updatedAt;
    await todos.sweepDueReminders(ALICE.email, TODAY);
    expect((await TodoList.findById(due._id).lean()).updatedAt).toEqual(before);
    expect((await api().get('/api/todos')).body.lists.map((l) => l.title)).toEqual(['Newer list', 'Older list']);
  });
});
