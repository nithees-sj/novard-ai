const consoleService = require('../../services/admin/consoleService');
const gateways = require('../../services/admin/gatewayService');
const { costs } = require('../../services/admin/costService');
const users = require('../../services/admin/usersService');
const moderation = require('../../services/admin/moderationService');
const announcements = require('../../services/announcementService');
const { objectId } = require('../../utils/validate');

const opts = (req) => ({ ip: req.ip });

// Overview and risk
exports.overview = async (req, res) => res.json(await consoleService.overview());
exports.board = async (req, res) => res.json(await consoleService.board({ rescan: req.query.rescan !== 'false' }));
exports.area = async (req, res) => res.json(await consoleService.areaDetail(req.params.area));
exports.alerts = async (req, res) => res.json(await consoleService.alerts({ includeAcknowledged: req.query.all === 'true' }));
exports.ackAlert = async (req, res) => res.json({ alert: await consoleService.acknowledge(req.admin, req.params.id, opts(req)) });

// Gateways and costs
exports.gateways = async (req, res) => res.json({ gateways: await gateways.listGateways() });
exports.gateway = async (req, res) => res.json(await gateways.gatewayDetail(req.params.id));
exports.gatewaySettings = async (req, res) => res.json({ value: await gateways.updateSetting(req.admin, req.params.id, req.body || {}, opts(req)) });
exports.gatewayTest = async (req, res) => res.json(await gateways.testGateway(req.params.id));
exports.costs = async (req, res) => res.json(await costs(req.query));

// Users
exports.users = async (req, res) => res.json(await users.listUsers(req.query));
exports.user = async (req, res) => res.json(await users.userDetail(objectId(req.params.id, 'user id')));
exports.revealEmail = async (req, res) => res.json(await users.revealEmail(req.admin, objectId(req.params.id, 'user id'), opts(req)));

// Moderation
exports.forumIssues = async (req, res) => res.json(await moderation.listIssues(req.query));
exports.forumIssue = async (req, res) => res.json(await moderation.getIssue(req.params.issueId));
exports.forumIssueStatus = async (req, res) => res.json({ issue: await moderation.setIssueStatus(req.admin, req.params.issueId, req.body?.status, opts(req)) });
exports.forumIssueDelete = async (req, res) => res.json(await moderation.deleteIssue(req.admin, req.params.issueId, opts(req)));
exports.forumCommentDelete = async (req, res) => res.json(await moderation.deleteComment(req.admin, req.params.commentId, opts(req)));
exports.forumCommentHidden = async (req, res) => res.json({ comment: await moderation.setCommentHidden(req.admin, req.params.commentId, req.body?.hidden, opts(req)) });
exports.flagged = async (req, res) => res.json(await moderation.flaggedAiMessages(req.query));

// Announcements
exports.announcements = async (req, res) => res.json({ announcements: await announcements.list() });
exports.announce = async (req, res) => res.status(201).json(await announcements.broadcast(req.admin, req.body || {}, opts(req)));
