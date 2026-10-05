import React, { useState } from 'react';
import MarkdownView from '../MarkdownView';
import AgentAvatar from './AgentAvatar';
import ActionCard from './ActionCard';
import AskCard from './AskCard';
import { ReportAction } from '../learning/LearningUI';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-fg-subtle hover:bg-sunken hover:text-fg" aria-label="Copy reply">
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        {copied
          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />}
      </svg>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

/**
 * One turn in the conversation. Assistant turns render Markdown, their cards,
 * and any questions the agent asked (answerable only on the latest turn).
 */
const AgentMessage = ({ message, streaming = false, status = '', onDecide, busy = false, canAnswer = false, onAnswer, onReport }) => {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl rounded-br-lg bg-sunken px-4 py-2.5 text-body leading-relaxed text-fg">
          {message.content}
        </div>
      </div>
    );
  }

  const waiting = streaming && !message.content;
  return (
    <div className="group flex gap-3.5">
      <AgentAvatar size="h-8 w-8" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {waiting ? (
          <div className="flex h-8 items-center gap-2 text-sm text-fg-subtle" role="status">
            {status ? (
              <><span className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />{status}</>
            ) : (
              <span className="flex gap-1" aria-label="Thinking">
                {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 rounded-full bg-fg-disabled animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </span>
            )}
          </div>
        ) : (
          <div className={streaming ? 'agent-streaming' : ''}>
            <MarkdownView content={message.content} size="base" />
          </div>
        )}

        {streaming && status && message.content && (
          <p className="mt-2 flex items-center gap-2 text-sm text-fg-subtle" role="status">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />{status}
          </p>
        )}

        {(message.actions || []).map((a) => <ActionCard key={a.id} action={a} onDecide={onDecide} busy={busy} />)}

        {message.ask && <AskCard ask={message.ask} active={canAnswer} onAnswer={onAnswer} />}

        {!streaming && message.content && (
          <div className="mt-1.5 flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <CopyButton text={message.content} />
            {onReport && <ReportAction onClick={() => onReport(message)} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentMessage;
