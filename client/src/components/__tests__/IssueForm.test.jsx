import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IssueForm from '../IssueForm';

const fill = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });

describe('IssueForm', () => {
  it('requires a title and description', async () => {
    const onSubmit = jest.fn();
    render(<IssueForm isVisible onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Issue' }));
    expect(await screen.findByText('Please fill in both the title and the description.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends the post without any identity fields (the server uses the session)', async () => {
    const onSubmit = jest.fn(async () => {});
    render(<IssueForm isVisible onSubmit={onSubmit} onCancel={() => {}} />);
    fill('title', 'Docker volume permissions');
    fill('description', 'The container cannot write.');
    fill('tags', 'docker, volumes, ');
    fireEvent.click(screen.getByRole('button', { name: 'Create Issue' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      title: 'Docker volume permissions', description: 'The container cannot write.', tags: ['docker', 'volumes'], category: 'general',
    }));
  });

  it('shows the server’s error message', async () => {
    render(<IssueForm isVisible onSubmit={async () => { throw new Error('Title must be 200 characters or fewer.'); }} onCancel={() => {}} />);
    fill('title', 'x');
    fill('description', 'y');
    fireEvent.click(screen.getByRole('button', { name: 'Create Issue' }));
    expect(await screen.findByText('Title must be 200 characters or fewer.')).toBeInTheDocument();
  });
});
