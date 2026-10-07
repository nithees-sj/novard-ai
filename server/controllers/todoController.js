const todos = require('../services/todoService');
const { currentUserId } = require('../middleware/auth');

/**
 * Todo lists. The owner is always the signed-in student. `today` is the
 * student's local date (query or body), used for due and overdue counts.
 */
const me = (req) => currentUserId(req);
const today = (req) => req.query.today || req.body?.today;

exports.list = async (req, res) => {
  res.json({ lists: await todos.listLists(me(req), today(req)) });
};

exports.create = async (req, res) => {
  const { title, description, items, source } = req.body || {};
  res.status(201).json(await todos.createList({ userId: me(req), title, description, items, source }, { today: today(req) }));
};

exports.get = async (req, res) => {
  res.json(await todos.getList(me(req), req.params.id, today(req)));
};

exports.update = async (req, res) => {
  res.json(await todos.updateList(me(req), req.params.id, req.body || {}, today(req)));
};

exports.remove = async (req, res) => {
  res.json(await todos.deleteList(me(req), req.params.id));
};

exports.addItem = async (req, res) => {
  res.status(201).json(await todos.addItem(me(req), req.params.id, req.body || {}, today(req)));
};

exports.updateItem = async (req, res) => {
  res.json(await todos.updateItem(me(req), req.params.id, req.params.itemId, req.body || {}, today(req)));
};

exports.removeItem = async (req, res) => {
  res.json(await todos.deleteItem(me(req), req.params.id, req.params.itemId, today(req)));
};

exports.reorder = async (req, res) => {
  res.json(await todos.reorderItems(me(req), req.params.id, req.body?.itemIds, today(req)));
};

exports.clearCompleted = async (req, res) => {
  res.json(await todos.clearCompleted(me(req), req.params.id, today(req)));
};

exports.draft = async (req, res) => {
  res.json(await todos.draftList({ prompt: req.body?.prompt, today: today(req) }));
};

exports.toSkillPlan = async (req, res) => {
  res.status(201).json(await todos.convertToSkillPlan({ userId: me(req), listId: req.params.id, body: req.body || {} }));
};
