import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '../../lib/api';
import { AppStatusProvider } from '../../context/AppStatusContext';
import { ReportProvider, useReportProblem } from '../../context/ReportContext';
import NotificationBell from '../NotificationBell';
import { ChatPanel, QuizRunner } from '../learning/LearningUI';

jest.mock('../MarkdownView', () => ({ content }) => <div>{content}</div>);
jest.mock('../../lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  apiFetch: jest.fn(),
  errorMessage: (error, fallback) => error?.response?.data?.error || fallback,
}));

const STATUS = (voiceEnabled = true) => ({
  data: {
    features: {},
    maintenance: { enabled: false },
    banner: null,
    reports: { areas: [{ id: 'notes', label: 'Notes & PDF chat' }, { id: 'quizzes', label: 'Quizzes' }], maxOpenPerArea: 2, voiceEnabled },
  },
});

function Opener({ context }) {
  const open = useReportProblem();
  return <button type="button" onClick={() => open(context)}>open report</button>;
}

const renderDialog = (context = {}, voiceEnabled = true) => {
  api.get.mockImplementation(async (url) => (url === '/api/app-status' ? STATUS(voiceEnabled) : { data: {} }));
  return render(
    <MemoryRouter>
      <AppStatusProvider>
        <ReportProvider>
          <Opener context={context} />
        </ReportProvider>
      </AppStatusProvider>
    </MemoryRouter>
  );
};

describe('Report a problem dialog', () => {
  it('opens with the area and the AI answer it is about, and sends the report', async () => {
    api.post.mockResolvedValue({ data: { ref: 'NV-1A2B3C4D', status: 'open' } });
    renderDialog({ area: 'notes', source: { itemType: 'note_chat', itemId: 'n1', messageIndex: 3, excerpt: 'ATP is a kind of sugar.' } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/app-status'));
    fireEvent.click(screen.getByText('open report'));

    expect(await screen.findByText('ATP is a kind of sugar.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Which part of Novard-AI/)).toHaveValue('notes'));
    fireEvent.change(screen.getByLabelText(/What went wrong/), { target: { value: 'This answer about ATP is wrong.' } });
    fireEvent.click(screen.getByText('Send report'));

    expect(await screen.findByText('Report NV-1A2B3C4D sent')).toBeInTheDocument();
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe('/api/reports?area=notes');
    expect(form.get('text')).toBe('This answer about ATP is wrong.');
    expect(JSON.parse(form.get('source'))).toMatchObject({ itemType: 'note_chat', itemId: 'n1', messageIndex: 3 });
    expect(form.get('routedBy')).toBe('context');
  });

  it('asks for an area and enough detail before sending', async () => {
    renderDialog();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByText('open report'));
    fireEvent.click(await screen.findByText('Send report'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose which part of the app');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the quota message with a link to the existing report', async () => {
    api.post.mockRejectedValue({ response: { status: 429, data: { error: 'You already have 2 open reports about Quizzes. Please add to your existing report (NV-00000001) instead.', code: 'REPORT_QUOTA', details: { existingRef: 'NV-00000001' } } } });
    renderDialog({ area: 'quizzes' });
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByText('open report'));
    await waitFor(() => expect(screen.getByLabelText(/Which part of Novard-AI/)).toHaveValue('quizzes'));
    fireEvent.change(screen.getByLabelText(/What went wrong/), { target: { value: 'The answer key is wrong again.' } });
    fireEvent.click(screen.getByText('Send report'));
    expect(await screen.findByText(/already have 2 open reports/)).toBeInTheDocument();
    expect(screen.getByText('Open NV-00000001')).toHaveAttribute('href', '/reports/NV-00000001');
  });

  it('offers a voice note only when voice is enabled', async () => {
    const { unmount } = renderDialog({}, false);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByText('open report'));
    await screen.findByText('Send report');
    expect(screen.queryByText('Record a voice note')).not.toBeInTheDocument();
    unmount();

    renderDialog({}, true);
    fireEvent.click(screen.getByText('open report'));
    expect(await screen.findByText('Record a voice note')).toBeInTheDocument();
  });
});

describe('report entry points', () => {
  it('ChatPanel offers "Report" under AI answers only, with the message and its index', () => {
    const onReport = jest.fn();
    render(<ChatPanel messages={[{ role: 'user', content: 'q' }, { role: 'assistant', content: 'an answer' }]} onSend={jest.fn()} onReport={onReport} />);
    const buttons = screen.getAllByTitle('Report a problem with this');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onReport).toHaveBeenCalledWith({ role: 'assistant', content: 'an answer' }, 1);
  });

  it('ChatPanel shows no report action when the tool does not ask for one', () => {
    render(<ChatPanel messages={[{ role: 'assistant', content: 'an answer' }]} onSend={jest.fn()} />);
    expect(screen.queryByTitle('Report a problem with this')).not.toBeInTheDocument();
  });

  it('QuizRunner lets a student report a question', () => {
    const onReport = jest.fn();
    const q = { question: 'What is 2+2?', options: ['3', '4'], correctAnswer: 1 };
    render(<QuizRunner questions={[q]} answers={{}} onAnswer={jest.fn()} onSubmit={jest.fn()} result={null} onReport={onReport} />);
    fireEvent.click(screen.getByTitle('Report a problem with this'));
    expect(onReport).toHaveBeenCalledWith(q, 0);
  });
});

describe('NotificationBell', () => {
  it('shows the unread count, lists updates and marks them read', async () => {
    api.get.mockResolvedValue({ data: { unread: 2, notifications: [
      { _id: 'a', kind: 'report_resolved', title: 'Your Quizzes report has been resolved', body: 'What we did: fixed the answer key.', read: false, createdAt: '2026-09-30T10:00:00Z', link: '/reports/NV-1' },
      { _id: 'b', kind: 'announcement', title: 'New: report from any AI answer', body: '', read: false, createdAt: '2026-09-29T10:00:00Z' },
    ] } });
    api.post.mockResolvedValue({ data: { updated: 2 } });
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);

    const bell = await screen.findByLabelText('Notifications, 2 unread');
    expect(bell).toHaveTextContent('2');
    fireEvent.click(bell);
    expect(screen.getByText('Your Quizzes report has been resolved')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Mark all as read'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/notifications/read', {}));
  });
});
