import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MermaidDiagram from './MermaidDiagram';
import normalizeModelMarkdown from '../lib/normalizeModelMarkdown';

/**
 * The single renderer for every piece of Markdown the models produce -
 * summaries and chat replies alike.
 *
 * It replaces three hand-written approaches that previously did this job:
 *   - `{summary}` printed as raw text, so "###" and "**" showed literally
 *   - a sentence splitter that rebuilt the text into cards, destroying
 *     tables, lists, code blocks and any diagram
 *   - StructuredMessageRenderer, a ~180-line regex parser duplicated across
 *     three files, with no table support at all
 *
 * remark-gfm adds tables, task lists and strikethrough. ```mermaid fences are
 * rendered as real diagrams.
 *
 * Note: react-markdown v9 no longer passes an `inline` prop to `code`, so the
 * fenced-block override lives on `pre` (which only ever wraps a fenced block).
 * Inline code is left to the typography plugin.
 */

/** Pull the raw text and language out of the <code> child of a <pre>. */
function readCodeChild(children) {
  const child = React.Children.toArray(children)[0];
  if (!React.isValidElement(child)) return { text: '', language: null };

  const className = child.props?.className || '';
  const language = /language-(\w+)/.exec(className)?.[1] || null;

  const raw = child.props?.children;
  const text = Array.isArray(raw) ? raw.join('') : String(raw ?? '');

  return { text: text.replace(/\n$/, ''), language };
}

const components = {
  pre({ children }) {
    const { text, language } = readCodeChild(children);

    if (language === 'mermaid') {
      return <MermaidDiagram chart={text} />;
    }

    return (
      <pre className="not-prose my-3 first:mt-0 last:mb-0 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed">
        {/* Size and line height sit on the <pre>: the block's line boxes come from it, not from the inline <code>. */}
        <code className="text-gray-100">{text}</code>
      </pre>
    );
  },

  // Tables need their own scroll container on narrow screens.
  table({ children, ...props }) {
    return (
      <div className="my-3 first:mt-0 last:mb-0 overflow-x-auto [&>table]:my-0">
        <table {...props}>{children}</table>
      </div>
    );
  },

  // Never let model output navigate the app away or leak the referrer.
  a({ children, href, ...props }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

const MarkdownView = ({ content, className = '', size = 'sm' }) => {
  if (content === null || content === undefined || content === '') return null;

  const text = normalizeModelMarkdown(
    typeof content === 'string' ? content : String(content)
  );
  const proseSize = size === 'base' ? 'prose' : 'prose prose-sm';

  return (
    <div className={`${proseSize} max-w-none break-words ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default memo(MarkdownView);
