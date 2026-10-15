import type { ColorScheme } from "./tokens";

/**
 * The scheme the app is showing right now, for the few static style objects
 * that are read at render time outside a component (e.g. MapSheet's
 * `sheetStyles.note`). Components use useTheme() instead.
 */
let current: ColorScheme = "light";

export function setCurrentScheme(scheme: ColorScheme) {
  current = scheme;
}

export function currentScheme(): ColorScheme {
  return current;
}
