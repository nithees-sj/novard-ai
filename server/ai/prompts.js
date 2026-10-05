const { CHAT_SOURCE_CHARS, relevantText, sampleContent } = require('../utils/longText');

/** Shared system prompts for the conversational features. */

const FORMAT_RULES = `How to answer:
- Match the length to the question: a quick question gets a short, direct answer; "explain", "compare" or "walk me through" gets more depth, with a concrete example or code where it helps.
- Use GitHub-flavoured Markdown: ### headings only for longer answers, numbered lists for steps, bullets for key points, fenced code blocks with a language tag for code.
- Never emit raw HTML (no <br>); start a new line or list item instead.`;

/**
 * Q&A about one video (YouTube summarizer, video library). A long transcript
 * contributes the passages that best match the student's question, from
 * anywhere in the video.
 */
function videoTutorPrompt(video, { platform, question = '' } = {}) {
  // The summary (if any) and the transcript share one chat turn's source budget.
  const summary = sampleContent(video.summary, Math.round(CHAT_SOURCE_CHARS / 2));
  const transcript = video.transcript ? relevantText(video.transcript, `${question} ${video.title}`, CHAT_SOURCE_CHARS - summary.length) : '';
  const content = [
    `Title: ${video.title}`,
    platform ? `Platform: ${platform}` : null,
    video.description ? `Description: ${video.description}` : null,
    summary ? `Summary:\n${summary}` : null,
    transcript ? `Transcript${transcript.length < video.transcript.length ? ' (the passages that match the question)' : ''}:\n${transcript}` : null,
  ].filter(Boolean).join('\n\n');

  return `You are a tutor helping a student understand a video they are studying.
Answer from the video material below. If the transcript is missing or does not cover the question, say what the video's title/description suggest, then give a clear general explanation and say that part is not from the video.

VIDEO:
${content}

${FORMAT_RULES}`;
}

module.exports = { FORMAT_RULES, videoTutorPrompt };
