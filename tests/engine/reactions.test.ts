import {
  parseReaction,
  toSeconds,
  triggerKind,
  type RawReaction,
} from '../../src/shared/reactions';

describe('toSeconds', () => {
  it('keeps seconds and reads large numbers as milliseconds', () => {
    expect(toSeconds(0.3)).toBe(0.3);
    expect(toSeconds(2)).toBe(2);
    expect(toSeconds(800)).toBeCloseTo(0.8);
  });

  it('turns bad numbers into zero', () => {
    expect(toSeconds(-1)).toBe(0);
    expect(toSeconds(Number.NaN)).toBe(0);
  });
});

describe('triggerKind', () => {
  it('maps Figma triggers to the ones the cost model knows', () => {
    expect(triggerKind('ON_CLICK')).toBe('CLICK');
    expect(triggerKind('AFTER_TIMEOUT')).toBe('TIMEOUT');
    expect(triggerKind('ON_HOVER')).toBe('HOVER');
    expect(triggerKind('ON_KEY_DOWN')).toBe('KEY');
    expect(triggerKind('MOUSE_ENTER')).toBe('OTHER');
  });
});

describe('parseReaction', () => {
  it('reads a plain navigation', () => {
    const reaction: RawReaction = {
      trigger: { type: 'ON_CLICK' },
      actions: [
        {
          type: 'NODE',
          destinationId: '1:2',
          navigation: 'NAVIGATE',
          transition: { duration: 0.3 },
        },
      ],
    };
    expect(parseReaction(reaction)).toEqual([
      {
        trigger: 'CLICK',
        delaySeconds: 0,
        navigation: 'NAVIGATE',
        destinationId: '1:2',
        transitionSeconds: 0.3,
        conditional: false,
      },
    ]);
  });

  it('reads the older single action', () => {
    const reaction: RawReaction = {
      trigger: { type: 'ON_CLICK' },
      action: { type: 'NODE', destinationId: '1:3', navigation: 'OVERLAY' },
    };
    expect(parseReaction(reaction)[0]?.navigation).toBe('OVERLAY');
  });

  it('reads a timer', () => {
    const [parsed] = parseReaction({
      trigger: { type: 'AFTER_TIMEOUT', timeout: 2 },
      actions: [{ type: 'NODE', destinationId: '1:4', navigation: 'NAVIGATE' }],
    });
    expect(parsed).toMatchObject({ trigger: 'TIMEOUT', delaySeconds: 2 });
  });

  it('flattens conditional branches and marks them', () => {
    const parsed = parseReaction({
      trigger: { type: 'ON_CLICK' },
      actions: [
        {
          type: 'CONDITIONAL',
          conditionalBlocks: [
            {
              actions: [
                { type: 'NODE', destinationId: 'a', navigation: 'NAVIGATE' },
              ],
            },
            {
              actions: [
                { type: 'NODE', destinationId: 'b', navigation: 'NAVIGATE' },
              ],
            },
          ],
        },
      ],
    });
    expect(parsed.map((p) => p.destinationId)).toEqual(['a', 'b']);
    expect(parsed.every((p) => p.conditional)).toBe(true);
  });

  it('ignores actions that do not move the person', () => {
    expect(
      parseReaction({
        trigger: { type: 'ON_CLICK' },
        actions: [{ type: 'SET_VARIABLE' }, { type: 'UPDATE_MEDIA_RUNTIME' }],
      }),
    ).toEqual([]);
  });

  it('keeps back, close and external links without a destination', () => {
    const parsed = parseReaction({
      trigger: { type: 'ON_CLICK' },
      actions: [{ type: 'BACK' }, { type: 'CLOSE' }, { type: 'URL' }],
    });
    expect(parsed.map((p) => p.navigation)).toEqual([
      'BACK',
      'CLOSE',
      'EXTERNAL',
    ]);
    expect(parsed.every((p) => p.destinationId === null)).toBe(true);
  });

  it('returns nothing for a reaction without a trigger', () => {
    expect(parseReaction({ trigger: null, actions: [] })).toEqual([]);
  });
});
