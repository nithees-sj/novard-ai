import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Todos from '../../pages/Todos';
import { dueLabel, dueStatus, localToday } from '../../lib/todos';

jest.mock('../layout/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../FeatureNotice', () => () => null);
jest.mock('../../context/AppStatusContext', () => ({
  useFeature: () => ({ enabled: true, message: '', notice: '' }),
  useAppStatus: () => ({ status: {} }),
}));
jest.mock('../../lib/todos', () => {
  const actual = jest.requireActual('../../lib/todos');
  return {
    ...actual,
    todosApi: {
      lists: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), addItem: jest.fn(), updateItem: jest.fn(),
      removeItem: jest.fn(), reorder: jest.fn(), clearCompleted: jest.fn(), draft: jest.fn(), toSkillPlan: jest.fn(),
    },
  };
});
// eslint-disable-next-line import/first
import { todosApi } from '../../lib/todos';

const TODAY = localToday();
const item = (id, text, extra = {}) => ({ _id: id, text, notes: '', done: false, doneAt: null, priority: null, dueDate: null, subtasks: [], ...extra });
const withCounts = (list) => {
  const open = list.items.filter((i) => !i.done);
  return { description: '', source: 'manual', skillPlanId: null, ...list, total: list.items.length, done: list.items.length - open.length, overdue: 0, dueToday: 0, nextDue: null };
};
const summary = ({ items, ...rest }) => rest;

const LIST = withCounts({
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  title: 'DBMS exam prep',
  items: [item('i1', 'Revise ER diagrams', { priority: 'high' }), item('i2', 'Solve SQL joins'), item('i3', 'Past papers', { done: true })],
});

const renderPage = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Todos /></MemoryRouter>);

beforeEach(() => {
  jest.resetAllMocks();
  todosApi.lists.mockResolvedValue([summary(LIST)]);
  todosApi.get.mockResolvedValue(LIST);
});

describe('Todo lists page', () => {
  it('starts with two choices and creates a list in place, without a dialog', async () => {
    todosApi.lists.mockResolvedValue([]);
    const created = withCounts({ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', title: 'Internships', items: [item('n1', 'Update my CV')] });
    todosApi.create.mockResolvedValue(created);
    todosApi.get.mockResolvedValue(created);
    renderPage();
    expect(await screen.findByText('Make your first list')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Write it yourself/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Internships' } });
    const next = screen.getByLabelText('Add a task');
    fireEvent.change(next, { target: { value: 'Update my CV' } });
    fireEvent.keyDown(next, { key: 'Enter' });
    expect(screen.getByLabelText('Task 1')).toHaveValue('Update my CV');
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }));
    await waitFor(() => expect(todosApi.create).toHaveBeenCalledWith({
      title: 'Internships', description: '', items: [{ text: 'Update my CV', priority: null, dueDate: null, subtasks: [] }],
    }));
    expect(await screen.findByText('Created “Internships”.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Update my CV/ })).toBeInTheDocument();
  });

  it('opens "New list" in the main pane next to the lists, and cancels back to the list', async () => {
    renderPage();
    await screen.findByText('Revise ER diagrams');
    fireEvent.click(screen.getByRole('button', { name: 'New list' }));
    expect(screen.getByRole('heading', { name: 'New list' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Your lists' })).getByText('DBMS exam prep')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Revise ER diagrams')).toBeInTheDocument();
  });

  it('shows the open list, adds and ticks off tasks, and filters them', async () => {
    renderPage();
    expect(await screen.findByText('Revise ER diagrams')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 done · 33%')).toBeInTheDocument();

    todosApi.addItem.mockImplementation(async (id, body) => withCounts({ ...LIST, items: [...LIST.items, item('i4', body.text)] }));
    fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'Normalisation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Normalisation')).toBeInTheDocument(); // shown before the server answers
    await waitFor(() => expect(todosApi.addItem).toHaveBeenCalledWith(LIST._id, { text: 'Normalisation' }));
    await screen.findByText('1 of 4 done · 25%');

    todosApi.updateItem.mockImplementation(async () => withCounts({ ...LIST, items: [{ ...LIST.items[0], done: true }, ...LIST.items.slice(1), item('i4', 'Normalisation')] }));
    fireEvent.click(screen.getByLabelText('Mark "Revise ER diagrams" as done'));
    await waitFor(() => expect(todosApi.updateItem).toHaveBeenCalledWith(LIST._id, 'i1', { done: true }));
    expect(await screen.findByText('2 of 4 done · 50%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'To do' }));
    const tasks = within(screen.getByRole('list', { name: 'Tasks' }));
    expect(tasks.queryByText('Revise ER diagrams')).not.toBeInTheDocument();
    expect(tasks.getByText('Solve SQL joins')).toBeInTheDocument();
  });

  it('lets a deleted task be undone, and sends the deletion once another task is deleted', async () => {
    renderPage();
    await screen.findByText('Solve SQL joins');
    const deleteTask = (name) => {
      fireEvent.click(screen.getByRole('button', { name: `Options for "${name}"` }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete task' }));
    };

    deleteTask('Solve SQL joins');
    expect(screen.queryByRole('button', { name: /^Solve SQL joins/ })).not.toBeInTheDocument();
    expect(screen.getByText('Deleted “Solve SQL joins”')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: /^Solve SQL joins/ })).toBeInTheDocument();
    expect(todosApi.removeItem).not.toHaveBeenCalled();

    todosApi.removeItem.mockImplementation(async (id, itemId) => withCounts({ ...LIST, items: LIST.items.filter((i) => i._id !== itemId) }));
    deleteTask('Solve SQL joins');
    deleteTask('Past papers');
    await waitFor(() => expect(todosApi.removeItem).toHaveBeenCalledWith(LIST._id, 'i2'));
    expect(screen.queryByRole('button', { name: /^Solve SQL joins/ })).not.toBeInTheDocument(); // the server's reply still has "Past papers", but it stays hidden
    expect(screen.queryByRole('button', { name: /^Past papers/ })).not.toBeInTheDocument();
    expect(screen.getByText('Deleted “Past papers”')).toBeInTheDocument();
  });

  it('deletes a list from the lists rail after confirming', async () => {
    renderPage();
    await screen.findByText('Revise ER diagrams');
    todosApi.remove.mockResolvedValue({ deleted: true });
    fireEvent.click(screen.getByRole('button', { name: 'Options for DBMS exam prep' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete list' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Its 3 tasks will be deleted too/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete list' }));
    await waitFor(() => expect(todosApi.remove).toHaveBeenCalledWith(LIST._id));
    expect(await screen.findByText('Make your first list')).toBeInTheDocument();
  });

  it('reloads the list and says so when a change fails', async () => {
    renderPage();
    await screen.findByText('Solve SQL joins');
    todosApi.updateItem.mockRejectedValue(new Error('Network down'));
    fireEvent.click(screen.getByLabelText('Mark "Solve SQL joins" as done'));
    expect(await screen.findByText('Network down')).toBeInTheDocument();
    await waitFor(() => expect(todosApi.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('1 of 3 done · 33%')).toBeInTheDocument();
  });

  it('plans a list with AI in the main pane, lets the student edit it, then saves it', async () => {
    renderPage();
    await screen.findByText('Revise ER diagrams');
    let answer;
    todosApi.draft.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const saved = withCounts({ _id: 'cccccccccccccccccccccccc', title: 'OS finals', source: 'ai', items: [item('o1', 'Revise scheduling'), item('o2', 'Practise deadlock problems')] });
    todosApi.create.mockResolvedValue(saved);
    todosApi.get.mockResolvedValue(saved);

    fireEvent.click(screen.getByRole('button', { name: 'Plan with AI' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/What do you need to do/), { target: { value: 'OS exam in 3 days' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draft my list' }));
    expect(await screen.findByText('Breaking it into tasks…')).toBeInTheDocument();
    answer({ title: 'OS exam prep', items: [{ text: 'Revise scheduling', priority: 'high', dueDate: TODAY, subtasks: ['FCFS'] }, { text: 'Deadlocks', priority: null, dueDate: null, subtasks: [] }] });
    expect(await screen.findByText('Check your list')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/List name/), { target: { value: 'OS finals' } });
    fireEvent.change(screen.getByLabelText('Task 2'), { target: { value: 'Practise deadlock problems' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }));
    await waitFor(() => expect(todosApi.create).toHaveBeenCalledWith({
      title: 'OS finals',
      source: 'ai',
      items: [
        { text: 'Revise scheduling', priority: 'high', dueDate: TODAY, subtasks: ['FCFS'] },
        { text: 'Practise deadlock problems', priority: null, dueDate: null, subtasks: [] },
      ],
    }));
    expect(await screen.findByText('“OS finals” is ready with 2 tasks.')).toBeInTheDocument();
  });

  it('shows the kind decline for an out-of-scope request', async () => {
    renderPage();
    await screen.findByText('Revise ER diagrams');
    todosApi.draft.mockResolvedValue({ declined: 'I can only help with educational topics.' });
    fireEvent.click(screen.getByRole('button', { name: 'Plan with AI' }));
    fireEvent.change(screen.getByLabelText(/What do you need to do/), { target: { value: 'Plan a party' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draft my list' }));
    expect(await screen.findByText('I can only help with educational topics.')).toBeInTheDocument();
    expect(todosApi.create).not.toHaveBeenCalled();
  });

  it('turns the list into a Skill Plan built from its open tasks', async () => {
    renderPage();
    await screen.findByText('Revise ER diagrams');
    fireEvent.click(screen.getAllByRole('button', { name: 'Turn into a Skill Plan' })[0]);

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByLabelText(/Skill or subject/)).toHaveValue('DBMS exam prep');
    expect(dialog.getByLabelText(/^Days/)).toHaveValue(10); // 2 open tasks, at least 10 days
    expect(dialog.getByLabelText(/By the end I want to/)).toHaveValue('Work through: Revise ER diagrams; Solve SQL joins');
    expect(dialog.getByText('The plan follows these 2 tasks')).toBeInTheDocument();
    expect(dialog.queryByText('Past papers')).not.toBeInTheDocument();

    todosApi.toSkillPlan.mockResolvedValue({ list: { ...LIST, skillPlanId: 'dddddddddddddddddddddddd' }, plan: { _id: 'dddddddddddddddddddddddd', skillName: 'DBMS', duration: 12 } });
    fireEvent.change(dialog.getByLabelText(/Skill or subject/), { target: { value: 'DBMS' } });
    fireEvent.change(dialog.getByLabelText(/^Days/), { target: { value: '12' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(todosApi.toSkillPlan).toHaveBeenCalledWith(LIST._id, {
      skillName: 'DBMS', duration: 12, description: 'Work through: Revise ER diagrams; Solve SQL joins',
      preferences: { level: 'beginner', language: 'English', teachingStyle: 'Standard' },
    }));
    expect(await screen.findByText('Your Skill Plan is ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
    expect(screen.getAllByRole('button', { name: 'Open Skill Plan' }).length).toBeGreaterThan(0);
  });

  it('refuses a plan length outside 10-60 days before calling the server', async () => {
    renderPage();
    await screen.findByText('Revise ER diagrams');
    fireEvent.click(screen.getAllByRole('button', { name: 'Turn into a Skill Plan' })[0]);
    fireEvent.change(screen.getByLabelText(/^Days/), { target: { value: '5' } });
    expect(screen.getByText('Choose 10 to 60 days.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create plan' })).toBeDisabled();
  });
});

describe('due dates', () => {
  it('classifies and labels due dates in the student’s calendar', () => {
    expect(dueStatus('2026-10-06', '2026-10-07')).toBe('overdue');
    expect(dueStatus('2026-10-07', '2026-10-07')).toBe('today');
    expect(dueStatus('2026-10-09', '2026-10-07')).toBe('soon');
    expect(dueStatus('2026-10-20', '2026-10-07')).toBe('later');
    expect(dueStatus(null, '2026-10-07')).toBeNull();
    expect(dueLabel('2026-10-08', '2026-10-07')).toBe('Tomorrow');
    expect(dueLabel('2026-10-06', '2026-10-07')).toBe('Yesterday');
  });
});
