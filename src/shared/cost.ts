// The cost model: Keystroke-Level Model operators with Fitts's law for
// pointing. Every number lives in `Assumptions` so the window can show and
// change it. The defaults for M, H, P, B and K come from the original KLM; the
// rest are working assumptions, not measurements.

import { center, type Link, type Rect, type Screen } from './graph';

export type Skill = 'expert' | 'regular' | 'novice';
export type Device = 'mouse' | 'touch';

export interface Assumptions {
  readonly skill: Skill;
  readonly device: Device;
  /** Mental preparation before an action (M), seconds. */
  readonly mental: number;
  /** Moving a hand between pointing device and keyboard (H), seconds. */
  readonly home: number;
  /** One key press (K), seconds. */
  readonly keystroke: number;
  /** Pointing time when Fitts's law is off (P), seconds. */
  readonly pointFixed: number;
  /** Pressing the button or touching the glass (BB / tap), seconds. */
  readonly press: number;
  /** One scroll or swipe to reveal content, seconds. */
  readonly scroll: number;
  /** A drag gesture, seconds. */
  readonly drag: number;
  readonly useFitts: boolean;
  /** Fitts's law intercept `a`, seconds. */
  readonly fittsA: number;
  /** Fitts's law slope `b`, seconds per bit. */
  readonly fittsB: number;
  /** Targets smaller than this (in design pixels) are flagged. */
  readonly minTarget: number;
  /** Index of difficulty, in bits, above which a target counts as far. */
  readonly farIndex: number;
  readonly useHick: boolean;
  /** Hick's law slope: seconds per bit of choice among the options. */
  readonly hickB: number;
  /** A screen with this many options or more is flagged. */
  readonly manyChoices: number;
}

const SKILL_MENTAL: Record<Skill, number> = {
  expert: 1.35,
  regular: 1.8,
  novice: 2.7,
};

// Original KLM keystroke times: good typist, average non-secretary, random text.
const SKILL_KEYSTROKE: Record<Skill, number> = {
  expert: 0.12,
  regular: 0.28,
  novice: 0.5,
};

export function defaultAssumptions(
  skill: Skill = 'regular',
  device: Device = 'mouse',
): Assumptions {
  const touch = device === 'touch';
  return {
    skill,
    device,
    mental: SKILL_MENTAL[skill],
    home: 0.4,
    keystroke: SKILL_KEYSTROKE[skill],
    pointFixed: 1.1,
    press: touch ? 0.15 : 0.2,
    scroll: 0.8,
    drag: 1,
    useFitts: true,
    fittsA: 0.1,
    fittsB: touch ? 0.12 : 0.15,
    minTarget: touch ? 44 : 24,
    farIndex: 4.5,
    useHick: true,
    hickB: 0.15,
    manyChoices: 7,
  };
}

/** M, P, B, H, K, S, D, R as in the KLM; C is the choice among options (Hick). */
export type OperatorKind = 'M' | 'P' | 'B' | 'H' | 'K' | 'S' | 'D' | 'R' | 'C';

export interface Operator {
  readonly kind: OperatorKind;
  readonly seconds: number;
  readonly label: string;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where the pointer or thumb rests before the first action of a flow. */
export function restingPoint(screen: Screen, device: Device): Point {
  return device === 'touch'
    ? { x: screen.width / 2, y: screen.height * 0.8 }
    : { x: screen.width / 2, y: screen.height / 2 };
}

/** Fitts's law index of difficulty in bits; the target width is its smaller side. */
export function indexOfDifficulty(distance: number, target: Rect): number {
  const width = Math.max(1, Math.min(target.width, target.height));
  return Math.log2(distance / width + 1);
}

export function pointingSeconds(
  assumptions: Assumptions,
  from: Point,
  target: Rect,
): number {
  if (!assumptions.useFitts) return assumptions.pointFixed;
  const to = center(target);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const id = indexOfDifficulty(distance, target);
  return assumptions.fittsA + assumptions.fittsB * id;
}

/**
 * Time to choose among `options` equally likely options: `b * log2(options)`.
 * One option means no choice and costs nothing; the mental step already covers
 * finding the control.
 */
export function choiceSeconds(
  assumptions: Assumptions,
  options: number,
): number {
  if (options <= 1) return 0;
  return assumptions.hickB * Math.log2(options);
}

/** How many scrolls the person needs to bring the target into view. */
export function scrollsNeeded(screen: Screen, target: Rect): number {
  const bottom = target.y + target.height;
  if (!screen.scrolls || bottom <= screen.height) return 0;
  return Math.max(
    1,
    Math.ceil((bottom - screen.height) / (screen.height * 0.8)),
  );
}

export interface StepCost {
  readonly operators: readonly Operator[];
  readonly seconds: number;
  /** Where the pointer ends up, for the next step. */
  readonly pointer: Point;
  /** Where the pointer was when it started moving to the link itself. */
  readonly linkFrom: Point;
  readonly typedChars: number;
  readonly taps: number;
  /** The step needs no action from the person (a timer). */
  readonly automatic: boolean;
}

function sum(operators: readonly Operator[]): number {
  let total = 0;
  for (const operator of operators) total += operator.seconds;
  return total;
}

/**
 * The cost of taking `link` from `screen` with the pointer at `pointer`.
 * Fields of the screen are typed first, then the link itself is used.
 */
export function stepCost(
  assumptions: Assumptions,
  screen: Screen,
  link: Link,
  pointer: Point,
  /** How many options the screen offers; one means there is no choice. */
  choices = 1,
): StepCost {
  const operators: Operator[] = [];
  let at = pointer;
  let typedChars = 0;
  let taps = 0;

  if (link.trigger === 'TIMEOUT') {
    const wait = link.delaySeconds + link.transitionSeconds;
    if (wait > 0) {
      operators.push({
        kind: 'R',
        seconds: wait,
        label: `Wait for the timer (${link.delaySeconds}s) and transition`,
      });
    }
    return {
      operators,
      seconds: sum(operators),
      pointer: at,
      linkFrom: at,
      typedChars,
      taps,
      automatic: true,
    };
  }

  for (const field of screen.fields) {
    operators.push({
      kind: 'M',
      seconds: assumptions.mental,
      label: `Decide what to enter in "${field.name}"`,
    });
    operators.push({
      kind: 'P',
      seconds: pointingSeconds(assumptions, at, field.bounds),
      label: `Point at "${field.name}"`,
    });
    operators.push({
      kind: 'B',
      seconds: assumptions.press,
      label: 'Activate the field',
    });
    taps += 1;
    operators.push({
      kind: 'H',
      seconds: assumptions.home,
      label: 'To keyboard',
    });
    operators.push({
      kind: 'K',
      seconds: assumptions.keystroke * field.chars,
      label: `Type ${field.chars} characters`,
    });
    operators.push({
      kind: 'H',
      seconds: assumptions.home,
      label: 'From keyboard',
    });
    typedChars += field.chars;
    at = center(field.bounds);
  }

  const scrolls = scrollsNeeded(screen, link.bounds);
  if (scrolls > 0) {
    operators.push({
      kind: 'S',
      seconds: assumptions.scroll * scrolls,
      label: scrolls === 1 ? 'Scroll to the target' : `Scroll ${scrolls} times`,
    });
  }

  operators.push({
    kind: 'M',
    seconds: assumptions.mental,
    label: `Find "${link.sourceName}"`,
  });
  if (assumptions.useHick && choices > 1) {
    operators.push({
      kind: 'C',
      seconds: choiceSeconds(assumptions, choices),
      label: `Choose among ${choices} options`,
    });
  }
  const linkFrom = at;

  if (link.trigger === 'KEY') {
    operators.push({
      kind: 'H',
      seconds: assumptions.home,
      label: 'To keyboard',
    });
    operators.push({
      kind: 'K',
      seconds: assumptions.keystroke,
      label: 'Press the key',
    });
    typedChars += 1;
  } else if (link.trigger === 'DRAG') {
    operators.push({
      kind: 'P',
      seconds: pointingSeconds(assumptions, at, link.bounds),
      label: `Point at "${link.sourceName}"`,
    });
    operators.push({ kind: 'D', seconds: assumptions.drag, label: 'Drag' });
    taps += 1;
    at = center(link.bounds);
  } else {
    operators.push({
      kind: 'P',
      seconds: pointingSeconds(assumptions, at, link.bounds),
      label: `Point at "${link.sourceName}"`,
    });
    operators.push({
      kind: 'B',
      seconds: assumptions.press,
      label: assumptions.device === 'touch' ? 'Tap' : 'Click',
    });
    taps += 1;
    at = center(link.bounds);
  }

  if (link.transitionSeconds > 0) {
    operators.push({
      kind: 'R',
      seconds: link.transitionSeconds,
      label: 'Transition animation',
    });
  }

  return {
    operators,
    seconds: sum(operators),
    pointer: at,
    linkFrom,
    typedChars,
    taps,
    automatic: false,
  };
}
