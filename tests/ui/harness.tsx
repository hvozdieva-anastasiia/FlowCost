import { act, render } from '@testing-library/react';
import { App } from '../../src/ui/App';
import type { Bridge } from '../../src/ui/bridge';
import { FlowProvider } from '../../src/ui/FlowProvider';
import type { FlowGraph } from '../../src/shared/graph';
import {
  defaultSettings,
  type PluginMessage,
  type UiMessage,
} from '../../src/shared/messages';
import { graph, link, screen } from '../engine/fixtures';

export interface Harness {
  readonly sent: UiMessage[];
  send(message: PluginMessage): void;
}

export function renderApp(): Harness & ReturnType<typeof render> {
  const sent: UiMessage[] = [];
  const listeners = new Set<(message: PluginMessage) => void>();
  const bridge: Bridge = {
    post: (message) => {
      sent.push(message);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const send = (message: PluginMessage) => {
    act(() => {
      for (const listener of listeners) listener(message);
    });
  };
  const view = render(
    <FlowProvider bridge={bridge}>
      <App />
    </FlowProvider>,
  );
  return { ...view, sent, send };
}

/** Sign up: a -> b -> c, with a shortcut a -> c that is quicker. */
export function sampleGraph(): FlowGraph {
  return graph(
    [
      screen('welcome', { name: 'Welcome' }),
      screen('form', { name: 'Form' }),
      screen('done', { name: 'Done', ending: true }),
      screen('island', { name: 'Island' }),
    ],
    [
      link('start', 'welcome', 'form', { sourceName: 'Get started' }),
      link('submit', 'form', 'done', { sourceName: 'Submit' }),
      link('skip', 'welcome', 'done', { sourceName: 'Skip' }),
      // Nothing leads to the island, so no flow reaches it.
      link('leave', 'island', 'form', { sourceName: 'Leave' }),
    ],
    ['welcome'],
  );
}

export function loadGraph(
  harness: Harness,
  flow: FlowGraph = sampleGraph(),
): void {
  harness.send({
    type: 'STATE',
    settings: defaultSettings(),
    snapshots: [],
  });
  harness.send({ type: 'SCAN_RESULT', graph: flow });
}
