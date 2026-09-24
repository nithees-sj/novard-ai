const { createDoubt } = require('../controllers/doubtClearanceController');
const { addYouTubeVideo } = require('../controllers/youtubeVideoController');
const { createRoadmapFor } = require('../controllers/roadmapController');
const { createSkillPlan } = require('../controllers/skillUnlockerController');
const { startSession } = require('../controllers/skillGapController');
const { openIssue, CATEGORIES } = require('../controllers/forumController');

/**
 * Things the Novard Agent can do inside the app.
 *
 * The agent never acts on its own: it *proposes* an action (a propose_* tool
 * call), the student sees it as a card with its details, and it runs only when
 * they press "Yes". Each action reuses the exact function behind the matching
 * page, so an item the agent creates is identical to one made by hand.
 *
 * For each action:
 *   tool       the function definition the model sees
 *   normalize  clean and bound the model's arguments (throws on bad input)
 *   summary    one line for the card and for the model's memory
 *   run        carry it out for the student; returns where to open the result
 */

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (v, maxItems, maxLen) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map((x) => clean(x, maxLen)).filter(Boolean).slice(0, maxItems);
const int = (v, lo, hi, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const oneOf = (v, options, fallback) => (options.includes(v) ? v : fallback);
const invalid = (message) => Object.assign(new Error(message), { status: 400 });

const fn = (name, description, properties, required) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});

const ACTIONS = {
  create_doubt: {
    label: 'Create a doubt',
    section: 'Doubt Clearance',
    tool: fn(
      'propose_create_doubt',
      'Offer to save the student\'s question as a doubt in Doubt Clearance, where they can keep chatting about it, get a summary with a diagram, video suggestions and a quiz. Use after you have explained the concept.',
      {
        title: { type: 'string', description: 'Short doubt title, e.g. "How useEffect dependencies work"' },
        description: { type: 'string', description: 'The question written in the first person, as the student would ask it, with the context they gave (1-4 sentences), e.g. "Why does my useEffect run twice when the component loads?"' },
      },
      ['title', 'description'],
    ),
    normalize: (a) => {
      const out = { title: clean(a.title, 200), description: String(a.description || '').trim().slice(0, 2000) };
      if (out.title.length < 3 || out.description.length < 5) throw invalid('A doubt needs a title and a description.');
      return out;
    },
    summary: (a) => `"${a.title}"`,
    async run(a, ctx) {
      const doubt = await createDoubt({ ...a, userId: ctx.userId });
      // Carry the agent's explanation over, so the doubt opens with the context of this chat.
      if (ctx.sourceText) {
        doubt.chatHistory.push(
          { role: 'user', content: a.description },
          { role: 'assistant', content: ctx.sourceText },
        );
        await doubt.save();
      }
      return { itemId: String(doubt._id), route: `/doubt-clearance?open=${doubt._id}`, label: 'Open doubt' };
    },
  },

  add_video: {
    label: 'Add a video',
    section: 'Video Summarizer',
    tool: fn(
      'propose_add_video',
      'Offer to add ONE YouTube video to the student\'s Video Summarizer library, where they can chat with it, summarise it and take a quiz. You MUST call search_youtube_videos first and use a videoId from its results.',
      {
        videoId: { type: 'string', description: 'The 11-character id from search_youtube_videos results' },
        reason: { type: 'string', description: 'One sentence on why this video fits the student' },
      },
      ['videoId'],
    ),
    normalize: (a, ctx) => {
      const videoId = clean(a.videoId, 20);
      const found = ctx.searchResults?.get(videoId);
      if (!found) throw invalid('Call search_youtube_videos first and propose a videoId from its results.');
      return {
        videoId,
        title: clean(found.title, 200),
        channelName: clean(found.channelName, 100),
        duration: clean(found.duration, 20),
        thumbnailUrl: found.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        reason: clean(a.reason, 240),
      };
    },
    summary: (a) => `"${a.title}"${a.channelName ? ` by ${a.channelName}` : ''}`,
    async run(a, ctx) {
      const video = await addYouTubeVideo(
        { title: a.title, videoUrl: `https://www.youtube.com/watch?v=${a.videoId}`, userId: ctx.userId },
        { returnExisting: true },
      );
      return { itemId: String(video._id), route: `/youtube-video-summarizer?open=${video._id}`, label: 'Open video' };
    },
  },

  generate_roadmap: {
    label: 'Generate a career roadmap',
    section: 'Smart Roadmap',
    tool: fn(
      'propose_generate_roadmap',
      'Offer to generate a personalised, staged career roadmap (with a diagram) towards a target role in Smart Roadmap. Fill in what the student told you; skills they already know are skipped or marked as known.',
      {
        role: { type: 'string', description: 'Target role, e.g. "DevOps Engineer"' },
        level: { type: 'string', enum: ['beginner', 'intermediate', 'experienced'], description: 'beginner = no experience; intermediate = knows the basics, not job-ready; experienced = working professional switching role' },
        knownSkills: { type: 'array', items: { type: 'string' }, description: 'Skills they already have' },
        hoursPerWeek: { type: 'integer', description: 'Study hours per week (default 10)' },
        timelineMonths: { type: 'integer', description: 'Months they want to take (default 6)' },
        goal: { type: 'string', description: 'Their goal in their own words, e.g. "get a job at a product company"' },
      },
      ['role'],
    ),
    normalize: (a) => {
      const out = {
        role: clean(a.role, 80),
        level: oneOf(a.level, ['beginner', 'intermediate', 'experienced'], 'beginner'),
        knownSkills: list(a.knownSkills, 20, 40),
        hoursPerWeek: int(a.hoursPerWeek, 3, 40, 10),
        timelineMonths: int(a.timelineMonths, 1, 24, 6),
        goal: clean(a.goal, 240),
      };
      if (out.role.length < 2) throw invalid('A roadmap needs a target role.');
      return out;
    },
    summary: (a) => `${a.role} · ${a.level} · ${a.hoursPerWeek} h/week · ${a.timelineMonths} months`,
    async run(a, ctx) {
      const roadmap = await createRoadmapFor(ctx.userId, a);
      return {
        itemId: String(roadmap._id),
        route: `/roadmap?open=${roadmap._id}`,
        label: 'Open roadmap',
        note: `${(roadmap.stages || []).length} stages over about ${roadmap.totalWeeks || '?'} weeks`,
      };
    },
  },

  create_skill_plan: {
    label: 'Create a learning plan',
    section: 'Skill Unlocker',
    tool: fn(
      'propose_create_skill_plan',
      'Offer to create a day-by-day learning plan for ONE skill in Skill Unlocker: a topic, an objective and a YouTube video for each day, with progress tracking and quizzes.',
      {
        skillName: { type: 'string', description: 'The skill, e.g. "React Hooks" or "Docker"' },
        durationDays: { type: 'integer', description: 'Number of days, 10-60 (default 14)' },
        description: { type: 'string', description: 'What they want to be able to do by the end' },
        level: { type: 'string', enum: ['beginner', 'intermediate'] },
        focusAreas: { type: 'array', items: { type: 'string' }, description: 'Sub-topics to emphasise' },
      },
      ['skillName', 'description'],
    ),
    normalize: (a) => {
      const out = {
        skillName: clean(a.skillName, 80),
        durationDays: int(a.durationDays, 10, 60, 14),
        description: clean(a.description, 500),
        level: oneOf(a.level, ['beginner', 'intermediate'], 'beginner'),
        focusAreas: list(a.focusAreas, 8, 60),
      };
      if (out.skillName.length < 2) throw invalid('A learning plan needs a skill.');
      if (!out.description) out.description = `Learn ${out.skillName} from the basics to practical use.`;
      return out;
    },
    summary: (a) => `${a.skillName} · ${a.durationDays} days · ${a.level}`,
    async run(a, ctx) {
      const plan = await createSkillPlan({
        userId: ctx.userId,
        skillName: a.skillName,
        duration: a.durationDays,
        description: a.description,
        preferences: { level: a.level, focusAreas: a.focusAreas, language: 'English', teachingStyle: 'Standard' },
      });
      return { itemId: String(plan._id), route: `/skill-unlocker?open=${plan._id}`, label: 'Open plan', note: `${plan.dailyPlan.length} days` };
    },
  },

  skill_gap_analysis: {
    label: 'Run a skill gap analysis',
    section: 'Skill Gap Analysis',
    tool: fn(
      'propose_skill_gap_analysis',
      'Offer to analyse the student\'s skills against a target role in Skill Gap Analysis: readiness %, the skills they have, the gaps ranked by priority, then a coaching chat.',
      {
        targetRole: { type: 'string' },
        currentSkills: { type: 'array', items: { type: 'string' } },
        experience: { type: 'string', enum: ['student', 'junior', 'switching', 'experienced'] },
        hoursPerWeek: { type: 'integer' },
        goal: { type: 'string' },
      },
      ['targetRole'],
    ),
    normalize: (a) => {
      const out = {
        targetRole: clean(a.targetRole, 80),
        currentSkills: list(a.currentSkills, 30, 40),
        experience: oneOf(a.experience, ['student', 'junior', 'switching', 'experienced'], 'student'),
        hoursPerWeek: int(a.hoursPerWeek, 2, 40, 10),
        goal: clean(a.goal, 240),
      };
      if (out.targetRole.length < 2) throw invalid('A skill gap analysis needs a target role.');
      return out;
    },
    summary: (a) => `${a.targetRole}${a.currentSkills.length ? ` · knows ${a.currentSkills.slice(0, 4).join(', ')}${a.currentSkills.length > 4 ? '…' : ''}` : ''}`,
    async run(a, ctx) {
      const session = await startSession(ctx.userId, a);
      return {
        itemId: String(session._id),
        route: `/skills-required?open=${session._id}`,
        label: 'Open analysis',
        note: `${session.analysis.readiness}% ready · ${session.analysis.gaps.length} skills to learn`,
      };
    },
  },

  forum_post: {
    label: 'Post to the AI Forum',
    section: 'AI Forum',
    tool: fn(
      'propose_forum_post',
      'Offer to start a discussion in the AI Forum, for questions that benefit from other students\' experience or opinions (not for plain concept questions).',
      {
        title: { type: 'string' },
        description: { type: 'string', description: 'The full question with context, written as the student' },
        category: { type: 'string', enum: CATEGORIES },
        tags: { type: 'array', items: { type: 'string' } },
      },
      ['title', 'description'],
    ),
    normalize: (a) => {
      const out = {
        title: clean(a.title, 200),
        description: String(a.description || '').trim().slice(0, 5000),
        category: oneOf(a.category, CATEGORIES, 'general'),
        tags: list(a.tags, 8, 30),
      };
      if (out.title.length < 3 || out.description.length < 10) throw invalid('A forum post needs a title and a description.');
      return out;
    },
    summary: (a) => `"${a.title}" in ${a.category}`,
    async run(a, ctx) {
      const issue = await openIssue({ ...a, userEmail: ctx.userId, userName: ctx.userName || 'Student' });
      return { itemId: issue.issueId, route: `/forum?open=${issue.issueId}`, label: 'Open discussion' };
    },
  },
};

const TOOL_TO_ACTION = Object.fromEntries(Object.entries(ACTIONS).map(([type, a]) => [a.tool.function.name, type]));

module.exports = { ACTIONS, TOOL_TO_ACTION };
