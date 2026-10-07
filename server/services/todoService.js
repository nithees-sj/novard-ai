const TodoList = require('../models/todoList');
const SkillPlan = require('../models/skillPlan');
const { MODELS } = require('../config/ai');
const { complete } = require('../ai/groqClient');
const { todoDraftPrompt } = require('../ai/prompts');
const { parseModelJson } = require('../utils/parseModelJson');
const { createSkillPlan } = require('./skillPlanService');
const { notify } = require('./notificationService');
const { badRequest, conflict, notFound, upstreamError } = require('../utils/httpError');
const { objectId, text, oneOf } = require('../utils/validate');
const logger = require('../utils/logger');

/**
 * Todo lists: a student's own lists of tasks, made by hand, drafted by AI on
 * the page or by the Novard Agent, and optionally turned into a Skill
 * Unlocker plan. Every query is scoped to the session user.
 */

const LIMITS = { lists: 100, items: 200, subtasks: 20, title: 120, description: 500, item: 200, notes: 2000, prompt: 2000 };
const PRIORITIES = ['low', 'medium', 'high'];
const SOURCES = ['manual', 'ai', 'agent'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
// A conversion that has not finished after this long is treated as failed.
const CONVERT_STALE_MS = 10 * 60 * 1000;

// ── dates ─────────────────────────────────────────────────────────────────

const isoDay = (d) => d.toISOString().slice(0, 10);
const validDay = (s) => typeof s === 'string' && DATE.test(s) && isoDay(new Date(`${s}T00:00:00Z`)) === s;
const addDays = (day, n) => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));

/**
 * The student's local date, as their browser reports it. Anything that is not
 * a real date within a day of UTC (every time zone is) falls back to UTC today.
 */
function readToday(value) {
  const utc = isoDay(new Date());
  if (!validDay(value)) return utc;
  return Math.abs(Date.parse(`${value}T00:00:00Z`) - Date.parse(`${utc}T00:00:00Z`)) <= DAY_MS ? value : utc;
}

function dueDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!validDay(value)) throw badRequest('Due date must be a date like 2026-10-31.');
  return value;
}

// ── input ─────────────────────────────────────────────────────────────────

const priority = (value) => (value === undefined || value === null || value === '' ? null : oneOf(value, 'Priority', PRIORITIES));

function subtasks(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest('Subtasks must be a list.');
  if (value.length > LIMITS.subtasks) throw badRequest(`A task can have at most ${LIMITS.subtasks} subtasks.`);
  return value.map((s) => (typeof s === 'string'
    ? { text: text(s, 'Subtask', { max: LIMITS.item }), done: false }
    : { text: text(s?.text, 'Subtask', { max: LIMITS.item }), done: s?.done === true }));
}

/** A new item from the request; throws 400 on anything unusable. */
function readItem(body = {}) {
  return {
    text: text(body.text, 'Task', { max: LIMITS.item }),
    notes: text(body.notes, 'Notes', { required: false, max: LIMITS.notes, collapse: false }),
    priority: priority(body.priority),
    dueDate: dueDate(body.dueDate),
    subtasks: subtasks(body.subtasks),
    done: body.done === true,
    doneAt: body.done === true ? new Date() : null,
  };
}

/** Only the fields present in the patch, cleaned. */
function readItemPatch(body = {}) {
  const patch = {};
  if ('text' in body) patch.text = text(body.text, 'Task', { max: LIMITS.item });
  if ('notes' in body) patch.notes = text(body.notes, 'Notes', { required: false, max: LIMITS.notes, collapse: false });
  if ('priority' in body) patch.priority = priority(body.priority);
  if ('dueDate' in body) patch.dueDate = dueDate(body.dueDate);
  if ('subtasks' in body) patch.subtasks = subtasks(body.subtasks);
  if ('done' in body) {
    if (typeof body.done !== 'boolean') throw badRequest('Done must be true or false.');
    patch.done = body.done;
    patch.doneAt = body.done ? new Date() : null;
  }
  if (!Object.keys(patch).length) throw badRequest('Nothing to change.');
  return patch;
}

function readListFields(body = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || 'title' in body) out.title = text(body.title, 'List name', { max: LIMITS.title });
  if (!partial || 'description' in body) out.description = text(body.description, 'Description', { required: false, max: LIMITS.description, collapse: false });
  if (partial && !Object.keys(out).length) throw badRequest('Nothing to change.');
  return out;
}

// ── output ────────────────────────────────────────────────────────────────

const presentItem = (i) => ({
  _id: String(i._id),
  text: i.text,
  notes: i.notes || '',
  done: Boolean(i.done),
  doneAt: i.doneAt || null,
  priority: i.priority || null,
  dueDate: i.dueDate || null,
  subtasks: (i.subtasks || []).map((s) => ({ _id: String(s._id), text: s.text, done: Boolean(s.done) })),
});

function counts(items, today) {
  const open = items.filter((i) => !i.done);
  const dated = open.map((i) => i.dueDate).filter(Boolean).sort();
  return {
    total: items.length,
    done: items.length - open.length,
    overdue: dated.filter((d) => d < today).length,
    dueToday: dated.filter((d) => d === today).length,
    nextDue: dated[0] || null,
  };
}

function present(list, today = readToday()) {
  const items = list.items || [];
  return {
    _id: String(list._id),
    title: list.title,
    description: list.description || '',
    source: list.source || 'manual',
    skillPlanId: list.skillPlanId ? String(list.skillPlanId) : null,
    items: items.map(presentItem),
    ...counts(items, today),
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
}

// ── lists ─────────────────────────────────────────────────────────────────

async function findOwnList(userId, listId) {
  const list = await TodoList.findOne({ _id: objectId(listId, 'list id'), userId });
  if (!list) throw notFound('List not found');
  return list;
}

/** Every list, newest activity first, without the items themselves. */
async function listLists(userId, today) {
  const day = readToday(today);
  const lists = await TodoList.find({ userId }).sort({ updatedAt: -1 })
    .select('title description source skillPlanId items.done items.dueDate createdAt updatedAt').lean();
  return lists.map((l) => {
    const summary = present(l, day);
    delete summary.items;
    return summary;
  });
}

async function getList(userId, listId, today) {
  return present(await findOwnList(userId, listId), readToday(today));
}

async function createList({ userId, title, description, items, source }, { today } = {}) {
  const fields = readListFields({ title, description });
  if (items !== undefined && !Array.isArray(items)) throw badRequest('Tasks must be a list.');
  const list = (items || []).map((i) => readItem(typeof i === 'string' ? { text: i } : i));
  if (list.length > LIMITS.items) throw badRequest(`A list can have at most ${LIMITS.items} tasks.`);
  if (await TodoList.countDocuments({ userId }) >= LIMITS.lists) {
    throw badRequest(`You can keep up to ${LIMITS.lists} lists. Delete one you no longer need first.`);
  }
  const created = await TodoList.create({ userId, ...fields, source: oneOf(source, 'Source', SOURCES, { fallback: 'manual' }), items: list });
  return present(created, readToday(today));
}

async function updateList(userId, listId, body, today) {
  const fields = readListFields(body, { partial: true });
  const list = await TodoList.findOneAndUpdate({ _id: objectId(listId, 'list id'), userId }, { $set: fields }, { new: true });
  if (!list) throw notFound('List not found');
  return present(list, readToday(today));
}

async function deleteList(userId, listId) {
  const { deletedCount } = await TodoList.deleteOne({ _id: objectId(listId, 'list id'), userId });
  if (!deletedCount) throw notFound('List not found');
  return { deleted: true };
}

// ── items ─────────────────────────────────────────────────────────────────

async function addItem(userId, listId, body, today) {
  const item = readItem(body);
  const id = objectId(listId, 'list id');
  const list = await TodoList.findOneAndUpdate(
    { _id: id, userId, [`items.${LIMITS.items - 1}`]: { $exists: false } },
    { $push: { items: item } },
    { new: true },
  );
  if (!list) {
    await findOwnList(userId, id); // 404 when it is not theirs
    throw badRequest(`A list can have at most ${LIMITS.items} tasks.`);
  }
  return present(list, readToday(today));
}

async function updateItem(userId, listId, itemId, body, today) {
  const patch = readItemPatch(body);
  const set = Object.fromEntries(Object.entries(patch).map(([k, v]) => [`items.$.${k}`, v]));
  const list = await TodoList.findOneAndUpdate(
    { _id: objectId(listId, 'list id'), userId, 'items._id': objectId(itemId, 'task id') },
    { $set: set },
    { new: true },
  );
  if (!list) throw notFound('Task not found');
  return present(list, readToday(today));
}

async function deleteItem(userId, listId, itemId, today) {
  const id = objectId(itemId, 'task id');
  const list = await TodoList.findOneAndUpdate(
    { _id: objectId(listId, 'list id'), userId, 'items._id': id },
    { $pull: { items: { _id: id } } },
    { new: true },
  );
  if (!list) throw notFound('Task not found');
  return present(list, readToday(today));
}

/** Put the tasks in the given order. The ids must be exactly the list's tasks. */
async function reorderItems(userId, listId, itemIds, today) {
  if (!Array.isArray(itemIds) || !itemIds.every((i) => typeof i === 'string')) throw badRequest('Order must be a list of task ids.');
  const list = await findOwnList(userId, listId);
  if (new Set(itemIds).size !== itemIds.length) throw badRequest('Each task can appear in the order only once.');
  const byId = new Map(list.items.map((i) => [String(i._id), i]));
  if (itemIds.length !== byId.size || !itemIds.every((i) => byId.has(i))) {
    throw conflict('The list changed while you were reordering it. Reload and try again.');
  }
  list.items = itemIds.map((i) => byId.get(i));
  try {
    await list.save(); // versioned: a concurrent change to the tasks fails instead of being lost
  } catch (error) {
    if (error.name === 'VersionError') throw conflict('The list changed while you were reordering it. Reload and try again.');
    throw error;
  }
  return present(list, readToday(today));
}

async function clearCompleted(userId, listId, today) {
  const list = await TodoList.findOneAndUpdate(
    { _id: objectId(listId, 'list id'), userId },
    { $pull: { items: { done: true } } },
    { new: true },
  );
  if (!list) throw notFound('List not found');
  return present(list, readToday(today));
}

// ── AI draft ──────────────────────────────────────────────────────────────

/** The model's list, cleaned: [] items when nothing usable came back. */
function normaliseDraft(raw, today) {
  const items = (Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [])
    .filter((i) => i && (typeof i === 'string' || String(i.text || '').trim()))
    .slice(0, 30)
    .map((i) => {
      const item = typeof i === 'string' ? { text: i } : i;
      const days = item.dueInDays === null || item.dueInDays === undefined || item.dueInDays === '' ? NaN : Number(item.dueInDays);
      return {
        text: String(item.text).replace(/\s+/g, ' ').trim().slice(0, LIMITS.item),
        priority: PRIORITIES.includes(item.priority) ? item.priority : null,
        dueDate: Number.isInteger(days) && days >= 0 && days <= 365 ? addDays(today, days) : null,
        subtasks: (Array.isArray(item.subtasks) ? item.subtasks : [])
          .map((s) => String(typeof s === 'string' ? s : s?.text || '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.item))
          .filter(Boolean).slice(0, 5),
      };
    });
  const title = String(raw?.title || '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.title) || 'My todo list';
  return { title, items };
}

/**
 * Draft a list from what the student says they need to do. Nothing is saved:
 * the student reviews and edits the draft first. Returns { declined } for a
 * request outside Novard's educational scope.
 */
async function draftList({ prompt, today }) {
  const request = text(prompt, 'What you need to do', { min: 3, max: LIMITS.prompt, collapse: false });
  const day = readToday(today);
  const reply = await complete({
    messages: [
      { role: 'system', content: todoDraftPrompt() },
      { role: 'user', content: `Today is ${day}.\n\n${request}` },
    ],
    model: MODELS.REASONING,
    temperature: 0.4,
  });

  let raw;
  try {
    raw = parseModelJson(reply, { context: 'todo draft' });
  } catch (error) {
    logger.warn('Could not parse the todo draft', { error: error.message });
  }
  if (raw && typeof raw.declined === 'string' && raw.declined.trim()) return { declined: raw.declined.trim().slice(0, 500) };
  const draft = raw && normaliseDraft(raw, day);
  if (!draft?.items.length) throw upstreamError('The list could not be drafted. Please try again.');
  return draft;
}

// ── Skill Unlocker ────────────────────────────────────────────────────────

/** The open tasks (or all, when everything is done) as plan topics, subtasks included. */
function planTopics(items) {
  const open = items.filter((i) => !i.done);
  return (open.length ? open : items).map((i) => {
    const steps = (i.subtasks || []).map((s) => s.text).join(', ');
    return (steps ? `${i.text} (${steps})` : i.text).slice(0, 200);
  });
}

/**
 * Turn a list into a day-by-day Skill Unlocker plan whose days follow its
 * tasks. The list is claimed first, so a double click makes one plan.
 */
async function convertToSkillPlan({ userId, listId, body = {} }) {
  const list = await findOwnList(userId, listId);
  if (list.skillPlanId && await SkillPlan.exists({ _id: list.skillPlanId, userId })) {
    throw conflict('This list is already a Skill Unlocker plan.', { code: 'ALREADY_CONVERTED', details: { planId: String(list.skillPlanId) } });
  }
  if (!list.items.length) throw badRequest('Add some tasks before turning the list into a plan.');

  const claimed = await TodoList.findOneAndUpdate(
    { _id: list._id, userId, skillPlanId: list.skillPlanId, $or: [{ convertingAt: null }, { convertingAt: { $lt: new Date(Date.now() - CONVERT_STALE_MS) } }] },
    { $set: { convertingAt: new Date() } },
  );
  if (!claimed) throw conflict('This list is already being turned into a plan.');

  try {
    const prefs = body.preferences && typeof body.preferences === 'object' ? body.preferences : {};
    const plan = await createSkillPlan({
      userId,
      skillName: body.skillName,
      duration: body.duration,
      description: body.description,
      preferences: prefs,
      topics: planTopics(list.items),
    });
    const updated = await TodoList.findOneAndUpdate(
      { _id: list._id, userId },
      { $set: { skillPlanId: plan._id, convertingAt: null } },
      { new: true },
    );
    return {
      list: present(updated || list, readToday(body.today)),
      plan: { _id: String(plan._id), skillName: plan.skillName, duration: plan.duration },
    };
  } catch (error) {
    await TodoList.updateOne({ _id: list._id, userId }, { $set: { convertingAt: null } });
    throw error;
  }
}

// ── reminders ─────────────────────────────────────────────────────────────

/**
 * Bell reminders for tasks that are due or overdue. Nothing runs on a timer
 * (the server scales to zero), so this runs when the student's bell loads.
 * Each task is claimed atomically for its due date before it counts, so two
 * sweeps at once remind once; a new due date reminds again.
 */
async function sweepDueReminders(userId, today) {
  const day = readToday(today);
  const lists = await TodoList.find({ userId, items: { $elemMatch: { done: false, dueDate: { $ne: null, $lte: day } } } })
    .select('title items._id items.text items.done items.dueDate items.remindedFor').lean();

  const claim = (list, item) => TodoList.updateOne(
    { _id: list._id, userId, items: { $elemMatch: { _id: item._id, done: false, dueDate: item.dueDate, remindedFor: { $ne: item.dueDate } } } },
    { $set: { 'items.$.remindedFor': item.dueDate } },
    { timestamps: false }, // a reminder is not an edit: the list keeps its place in the rail
  ).then(({ modifiedCount }) => (modifiedCount ? item : null));

  const perList = await Promise.all(lists.map(async (list) => {
    const due = list.items.filter((i) => !i.done && i.dueDate && i.dueDate <= day && i.remindedFor !== i.dueDate);
    return { list, claimed: (await Promise.all(due.map((item) => claim(list, item)))).filter(Boolean) };
  }));

  const notes = perList.filter(({ claimed }) => claimed.length).map(({ list, claimed }) => {
    const overdue = claimed.filter((i) => i.dueDate < day).length;
    const n = claimed.length;
    return {
      userId,
      kind: 'todo_due',
      title: `${n} ${n === 1 ? 'task' : 'tasks'} ${overdue === n ? 'overdue' : 'due'} in “${list.title}”`.slice(0, 200),
      body: claimed.slice(0, 3).map((i) => `• ${i.text}${i.dueDate < day ? ` (was due ${i.dueDate})` : ''}`).join('\n')
        + (n > 3 ? `\n…and ${n - 3} more` : ''),
      link: `/todos?open=${list._id}`,
    };
  });
  if (notes.length) await notify(notes);
  return notes.length;
}

/** A few lines about the student's lists for the Novard Agent's workspace tool. */
async function recentListsSummary(userId, limit = 5) {
  const day = readToday();
  const lists = await TodoList.find({ userId }).sort({ updatedAt: -1 }).limit(limit)
    .select('title items.done items.dueDate').lean();
  return lists.map((l) => {
    const c = counts(l.items || [], day);
    return { title: l.title, done: `${c.done}/${c.total}`, ...(c.overdue ? { overdue: c.overdue } : {}) };
  });
}

module.exports = {
  LIMITS,
  readToday,
  listLists,
  getList,
  createList,
  updateList,
  deleteList,
  addItem,
  updateItem,
  deleteItem,
  reorderItems,
  clearCompleted,
  draftList,
  convertToSkillPlan,
  sweepDueReminders,
  recentListsSummary,
  _internal: { normaliseDraft, planTopics, addDays },
};
