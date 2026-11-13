// The graph in tests/fixtures/figma-signup.json was read from a real Figma file
// with the page reader (src/plugin/extract.ts), so these tests run the engine on
// what Figma actually reports: reactions, overlays, a timer, scrolling, inputs.

import { analyze } from '../../src/shared/analysis';
import { defaultAssumptions } from '../../src/shared/cost';
import type { FlowGraph } from '../../src/shared/graph';
import { checkHealth } from '../../src/shared/health';
import raw from '../fixtures/figma-signup.json';

const graph = raw as FlowGraph;
const assumptions = defaultAssumptions('regular', 'mouse');

const ids = {
  splash: '1:2',
  welcome: '1:3',
  form: '1:4',
  menu: '1:5',
  help: '1:6',
  done: '1:7',
  feed: '1:8',
  island: '1:9',
};

describe('a real Figma prototype', () => {
  it('takes the timer as a step without an action', () => {
    const result = analyze(graph, ids.splash, ids.welcome, assumptions);
    const [step] = result.fastest?.steps ?? [];
    expect(step?.automatic).toBe(true);
    expect(result.fastest?.actions).toBe(0);
    expect(result.fastest?.seconds).toBeCloseTo(2);
  });

  it('finds the one-tap shortcut from Welcome to Done', () => {
    const result = analyze(graph, ids.welcome, ids.done, assumptions);
    expect(result.fastest?.steps.map((s) => s.label)).toEqual(['Skip']);
    expect(result.fewest?.actions).toBe(1);
    expect(result.alternatives).toHaveLength(2);
  });

  it('flags the small Skip target and counts the form fields on the long way', () => {
    // Skip is 24 px high: enough for a mouse, too small for a finger.
    const mouse = analyze(graph, ids.welcome, ids.done, assumptions);
    expect(mouse.fastest?.friction.map((f) => f.kind) ?? []).not.toContain(
      'small-target',
    );
    const touch = analyze(
      graph,
      ids.welcome,
      ids.done,
      defaultAssumptions('regular', 'touch'),
    );
    expect(touch.fastest?.friction.map((f) => f.kind) ?? []).toContain(
      'small-target',
    );
    const result = mouse;
    const long = result.alternatives.find((p) => p.steps.length === 2);
    expect(long?.typedChars).toBe(24);
  });

  it('reaches Help through an overlay and a swap', () => {
    const result = analyze(graph, ids.form, ids.help, assumptions);
    expect(result.fastest?.steps.map((s) => s.navigation)).toEqual([
      'OVERLAY',
      'SWAP',
    ]);
    expect(result.fastest?.friction.map((f) => f.kind)).toContain('overlay');
  });

  it('adds a scroll for the button below the fold on Feed', () => {
    const result = analyze(graph, ids.feed, ids.done, assumptions);
    const kinds = result.fastest?.friction.map((f) => f.kind) ?? [];
    expect(kinds).toContain('scroll');
    expect(
      result.fastest?.steps[0]?.operators.some((o) => o.kind === 'S'),
    ).toBe(true);
  });

  it('reports the screens no flow reaches', () => {
    const issues = checkHealth(graph);
    const unreachable = issues
      .filter((i) => i.kind === 'unreachable')
      .map((i) => i.nodeId)
      .sort();
    expect(unreachable).toEqual([ids.splash, ids.feed, ids.island].sort());
    expect(issues.some((i) => i.kind === 'broken-link')).toBe(false);
  });

  it('does not treat the closable overlay as a trap', () => {
    expect(checkHealth(graph).some((i) => i.kind === 'overlay-no-exit')).toBe(
      false,
    );
  });
});
