// Plugin Main: opens the window, reads the prototype when asked and carries out
// the few things the window cannot do itself. It never changes the design;
// the only writes are marks (pluginData) the person asked for.

import { DEFAULT_WINDOW } from '../shared/product';
import {
  parseUiMessage,
  type InputMark,
  type PluginMessage,
  type UiMessage,
} from '../shared/messages';
import {
  ENDING_KEY,
  INPUT_KEY,
  NAMESPACE,
  readGraph,
  screenOf,
} from './extract';
import {
  addSnapshot,
  loadSettings,
  loadSnapshots,
  removeSnapshot,
  saveSettings,
} from './storage';

function post(message: PluginMessage): void {
  figma.ui.postMessage(message);
}

function notice(level: 'info' | 'error', text: string): void {
  post({ type: 'NOTICE', level, text });
}

function postSelection(): void {
  const ids = new Set<string>();
  for (const node of figma.currentPage.selection) {
    const screen = screenOf(node);
    if (screen) ids.add(screen.id);
  }
  post({ type: 'SELECTION', screenIds: [...ids] });
}

async function scan(): Promise<void> {
  try {
    post({ type: 'SCAN_RESULT', graph: await readGraph() });
  } catch (error) {
    notice('error', `Could not read the page: ${describe(error)}`);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function reveal(nodeId: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') {
    notice('error', 'That layer no longer exists.');
    return;
  }
  let page: BaseNode | null = node;
  while (page && page.type !== 'PAGE') page = page.parent;
  if (page && page.id !== figma.currentPage.id) {
    notice('error', 'That layer is on another page.');
    return;
  }
  figma.currentPage.selection = [node as SceneNode];
  figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
}

function markInput(mark: InputMark): number {
  const selection = figma.currentPage.selection;
  const value =
    mark.kind === 'input'
      ? String(mark.chars)
      : mark.kind === 'not-input'
        ? '0'
        : '';
  for (const node of selection) {
    node.setSharedPluginData(NAMESPACE, INPUT_KEY, value);
  }
  return selection.length;
}

function markEnding(value: boolean): number {
  let count = 0;
  for (const node of figma.currentPage.selection) {
    const screen = screenOf(node);
    if (!screen) continue;
    screen.setSharedPluginData(NAMESPACE, ENDING_KEY, value ? '1' : '');
    count += 1;
  }
  return count;
}

async function handle(message: UiMessage): Promise<void> {
  switch (message.type) {
    case 'READY': {
      post({
        type: 'STATE',
        settings: await loadSettings(),
        snapshots: loadSnapshots(),
      });
      postSelection();
      await scan();
      return;
    }
    case 'SCAN':
      await scan();
      return;
    case 'REVEAL':
      await reveal(message.nodeId);
      return;
    case 'MARK_INPUT': {
      const count = markInput(message.mark);
      if (count === 0) {
        notice('error', 'Select the field layers first.');
        return;
      }
      await scan();
      return;
    }
    case 'MARK_ENDING': {
      const count = markEnding(message.value);
      if (count === 0) {
        notice('error', 'Select a screen, or a layer inside it, first.');
        return;
      }
      await scan();
      return;
    }
    case 'SNAPSHOT_SAVE':
      post({ type: 'SNAPSHOTS', snapshots: addSnapshot(message.snapshot) });
      return;
    case 'SNAPSHOT_DELETE':
      post({ type: 'SNAPSHOTS', snapshots: removeSnapshot(message.id) });
      return;
    case 'SETTINGS_SAVE':
      saveSettings(message.settings);
      return;
  }
}

figma.showUI(__html__, {
  width: DEFAULT_WINDOW.width,
  height: DEFAULT_WINDOW.height,
  themeColors: true,
});

figma.ui.onmessage = (raw: unknown) => {
  const message = parseUiMessage(raw);
  if (!message) return;
  handle(message).catch((error: unknown) => {
    notice('error', `Something went wrong: ${describe(error)}`);
  });
};

figma.on('selectionchange', postSelection);
figma.on('currentpagechange', () => post({ type: 'PAGE_CHANGED' }));
