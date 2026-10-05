import React from 'react';
import { render, screen } from '@testing-library/react';
import FeatureNotice, { AiLimitBanner } from '../FeatureNotice';

jest.mock('../MarkdownView', () => ({ content }) => <div>{content}</div>);

const mockUsage = { current: null };
jest.mock('../../hooks/useAiUsage', () => () => mockUsage.current);
jest.mock('../../context/AppStatusContext', () => ({
  useFeature: () => ({ enabled: true, label: 'Notes & PDF chat' }),
  useAppStatus: () => ({ status: {} }),
}));

const NOTES_AT_LIMIT = {
  tool: 'notes', label: 'Notes & PDF chat', used: 21000, limit: 20000, reached: true,
  message: 'You have used your daily allowance of 20,000 AI tokens for Notes & PDF chat. It resets at midnight (UTC). Everything else keeps working.',
};

afterEach(() => { mockUsage.current = null; });

describe('AI token limit notices', () => {
  it('the tool shows why it is limited and when it comes back', () => {
    mockUsage.current = { period: 'day', resetsAt: '2026-10-03T00:00:00.000Z', tools: [NOTES_AT_LIMIT] };
    render(<FeatureNotice tool="notes" />);
    expect(screen.getByText('AI limit reached: Notes & PDF chat')).toBeInTheDocument();
    expect(screen.getByText(/20,000 AI tokens/)).toBeInTheDocument();
    expect(screen.getByText(/Available again/)).toBeInTheDocument();
  });

  it('another tool shows nothing', () => {
    mockUsage.current = { period: 'day', resetsAt: '2026-10-03T00:00:00.000Z', tools: [NOTES_AT_LIMIT] };
    const { container } = render(<FeatureNotice tool="doubts" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('the dashboard lists tools at the limit and warns about ones nearly there', () => {
    mockUsage.current = {
      period: 'week',
      resetsAt: '2026-10-05T00:00:00.000Z',
      tools: [NOTES_AT_LIMIT, { tool: 'doubts', label: 'Doubt Clearance', used: 9000, limit: 10000, reached: false }, { tool: 'roadmap', label: 'Smart Roadmap', used: 100, limit: 10000, reached: false }],
    };
    render(<AiLimitBanner />);
    expect(screen.getByText('AI limit reached: Notes & PDF chat')).toBeInTheDocument();
    expect(screen.getByText('Doubt Clearance: 9,000 of 10,000 tokens used this week.')).toBeInTheDocument();
    expect(screen.queryByText(/Smart Roadmap/)).not.toBeInTheDocument();
  });

  it('the dashboard shows nothing without limits', () => {
    mockUsage.current = { period: 'day', resetsAt: '2026-10-03T00:00:00.000Z', tools: [{ tool: 'notes', label: 'Notes & PDF chat', used: 5000, limit: 0, reached: false }] };
    const { container } = render(<AiLimitBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
