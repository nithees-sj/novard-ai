import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReadableStream } from 'stream/web';
import { adminGet, adminPost, adminPut, adminFetch } from '../../../lib/adminApi';
import AdminApp from '../AdminApp';
import { AuthProvider } from '../../../AuthContext';

// Both the student and the admin providers use Google sign-in: keep every hook's options.
const mockGoogleHooks = [];
jest.mock('@react-oauth/google', () => ({
  useGoogleLogin: (options) => {
    mockGoogleHooks.push(options);
    return jest.fn();
  },
}));
jest.mock('../../../components/MarkdownView', () => ({ content }) => <div>{content}</div>);
jest.mock('../../../lib/adminApi', () => {
  const actual = jest.requireActual('../../../lib/adminApi');
  return {
    ...actual,
    adminApi: { get: jest.fn(async () => ({ data: { admin: { email: 'ada@example.com', role: 'admin', name: 'Ada' } } })), post: jest.fn() },
    adminGet: jest.fn(),
    adminPost: jest.fn(),
    adminPut: jest.fn(),
    adminFetch: jest.fn(),
  };
});
jest.mock('../../../lib/api', () => ({
  API_URL: '',
  api: { get: jest.fn(async () => ({ data: {} })), post: jest.fn() },
  errorMessage: (error, fallback) => error?.response?.data?.error || fallback,
}));

const { adminApi } = require('../../../lib/adminApi');
const { api } = require('../../../lib/api');

const signedIn = () => {
  localStorage.setItem('admin_token', 'tok');
  localStorage.setItem('admin_profile', JSON.stringify({ email: 'ada@example.com', name: 'Ada Admin', role: 'admin' }));
};

// As in App.js: the student AuthProvider wraps everything (the shared header and sidebar read it).
const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>
      <Routes><Route path="/admin/*" element={<AdminApp />} /><Route path="/home" element={<p>student home</p>} /></Routes>
    </AuthProvider>
  </MemoryRouter>
);

const BOARD = {
  lastRescanAt: '2026-09-30T10:00:00Z',
  areas: [
    { area: 'video-summarizer', label: 'Video Summarizer', level: 'CRITICAL', score: 0.982, status: 'scored', drivers: [{ feature: 'n_reports', label: 'report volume', z: 6 }], sparkline: [{ d: '2026-09-29', score: 0.2 }, { d: '2026-09-30', score: 0.98 }], openReports: 40, urgentReports: 30, riskObject: { topic: 'missing video captions', state: 'new' }, openAlerts: 1 },
    { area: 'notes', label: 'Notes & PDF chat', level: 'LOW', score: 0.12, status: 'scored', drivers: [], sparkline: [], openReports: 0, urgentReports: 0, riskObject: null, openAlerts: 0 },
  ],
};

beforeEach(() => {
  adminGet.mockImplementation(async (path) => {
    if (path === '/api/admin/risk/alerts') return { open: [] };
    if (path === '/api/admin/risk/board') return BOARD;
    if (path === '/api/admin/gateways/groq') {
      return {
        id: 'groq', name: 'Groq (AI)', kind: 'ai', status: 'ok', key: { configured: true, last4: 'abcd' },
        windows: { '24h': { calls: 3, errorRate: 0, rateLimited: 0, dailyQuota: 0, p50Ms: 900, p95Ms: 1500, usd: 0.001 } },
        daily: [], byModel: [], byFeature: [],
        editableSettings: ['ai.params'],
        settings: { 'ai.params': { reasoningEffort: 'low', maxTokensScale: 1, temperature: null } },
        reference: { tasks: [] },
      };
    }
    return {};
  });
  adminApi.get.mockResolvedValue({ data: { admin: { email: 'ada@example.com', role: 'admin', name: 'Ada Admin' } } });
  api.get.mockResolvedValue({ data: {} });
});

describe('admin console routing', () => {
  it('sends someone without an admin session to the admin sign-in', async () => {
    renderAt('/admin/risk');
    expect(await screen.findByText('Sign in to NOVARD-AI admin')).toBeInTheDocument();
  });

  it('tells a student account clearly that it is not an admin', async () => {
    adminApi.post.mockRejectedValue({ response: { status: 403, data: { error: 'This Google account is not a Novard-AI admin. Ask a superadmin to grant you access.', code: 'NOT_ADMIN' } } });
    renderAt('/admin/login');
    await screen.findByText('Sign in to NOVARD-AI admin');
    // The admin provider's hook is the one that posts to /api/admin/auth/google.
    await Promise.all(mockGoogleHooks.slice(-2).map((o) => o.onSuccess({ access_token: 'g' })));
    expect(await screen.findByRole('alert')).toHaveTextContent('not a Novard-AI admin');
    expect(localStorage.getItem('admin_token')).toBeNull();
  });

  it('opens straight into the console for an admin signed in to the app', async () => {
    localStorage.setItem('auth_token', 'app-tok');
    localStorage.setItem('auth_user', JSON.stringify({ email: 'ada@example.com', name: 'Ada Admin', role: 'superadmin' }));
    api.post.mockResolvedValue({ data: { token: 'admin-tok', admin: { email: 'ada@example.com', name: 'Ada Admin', role: 'superadmin' } } });
    renderAt('/admin/risk');
    expect(await screen.findByText('Video Summarizer')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/api/auth/admin-session');
    expect(localStorage.getItem('admin_token')).toBe('admin-tok');
  });

  it('still shows the admin sign-in to a student signed in to the app', async () => {
    localStorage.setItem('auth_token', 'app-tok');
    localStorage.setItem('auth_user', JSON.stringify({ email: 'sam@example.com', name: 'Sam', role: 'student' }));
    renderAt('/admin/risk');
    expect(await screen.findByText('Sign in to NOVARD-AI admin')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalledWith('/api/auth/admin-session');
  });

  it('renders the console inside the app\'s own shell: the same sidebar and header', async () => {
    signedIn();
    renderAt('/admin/risk');
    expect(await screen.findByText('Video Summarizer')).toBeInTheDocument();
    expect(screen.getByText('NOVARD-AI')).toBeInTheDocument();
    expect(screen.getByText('Admin console')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Risk board/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('ADMIN · RISK BOARD')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('report volume +6.0σ')).toBeInTheDocument();
  });
});

describe('live investigation', () => {
  it('lights up the graph from the SSE stream and links to the findings', async () => {
    signedIn();
    const frames = [
      ['snapshot', { runId: 'run_1', area: 'video-summarizer', status: 'running', startedAt: '2026-09-30T10:00:00Z' }],
      ['step', { _id: 's1', seq: 1, node: 'buildFeatures', latencyMs: 12 }],
      ['step', { _id: 's2', seq: 2, node: 'lane', lane: 'telemetry', latencyMs: 800, usd: 0.0002, outputSummary: 'Caption downloads fail.' }],
      ['call', { _id: 'c1', model: 'openai/gpt-oss-20b', task: 'risk_lane', tokensIn: 500, tokensOut: 80, usd: 0.0002, latencyMs: 790, outcome: 'ok' }],
      ['done', { status: 'done', outcome: 'investigated', assessmentId: 'a1' }],
    ];
    const encoder = new TextEncoder();
    adminFetch.mockResolvedValue({
      ok: true,
      body: new ReadableStream({ start(c) { frames.forEach(([e, d]) => c.enqueue(encoder.encode(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`))); c.close(); } }),
    });
    renderAt('/admin/runs/run_1');
    expect(await screen.findByText('Investigating video-summarizer')).toBeInTheDocument();
    expect(await screen.findByLabelText('AI, YouTube & PDF: done')).toBeInTheDocument();
    expect(screen.getByLabelText('Features: done')).toBeInTheDocument();
    expect(screen.getByLabelText('Root cause: waiting')).toBeInTheDocument();
    expect(await screen.findByText(/Finished: investigated/)).toBeInTheDocument();
    expect(screen.getByText('Open the findings')).toBeInTheDocument();
    expect(screen.getByText('Caption downloads fail.')).toBeInTheDocument();
    expect(adminFetch.mock.calls[0][0]).toBe('/api/admin/risk/runs/run_1/stream');
  });
});

describe('gateway settings', () => {
  it('saves a setting from the gateway page and never shows the key', async () => {
    signedIn();
    adminPut.mockResolvedValue({ value: {} });
    renderAt('/admin/gateways/groq');
    expect(await screen.findByText('Parameters')).toBeInTheDocument();
    expect(screen.getAllByText(/…abcd/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/max tokens scale/i), { target: { value: '0.5' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(adminPut).toHaveBeenCalledWith('/api/admin/gateways/groq/settings', { key: 'ai.params', value: { reasoningEffort: 'low', maxTokensScale: 0.5, temperature: null } }));
    expect(adminPost).not.toHaveBeenCalled();
  });
});

describe('admin assistant', () => {
  it('shows the reply with its confirmation card, and Confirm runs it', async () => {
    signedIn();
    const reply = { role: 'assistant', content: 'Video Summarizer is CRITICAL. I prepared an investigation.', tools: [{ name: 'risk_board', ok: true }], actions: [{ id: 'abc123', type: 'start_investigation', status: 'proposed', args: { area: 'video-summarizer', summary: 'Investigate video-summarizer' } }] };
    adminGet.mockImplementation(async (path) => {
      if (path === '/api/admin/assistant/conversations') return { conversations: [] };
      // After the first reply the page opens the saved chat.
      if (path === '/api/admin/assistant/conversations/c1') return { messages: [{ role: 'user', content: 'What is at risk right now?' }, reply] };
      return { open: [] };
    });
    const encoder = new TextEncoder();
    const frames = [
      ['meta', { conversationId: 'c1', isNew: true }],
      ['tool', { name: 'risk_board', args: {} }],
      ['done', { message: reply }],
    ];
    adminFetch.mockResolvedValue({ ok: true, body: new ReadableStream({ start(c) { frames.forEach(([e, d]) => c.enqueue(encoder.encode(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`))); c.close(); } }) });
    adminPost.mockResolvedValue({ action: { id: 'abc123', type: 'start_investigation', status: 'done', args: { summary: 'Investigate video-summarizer' }, result: { route: '/admin/runs/run_1', label: 'Watch it run' } } });

    renderAt('/admin/assistant');
    fireEvent.click(await screen.findByText('What is at risk right now?'));
    expect(await screen.findByText('Video Summarizer is CRITICAL. I prepared an investigation.')).toBeInTheDocument();
    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    expect(JSON.parse(adminFetch.mock.calls[0][1].body)).toMatchObject({ message: 'What is at risk right now?' });
    fireEvent.click(screen.getByText('Confirm'));
    expect(await screen.findByText('Watch it run')).toBeInTheDocument();
    expect(adminPost).toHaveBeenCalledWith('/api/admin/assistant/conversations/c1/actions/abc123', { decision: 'confirm' });
  });
});
