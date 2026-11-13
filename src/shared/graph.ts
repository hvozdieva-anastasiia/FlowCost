// The prototype as plain data. Plugin Main builds it from Figma nodes; the
// window and the tests work on it without Figma.

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type TriggerKind =
  'CLICK' | 'PRESS' | 'HOVER' | 'DRAG' | 'KEY' | 'TIMEOUT' | 'OTHER';

export type NavigationKind =
  | 'NAVIGATE'
  | 'OVERLAY'
  | 'SWAP'
  | 'CHANGE_TO'
  | 'SCROLL_TO'
  | 'BACK'
  | 'CLOSE'
  | 'EXTERNAL';

export type BrokenReason = 'missing' | 'off-page';

/** Characters assumed for a field the person has not set. */
export const DEFAULT_FIELD_CHARS = 12;

export interface InputField {
  readonly id: string;
  readonly name: string;
  /** Relative to the screen. */
  readonly bounds: Rect;
  /** How many characters the person is assumed to type. */
  readonly chars: number;
}

export interface Screen {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Bottom edge of the content; larger than `height` when the screen scrolls. */
  readonly contentHeight: number;
  readonly scrolls: boolean;
  /** Marked by the person as an intended end of a flow. */
  readonly ending: boolean;
  readonly fields: readonly InputField[];
}

export interface Link {
  readonly id: string;
  readonly screenId: string;
  readonly sourceId: string;
  readonly sourceName: string;
  /** Relative to the screen it lives on. */
  readonly bounds: Rect;
  readonly trigger: TriggerKind;
  /** Wait before the action, in seconds; only for `TIMEOUT`. */
  readonly delaySeconds: number;
  readonly navigation: NavigationKind;
  readonly targetId: string | null;
  readonly broken: BrokenReason | null;
  /** The action sits inside a conditional branch. */
  readonly conditional: boolean;
  /** Length of the transition animation, in seconds. */
  readonly transitionSeconds: number;
}

export interface FlowStart {
  readonly id: string;
  readonly name: string;
}

export interface FlowGraph {
  readonly pageName: string;
  readonly screens: readonly Screen[];
  readonly links: readonly Link[];
  readonly starts: readonly FlowStart[];
}

export function center(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Looks screens up by id once, for the many lookups a search makes. */
export interface GraphIndex {
  readonly graph: FlowGraph;
  readonly screens: ReadonlyMap<string, Screen>;
  readonly linksByScreen: ReadonlyMap<string, readonly Link[]>;
  /** Screens that some link opens as an overlay. */
  readonly overlays: ReadonlySet<string>;
}

export function indexGraph(graph: FlowGraph): GraphIndex {
  const screens = new Map<string, Screen>();
  for (const screen of graph.screens) screens.set(screen.id, screen);
  const linksByScreen = new Map<string, Link[]>();
  const overlays = new Set<string>();
  for (const link of graph.links) {
    const list = linksByScreen.get(link.screenId);
    if (list) list.push(link);
    else linksByScreen.set(link.screenId, [link]);
    if (link.navigation === 'OVERLAY' && link.targetId !== null) {
      overlays.add(link.targetId);
    }
  }
  return { graph, screens, linksByScreen, overlays };
}

/** A link that moves the person to another screen state. */
export function movesToScreen(link: Link): boolean {
  if (link.targetId === null || link.broken !== null) return false;
  return (
    link.navigation === 'NAVIGATE' ||
    link.navigation === 'OVERLAY' ||
    link.navigation === 'SWAP'
  );
}
