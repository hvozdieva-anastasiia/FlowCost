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
  post({
    type: 'SELECTION',
    screenIds: [...ids],
    count: figma.currentPage.selection.length,
  });
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

/** Marks the screens behind `nodes`; returns their names. */
function markEnding(nodes: readonly BaseNode[], value: boolean): string[] {
  const names = new Map<string, string>();
  for (const node of nodes) {
    const screen = screenOf(node);
    if (!screen || names.has(screen.id)) continue;
    screen.setSharedPluginData(NAMESPACE, ENDING_KEY, value ? '1' : '');
    names.set(screen.id, screen.name);
  }
  return [...names.values()];
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
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
        notice(
          'error',
          'Nothing is selected. Select the field layers on the canvas first.',
        );
        return;
      }
      const what = plural(count, 'layer', 'layers');
      notice(
        'info',
        message.mark.kind === 'input'
          ? `Marked ${what} as input fields.`
          : message.mark.kind === 'not-input'
            ? `Marked ${what} as not input fields.`
            : `Cleared the marks on ${what}.`,
      );
      await scan();
      return;
    }
    case 'MARK_ENDING': {
      let nodes: readonly BaseNode[] = figma.currentPage.selection;
      if (message.screenId !== undefined) {
        const node = await figma.getNodeByIdAsync(message.screenId);
        nodes = node ? [node] : [];
      }
      const names = markEnding(nodes, message.value);
      if (names.length === 0) {
        notice(
          'error',
          'No screen to mark. Select a screen, or a layer inside it, on the canvas first.',
        );
        return;
      }
      const list = names.map((name) => `"${name}"`).join(', ');
      notice(
        'info',
        message.value
          ? `${list} is now marked as an end of the flow.`
          : `Removed the end-of-flow mark from ${list}.`,
      );
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

// Tell the window when the page is edited, so it can read the prototype again
// by itself. Edits come in bursts (a drag, a paste), so wait until they pause.
const EDIT_PAUSE_MS = 500;
let editTimer: ReturnType<typeof setTimeout> | undefined;
let watched: PageNode | null = null;

function onNodeChange(): void {
  if (editTimer !== undefined) clearTimeout(editTimer);
  editTimer = setTimeout(() => post({ type: 'PAGE_EDITED' }), EDIT_PAUSE_MS);
}

async function watchCurrentPage(): Promise<void> {
  const page = figma.currentPage;
  await page.loadAsync();
  if (watched) watched.off('nodechange', onNodeChange);
  watched = page;
  page.on('nodechange', onNodeChange);
}

figma.on('selectionchange', postSelection);
figma.on('currentpagechange', () => {
  post({ type: 'PAGE_CHANGED' });
  postSelection();
  void watchCurrentPage();
});
void watchCurrentPage();
