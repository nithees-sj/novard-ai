const { readRoadmapInput, buildRoadmapMermaid, _internal: roadmap } = require('../../services/roadmapService');
const { readProfile, openingMessage, _internal: skillGap } = require('../../services/skillGapService');
const { extractVideoId, _internal: youtube } = require('../../services/youtubeService');
const { _internal: plans } = require('../../services/skillPlanService');
const { _internal: notes } = require('../../services/notesService');
const { _internal: courses } = require('../../services/courseCatalog');
const { _internal: doubts } = require('../../services/doubtService');
const { mapWithConcurrency } = require('../../utils/concurrency');

describe('roadmaps', () => {
  it('reads and bounds the generator input', () => {
    expect(readRoadmapInput({ role: '  DevOps   Engineer ', hoursPerWeek: 99, timelineMonths: 0, knownSkills: 'Linux, linux, Git', level: 'guru' }))
      .toEqual({ role: 'DevOps Engineer', level: 'beginner', hoursPerWeek: 40, timelineMonths: 1, knownSkills: ['Linux', 'Git'], goal: '' });
  });

  const input = { role: 'Dev', level: 'beginner', hoursPerWeek: 10, timelineMonths: 2, knownSkills: ['C'], goal: '' };
  const raw = {
    stages: [1, 2, 3].map((n) => ({ title: `Stage ${n}`, weeks: n, topics: [{ name: 'CSS' }, { name: 'C basics' }, { name: '' }] })),
  };

  it('fits stages to the timeline and marks known topics by whole word', () => {
    const result = roadmap.normaliseRoadmap(raw, input);
    expect(result.totalWeeks).toBe(9); // 2 months ≈ 9 weeks
    expect(result.stages.map((s) => [s.startWeek, s.endWeek])).toEqual([[1, 2], [3, 5], [6, 9]]);
    const topics = result.stages[0].topics;
    expect(topics).toHaveLength(2);
    expect(topics.find((t) => t.name === 'CSS').known).toBe(false); // "C" must not match "CSS"
    expect(topics.find((t) => t.name === 'C basics').known).toBe(true);
  });

  it('rejects an incomplete roadmap', () => {
    expect(roadmap.normaliseRoadmap({ stages: raw.stages.slice(0, 2) }, input)).toBeNull();
  });

  it('builds a diagram that neutralises characters that break Mermaid', () => {
    const result = roadmap.normaliseRoadmap(raw, input);
    result.stages[0].topics[0].name = 'Say "hi" <b>|`';
    const mermaid = buildRoadmapMermaid(result, input);
    expect(mermaid).toMatch(/^%%\{init/);
    expect(mermaid).toContain("Say 'hi' b");
    expect(mermaid).not.toMatch(/<b>/);
  });
});

describe('skill gap', () => {
  it('reads the profile and de-duplicates skills', () => {
    expect(readProfile({ targetRole: 'SRE', currentSkills: ['Go', 'go', ' Linux '], experience: 'wizard', hoursPerWeek: 1 }))
      .toMatchObject({ targetRole: 'SRE', currentSkills: ['Go', 'Linux'], experience: 'student', hoursPerWeek: 2 });
  });

  it('computes readiness from the skill list, trusting the student’s listed skills', () => {
    const profile = readProfile({ targetRole: 'SRE', currentSkills: 'Kubernetes' });
    const analysis = skillGap.normaliseAnalysis({
      summary: 's',
      skills: [
        { skill: 'Kubernetes', importance: 'core', have: false, priority: 'high' },
        { skill: 'Go', importance: 'core', have: false, priority: 'low' },
        { skill: 'Terraform', importance: 'core', have: false, priority: 'high' },
        { skill: 'Linux', importance: 'core', have: true },
        { skill: 'Grafana', importance: 'nice', have: false, priority: 'medium' },
      ],
    }, profile);
    expect(analysis.readiness).toBe(44); // (2 + 2) of 9
    expect(analysis.gaps.map((g) => g.skill)).toEqual(['Terraform', 'Grafana', 'Go']);
    expect(openingMessage(profile, analysis)).toMatch(/Estimated readiness: 44%/);
  });
});

describe('YouTube helpers', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://vimeo.com/123', null],
  ])('extracts the id from %s', (url, id) => expect(extractVideoId(url)).toBe(id));

  it('parses caption XML, decoding double-escaped entities', () => {
    const xml = '<?xml version="1.0"?><transcript><text start="0" dur="1">I&amp;#39;m here</text><text start="1" dur="1">a &amp;amp; b\n&lt;c&gt;</text></transcript>';
    expect(youtube.parseTranscriptXml(xml)).toBe("I'm here a & b <c>");
  });

  it('prefers human English captions', () => {
    const tracks = [{ language_code: 'fr' }, { language_code: 'en', kind: 'asr' }, { language_code: 'en-GB' }];
    expect(youtube.pickCaptionTrack(tracks)).toBe(tracks[2]);
    expect(youtube.pickCaptionTrack([])).toBeNull();
  });
});

describe('skill plans', () => {
  it('validates the plan request', () => {
    expect(() => plans.readPlanRequest({ skillName: 'SQL', duration: 9, description: 'd' })).toThrow(/at least 10/);
    expect(() => plans.readPlanRequest({ skillName: 'SQL', duration: 61, description: 'd' })).toThrow(/at most 60/);
    // An unknown level used to reach the schema enum and fail with a 500.
    expect(() => plans.readPlanRequest({ skillName: 'SQL', duration: 14, description: 'd', preferences: { level: 'pro' } })).toThrow(/Level/);
    expect(plans.readPlanRequest({ skillName: ' SQL ', duration: '14', description: 'd', preferences: { focusAreas: ['joins', ''] } }))
      .toEqual({ skillName: 'SQL', duration: 14, description: 'd', preferences: { level: 'beginner', focusAreas: ['joins'], language: 'English', teachingStyle: 'Standard' } });
  });

  it('renumbers the model’s days and fills missing fields', () => {
    const days = plans.normaliseDays({ days: [{ day: 7, topic: 'A' }, { topic: '' }, { day: 2, topic: 'B', objective: 'o' }] }, 10);
    expect(days).toEqual([
      { day: 1, topic: 'A', objective: 'A', videoTitle: 'A' },
      { day: 2, topic: 'B', objective: 'o', videoTitle: 'B' },
    ]);
    expect(plans.normaliseDays('nope', 10)).toBeNull();
  });
});

describe('notes', () => {
  it('chunks text and picks the passages that match the question', () => {
    const text = Array.from({ length: 40 }, (_, i) => `section${i} ${'filler '.repeat(100)}`).join(' ');
    expect(text.length).toBeGreaterThan(16000);
    const picked = notes.relevantNoteText(text, 'tell me about section33');
    expect(picked.length).toBeLessThanOrEqual(16000);
    expect(picked).toContain('section33');
    expect(notes.relevantNoteText('short', 'q')).toBe('short');
  });

  it('sends only pages without a real text layer to OCR, up to the cap', () => {
    const typed = 'A full paragraph of typed lecture notes.';
    const pages = [
      { num: 1, text: typed },
      { num: 2, text: '' },
      { num: 3, text: '  12  ' }, // just a page number over a scan
      { num: 4, text: typed },
    ];
    expect(notes.pagesNeedingOcr(pages)).toEqual([2, 3]);
    const many = Array.from({ length: 50 }, (_, i) => ({ num: i + 1, text: '' }));
    expect(notes.pagesNeedingOcr(many)).toHaveLength(30);
  });

  it('validates quiz scores and answers', () => {
    expect(notes.readScore({ correct: 3, total: 4 })).toEqual({ correct: 3, total: 4, percentage: 75 });
    expect(() => notes.readScore({ correct: 5, total: 4 })).toThrow();
    expect(notes.readAnswers({ 0: 2, 1: 'B', $where: 'x' })).toEqual({ 0: '2', 1: 'B' });
  });
});

describe('course links from the model', () => {
  it('keeps only http(s) links', () => {
    expect(courses.toCourse({ title: 't', description: 'd', url: 'javascript:alert(1)' }, 'udemy', 'x')).toBeNull();
    expect(courses.toCourse({ title: 't', description: 'd', url: 'https://www.udemy.com/course/x/' }, 'udemy', 'x'))
      .toMatchObject({ url: 'https://www.udemy.com/course/x/', platform: 'udemy', duration: '' });
  });
});

describe('doubt video searches', () => {
  it('goes from single keywords to combinations', () => {
    expect(doubts.searchQueriesFor(['a', 'b', 'c'])).toEqual(['a', 'b', 'c', 'a b', 'b c', 'a b c', 'a tutorial', 'b explanation']);
    expect(doubts.searchQueriesFor(['only'])).toEqual(['only']);
  });
});

describe('mapWithConcurrency', () => {
  it('keeps order and never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([30, 10, 20, 5, 15], 2, async (ms, i) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => { setTimeout(r, ms); });
      active -= 1;
      return i;
    });
    expect(result).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });
});
