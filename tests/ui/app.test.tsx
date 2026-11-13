import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadGraph, renderApp } from './harness';

describe('Flow Cost window', () => {
  it('asks the plugin to read the page when it opens', () => {
    const app = renderApp();
    expect(app.sent).toContainEqual({ type: 'READY' });
    expect(screen.getByText('Reading the page…')).toBeInTheDocument();
  });

  it('starts at the flow start and waits for a goal', () => {
    const app = renderApp();
    loadGraph(app);
    expect(screen.getByLabelText('Start')).toHaveValue('welcome');
    expect(screen.getByLabelText('Goal')).toHaveValue('');
    expect(
      screen.getByText(/Choose where the flow starts and where it ends/),
    ).toBeInTheDocument();
  });

  it('prices the flow once a goal is chosen', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    await user.selectOptions(screen.getByLabelText('Goal'), 'done');
    const result = screen.getByRole('region', { name: 'Result' });
    // The shortcut is one action; the long way is two.
    expect(within(result).getByText('Actions').nextSibling).toHaveTextContent(
      '1',
    );
    expect(within(result).getByText('1. Skip')).toBeInTheDocument();
  });

  it('switches to the path with fewest steps and lists the others', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    await user.selectOptions(screen.getByLabelText('Goal'), 'done');
    await user.click(screen.getByRole('button', { name: 'Fewest steps' }));
    expect(
      screen.getByRole('button', { name: 'Fewest steps' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.selectOptions(screen.getByLabelText('Other paths'), '1');
    expect(screen.getByText('1. Get started')).toBeInTheDocument();
    expect(screen.getByText('2. Submit')).toBeInTheDocument();
  });

  it('says so when no path exists', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    await user.selectOptions(screen.getByLabelText('Goal'), 'island');
    expect(screen.getByRole('status')).toHaveTextContent(/no path/i);
  });

  it('takes the start and goal from the canvas selection', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    app.send({ type: 'SELECTION', screenIds: ['form'] });
    // The first button is for the start, the second for the goal.
    const buttons = screen.getAllByRole('button', { name: 'Use selection' });
    await user.click(buttons[1] as HTMLElement);
    expect(screen.getByLabelText('Goal')).toHaveValue('form');
  });

  it('shows a layer on the canvas when a step asks for it', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    await user.selectOptions(screen.getByLabelText('Goal'), 'done');
    await user.click(screen.getByText('1. Skip'));
    await user.click(screen.getByRole('button', { name: 'Show layer' }));
    expect(app.sent).toContainEqual({ type: 'REVEAL', nodeId: 'node-skip' });
  });

  it('saves a snapshot and compares against it', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    await user.selectOptions(screen.getByLabelText('Goal'), 'done');
    await user.click(screen.getByText('Compare with a snapshot'));
    await user.click(screen.getByRole('button', { name: 'Save snapshot' }));
    const saved = app.sent.find((m) => m.type === 'SNAPSHOT_SAVE');
    expect(saved).toBeDefined();
    if (saved?.type !== 'SNAPSHOT_SAVE') return;
    expect(saved.snapshot.label).toBe('Welcome to Done');

    app.send({ type: 'SNAPSHOTS', snapshots: [saved.snapshot] });
    await user.selectOptions(
      screen.getByLabelText('Compare with'),
      saved.snapshot.id,
    );
    expect(
      screen.getByRole('table', { name: /compared with the current path/ }),
    ).toBeInTheDocument();
  });

  it('keeps the page changed notice until the page is read again', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    app.send({ type: 'PAGE_CHANGED' });
    await user.click(screen.getByRole('button', { name: 'Read it again' }));
    expect(app.sent.filter((m) => m.type === 'SCAN')).toHaveLength(1);
  });

  it('lists problems on the health tab and counts them on the tab', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    const tab = screen.getByRole('tab', { name: /Health/ });
    expect(tab).toHaveTextContent('Health (1)');
    await user.click(tab);
    expect(screen.getByText(/"Island" cannot be reached/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(app.sent).toContainEqual({ type: 'REVEAL', nodeId: 'island' });
  });

  it('shows plugin notices and lets the person dismiss them', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    app.send({
      type: 'NOTICE',
      level: 'error',
      text: 'Select the field layers first.',
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Select the field layers first.',
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends the marks the person asks for', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    await user.click(screen.getByText('Marks'));
    await user.click(
      screen.getByRole('button', { name: 'Selected layers are inputs' }),
    );
    expect(app.sent).toContainEqual({
      type: 'MARK_INPUT',
      mark: { kind: 'input', chars: 12 },
    });
    await user.click(
      screen.getByRole('button', { name: 'Selected screen is an ending' }),
    );
    expect(app.sent).toContainEqual({ type: 'MARK_ENDING', value: true });
  });

  it('saves changed assumptions and reprices', async () => {
    const user = userEvent.setup();
    const app = renderApp();
    loadGraph(app);
    await user.selectOptions(screen.getByLabelText('Goal'), 'done');
    const before = screen.getByText('Time').nextSibling?.textContent;
    await user.click(screen.getByText('Profile and assumptions'));
    await user.selectOptions(screen.getByLabelText('Skill'), 'novice');
    const after = screen.getByText('Time').nextSibling?.textContent;
    expect(after).not.toBe(before);
    expect(app.sent.some((m) => m.type === 'SETTINGS_SAVE')).toBe(true);
  });
});
