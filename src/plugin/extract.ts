// Reads the current page into a FlowGraph. This is the only place that knows
// how Figma stores a prototype; everything after it works on plain data.

import {
  DEFAULT_FIELD_CHARS,
  type BrokenReason,
  type FlowGraph,
  type InputField,
  type Link,
  type Rect,
  type Screen,
} from '../shared/graph';
import { parseReaction, type RawReaction } from '../shared/reactions';

/** Plugin data on a node: a number of characters, or `0` for "not an input". */
export const INPUT_KEY = 'flowcost:input';
/** Plugin data on a screen: `1` when the person marked it as an ending. */
export const ENDING_KEY = 'flowcost:ending';

type ScreenNode = FrameNode | ComponentNode | InstanceNode;

function isScreenNode(node: BaseNode): node is ScreenNode {
  return (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE'
  );
}

function isTopLevel(node: BaseNode): boolean {
  const parent = node.parent;
  return (
    parent !== null && (parent.type === 'PAGE' || parent.type === 'SECTION')
  );
}

/** The screen a node belongs to: its nearest top-level frame. */
export function screenOf(node: BaseNode): ScreenNode | null {
  let current: BaseNode | null = node;
  while (current) {
    if (isScreenNode(current) && isTopLevel(current)) return current;
    current = current.parent;
  }
  return null;
}

function pageOf(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === 'PAGE') return current;
    current = current.parent;
  }
  return null;
}

function collectScreens(parent: ChildrenMixin): ScreenNode[] {
  const found: ScreenNode[] = [];
  for (const child of parent.children) {
    if (child.type === 'SECTION') found.push(...collectScreens(child));
    else if (isScreenNode(child)) found.push(child);
  }
  return found;
}

function relativeBounds(node: SceneNode, screen: ScreenNode): Rect | null {
  const box = node.absoluteBoundingBox;
  const origin = screen.absoluteBoundingBox;
  if (!box || !origin) return null;
  return {
    x: box.x - origin.x,
    y: box.y - origin.y,
    width: box.width,
    height: box.height,
  };
}

function contentHeight(screen: ScreenNode): number {
  let bottom = screen.height;
  for (const child of screen.children) {
    if ('y' in child && 'height' in child) {
      bottom = Math.max(bottom, child.y + child.height);
    }
  }
  return bottom;
}

const INPUT_NAME =
  /(^|[\s/_.-])(input|text ?field|textfield|field|search|email|password|phone|textarea)([\s/_.-]|$)/i;
const NOT_INPUT_NAME = /button|btn|icon|label|chip|tab/i;

function looksLikeField(node: SceneNode): boolean {
  if (
    node.type !== 'FRAME' &&
    node.type !== 'INSTANCE' &&
    node.type !== 'COMPONENT'
  ) {
    return false;
  }
  if (!node.visible) return false;
  if (!INPUT_NAME.test(node.name) || NOT_INPUT_NAME.test(node.name))
    return false;
  return node.findOne((child) => child.type === 'TEXT') !== null;
}

function detectFields(screen: ScreenNode): InputField[] {
  const matched = new Map<string, { node: SceneNode; chars: number }>();
  screen.findAll((node) => {
    const mark = node.getPluginData(INPUT_KEY);
    if (mark === '0') return false;
    const marked = Number(mark);
    if (mark !== '' && Number.isFinite(marked) && marked > 0) {
      matched.set(node.id, { node, chars: marked });
    } else if (looksLikeField(node)) {
      matched.set(node.id, { node, chars: DEFAULT_FIELD_CHARS });
    }
    return false;
  });

  const fields: InputField[] = [];
  for (const { node, chars } of matched.values()) {
    // A field inside another field is the same field.
    let inside = false;
    for (let up = node.parent; up && up.id !== screen.id; up = up.parent) {
      if (matched.has(up.id)) {
        inside = true;
        break;
      }
    }
    if (inside) continue;
    const bounds = relativeBounds(node, screen);
    if (!bounds) continue;
    fields.push({ id: node.id, name: node.name, bounds, chars });
  }
  return fields.sort(
    (a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x,
  );
}

interface Resolved {
  readonly screenId: string | null;
  readonly broken: BrokenReason | null;
}

export async function readGraph(): Promise<FlowGraph> {
  const page = figma.currentPage;
  await page.loadAsync();

  const screenNodes = collectScreens(page);
  const screenIds = new Set(screenNodes.map((node) => node.id));
  const screens: Screen[] = [];
  const links: Link[] = [];
  const cache = new Map<string, Resolved>();

  const resolve = async (id: string): Promise<Resolved> => {
    const cached = cache.get(id);
    if (cached) return cached;
    let result: Resolved;
    if (screenIds.has(id)) {
      result = { screenId: id, broken: null };
    } else {
      const node = await figma.getNodeByIdAsync(id);
      if (!node) {
        result = { screenId: null, broken: 'missing' };
      } else {
        const top = screenOf(node);
        const owner = pageOf(node);
        if (top && screenIds.has(top.id)) {
          result = { screenId: top.id, broken: null };
        } else if (owner && owner.id !== page.id) {
          result = { screenId: null, broken: 'off-page' };
        } else {
          result = { screenId: null, broken: 'missing' };
        }
      }
    }
    cache.set(id, result);
    return result;
  };

  for (const node of screenNodes) {
    const scrolls =
      node.overflowDirection === 'VERTICAL' ||
      node.overflowDirection === 'BOTH';
    screens.push({
      id: node.id,
      name: node.name,
      width: node.width,
      height: node.height,
      contentHeight: contentHeight(node),
      scrolls,
      ending: node.getPluginData(ENDING_KEY) === '1',
      fields: detectFields(node),
    });

    const sources: SceneNode[] = [];
    if (node.reactions.length > 0) sources.push(node);
    sources.push(
      ...node.findAll(
        (child) => 'reactions' in child && child.reactions.length > 0,
      ),
    );

    for (const source of sources) {
      if (!('reactions' in source)) continue;
      const bounds =
        relativeBounds(source, node) ??
        ({ x: 0, y: 0, width: node.width, height: node.height } satisfies Rect);
      let counter = 0;
      for (const reaction of source.reactions) {
        // Figma's Reaction fits the structural type of the reader.
        const parsed = parseReaction(reaction as RawReaction);
        for (const action of parsed) {
          let targetId: string | null = null;
          let broken: BrokenReason | null = null;
          if (action.destinationId !== null) {
            const resolved = await resolve(action.destinationId);
            targetId = resolved.screenId;
            broken = resolved.broken;
          } else if (
            action.navigation === 'NAVIGATE' ||
            action.navigation === 'OVERLAY' ||
            action.navigation === 'SWAP'
          ) {
            broken = 'missing';
          }
          counter += 1;
          links.push({
            id: `${source.id}#${counter}`,
            screenId: node.id,
            sourceId: source.id,
            sourceName:
              source.id === node.id ? `${node.name} (screen)` : source.name,
            bounds,
            trigger: action.trigger,
            delaySeconds: action.delaySeconds,
            navigation: action.navigation,
            targetId,
            broken,
            conditional: action.conditional,
            transitionSeconds: action.transitionSeconds,
          });
        }
      }
    }
  }

  return {
    pageName: page.name,
    screens,
    links,
    starts: page.flowStartingPoints.map((start) => ({
      id: start.nodeId,
      name: start.name,
    })),
  };
}
