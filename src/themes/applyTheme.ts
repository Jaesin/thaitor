/*
 * applyTheme — write every token in a theme object as a CSS custom property
 * on the document root (`--bg`, `--surface`, `--ink`, …). Mirrors JERNO's
 * theme.js pattern. Optional tokens absent from a theme are simply skipped.
 */
import type { Theme } from './tokens';

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    if (value == null) continue;
    root.style.setProperty(`--${key}`, value);
  }
}
