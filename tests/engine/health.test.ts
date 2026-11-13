import { checkHealth } from '../../src/shared/health';
import { graph, link, screen } from './fixtures';

const kinds = (issues: { kind: string }[]) => issues.map((i) => i.kind);

describe('checkHealth', () => {
  it('reports a page without a flow start', () => {
    const g = graph([screen('a'), screen('b')], [link('ab', 'a', 'b')]);
    expect(kinds(checkHealth(g))).toContain('no-start');
  });

  it('reports a link to a missing screen', () => {
    const g = graph(
      [screen('a')],
      [link('gone', 'a', 'x', { broken: 'missing' })],
      ['a'],
    );
    const issue = checkHealth(g).find((i) => i.kind === 'broken-link');
    expect(issue?.severity).toBe('error');
    expect(issue?.nodeId).toBe('node-gone');
  });

  it('reports a target that is not among the screens', () => {
    const g = graph([screen('a')], [link('lost', 'a', 'x')], ['a']);
    expect(kinds(checkHealth(g))).toContain('broken-link');
  });

  it('reports a screen no flow reaches', () => {
    const g = graph(
      [screen('a'), screen('b'), screen('c')],
      [link('ab', 'a', 'b'), link('cb', 'c', 'b')],
      ['a'],
    );
    const unreachable = checkHealth(g).filter((i) => i.kind === 'unreachable');
    expect(unreachable.map((i) => i.nodeId)).toEqual(['c']);
  });

  it('reports a dead end but not a marked ending', () => {
    const open = graph(
      [screen('a'), screen('b')],
      [link('ab', 'a', 'b')],
      ['a'],
    );
    expect(kinds(checkHealth(open))).toContain('dead-end');
    const marked = graph(
      [screen('a'), screen('b', { ending: true })],
      [link('ab', 'a', 'b')],
      ['a'],
    );
    expect(kinds(checkHealth(marked))).not.toContain('dead-end');
  });

  it('reports an overlay with no exit', () => {
    const g = graph(
      [screen('a'), screen('o')],
      [
        link('open', 'a', 'o', { navigation: 'OVERLAY' }),
        link('back', 'a', 'a', { navigation: 'BACK' }),
      ],
      ['a'],
    );
    expect(kinds(checkHealth(g))).toContain('overlay-no-exit');
  });

  it('accepts a close action as an exit', () => {
    const g = graph(
      [screen('a'), screen('o')],
      [
        link('open', 'a', 'o', { navigation: 'OVERLAY' }),
        link('close', 'o', null, { navigation: 'CLOSE' }),
        link('end', 'a', 'a', { navigation: 'CLOSE' }),
      ],
      ['a'],
    );
    expect(kinds(checkHealth(g))).not.toContain('overlay-no-exit');
  });
});
