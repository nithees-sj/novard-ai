const logger = require('../utils/logger');
const gateway = require('./gatewayEvents');

/**
 * YouTube lookups (video details, transcripts, search) through youtubei.js.
 *
 * One Innertube session is shared and refreshed every few hours; creating one
 * is a network handshake, and the old code did it for every lookup (twice per
 * added video, and once per day when building a 30-day learning plan).
 */

const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const CAPTION_TIMEOUT_MS = 10000;

let session = null; // { promise, createdAt }

function getInnertube() {
  if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
    // youtubei.js is an ES module; import() loads it from this CommonJS file on every Node version.
    const promise = gateway.track({ gateway: 'youtube', operation: 'session' }, () => import('youtubei.js').then(({ Innertube }) => Innertube.create()))
      .catch((error) => {
        session = null; // do not cache a failed handshake
        throw error;
      });
    session = { promise, createdAt: Date.now() };
  }
  return session.promise;
}

/** The 11-character video id from any common YouTube URL form, or null. */
function extractVideoId(url) {
  const match = String(url || '').match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : null;
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decodeEntities = (s) => s
  .replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m])
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** Caption XML (<transcript><text start dur>…</text></transcript>) to plain text. */
function parseTranscriptXml(xml) {
  const parts = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match = re.exec(xml);
  while (match) {
    // Caption text is escaped twice ("I&amp;#39;m"); after decoding it is plain text, "<div>" included.
    parts.push(decodeEntities(decodeEntities(match[1])));
    match = re.exec(xml);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Prefer English captions written by a person, then English auto-captions, then anything. */
function pickCaptionTrack(tracks = []) {
  const english = tracks.filter((t) => String(t.language_code || '').toLowerCase().startsWith('en'));
  return english.find((t) => t.kind !== 'asr') || english[0] || tracks[0] || null;
}

async function fetchCaptions(track) {
  if (!track?.base_url) return '';
  const response = await fetch(track.base_url, { signal: AbortSignal.timeout(CAPTION_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Caption download failed (${response.status})`);
  return parseTranscriptXml(await response.text());
}

/**
 * Title, description and transcript of a video. Never throws: missing parts
 * come back as fallbacks, so a video can always be added and discussed.
 *
 * The iOS client is used because YouTube now refuses caption downloads made
 * with the web client's URLs (they come back empty without a proof-of-origin
 * token), and youtubei.js's own getTranscript endpoint returns 400.
 */
async function fetchVideoDetails(videoId) {
  await gateway.assertYoutubeEnabled('metadata');
  let title = `YouTube Video ${videoId}`;
  let description = 'Unable to fetch video details';
  let transcript = '';

  try {
    const yt = await getInnertube();
    const info = await gateway.track({ gateway: 'youtube', operation: 'metadata' }, () => yt.getBasicInfo(videoId, { client: 'IOS' }));
    title = info.basic_info?.title || title;
    description = info.basic_info?.short_description || info.basic_info?.description || 'No description available';
    const track = pickCaptionTrack(info.captions?.caption_tracks);
    if (!track?.base_url) gateway.record({ gateway: 'youtube', operation: 'captions', outcome: 'missing' });
    else {
      transcript = await gateway.track({ gateway: 'youtube', operation: 'captions', classify: (t) => (t ? 'ok' : 'missing') }, () => fetchCaptions(track))
        .catch((error) => {
          logger.warn('Could not download captions', { videoId, error: error.message });
          return '';
        });
    }
  } catch (error) {
    logger.warn('Could not fetch YouTube video details', { videoId, error: error.message });
  }

  if (!transcript) {
    transcript = `Transcript not available for this video. The video title is: "${title}" and description: "${description}". You can still ask questions about the video based on its title and description.`;
  }
  return { title, description, transcript };
}

/** Top YouTube search results for a query: id, title, thumbnail, duration, channel. */
async function searchVideos(query, maxResults = 3) {
  await gateway.assertYoutubeEnabled('search');
  const yt = await getInnertube();
  const results = await gateway.track({ gateway: 'youtube', operation: 'search' }, () => yt.search(String(query), { type: 'video' }));
  return (results.videos || [])
    .filter((video) => video.id)
    .slice(0, maxResults)
    .map((video) => ({
      videoId: video.id,
      title: video.title?.text || String(video.title || ''),
      thumbnailUrl: video.thumbnails?.[0]?.url || video.best_thumbnail?.url || '',
      url: `https://www.youtube.com/watch?v=${video.id}`,
      duration: video.duration?.text || '',
      channelName: video.author?.name || '',
    }));
}

module.exports = {
  getInnertube,
  extractVideoId,
  fetchVideoDetails,
  searchVideos,
  _internal: { parseTranscriptXml, pickCaptionTrack, decodeEntities },
};
