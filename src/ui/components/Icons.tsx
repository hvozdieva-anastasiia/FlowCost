// Small drawn icons in one stroke weight. Each is decorative: the button that
// holds it carries the accessible name.

import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <Icon>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 2.5v3h-3" />
    </Icon>
  );
}

export function SwapIcon() {
  return (
    <Icon>
      <path d="M5 13V3M2.5 5.5 5 3l2.5 2.5" />
      <path d="M11 3v10M8.5 10.5 11 13l2.5-2.5" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Icon>
  );
}
