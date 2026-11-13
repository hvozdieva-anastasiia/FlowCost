import { analyze, applyLink } from '../../src/shared/analysis';
import { defaultAssumptions } from '../../src/shared/cost';
import { field, graph, link, rect, screen } from './fixtures';

const assumptions = defaultAssumptions('regular', 'mouse');

describe('applyLink', () => {
  it('replaces the stack when navigating', () => {
    expect(applyLink(['a', 'o'], link('l', 'o', 'b'))).toEqual(['b']);
  });

  it('pushes an overlay', () => {
    expect(
      applyLink(['a'], link('l', 'a', 'o', { navigation: 'OVERLAY' })),
    ).toEqual(['a', 'o']);
  });

  it('swaps the top layer', () => {
    expect(
      applyLink(['a', 'o'], link('l', 'o', 'p', { navigation: 'SWAP' })),
    ).toEqual(['a', 'p']);
  });

  it('does not move for states that keep the screen', () => {
    expect(
      applyLink(['a'], link('l', 'a', 'a', { navigation: 'CHANGE_TO' })),
    ).toBeNull();
  });
});

describe('analyze', () => {
  it('follows a linear flow', () => {
    const g = graph(
      [screen('a'), screen('b'), screen('c')],
      [link('ab', 'a', 'b'), link('bc', 'b', 'c')],
    );
    const result = analyze(g, 'a', 'c', assumptions);
    expect(result.fastest?.actions).toBe(2);
    expect(result.fastest?.screens).toBe(3);
    expect(result.fastest?.steps.map((s) => s.toScreenId)).toEqual(['b', 'c']);
    expect(result.alternatives).toHaveLength(1);
  });

  it('prefers the shorter of two routes, and reports both', () => {
    const g = graph(
      [screen('a'), screen('b'), screen('c'), screen('d')],
      [
        link('ab', 'a', 'b'),
        link('bc', 'b', 'c'),
        link('cd', 'c', 'd'),
        link('ad', 'a', 'd', { bounds: rect(100, 300) }),
      ],
    );
    const result = analyze(g, 'a', 'd', assumptions);
    expect(result.fewest?.actions).toBe(1);
    expect(result.fastest?.actions).toBe(1);
    expect(result.alternatives).toHaveLength(2);
    expect(result.alternatives[0]?.seconds).toBeLessThan(
      result.alternatives[1]?.seconds ?? 0,
    );
  });

  it('can have a fastest path that is not the one with fewest steps', () => {
    // One step through a long form against two quick steps.
    const form = screen('a', {
      fields: [field('f1', 40), field('f2', 40), field('f3', 40)],
    });
    const g = graph(
      [form, screen('b'), screen('c')],
      [link('direct', 'a', 'c'), link('ab', 'a', 'b'), link('bc', 'b', 'c')],
    );
    const result = analyze(g, 'a', 'c', assumptions);
    expect(result.fewest?.actions).toBe(1);
    expect(result.fastest?.actions).toBe(1);
  });

  it('returns no path to an unreachable goal', () => {
    const g = graph([screen('a'), screen('b')], []);
    const result = analyze(g, 'a', 'b', assumptions);
    expect(result.fastest).toBeNull();
    expect(result.fewest).toBeNull();
    expect(result.alternatives).toEqual([]);
  });

  it('handles a goal equal to the start', () => {
    const g = graph([screen('a')], []);
    const result = analyze(g, 'a', 'a', assumptions);
    expect(result.fastest?.actions).toBe(0);
    expect(result.fastest?.seconds).toBe(0);
  });

  it('does not loop forever on a cycle', () => {
    const g = graph(
      [screen('a'), screen('b'), screen('c')],
      [link('ab', 'a', 'b'), link('ba', 'b', 'a'), link('bc', 'b', 'c')],
    );
    const result = analyze(g, 'a', 'c', assumptions);
    expect(result.fastest?.actions).toBe(2);
    expect(result.alternatives).toHaveLength(1);
  });

  it('reaches a screen through an overlay and a swap', () => {
    const g = graph(
      [screen('a'), screen('menu'), screen('pick'), screen('done')],
      [
        link('open', 'a', 'menu', { navigation: 'OVERLAY' }),
        link('choose', 'menu', 'pick', { navigation: 'SWAP' }),
        link('finish', 'pick', 'done'),
      ],
    );
    const result = analyze(g, 'a', 'done', assumptions);
    expect(result.fastest?.actions).toBe(3);
    expect(result.fastest?.friction.some((f) => f.kind === 'overlay')).toBe(
      true,
    );
  });

  it('ignores links that do not move the person', () => {
    const g = graph(
      [screen('a'), screen('b')],
      [
        link('scroll', 'a', 'a', { navigation: 'SCROLL_TO' }),
        link('hover', 'a', 'b', { trigger: 'HOVER' }),
        link('back', 'a', 'b', { navigation: 'BACK' }),
      ],
    );
    expect(analyze(g, 'a', 'b', assumptions).fastest).toBeNull();
  });

  it('counts a timer as a step without an action', () => {
    const g = graph(
      [screen('splash'), screen('home')],
      [
        link('auto', 'splash', 'home', {
          trigger: 'TIMEOUT',
          delaySeconds: 2,
        }),
      ],
    );
    const result = analyze(g, 'splash', 'home', assumptions);
    expect(result.fastest?.steps).toHaveLength(1);
    expect(result.fastest?.actions).toBe(0);
    expect(result.fastest?.seconds).toBeCloseTo(2);
    expect(result.fastest?.friction.some((f) => f.kind === 'wait')).toBe(true);
  });

  it('flags small, far and below-the-fold targets', () => {
    const tall = screen('a', { scrolls: true, contentHeight: 2400 });
    const g = graph(
      [tall, screen('b')],
      [link('tiny', 'a', 'b', { bounds: rect(380, 2000, 10, 10) })],
    );
    const kinds = new Set(
      analyze(g, 'a', 'b', assumptions).fastest?.friction.map((f) => f.kind),
    );
    expect(kinds.has('small-target')).toBe(true);
    expect(kinds.has('scroll')).toBe(true);
    expect(kinds.has('far-target')).toBe(true);
  });

  it('flags a long form', () => {
    const form = screen('a', {
      fields: [field('1'), field('2'), field('3'), field('4')],
    });
    const g = graph([form, screen('b')], [link('go', 'a', 'b')]);
    expect(
      analyze(g, 'a', 'b', assumptions).fastest?.friction.some(
        (f) => f.kind === 'form',
      ),
    ).toBe(true);
  });

  it('marks a path with a conditional branch as assumed', () => {
    const g = graph(
      [screen('a'), screen('b')],
      [link('go', 'a', 'b', { conditional: true })],
    );
    expect(analyze(g, 'a', 'b', assumptions).fastest?.assumed).toBe(true);
  });

  it('skips broken links', () => {
    const g = graph(
      [screen('a'), screen('b')],
      [link('gone', 'a', 'x', { broken: 'missing' }), link('ok', 'a', 'b')],
    );
    expect(analyze(g, 'a', 'b', assumptions).fastest?.steps).toHaveLength(1);
  });

  it('stops at the path limit and says so', () => {
    const screens = [screen('a'), screen('z')];
    const links = [];
    for (let i = 0; i < 6; i += 1) {
      screens.push(screen(`m${i}`));
      links.push(link(`a-m${i}`, 'a', `m${i}`));
      links.push(link(`m${i}-z`, `m${i}`, 'z'));
    }
    const result = analyze(graph(screens, links), 'a', 'z', assumptions, {
      maxDepth: 12,
      maxPaths: 3,
      maxVisits: 20_000,
      maxStack: 4,
    });
    expect(result.alternatives).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });

  it('prices touch flows with the touch resting point', () => {
    const mouse = analyze(
      graph(
        [screen('a'), screen('b')],
        [link('go', 'a', 'b', { bounds: rect(180, 700, 60, 60) })],
      ),
      'a',
      'b',
      defaultAssumptions('regular', 'mouse'),
    );
    const touch = analyze(
      graph(
        [screen('a'), screen('b')],
        [link('go', 'a', 'b', { bounds: rect(180, 700, 60, 60) })],
      ),
      'a',
      'b',
      defaultAssumptions('regular', 'touch'),
    );
    expect(touch.fastest?.seconds).not.toBe(mouse.fastest?.seconds);
  });
});
