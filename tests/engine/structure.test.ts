import {
  analyze,
  flowStructure,
  returnActions,
} from '../../src/shared/analysis';
import {
  choiceSeconds,
  defaultAssumptions,
  restingPoint,
  stepCost,
} from '../../src/shared/cost';
import { indexGraph } from '../../src/shared/graph';
import { graph, link, screen } from './fixtures';

const assumptions = defaultAssumptions('regular', 'mouse');

describe("Hick's law", () => {
  it('costs nothing for a single option and grows with more', () => {
    expect(choiceSeconds(assumptions, 1)).toBe(0);
    expect(choiceSeconds(assumptions, 2)).toBeCloseTo(assumptions.hickB);
    expect(choiceSeconds(assumptions, 8)).toBeCloseTo(3 * assumptions.hickB);
  });

  it('adds a choice operator only when there is something to choose', () => {
    const a = screen('a');
    const go = link('go', 'a', 'b');
    const origin = restingPoint(a, 'mouse');
    const alone = stepCost(assumptions, a, go, origin, 1);
    const among = stepCost(assumptions, a, go, origin, 4);
    expect(alone.operators.some((o) => o.kind === 'C')).toBe(false);
    expect(among.operators.find((o) => o.kind === 'C')?.seconds).toBeCloseTo(
      2 * assumptions.hickB,
    );
    expect(among.seconds).toBeGreaterThan(alone.seconds);
  });

  it('can be switched off', () => {
    const a = screen('a');
    const off = { ...assumptions, useHick: false };
    const cost = stepCost(
      off,
      a,
      link('go', 'a', 'b'),
      restingPoint(a, 'mouse'),
      5,
    );
    expect(cost.operators.some((o) => o.kind === 'C')).toBe(false);
  });
});

describe('options on a screen', () => {
  it('counts layers, not links, and leaves timers out', () => {
    const index = indexGraph(
      graph(
        [screen('a'), screen('b')],
        [
          link('one', 'a', 'b', { sourceId: 'n1' }),
          link('also-one', 'a', 'b', { sourceId: 'n1', trigger: 'PRESS' }),
          link('two', 'a', 'b', { sourceId: 'n2' }),
          link('timer', 'a', 'b', { sourceId: 'n3', trigger: 'TIMEOUT' }),
        ],
      ),
    );
    expect(index.choices.get('a')).toBe(2);
    expect(index.choices.get('b')).toBeUndefined();
  });

  it('counts decision points along a path and flags a crowded screen', () => {
    const links = [];
    const screens = [screen('menu'), screen('goal')];
    for (let i = 0; i < 7; i += 1) {
      screens.push(screen(`s${i}`));
      links.push(link(`m-${i}`, 'menu', `s${i}`, { sourceId: `n${i}` }));
    }
    links.push(link('go', 'menu', 'goal', { sourceId: 'n-goal' }));
    const result = analyze(graph(screens, links), 'menu', 'goal', assumptions);
    expect(result.fastest?.decisionPoints).toBe(1);
    expect(
      result.fastest?.friction.some((f) => f.kind === 'many-choices'),
    ).toBe(true);
  });

  it('does not count a screen with one option as a decision', () => {
    const g = graph([screen('a'), screen('b')], [link('ab', 'a', 'b')]);
    expect(analyze(g, 'a', 'b', assumptions).fastest?.decisionPoints).toBe(0);
  });
});

describe('returnActions', () => {
  it('is one when the screen can go back or close', () => {
    const index = indexGraph(
      graph(
        [screen('a'), screen('b')],
        [link('ab', 'a', 'b'), link('back', 'b', null, { navigation: 'BACK' })],
      ),
    );
    expect(returnActions(index, 'b', 'a')).toBe(1);
  });

  it('follows links when there is no back action', () => {
    const index = indexGraph(
      graph(
        [screen('a'), screen('b'), screen('c')],
        [link('ab', 'a', 'b'), link('bc', 'b', 'c'), link('ca', 'c', 'a')],
      ),
    );
    expect(returnActions(index, 'b', 'a')).toBe(2);
  });

  it('is null when there is no way back', () => {
    const index = indexGraph(
      graph([screen('a'), screen('b')], [link('ab', 'a', 'b')]),
    );
    expect(returnActions(index, 'b', 'a')).toBeNull();
  });

  it('counts steps with no way back on a path', () => {
    const g = graph(
      [screen('a'), screen('b'), screen('c')],
      [
        link('ab', 'a', 'b'),
        link('back', 'b', null, { navigation: 'BACK', sourceId: 'back' }),
        link('bc', 'b', 'c'),
      ],
    );
    const path = analyze(g, 'a', 'c', assumptions).fastest;
    // Leaving a for b can be undone with Back; leaving b for c cannot.
    expect(path?.noReturn).toBe(1);
    expect(path?.longestReturn).toBe(1);
  });
});

describe('flowStructure', () => {
  it('is a single route for a straight line', () => {
    const g = graph(
      [screen('a'), screen('b'), screen('c')],
      [link('ab', 'a', 'b'), link('bc', 'b', 'c')],
    );
    expect(flowStructure(indexGraph(g), 'a', 'c')).toEqual({
      screens: 3,
      links: 2,
      decisionScreens: 0,
      cyclomatic: 1,
    });
  });

  it('counts a fork that rejoins as two routes', () => {
    const g = graph(
      [screen('a'), screen('b'), screen('c'), screen('d')],
      [
        link('ab', 'a', 'b'),
        link('ac', 'a', 'c'),
        link('bd', 'b', 'd'),
        link('cd', 'c', 'd'),
      ],
    );
    expect(flowStructure(indexGraph(g), 'a', 'd')).toEqual({
      screens: 4,
      links: 4,
      decisionScreens: 1,
      cyclomatic: 2,
    });
  });

  it('leaves out screens that do not lead to the goal', () => {
    const g = graph(
      [screen('a'), screen('b'), screen('side')],
      [link('ab', 'a', 'b'), link('as', 'a', 'side')],
    );
    expect(flowStructure(indexGraph(g), 'a', 'b')?.screens).toBe(2);
  });

  it('is null when the goal cannot be reached', () => {
    const g = graph([screen('a'), screen('b')], []);
    expect(flowStructure(indexGraph(g), 'a', 'b')).toBeNull();
  });

  it('is part of the analysis', () => {
    const g = graph([screen('a'), screen('b')], [link('ab', 'a', 'b')]);
    expect(analyze(g, 'a', 'b', assumptions).flow?.cyclomatic).toBe(1);
  });
});
