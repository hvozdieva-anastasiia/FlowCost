// Structural checks of the prototype graph. They report facts about links and
// screens, not about the design. An ending the person marked is never reported
// as a dead end.

import { indexGraph, movesToScreen, type FlowGraph } from './graph';

export type HealthKind =
  'no-start' | 'broken-link' | 'unreachable' | 'dead-end' | 'overlay-no-exit';

export type Severity = 'error' | 'warning' | 'info';

export interface HealthIssue {
  readonly kind: HealthKind;
  readonly severity: Severity;
  /** What was found, in a few words. */
  readonly title: string;
  /** Why it matters and what to do about it. */
  readonly hint: string;
  /** The node to reveal on the canvas. */
  readonly nodeId: string | null;
  /** The screen can be marked as an intended end of a flow. */
  readonly canMarkEnding: boolean;
}

export function checkHealth(graph: FlowGraph): HealthIssue[] {
  const index = indexGraph(graph);
  const issues: HealthIssue[] = [];

  if (graph.starts.length === 0) {
    issues.push({
      kind: 'no-start',
      severity: 'info',
      title: 'No flow start on this page',
      hint: 'A flow start tells Figma where people enter the prototype. Add one in the Prototype tab, or choose the From screen yourself.',
      nodeId: null,
      canMarkEnding: false,
    });
  }

  for (const link of graph.links) {
    const missing = link.targetId !== null && !index.screens.has(link.targetId);
    if (link.broken !== null || missing) {
      const reason =
        link.broken === 'off-page'
          ? 'It points to a screen on another page.'
          : 'The screen it pointed to no longer exists.';
      issues.push({
        kind: 'broken-link',
        severity: 'error',
        title: `"${link.sourceName}" leads nowhere`,
        hint: `${reason} It sits on "${screenName(index.screens, link.screenId)}". Reconnect it in the Prototype tab.`,
        nodeId: link.sourceId,
        canMarkEnding: false,
      });
    }
  }

  const reachable = new Set<string>();
  const queue = graph.starts
    .map((start) => start.id)
    .filter((id) => index.screens.has(id));
  for (const id of queue) reachable.add(id);
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    if (id === undefined) continue;
    for (const link of index.linksByScreen.get(id) ?? []) {
      if (!movesToScreen(link) || link.targetId === null) continue;
      if (!index.screens.has(link.targetId) || reachable.has(link.targetId)) {
        continue;
      }
      reachable.add(link.targetId);
      queue.push(link.targetId);
    }
  }

  if (graph.starts.length > 0) {
    for (const screen of graph.screens) {
      if (!reachable.has(screen.id) && hasPrototypeRole(graph, screen.id)) {
        issues.push({
          kind: 'unreachable',
          severity: 'warning',
          title: `"${screen.name}" can't be reached`,
          hint: 'Nothing leads here from the flow start. Fine for a spare screen.',
          nodeId: screen.id,
          canMarkEnding: false,
        });
      }
    }
  }

  for (const screen of graph.screens) {
    if (screen.ending) continue;
    const links = index.linksByScreen.get(screen.id) ?? [];
    const leaves = links.some(
      (link) =>
        movesToScreen(link) ||
        link.navigation === 'BACK' ||
        link.navigation === 'CLOSE' ||
        link.navigation === 'EXTERNAL',
    );
    if (leaves) continue;
    if (index.overlays.has(screen.id)) {
      issues.push({
        kind: 'overlay-no-exit',
        severity: 'warning',
        title: `Overlay "${screen.name}" can't be closed`,
        hint: 'Nothing on it closes it or moves on, so people would be stuck. Add a close action.',
        nodeId: screen.id,
        canMarkEnding: false,
      });
    } else if (graph.starts.length === 0 || reachable.has(screen.id)) {
      issues.push({
        kind: 'dead-end',
        severity: 'info',
        title: `"${screen.name}" has no way out`,
        hint: 'Anyone who arrives here is stuck. If this is where the flow is meant to end, mark it as an end.',
        nodeId: screen.id,
        canMarkEnding: true,
      });
    }
  }

  return issues;
}

function screenName(
  screens: ReadonlyMap<string, { readonly name: string }>,
  id: string,
): string {
  return screens.get(id)?.name ?? id;
}

/** A screen takes part in the prototype if any link leaves or enters it. */
function hasPrototypeRole(graph: FlowGraph, screenId: string): boolean {
  return graph.links.some(
    (link) => link.screenId === screenId || link.targetId === screenId,
  );
}
