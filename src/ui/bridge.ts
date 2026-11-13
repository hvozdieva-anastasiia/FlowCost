// The window's only line to Plugin Main.

import {
  isRecord,
  type PluginMessage,
  type UiMessage,
} from '../shared/messages';

export interface Bridge {
  post(message: UiMessage): void;
  /** Returns the function that stops listening. */
  subscribe(listener: (message: PluginMessage) => void): () => void;
}

const PLUGIN_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  'STATE',
  'SCAN_RESULT',
  'SELECTION',
  'SNAPSHOTS',
  'PAGE_CHANGED',
  'NOTICE',
]);

/** Plugin Main is our own code, so only the message tag is checked here. */
export function parsePluginMessage(raw: unknown): PluginMessage | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;
  return PLUGIN_MESSAGE_TYPES.has(raw.type) ? (raw as PluginMessage) : null;
}

export function figmaBridge(): Bridge {
  return {
    post(message) {
      parent.postMessage({ pluginMessage: message }, '*');
    },
    subscribe(listener) {
      const handler = (event: MessageEvent) => {
        const data: unknown = event.data;
        if (!isRecord(data) || !('pluginMessage' in data)) return;
        const message = parsePluginMessage(data.pluginMessage);
        if (message) listener(message);
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    },
  };
}
