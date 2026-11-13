import type {
  FlowGraph,
  InputField,
  Link,
  Rect,
  Screen,
} from '../../src/shared/graph';

export function rect(x = 100, y = 100, width = 100, height = 48): Rect {
  return { x, y, width, height };
}

export function screen(id: string, extra: Partial<Screen> = {}): Screen {
  return {
    id,
    name: id.toUpperCase(),
    width: 400,
    height: 800,
    contentHeight: 800,
    scrolls: false,
    ending: false,
    fields: [],
    ...extra,
  };
}

export function field(
  id: string,
  chars = 10,
  bounds = rect(40, 200, 320, 48),
): InputField {
  return { id, name: id, bounds, chars };
}

export function link(
  id: string,
  from: string,
  to: string | null,
  extra: Partial<Link> = {},
): Link {
  return {
    id,
    screenId: from,
    sourceId: `node-${id}`,
    sourceName: id,
    bounds: rect(),
    trigger: 'CLICK',
    delaySeconds: 0,
    navigation: 'NAVIGATE',
    targetId: to,
    broken: null,
    conditional: false,
    transitionSeconds: 0,
    ...extra,
  };
}

export function graph(
  screens: Screen[],
  links: Link[],
  starts: string[] = [],
): FlowGraph {
  return {
    pageName: 'Page',
    screens,
    links,
    starts: starts.map((id) => ({ id, name: `Flow ${id}` })),
  };
}
