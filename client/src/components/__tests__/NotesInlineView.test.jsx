import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotesInlineView from '../NotesInlineView';
import { api } from '../../lib/api';

jest.mock('../MarkdownView', () => ({ content }) => <div>{content}</div>);
jest.mock('../quiz/QuizSetup', () => () => <div>quiz setup</div>);
jest.mock('../../lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  errorMessage: (error, fallback) => error?.response?.data?.error || fallback,
}));

const note = (id, title) => ({ _id: id, id, title, fileName: title, summary: '', chatHistory: [], quizzes: [], uploadedAt: '2026-01-01' });

describe('Notes & Quiz', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('email', 'alice@example.com');
  });

  it('opens a freshly uploaded PDF and can chat with it straight away', async () => {
    const uploaded = note('n2', 'biology.pdf');
    api.get.mockResolvedValueOnce({ data: [] }).mockResolvedValue({ data: [uploaded] });
    api.post.mockImplementation(async (url) => (url === '/upload-notes'
      ? { data: { ...uploaded, message: 'ok' } }
      : { data: { response: 'Photosynthesis makes glucose.', noteId: 'n2' } }));

    render(<MemoryRouter><NotesInlineView /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/notes/alice%40example.com'));

    const file = new File(['%PDF-1.4'], 'biology.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Choose a PDF to upload'), { target: { files: [file] } });
    await screen.findByText('PDF uploaded successfully!');

    fireEvent.change(screen.getByLabelText('Ask a question about your notes…'), { target: { value: 'What is it?' } });
    fireEvent.click(screen.getByLabelText('Send'));

    await screen.findByText('Photosynthesis makes glucose.');
    // Before the fix the upload response had no _id, so this was sent as undefined.
    expect(api.post).toHaveBeenCalledWith('/chat-with-notes', { noteId: 'n2', message: 'What is it?' });
  });

  it('refuses non-PDF files before uploading', async () => {
    api.get.mockResolvedValue({ data: [] });
    render(<MemoryRouter><NotesInlineView /></MemoryRouter>);
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Choose a PDF to upload'), { target: { files: [file] } });
    expect(await screen.findByText('Please select a PDF file')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when a chat message fails', async () => {
    api.get.mockResolvedValue({ data: [note('n1', 'a.pdf')] });
    api.post.mockRejectedValue({ response: { data: { error: 'You are sending AI requests very quickly.' } } });
    render(<MemoryRouter><NotesInlineView /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Ask a question about your notes…'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByLabelText('Send'));
    expect(await screen.findByText('You are sending AI requests very quickly.')).toBeInTheDocument();
  });
});
