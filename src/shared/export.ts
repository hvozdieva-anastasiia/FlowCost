// Text exports of an analysis for a document or a spreadsheet.

import type { PathResult } from './analysis';
import type { Assumptions } from './cost';

function seconds(value: number): string {
  return value.toFixed(1);
}

/** A cell safe for CSV: quoted when it holds a comma, quote or line break. */
export function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeTable(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export interface ReportInput {
  readonly title: string;
  readonly startName: string;
  readonly goalName: string;
  readonly path: PathResult;
  readonly assumptions: Assumptions;
}

export function toMarkdown(input: ReportInput): string {
  const { path, assumptions } = input;
  const lines: string[] = [
    `# ${input.title}`,
    '',
    `From **${input.startName}** to **${input.goalName}**.`,
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Actions | ${path.actions} |`,
    `| Screens | ${path.screens} |`,
    `| Taps or clicks | ${path.taps} |`,
    `| Characters typed | ${path.typedChars} |`,
    `| Modelled time | ${seconds(path.seconds)} s |`,
    `| Friction points | ${path.friction.length} |`,
    '',
    '## Steps',
    '',
    '| # | Screen | Action | Opens | Time (s) |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const step of path.steps) {
    lines.push(
      `| ${step.index} | ${escapeTable(step.screenName)} | ${escapeTable(step.label)} | ${escapeTable(step.toScreenName)} | ${seconds(step.seconds)} |`,
    );
  }
  if (path.friction.length > 0) {
    lines.push('', '## Friction', '');
    for (const point of path.friction) {
      lines.push(`- Step ${point.step}: ${point.message}`);
    }
  }
  if (path.assumed) {
    lines.push(
      '',
      'The path crosses a conditional branch. Variable values are not simulated, so the branch is counted as possible.',
    );
  }
  lines.push(
    '',
    '## Assumptions',
    '',
    `Skill: ${assumptions.skill}. Device: ${assumptions.device}.`,
    `M ${assumptions.mental} s, H ${assumptions.home} s, K ${assumptions.keystroke} s, press ${assumptions.press} s, scroll ${assumptions.scroll} s.`,
    assumptions.useFitts
      ? `Pointing by Fitts's law: ${assumptions.fittsA} + ${assumptions.fittsB} x log2(D/W + 1) s.`
      : `Pointing: ${assumptions.pointFixed} s fixed.`,
    '',
    'The time is a model estimate for a person who knows the task, not a measurement of real users.',
    '',
  );
  return lines.join('\n');
}

export function toCsv(path: PathResult): string {
  const rows: (string | number)[][] = [
    ['step', 'screen', 'action', 'operator', 'detail', 'seconds'],
  ];
  for (const step of path.steps) {
    for (const operator of step.operators) {
      rows.push([
        step.index,
        step.screenName,
        step.label,
        operator.kind,
        operator.label,
        operator.seconds.toFixed(2),
      ]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}
