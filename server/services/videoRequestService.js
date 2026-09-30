const youtubeSearch = require('youtube-search-api');
const Video = require('../models/video');
const { MODELS } = require('../config/ai');
const { complete } = require('../ai/groqClient');
const { parseModelJson } = require('../utils/parseModelJson');
const { findCourses } = require('./courseCatalog');
const { badRequest, notFound } = require('../utils/httpError');
const { objectId, text, oneOf } = require('../utils/validate');
const logger = require('../utils/logger');

/**
 * Video Library: "what I want to learn" requests, and the videos (or, for
 * older requests, courses) recommended for each.
 */

const PLATFORMS = ['youtube', 'udemy', 'coursera', 'edureka'];
const PLATFORM_NAMES = { youtube: 'YouTube', udemy: 'Udemy', coursera: 'Coursera', edureka: 'Edureka' };
const RESULTS_PER_KEYWORD = 3;
const MAX_RECOMMENDATIONS = 6;

async function listRequests(userId) {
  return Video.find({ userId }).sort({ createdAt: -1 }).lean();
}

async function createRequest({ userId, title, description, platform }) {
  if (!title || !description) {
    throw badRequest('Title and description are required');
  }
  return Video.create({
    title: text(title, 'Title', { max: 200 }),
    description: text(description, 'Description', { max: 1000, collapse: false }),
    platform: oneOf(platform, 'Platform', PLATFORMS, { fallback: 'youtube' }),
    userId,
  });
}

async function deleteRequest({ userId, requestId }) {
  const result = await Video.deleteOne({ _id: objectId(requestId, 'request id'), userId });
  if (!result.deletedCount) throw notFound('Video request not found');
}

const formatDuration = (length) => {
  const totalSeconds = parseInt(length?.seconds, 10);
  if (!Number.isFinite(totalSeconds)) return 'Unknown';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
};

function bestThumbnail(item) {
  const thumbnails = Array.isArray(item.thumbnail) ? item.thumbnail : [];
  const fallback = `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`; // always exists, unlike maxresdefault
  if (!thumbnails.length) return fallback;
  return ['maxresdefault', 'hqdefault', 'mqdefault']
    .map((size) => thumbnails.find((t) => t.url?.includes(size))?.url)
    .find(Boolean) || thumbnails[0].url || fallback;
}

async function searchYouTube(keyword, count) {
  const result = await youtubeSearch.GetListByKeyword(keyword, false, count);
  return (result?.items || [])
    .filter((item) => item.type === 'video' && !item.isLive)
    .map((item) => ({
      title: item.title,
      description: item.description || item.shortDescription || 'Educational video content',
      thumbnail: bestThumbnail(item),
      url: `https://www.youtube.com/watch?v=${item.id}`,
      duration: item.length ? formatDuration(item.length) : 'Unknown',
      reason: `Found for search: "${keyword}"`,
      videoId: item.id,
      channel: item.channelTitle || 'Unknown Channel',
      viewCount: item.viewCount || 0,
      platform: 'youtube',
    }));
}

async function searchCourses(platform, keyword, count) {
  const courses = await findCourses(platform, keyword, count);
  return courses.map((course) => ({
    title: course.title,
    description: course.description || 'Educational course content',
    thumbnail: course.thumbnail,
    url: course.url,
    duration: course.duration,
    reason: `Found for search: "${keyword}"`,
    videoId: course.id,
    channel: course.instructor || PLATFORM_NAMES[platform],
    viewCount: course.enrollments || 0,
    rating: course.rating,
    price: course.price,
    platform,
  }));
}

/** 2-3 platform-appropriate search keywords for a request, from the model; the title if that fails. */
async function keywordsFor({ title, description }, platformName) {
  try {
    const reply = await complete({
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that generates search keywords for educational platforms based on user requests.

          When a user provides a request title and description, generate 2-3 specific search keywords that would find relevant educational content on ${platformName}.

          Focus on:
          - Educational content, tutorials, and courses
          - Specific technical terms and concepts
          - Learning-oriented keywords
          - Programming, development, and technical topics
          - Platform-specific terminology and course structures

          Return your response as a JSON array of strings:
          ["keyword1", "keyword2", "keyword3"]

          Examples for different platforms:
          - YouTube: ["React tutorial", "JavaScript course", "CSS flexbox guide"]
          - Udemy: ["Complete React course", "JavaScript programming bootcamp", "Web development masterclass"]
          - Coursera: ["React specialization", "JavaScript algorithms course", "Web development certificate"]
          - Edureka: ["React training", "JavaScript certification", "Full stack development course"]`,
        },
        {
          role: 'user',
          content: `Request Title: "${title}"\n\nRequest Description: "${description}"\n\nPlatform: ${platformName}\n\nGenerate search keywords for finding relevant educational content on ${platformName}.`,
        },
      ],
      model: MODELS.FAST,
      temperature: 0.7,
      maxTokens: 500,
    });
    const parsed = parseModelJson(reply, { context: 'search keywords' });
    const keywords = (Array.isArray(parsed) ? parsed : []).filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim().slice(0, 100));
    if (keywords.length) return keywords.slice(0, 3);
  } catch (error) {
    logger.warn('Could not generate search keywords; using the title', { error: error.message });
  }
  return [title, `${title} tutorial`, `${title} explained`];
}

/** Recommended videos (or courses) for a request, most popular first. */
async function recommend({ title, description, platform }) {
  const cleanTitle = text(title, 'Title', { max: 200 });
  const cleanDescription = text(description, 'Description', { max: 1000 });
  const selected = oneOf(platform, 'Platform', PLATFORMS, { fallback: 'youtube' });

  const keywords = await keywordsFor({ title: cleanTitle, description: cleanDescription }, PLATFORM_NAMES[selected]);
  const results = await Promise.all(keywords.map((keyword) => (selected === 'youtube'
    ? searchYouTube(keyword, RESULTS_PER_KEYWORD)
    : searchCourses(selected, keyword, RESULTS_PER_KEYWORD)
  ).catch((error) => {
    logger.warn('Search for a keyword failed', { keyword, platform: selected, error: error.message });
    return [];
  })));

  const unique = results.flat().filter((video, index, all) => index === all.findIndex((v) => (
    v.videoId === video.videoId || (v.title === video.title && v.url === video.url)
  )));
  const videos = unique.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, MAX_RECOMMENDATIONS);

  // Nothing found at all (e.g. the search library broke): one plain search on the title.
  if (!videos.length && selected === 'youtube') {
    return searchYouTube(cleanTitle, 4).catch(() => []);
  }
  return videos;
}

module.exports = { PLATFORMS, listRequests, createRequest, deleteRequest, recommend, _internal: { formatDuration, bestThumbnail } };
