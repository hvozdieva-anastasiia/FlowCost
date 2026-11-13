// Plugin Main: opens the window. Prototype reading and cost model come later.

import { DEFAULT_WINDOW } from '../shared/product';

figma.showUI(__html__, {
  width: DEFAULT_WINDOW.width,
  height: DEFAULT_WINDOW.height,
  themeColors: true,
});
