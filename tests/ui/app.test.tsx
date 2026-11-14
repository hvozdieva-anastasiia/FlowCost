import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graph, link, screen as screenFixture } from '../engine/fixtures';
import { loadGraph, renderApp } from './harness';

describe('Flow Cost window', () => {
  describe('opening', () => {
    it('asks the plugin to read the prototype and says it is reading', () => {
      const app = renderApp();
      expect(app.sent).toContainEqual({ type: 'READY' });
      expect(
        screen.getAllByText('Reading the prototype…').length,
      ).toBeGreaterThan(0);
    });

    it('starts at the flow start and asks for where it ends', () => {
      const app = renderApp();
      loadGraph(app);
      expect(screen.getByLabelText('From')).toHaveValue('welcome');
      expect(screen.getByLabelText('To')).toHaveValue('');
      expect(
        screen.getByText('Choose where the flow ends.'),
      ).toBeInTheDocument();
    });

    it('describes the page in a status line', () => {
      const app = renderApp();
      loadGraph(app);
      expect(
        screen.getByText(/Page · 4 screens · 4 connections · updated/),
      ).toBeInTheDocument();
    });

    it('asks for both screens when the page has no flow start', () => {
      const app = renderApp();
      loadGraph(
        app,
        graph([screenFixture('a'), screenFixture('b')], [link('ab', 'a', 'b')]),
      );
      expect(
        screen.getByText('Choose where the flow starts and ends.'),
      ).toBeInTheDocument();
    });

    it('says what to do on a page without screens', () => {
      const app = renderApp();
      loadGraph(app, graph([], []));
      expect(screen.getByText('No screens on this page.')).toBeInTheDocument();
    });
  });

  describe('the route', () => {
    it('prices the flow in plain words once the end is chosen', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.selectOptions(screen.getByLabelText('To'), 'done');
      expect(
        screen.getByText(/^About \d+ seconds? and 1 action$/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'From Welcome to Done, for a regular person using a mouse.',
        ),
      ).toBeInTheDocument();
      const result = screen.getByRole('region', { name: 'Result' });
      expect(within(result).getByText('Actions').nextSibling).toHaveTextContent(
        '1',
      );
      expect(within(result).getByText('1. Skip')).toBeInTheDocument();
    });

    it('switches to the route with fewest actions and lists the others', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.selectOptions(screen.getByLabelText('To'), 'done');
      await user.click(screen.getByRole('button', { name: 'Fewest actions' }));
      expect(
        screen.getByRole('button', { name: 'Fewest actions' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await user.selectOptions(screen.getByLabelText('Other routes'), '1');
      expect(screen.getByText('1. Get started')).toBeInTheDocument();
      expect(screen.getByText('2. Submit')).toBeInTheDocument();
    });

    it('explains when there is no route and offers the Check tab', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.selectOptions(screen.getByLabelText('To'), 'island');
      expect(
        screen.getByText(/No connection leads from "Welcome" to "Island"/),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Open Check' }));
      expect(screen.getByRole('tab', { name: /Check/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('swaps From and To', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.selectOptions(screen.getByLabelText('To'), 'done');
      await user.click(
        screen.getByRole('button', { name: 'Swap From and To' }),
      );
      expect(screen.getByLabelText('From')).toHaveValue('done');
      expect(screen.getByLabelText('To')).toHaveValue('welcome');
    });

    it('shows a layer on the canvas from a step', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.selectOptions(screen.getByLabelText('To'), 'done');
      await user.click(screen.getByText('1. Skip'));
      await user.click(screen.getByRole('button', { name: 'Show on canvas' }));
      expect(app.sent).toContainEqual({ type: 'REVEAL', nodeId: 'node-skip' });
    });

    it('says the time and what the profile changes', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.selectOptions(screen.getByLabelText('To'), 'done');
      const before = screen.getByText('Modelled time').nextSibling?.textContent;
      await user.click(screen.getByLabelText('Beginner'));
      const after = screen.getByText('Modelled time').nextSibling?.textContent;
      expect(after).not.toBe(before);
      expect(app.sent.some((m) => m.type === 'SETTINGS_SAVE')).toBe(true);
      expect(
        screen.getByText(/for a beginner person using a mouse/),
      ).toBeInTheDocument();
    });
  });

  describe('the canvas selection', () => {
    it('hints at what to do when nothing is selected', () => {
      const app = renderApp();
      loadGraph(app);
      expect(
        screen.getByText(
          'Select a screen on the canvas to use it as From or To.',
        ),
      ).toBeInTheDocument();
    });

    it('offers the selected screen as From or To', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      app.send({ type: 'SELECTION', screenIds: ['form'], count: 1 });
      expect(screen.getByText(/Selected on the canvas:/).textContent).toContain(
        'Form',
      );
      await user.click(screen.getByRole('button', { name: 'Use as To' }));
      expect(screen.getByLabelText('To')).toHaveValue('form');
      expect(screen.getByRole('button', { name: 'Use as To' })).toBeDisabled();
    });

    it('asks for one screen when several are selected', () => {
      const app = renderApp();
      loadGraph(app);
      app.send({ type: 'SELECTION', screenIds: ['form', 'done'], count: 2 });
      expect(screen.getByText(/Select one screen/)).toBeInTheDocument();
    });
  });

  describe('keeping up with the canvas', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('reads the prototype again on request and shows that it is reading', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.click(screen.getByRole('button', { name: /Refresh/ }));
      expect(app.sent.filter((m) => m.type === 'SCAN')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: /Reading…/ }),
      ).toBeInTheDocument();
      loadGraph(app);
      expect(
        screen.getByRole('button', { name: /Refresh/ }),
      ).toBeInTheDocument();
    });

    it('reads it again by itself once edits pause', () => {
      vi.useFakeTimers();
      const app = renderApp();
      loadGraph(app);
      app.send({ type: 'PAGE_EDITED' });
      app.send({ type: 'PAGE_EDITED' });
      expect(app.sent.filter((m) => m.type === 'SCAN')).toHaveLength(0);
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(app.sent.filter((m) => m.type === 'SCAN')).toHaveLength(1);
    });

    it('keeps the chosen route when the page is read again', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.selectOptions(screen.getByLabelText('To'), 'done');
      loadGraph(app);
      expect(screen.getByLabelText('To')).toHaveValue('done');
    });
  });

  describe('messages', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows a message that can be closed', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      app.send({
        type: 'NOTICE',
        level: 'error',
        text: 'Nothing is selected. Select the field layers on the canvas first.',
      });
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Nothing is selected.',
      );
      await user.click(screen.getByRole('button', { name: 'Close message' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('clears a message by itself', () => {
      vi.useFakeTimers();
      const app = renderApp();
      app.send({
        type: 'NOTICE',
        level: 'info',
        text: 'Marked 2 layers as input fields.',
      });
      expect(
        screen.getByText('Marked 2 layers as input fields.'),
      ).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(5_100);
      });
      expect(
        screen.queryByText('Marked 2 layers as input fields.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Check', () => {
    it('counts problems on the tab and groups them', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      const tab = screen.getByRole('tab', { name: /Check/ });
      expect(tab).toHaveTextContent('Check (1)');
      await user.click(tab);
      expect(
        screen.getByRole('heading', { name: 'Worth a look (1)' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/"Island" can't be reached/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Show on canvas' }));
      expect(app.sent).toContainEqual({ type: 'REVEAL', nodeId: 'island' });
    });

    it('lets a dead end be marked as the end of the flow', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(
        app,
        graph(
          [screenFixture('a'), screenFixture('end', { name: 'Thanks' })],
          [link('ae', 'a', 'end')],
          ['a'],
        ),
      );
      await user.click(screen.getByRole('tab', { name: 'Check' }));
      expect(
        screen.getByRole('heading', { name: 'Good to know (1)' }),
      ).toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: 'Mark as end of flow' }),
      );
      expect(app.sent).toContainEqual({
        type: 'MARK_ENDING',
        value: true,
        screenId: 'end',
      });
    });

    it('says so when everything is fine', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(
        app,
        graph(
          [screenFixture('a'), screenFixture('b', { ending: true })],
          [link('ab', 'a', 'b')],
          ['a'],
        ),
      );
      await user.click(screen.getByRole('tab', { name: 'Check' }));
      expect(screen.getByText('No problems found.')).toBeInTheDocument();
    });
  });

  describe('Teach Flow Cost', () => {
    it('turns the buttons off until something is selected, and says why', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.click(screen.getByText('Teach Flow Cost'));
      expect(
        screen.getByRole('button', { name: 'These are input fields' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Mark selected screen as an end' }),
      ).toBeDisabled();
      expect(
        screen.getByText(/Select layers on the canvas first/),
      ).toBeInTheDocument();
    });

    it('marks the selected layers and screens', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.click(screen.getByText('Teach Flow Cost'));
      app.send({ type: 'SELECTION', screenIds: ['form'], count: 2 });
      expect(screen.getByText(/Selected: 2 layers/)).toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: 'These are input fields' }),
      );
      expect(app.sent).toContainEqual({
        type: 'MARK_INPUT',
        mark: { kind: 'input', chars: 12 },
      });
      await user.click(
        screen.getByRole('button', { name: 'Mark selected screen as an end' }),
      );
      expect(app.sent).toContainEqual({ type: 'MARK_ENDING', value: true });
    });
  });

  describe('Compare before and after', () => {
    it('saves a result and compares against it', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.selectOptions(screen.getByLabelText('To'), 'done');
      await user.click(screen.getByText('Compare before and after'));
      await user.click(screen.getByRole('button', { name: 'Save result' }));
      const saved = app.sent.find((m) => m.type === 'SNAPSHOT_SAVE');
      expect(saved).toBeDefined();
      if (saved?.type !== 'SNAPSHOT_SAVE') return;
      expect(saved.snapshot.label).toBe('Welcome to Done');
      expect(
        screen.getByText('Result saved in this file.'),
      ).toBeInTheDocument();

      app.send({ type: 'SNAPSHOTS', snapshots: [saved.snapshot] });
      await user.selectOptions(
        screen.getByLabelText('Compare the current route with'),
        saved.snapshot.id,
      );
      expect(
        screen.getByRole('table', { name: /compared with the current route/ }),
      ).toBeInTheDocument();
    });

    it('asks for a route before saving', async () => {
      const user = userEvent.setup();
      const app = renderApp();
      loadGraph(app);
      await user.click(screen.getByText('Compare before and after'));
      expect(
        screen.getByRole('button', { name: 'Save result' }),
      ).toBeDisabled();
      expect(
        screen.getByText('Choose a route first, then save its result.'),
      ).toBeInTheDocument();
    });
  });
});
