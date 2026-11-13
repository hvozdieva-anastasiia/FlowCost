import { analyze } from '../../src/shared/analysis';
import { compare, summarize } from '../../src/shared/compare';
import { defaultAssumptions } from '../../src/shared/cost';
import { csvCell, toCsv, toMarkdown } from '../../src/shared/export';
import { graph, link, screen } from './fixtures';

const assumptions = defaultAssumptions('regular', 'mouse');

function pathOf(...ids: string[]) {
  const screens = ids.map((id) => screen(id));
  const links = ids
    .slice(1)
    .map((id, i) => link(`${ids[i]}-${id}`, ids[i] ?? '', id));
  const first = ids[0] ?? 'a';
  const last = ids[ids.length - 1] ?? 'a';
  const path = analyze(graph(screens, links), first, last, assumptions).fastest;
  if (!path) throw new Error('no path in fixture');
  return path;
}

describe('compare', () => {
  it('reports a shorter flow as a negative change', () => {
    const before = summarize(pathOf('a', 'b', 'c', 'd'));
    const after = summarize(pathOf('a', 'b'));
    const delta = compare(before, after);
    const actions = delta.find((d) => d.key === 'actions');
    expect(actions).toMatchObject({ before: 3, after: 1, change: -2 });
    expect(actions?.percent).toBeCloseTo(-66.67, 1);
    const seconds = delta.find((d) => d.key === 'seconds');
    expect(seconds?.change).toBeLessThan(0);
  });

  it('gives no percentage against zero', () => {
    const delta = compare(
      summarize(pathOf('a', 'b')),
      summarize(pathOf('a', 'b')),
    );
    expect(delta.find((d) => d.key === 'typedChars')?.percent).toBeNull();
  });
});

describe('export', () => {
  it('quotes csv cells that need it', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('writes one csv row per operator', () => {
    const path = pathOf('a', 'b');
    const rows = toCsv(path).trim().split('\n');
    expect(rows[0]).toBe('step,screen,action,operator,detail,seconds');
    const operators = path.steps.reduce((n, s) => n + s.operators.length, 0);
    expect(rows).toHaveLength(operators + 1);
  });

  it('writes a markdown report with the assumptions', () => {
    const text = toMarkdown({
      title: 'Sign up',
      startName: 'A',
      goalName: 'B',
      path: pathOf('a', 'b'),
      assumptions,
    });
    expect(text).toContain('# Sign up');
    expect(text).toContain('| Actions | 1 |');
    expect(text).toContain('## Assumptions');
    expect(text).toContain('model estimate');
  });
});
