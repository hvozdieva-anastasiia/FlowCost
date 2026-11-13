// Structural checks of the prototype graph. They report facts about links and
// screens; an ending the person marked is never reported as a dead end.

import { indexGraph, movesToScreen, type FlowGraph } from './graph';

export type HealthKind =
  'no-start' | 'broken-link' | 'unreachable' | 'dead-end' | 'overlay-no-exit';

export type Severity = 'error' | 'warning' | 'info';

export interface HealthIssue {
  readonly kind: HealthKind;
  readonly severity: Severity;
  readonly message: string;
  /** The node to reveal on the canvas. */
  readonly nodeId: string | null;
}

export function checkHealth(graph: FlowGraph): HealthIssue[] {
  const index = indexGraph(graph);
  const issues: HealthIssue[] = [];

  if (graph.starts.length === 0) {
    issues.push({
      kind: 'no-start',
      severity: 'info',
      message:
        'This page has no flow starting point. Pick the start screen by hand.',
      nodeId: null,
    });
  }

  for (const link of graph.links) {
    const missing = link.targetId !== null && !index.screens.has(link.targetId);
    if (link.broken !== null || missing) {
      const reason =
        link.broken === 'off-page'
          ? 'points to another page'
          : 'points to a screen that no longer exists';
      issues.push({
        kind: 'broken-link',
        severity: 'error',
        message: `"${link.sourceName}" on "${screenName(index.screens, link.screenId)}" ${reason}`,
        nodeId: link.sourceId,
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
          message: `"${screen.name}" cannot be reached from any flow start`,
          nodeId: screen.id,
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
        message: `Overlay "${screen.name}" has no way to close or continue`,
        nodeId: screen.id,
      });
    } else if (graph.starts.length === 0 || reachable.has(screen.id)) {
      issues.push({
        kind: 'dead-end',
        severity: 'info',
        message: `"${screen.name}" has no way out. Mark it as an ending if that is intended.`,
        nodeId: screen.id,
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
