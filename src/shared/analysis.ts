// Finds paths through the prototype and prices them with the cost model.

import {
  indexOfDifficulty,
  restingPoint,
  scrollsNeeded,
  stepCost,
  type Assumptions,
  type Operator,
  type Point,
} from './cost';
import {
  center,
  indexGraph,
  movesToScreen,
  type FlowGraph,
  type GraphIndex,
  type Link,
  type NavigationKind,
  type Screen,
  type TriggerKind,
} from './graph';

export type FrictionKind =
  | 'small-target'
  | 'far-target'
  | 'overlay'
  | 'scroll'
  | 'form'
  | 'wait'
  | 'many-choices';

export interface FrictionPoint {
  readonly kind: FrictionKind;
  /** 1-based number of the step it belongs to. */
  readonly step: number;
  readonly screenId: string;
  readonly nodeId: string;
  readonly message: string;
}

export interface StepResult {
  /** 1-based. */
  readonly index: number;
  readonly screenId: string;
  readonly screenName: string;
  readonly linkId: string;
  readonly nodeId: string;
  readonly label: string;
  readonly toScreenId: string;
  readonly toScreenName: string;
  readonly navigation: NavigationKind;
  readonly trigger: TriggerKind;
  readonly conditional: boolean;
  readonly automatic: boolean;
  readonly operators: readonly Operator[];
  readonly seconds: number;
  readonly taps: number;
  readonly typedChars: number;
}

export interface PathResult {
  readonly steps: readonly StepResult[];
  readonly seconds: number;
  /** Steps that need an action from the person. */
  readonly actions: number;
  /** Distinct screens the path touches, start and goal included. */
  readonly screens: number;
  readonly taps: number;
  readonly typedChars: number;
  readonly friction: readonly FrictionPoint[];
  /** The path crosses a conditional branch that is not simulated. */
  readonly assumed: boolean;
  /** Actions taken on a screen that offers more than one option. */
  readonly decisionPoints: number;
  /** Steps after which there is no way back to the screen the step left. */
  readonly noReturn: number;
  /** The most actions any step on the path needs to get back; 0 if none. */
  readonly longestReturn: number;
}

/** The part of the prototype that lies between the start and the goal. */
export interface FlowStructure {
  /** Screens on some path from the start to the goal. */
  readonly screens: number;
  /** Links between those screens. */
  readonly links: number;
  /** Screens among them where the person can go more than one way. */
  readonly decisionScreens: number;
  /** Independent routes: links - screens + 2 (1 for a straight line). */
  readonly cyclomatic: number;
}

export interface Analysis {
  readonly startId: string;
  readonly goalId: string;
  readonly fastest: PathResult | null;
  readonly fewest: PathResult | null;
  /** Other simple paths, cheapest first; includes the fastest. */
  readonly alternatives: readonly PathResult[];
  /** The alternative search stopped at its limit. */
  readonly truncated: boolean;
  /** Null when the goal cannot be reached from the start. */
  readonly flow: FlowStructure | null;
}

export interface AnalysisLimits {
  readonly maxDepth: number;
  readonly maxPaths: number;
  readonly maxVisits: number;
  readonly maxStack: number;
}

export const DEFAULT_LIMITS: AnalysisLimits = {
  maxDepth: 12,
  maxPaths: 50,
  maxVisits: 20_000,
  maxStack: 4,
};

interface SearchState {
  readonly stack: readonly string[];
  readonly pointer: Point;
  readonly lastLinkId: string | null;
}

/** The screen stack after taking `link`, or null when the link does not move. */
export function applyLink(
  stack: readonly string[],
  link: Link,
): readonly string[] | null {
  if (link.targetId === null) return null;
  switch (link.navigation) {
    case 'NAVIGATE':
      return [link.targetId];
    case 'OVERLAY':
      return [...stack, link.targetId];
    case 'SWAP':
      return [...stack.slice(0, -1), link.targetId];
    default:
      return null;
  }
}

function stackKey(stack: readonly string[]): string {
  return stack.join('>');
}

function isMoving(link: Link): boolean {
  if (!movesToScreen(link)) return false;
  // Hovering only reveals something and reverts; it does not take a step.
  return link.trigger !== 'HOVER';
}

function frictionFor(
  assumptions: Assumptions,
  screen: Screen,
  link: Link,
  step: number,
  linkFrom: Point,
  automatic: boolean,
  choices: number,
): FrictionPoint[] {
  const found: FrictionPoint[] = [];
  const add = (kind: FrictionKind, message: string) =>
    found.push({
      kind,
      step,
      screenId: screen.id,
      nodeId: link.sourceId,
      message,
    });

  if (!automatic) {
    const side = Math.min(link.bounds.width, link.bounds.height);
    if (side < assumptions.minTarget) {
      add(
        'small-target',
        `"${link.sourceName}" is ${Math.round(side)} px, below ${assumptions.minTarget} px`,
      );
    }
    const to = center(link.bounds);
    const distance = Math.hypot(to.x - linkFrom.x, to.y - linkFrom.y);
    const id = indexOfDifficulty(distance, link.bounds);
    if (id > assumptions.farIndex) {
      add(
        'far-target',
        `"${link.sourceName}" is far from the previous point (${id.toFixed(1)} bits)`,
      );
    }
    if (scrollsNeeded(screen, link.bounds) > 0) {
      add('scroll', `"${link.sourceName}" is below the fold`);
    }
    if (choices >= assumptions.manyChoices) {
      add('many-choices', `"${screen.name}" offers ${choices} options at once`);
    }
  }
  if (link.navigation === 'OVERLAY') {
    add('overlay', `"${link.sourceName}" opens an overlay`);
  }
  if (screen.fields.length >= 4) {
    add('form', `"${screen.name}" has ${screen.fields.length} fields to fill`);
  }
  const wait = link.delaySeconds + link.transitionSeconds;
  if (wait >= 1) {
    add('wait', `Waiting ${wait.toFixed(1)} s on "${link.sourceName}"`);
  }
  return found;
}

interface Hop {
  readonly link: Link;
  readonly screen: Screen;
  readonly target: Screen;
}

/**
 * How many actions it takes to get back to `to` after arriving at `from`:
 * one when the screen has a back or close action, otherwise the shortest run
 * of links. Null when there is no way back.
 */
export function returnActions(
  index: GraphIndex,
  from: string,
  to: string,
): number | null {
  const links = index.linksByScreen.get(from) ?? [];
  if (links.some((l) => l.navigation === 'BACK' || l.navigation === 'CLOSE')) {
    return 1;
  }
  const seen = new Set<string>([from]);
  let frontier = [from];
  for (let distance = 1; frontier.length > 0; distance += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const link of index.linksByScreen.get(id) ?? []) {
        if (!isMoving(link) || link.targetId === null) continue;
        if (link.targetId === to) return distance;
        if (seen.has(link.targetId) || !index.screens.has(link.targetId)) {
          continue;
        }
        seen.add(link.targetId);
        next.push(link.targetId);
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * The screens that lie on some path from `startId` to `goalId`, the links
 * between them and how many independent routes they make.
 */
export function flowStructure(
  index: GraphIndex,
  startId: string,
  goalId: string,
): FlowStructure | null {
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const link of index.graph.links) {
    if (!isMoving(link) || link.targetId === null) continue;
    if (!index.screens.has(link.targetId)) continue;
    const out = forward.get(link.screenId);
    if (out) out.push(link.targetId);
    else forward.set(link.screenId, [link.targetId]);
    const into = backward.get(link.targetId);
    if (into) into.push(link.screenId);
    else backward.set(link.targetId, [link.screenId]);
  }
  const reach = (from: string, edges: Map<string, string[]>): Set<string> => {
    const seen = new Set<string>([from]);
    const queue = [from];
    for (let i = 0; i < queue.length; i += 1) {
      const id = queue[i];
      if (id === undefined) continue;
      for (const next of edges.get(id) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  };
  const fromStart = reach(startId, forward);
  if (!fromStart.has(goalId)) return null;
  const toGoal = reach(goalId, backward);
  const inside = new Set([...fromStart].filter((id) => toGoal.has(id)));

  let links = 0;
  let decisionScreens = 0;
  for (const id of inside) {
    let out = 0;
    for (const next of forward.get(id) ?? []) {
      if (inside.has(next)) out += 1;
    }
    links += out;
    if (out > 1) decisionScreens += 1;
  }
  return {
    screens: inside.size,
    links,
    decisionScreens,
    cyclomatic: links - inside.size + 2,
  };
}

/** Prices a sequence of links starting at `startScreen`. */
export function priceHops(
  index: GraphIndex,
  assumptions: Assumptions,
  startScreen: Screen,
  hops: readonly Hop[],
): PathResult {
  let pointer = restingPoint(startScreen, assumptions.device);
  const steps: StepResult[] = [];
  const friction: FrictionPoint[] = [];
  const touched = new Set<string>([startScreen.id]);
  let seconds = 0;
  let actions = 0;
  let taps = 0;
  let typedChars = 0;
  let assumed = false;
  let decisionPoints = 0;
  let noReturn = 0;
  let longestReturn = 0;

  hops.forEach((hop, i) => {
    const choices = index.choices.get(hop.screen.id) ?? 1;
    const cost = stepCost(assumptions, hop.screen, hop.link, pointer, choices);
    pointer = cost.pointer;
    const number = i + 1;
    steps.push({
      index: number,
      screenId: hop.screen.id,
      screenName: hop.screen.name,
      linkId: hop.link.id,
      nodeId: hop.link.sourceId,
      label: hop.link.sourceName,
      toScreenId: hop.target.id,
      toScreenName: hop.target.name,
      navigation: hop.link.navigation,
      trigger: hop.link.trigger,
      conditional: hop.link.conditional,
      automatic: cost.automatic,
      operators: cost.operators,
      seconds: cost.seconds,
      taps: cost.taps,
      typedChars: cost.typedChars,
    });
    friction.push(
      ...frictionFor(
        assumptions,
        hop.screen,
        hop.link,
        number,
        cost.linkFrom,
        cost.automatic,
        choices,
      ),
    );
    seconds += cost.seconds;
    taps += cost.taps;
    typedChars += cost.typedChars;
    if (!cost.automatic) {
      actions += 1;
      if (choices > 1) decisionPoints += 1;
      const back = returnActions(index, hop.target.id, hop.screen.id);
      if (back === null) noReturn += 1;
      else longestReturn = Math.max(longestReturn, back);
    }
    if (hop.link.conditional) assumed = true;
    touched.add(hop.screen.id);
    touched.add(hop.target.id);
  });

  return {
    steps,
    seconds,
    actions,
    screens: touched.size,
    taps,
    typedChars,
    friction,
    assumed,
    decisionPoints,
    noReturn,
    longestReturn,
  };
}

// A small binary heap keyed by a number, for the shortest-path search.
class Heap<T> {
  private readonly items: { key: number; value: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(key: number, value: T): void {
    const items = this.items;
    items.push({ key, value });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const a = items[i];
      const b = items[parent];
      if (!a || !b || b.key <= a.key) break;
      items[i] = b;
      items[parent] = a;
      i = parent;
    }
  }

  pop(): { key: number; value: T } | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (!top) return undefined;
    if (items.length > 0 && last) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        const at = (n: number) => items[n]?.key ?? Infinity;
        if (l < items.length && at(l) < at(smallest)) smallest = l;
        if (r < items.length && at(r) < at(smallest)) smallest = r;
        if (smallest === i) break;
        const a = items[i];
        const b = items[smallest];
        if (!a || !b) break;
        items[i] = b;
        items[smallest] = a;
        i = smallest;
      }
    }
    return top;
  }
}

interface Visit {
  readonly state: SearchState;
  readonly hop: Hop | null;
  readonly previous: Visit | null;
}

/**
 * Dijkstra over (screen stack, last link). `weight` turns a priced step into
 * the number being minimized. Returns the hops of the best path, or null.
 */
function shortestHops(
  index: GraphIndex,
  assumptions: Assumptions,
  startId: string,
  goalId: string,
  weight: (seconds: number, automatic: boolean) => number,
  limits: AnalysisLimits,
): readonly Hop[] | null {
  const startScreen = index.screens.get(startId);
  if (!startScreen) return null;
  const heap = new Heap<{ visit: Visit; cost: number }>();
  const best = new Map<string, number>();
  const first: Visit = {
    state: {
      stack: [startId],
      pointer: restingPoint(startScreen, assumptions.device),
      lastLinkId: null,
    },
    hop: null,
    previous: null,
  };
  heap.push(0, { visit: first, cost: 0 });
  best.set(`${stackKey(first.state.stack)}#`, 0);

  let visits = 0;
  while (heap.size > 0 && visits < limits.maxVisits) {
    const popped = heap.pop();
    if (!popped) break;
    const { visit, cost } = popped.value;
    const { state } = visit;
    const top = state.stack[state.stack.length - 1];
    if (top === undefined) continue;
    const known = best.get(
      `${stackKey(state.stack)}#${state.lastLinkId ?? ''}`,
    );
    if (known !== undefined && cost > known) continue;
    visits += 1;

    if (top === goalId) {
      const hops: Hop[] = [];
      for (let v: Visit | null = visit; v && v.hop; v = v.previous) {
        hops.unshift(v.hop);
      }
      return hops;
    }

    const screen = index.screens.get(top);
    if (!screen) continue;
    for (const link of index.linksByScreen.get(top) ?? []) {
      if (!isMoving(link)) continue;
      const nextStack = applyLink(state.stack, link);
      if (!nextStack || nextStack.length > limits.maxStack) continue;
      const nextTop = nextStack[nextStack.length - 1];
      const target =
        nextTop === undefined ? undefined : index.screens.get(nextTop);
      if (!target) continue;
      const priced = stepCost(
        assumptions,
        screen,
        link,
        state.pointer,
        index.choices.get(screen.id) ?? 1,
      );
      const nextCost = cost + weight(priced.seconds, priced.automatic);
      const key = `${stackKey(nextStack)}#${link.id}`;
      const seen = best.get(key);
      if (seen !== undefined && seen <= nextCost) continue;
      best.set(key, nextCost);
      heap.push(nextCost, {
        visit: {
          state: {
            stack: nextStack,
            pointer: priced.pointer,
            lastLinkId: link.id,
          },
          hop: { link, screen, target },
          previous: visit,
        },
        cost: nextCost,
      });
    }
  }
  return null;
}

function enumerateHops(
  index: GraphIndex,
  assumptions: Assumptions,
  startId: string,
  goalId: string,
  limits: AnalysisLimits,
): { paths: Hop[][]; truncated: boolean } {
  const startScreen = index.screens.get(startId);
  const paths: Hop[][] = [];
  let visits = 0;
  let truncated = false;
  if (!startScreen) return { paths, truncated };

  const walk = (
    stack: readonly string[],
    pointer: Point,
    hops: Hop[],
    seen: Set<string>,
  ): void => {
    if (paths.length >= limits.maxPaths || visits >= limits.maxVisits) {
      truncated = true;
      return;
    }
    visits += 1;
    const top = stack[stack.length - 1];
    if (top === undefined) return;
    if (top === goalId) {
      paths.push([...hops]);
      return;
    }
    if (hops.length >= limits.maxDepth) return;
    const screen = index.screens.get(top);
    if (!screen) return;
    for (const link of index.linksByScreen.get(top) ?? []) {
      if (!isMoving(link)) continue;
      const nextStack = applyLink(stack, link);
      if (!nextStack || nextStack.length > limits.maxStack) continue;
      const key = stackKey(nextStack);
      if (seen.has(key)) continue;
      const nextTop = nextStack[nextStack.length - 1];
      const target =
        nextTop === undefined ? undefined : index.screens.get(nextTop);
      if (!target) continue;
      const priced = stepCost(
        assumptions,
        screen,
        link,
        pointer,
        index.choices.get(screen.id) ?? 1,
      );
      seen.add(key);
      hops.push({ link, screen, target });
      walk(nextStack, priced.pointer, hops, seen);
      hops.pop();
      seen.delete(key);
    }
  };

  walk(
    [startId],
    restingPoint(startScreen, assumptions.device),
    [],
    new Set([startId]),
  );
  return { paths, truncated };
}

export function analyze(
  graph: FlowGraph,
  startId: string,
  goalId: string,
  assumptions: Assumptions,
  limits: AnalysisLimits = DEFAULT_LIMITS,
): Analysis {
  const index = indexGraph(graph);
  const startScreen = index.screens.get(startId);
  const empty: Analysis = {
    startId,
    goalId,
    fastest: null,
    fewest: null,
    alternatives: [],
    truncated: false,
    flow: null,
  };
  if (!startScreen || !index.screens.has(goalId)) return empty;

  const price = (hops: readonly Hop[] | null): PathResult | null =>
    hops ? priceHops(index, assumptions, startScreen, hops) : null;

  const fastest = price(
    shortestHops(index, assumptions, startId, goalId, (s) => s, limits),
  );
  const fewest = price(
    shortestHops(
      index,
      assumptions,
      startId,
      goalId,
      (s, automatic) => (automatic ? 0 : 1000) + s,
      limits,
    ),
  );
  const { paths, truncated } = enumerateHops(
    index,
    assumptions,
    startId,
    goalId,
    limits,
  );
  const alternatives = paths
    .map((hops) => priceHops(index, assumptions, startScreen, hops))
    .sort((a, b) => a.seconds - b.seconds);

  return {
    startId,
    goalId,
    fastest,
    fewest,
    alternatives,
    truncated,
    flow: flowStructure(index, startId, goalId),
  };
}
