/** Shared system prompts for the conversational features. */

const FORMAT_RULES = `How to answer:
- Match the length to the question: a quick question gets a short, direct answer; "explain", "compare" or "walk me through" gets more depth, with a concrete example or code where it helps.
- Use GitHub-flavoured Markdown: ### headings only for longer answers, numbered lists for steps, bullets for key points, fenced code blocks with a language tag for code.
- Never emit raw HTML (no <br>); start a new line or list item instead.`;

/** Q&A about one video (YouTube summarizer, teacher guidance / educational videos). */
function videoTutorPrompt(video, { platform } = {}) {
  const content = [
    `Title: ${video.title}`,
    platform ? `Platform: ${platform}` : null,
    video.description ? `Description: ${String(video.description).slice(0, 2000)}` : null,
    video.summary ? `Summary:\n${String(video.summary).slice(0, 6000)}` : null,
    video.transcript ? `Transcript (may be partial):\n${String(video.transcript).slice(0, 18000)}` : null,
  ].filter(Boolean).join('\n\n');

  return `You are a tutor helping a student understand a video they are studying.
Answer from the video material below. If the transcript is missing or does not cover the question, say what the video's title/description suggest, then give a clear general explanation and say that part is not from the video.

VIDEO:
${content}

${FORMAT_RULES}`;
}

module.exports = { FORMAT_RULES, videoTutorPrompt };
