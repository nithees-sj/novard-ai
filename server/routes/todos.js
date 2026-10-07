const { Router } = require('express');
const h = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { aiFeature } = require('../middleware/featureGate');
const todos = require('../controllers/todoController');

/**
 * Todo lists. A student's own lists always work; only the AI routes are
 * behind a tool switch, quota and token limit. Turning a list into a plan
 * counts as making a Skill Unlocker plan.
 */
const router = Router();
router.use('/api/todos', requireAuth());

router.post('/api/todos/draft', aiLimiter, aiFeature('todo.draft'), h(todos.draft));
router.get('/api/todos', h(todos.list));
router.post('/api/todos', h(todos.create));
router.get('/api/todos/:id', h(todos.get));
router.patch('/api/todos/:id', h(todos.update));
router.delete('/api/todos/:id', h(todos.remove));
router.post('/api/todos/:id/items', h(todos.addItem));
router.patch('/api/todos/:id/items/:itemId', h(todos.updateItem));
router.delete('/api/todos/:id/items/:itemId', h(todos.removeItem));
router.put('/api/todos/:id/order', h(todos.reorder));
router.post('/api/todos/:id/clear-completed', h(todos.clearCompleted));
router.post('/api/todos/:id/skill-plan', aiLimiter, aiFeature('skillplan.create'), h(todos.toSkillPlan));

module.exports = router;
