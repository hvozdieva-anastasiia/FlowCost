import {
  defaultAssumptions,
  indexOfDifficulty,
  pointingSeconds,
  restingPoint,
  scrollsNeeded,
  stepCost,
} from '../../src/shared/cost';
import { field, link, rect, screen } from './fixtures';

describe('Fitts law', () => {
  it('grows with distance and shrinks with target size', () => {
    const small = rect(0, 0, 20, 20);
    const large = rect(0, 0, 100, 100);
    expect(indexOfDifficulty(200, small)).toBeGreaterThan(
      indexOfDifficulty(200, large),
    );
    expect(indexOfDifficulty(400, large)).toBeGreaterThan(
      indexOfDifficulty(100, large),
    );
  });

  it('uses the smaller side of the target', () => {
    expect(indexOfDifficulty(100, rect(0, 0, 200, 10))).toBeCloseTo(
      Math.log2(100 / 10 + 1),
    );
  });

  it('is zero for a target the pointer is already on', () => {
    expect(indexOfDifficulty(0, rect(0, 0, 50, 50))).toBe(0);
  });

  it('falls back to the fixed point time when switched off', () => {
    const assumptions = { ...defaultAssumptions(), useFitts: false };
    expect(pointingSeconds(assumptions, { x: 0, y: 0 }, rect())).toBe(
      assumptions.pointFixed,
    );
  });
});

describe('scrolling', () => {
  it('needs none when the target is inside the frame', () => {
    expect(scrollsNeeded(screen('a', { scrolls: true }), rect(0, 100))).toBe(0);
  });

  it('needs none on a screen that does not scroll', () => {
    expect(scrollsNeeded(screen('a'), rect(0, 1200))).toBe(0);
  });

  it('counts scrolls for content below the fold', () => {
    const tall = screen('a', { scrolls: true, contentHeight: 2400 });
    expect(scrollsNeeded(tall, rect(0, 900, 100, 48))).toBe(1);
    expect(scrollsNeeded(tall, rect(0, 2000, 100, 48))).toBe(2);
    expect(scrollsNeeded(tall, rect(0, 2400, 100, 48))).toBe(3);
  });
});

describe('step cost', () => {
  const assumptions = defaultAssumptions('regular', 'mouse');
  const a = screen('a');

  it('adds mental, pointing and press time for a click', () => {
    const cost = stepCost(
      assumptions,
      a,
      link('go', 'a', 'b'),
      restingPoint(a, 'mouse'),
    );
    expect(cost.operators.map((o) => o.kind)).toEqual(['M', 'P', 'B']);
    expect(cost.taps).toBe(1);
    expect(cost.automatic).toBe(false);
    expect(cost.seconds).toBeCloseTo(
      cost.operators.reduce((sum, o) => sum + o.seconds, 0),
    );
  });

  it('charges typing for the fields of the screen', () => {
    const form = screen('a', { fields: [field('email', 20)] });
    const cost = stepCost(
      assumptions,
      form,
      link('go', 'a', 'b'),
      restingPoint(form, 'mouse'),
    );
    expect(cost.typedChars).toBe(20);
    const typing = cost.operators.find((o) => o.kind === 'K');
    expect(typing?.seconds).toBeCloseTo(20 * assumptions.keystroke);
    expect(cost.operators.filter((o) => o.kind === 'H')).toHaveLength(2);
  });

  it('is only waiting for a timer link', () => {
    const cost = stepCost(
      assumptions,
      a,
      link('wait', 'a', 'b', {
        trigger: 'TIMEOUT',
        delaySeconds: 2,
        transitionSeconds: 0.3,
      }),
      restingPoint(a, 'mouse'),
    );
    expect(cost.automatic).toBe(true);
    expect(cost.taps).toBe(0);
    expect(cost.seconds).toBeCloseTo(2.3);
  });

  it('adds a scroll for a target below the fold', () => {
    const tall = screen('a', { scrolls: true, contentHeight: 2000 });
    const cost = stepCost(
      assumptions,
      tall,
      link('far', 'a', 'b', { bounds: rect(100, 1500) }),
      restingPoint(tall, 'mouse'),
    );
    expect(cost.operators.some((o) => o.kind === 'S')).toBe(true);
  });

  it('costs a novice more than an expert', () => {
    const run = (skill: 'expert' | 'novice') =>
      stepCost(
        defaultAssumptions(skill, 'mouse'),
        a,
        link('go', 'a', 'b'),
        restingPoint(a, 'mouse'),
      ).seconds;
    expect(run('novice')).toBeGreaterThan(run('expert'));
  });
});
