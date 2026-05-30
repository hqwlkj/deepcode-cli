import { test } from "node:test";
import assert from "node:assert/strict";
import chalk from "chalk";

import {
  LIGHT_THEME,
  DARK_THEME,
  MONOKAI_THEME,
  DRACULA_THEME,
  GITHUB_LIGHT_THEME,
  GITHUB_DARK_THEME,
  GITLAB_LIGHT_THEME,
  GITLAB_DARK_THEME,
  PRESETS,
} from "../ui/theme";
import { resolveTheme } from "../ui/theme";
import { createThemedChalk } from "../ui/theme";
import { setCurrentTheme, getCurrentThemedChalk, getCurrentThemeTokens } from "../ui/theme";
import { resolveSettingsSources } from "../settings";
import { getScopeRiskColor } from "../ui/views/PermissionPrompt";

import type { ThemeTokens } from "../ui/theme";

// Force chalk to produce ANSI escapes even in non-TTY test environments.
chalk.level = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All token keys that every ThemeTokens must define. */
const REQUIRED_TOKEN_KEYS: Array<keyof ThemeTokens> = [
  "primary",
  "secondary",
  "success",
  "error",
  "warning",
  "info",
  "text",
  "textDim",
  "textBright",
  "code",
  "border",
  "gradients",
];

const DEFAULTS = {
  model: "test-model",
  baseURL: "https://test.example.com",
};

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

test("LIGHT_THEME has all required token keys", () => {
  for (const key of REQUIRED_TOKEN_KEYS) {
    assert.ok(key in LIGHT_THEME, `LIGHT_THEME is missing key: ${key}`);
  }
});

test("LIGHT_THEME primary matches expected brand color", () => {
  assert.equal(LIGHT_THEME.primary, "#229ac3");
  assert.equal(LIGHT_THEME.secondary, "#229ac3e6");
});

test("LIGHT_THEME semantic colors match expected values", () => {
  assert.equal(LIGHT_THEME.success, "#1a7f37");
  assert.equal(LIGHT_THEME.error, "#d1242f");
  assert.equal(LIGHT_THEME.warning, "#fa8c16");
  assert.equal(LIGHT_THEME.info, "#0969da");
});

test("LIGHT_THEME base colors match expected values", () => {
  assert.equal(LIGHT_THEME.text, "#3D4149");
  assert.equal(LIGHT_THEME.textDim, "#646A71");
  assert.equal(LIGHT_THEME.textBright, "#1F2329");
  assert.equal(LIGHT_THEME.code, "#787f8a");
});

test("PRESETS map contains all presets", () => {
  assert.ok("light" in PRESETS);
  assert.ok("dark" in PRESETS);
  assert.ok("monokai" in PRESETS);
  assert.ok("dracula" in PRESETS);
  assert.ok("github-light" in PRESETS);
  assert.ok("github-dark" in PRESETS);
  assert.ok("gitlab-light" in PRESETS);
  assert.ok("gitlab-dark" in PRESETS);
  assert.equal(Object.keys(PRESETS).length, 8);
  assert.equal(PRESETS.light, LIGHT_THEME);
  assert.equal(PRESETS.dark, DARK_THEME);
  assert.equal(PRESETS.monokai, MONOKAI_THEME);
  assert.equal(PRESETS.dracula, DRACULA_THEME);
});

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

test("resolveTheme returns LIGHT_THEME when settings is undefined", () => {
  const result = resolveTheme(undefined);
  assert.equal(result.primary, LIGHT_THEME.primary);
  assert.equal(result.success, LIGHT_THEME.success);
});

test("resolveTheme returns LIGHT_THEME for explicit 'light' preset", () => {
  const result = resolveTheme({ preset: "light" });
  assert.equal(result.primary, LIGHT_THEME.primary);
});

test("resolveTheme returns DARK_THEME for 'dark' preset", () => {
  const result = resolveTheme({ preset: "dark" });
  assert.equal(result.primary, DARK_THEME.primary);
  assert.equal(result.text, DARK_THEME.text);
});

test("resolveTheme returns MONOKAI_THEME for 'monokai' preset", () => {
  const result = resolveTheme({ preset: "monokai" });
  assert.equal(result.primary, MONOKAI_THEME.primary);
  assert.equal(result.text, MONOKAI_THEME.text);
});

test("resolveTheme returns DRACULA_THEME for 'dracula' preset", () => {
  const result = resolveTheme({ preset: "dracula" });
  assert.equal(result.primary, DRACULA_THEME.primary);
  assert.equal(result.text, DRACULA_THEME.text);
});

test("resolveTheme applies overrides when preset is 'custom'", () => {
  const result = resolveTheme({
    preset: "custom",
    overrides: { primary: "#ff0000" },
  });
  assert.equal(result.primary, "#ff0000");
  assert.equal(result.success, LIGHT_THEME.success);
});

test("resolveTheme applies multiple overrides with custom preset", () => {
  const result = resolveTheme({
    preset: "custom",
    overrides: {
      primary: "#ff6600",
      success: "greenBright",
      warning: "yellowBright",
    },
  });
  assert.equal(result.primary, "#ff6600");
  assert.equal(result.success, "greenBright");
  assert.equal(result.warning, "yellowBright");
  assert.equal(result.error, LIGHT_THEME.error);
});

test("resolveTheme full custom tokens with custom preset", () => {
  const customTokens: ThemeTokens = {
    primary: "#aaaaaa",
    secondary: "#aaaaaacc",
    success: "blue",
    error: "blue",
    warning: "blue",
    info: "blue",
    text: "blue",
    textDim: "blue",
    textBright: "blue",
    code: "blue",
    border: "blue",
    gradients: ["#aaaaaa", "#bbbbbb"],
  };
  const result = resolveTheme({ preset: "custom", tokens: customTokens });
  assert.equal(result.primary, "#aaaaaa");
  assert.equal(result.code, "blue");
  assert.deepEqual(result.gradients, ["#aaaaaa", "#bbbbbb"]);
});

test("resolveTheme handles override with undefined fields gracefully", () => {
  const result = resolveTheme({
    preset: "custom",
    overrides: { primary: undefined, success: undefined } as Partial<ThemeTokens>,
  });
  assert.equal(result.primary, LIGHT_THEME.primary);
  assert.equal(result.success, LIGHT_THEME.success);
});

test("resolveTheme ignores overrides when preset is not custom", () => {
  const result = resolveTheme({
    preset: "light",
    overrides: { primary: "#ff0000" },
  });
  assert.equal(result.primary, LIGHT_THEME.primary);
});

test("resolveTheme ignores tokens when preset is not custom", () => {
  const result = resolveTheme({
    tokens: { primary: "#ff0000" } as ThemeTokens,
  });
  assert.equal(result.primary, LIGHT_THEME.primary);
});

test("resolveTheme returns LIGHT_THEME for custom preset without token/overrides", () => {
  const result = resolveTheme({ preset: "custom" });
  assert.equal(result.primary, LIGHT_THEME.primary);
});

// ---------------------------------------------------------------------------
// createThemedChalk — markdown 方法直接复用顶层 token
// ---------------------------------------------------------------------------

test("createThemedChalk heading1 produces styled output via primary", () => {
  const tc = createThemedChalk(LIGHT_THEME);
  assert.notEqual(tc.heading1("Hello"), "Hello");
});

test("createThemedChalk heading1 changes when primary changes", () => {
  const custom: ThemeTokens = { ...LIGHT_THEME, primary: "#ff0000" };
  assert.notEqual(createThemedChalk(LIGHT_THEME).heading1("test"), createThemedChalk(custom).heading1("test"));
});

test("createThemedChalk inlineCode changes when code changes", () => {
  const custom: ThemeTokens = { ...LIGHT_THEME, code: "#ff0000" };
  assert.notEqual(createThemedChalk(LIGHT_THEME).inlineCode("test"), createThemedChalk(custom).inlineCode("test"));
});

test("createThemedChalk listBullet changes when warning changes", () => {
  const custom: ThemeTokens = { ...LIGHT_THEME, warning: "#ff0000" };
  assert.notEqual(createThemedChalk(LIGHT_THEME).listBullet("test"), createThemedChalk(custom).listBullet("test"));
});

test("createThemedChalk quote changes when textDim changes", () => {
  const custom: ThemeTokens = { ...LIGHT_THEME, textDim: "#ff0000" };
  assert.notEqual(createThemedChalk(LIGHT_THEME).quote("test"), createThemedChalk(custom).quote("test"));
});

test("createThemedChalk bold / italic / dim produce styled output", () => {
  const tc = createThemedChalk(LIGHT_THEME);
  assert.notEqual(tc.bold("bold"), "bold");
  assert.notEqual(tc.italic("italic"), "italic");
  assert.notEqual(tc.dim("dim"), "dim");
});

test("createThemedChalk produces different output for different primary values", () => {
  const custom1: ThemeTokens = { ...LIGHT_THEME, primary: "#ff0000" };
  const custom2: ThemeTokens = { ...LIGHT_THEME, primary: "#00ff00" };
  assert.notEqual(createThemedChalk(custom1).primary("test"), createThemedChalk(custom2).primary("test"));
});

test("createThemedChalk handles hex colors correctly", () => {
  const hexTheme: ThemeTokens = {
    ...LIGHT_THEME,
    primary: "#ff6600",
    warning: "#ffcc00",
    code: "#00ccff",
  };
  const tc = createThemedChalk(hexTheme);
  assert.notEqual(tc.heading1("test"), "test");
  assert.notEqual(tc.inlineCode("test"), "test");
});

// ---------------------------------------------------------------------------
// current-theme (module-level state)
// ---------------------------------------------------------------------------

test("getCurrentThemedChalk returns LIGHT_THEME chalk by default", () => {
  setCurrentTheme(LIGHT_THEME);
  assert.notEqual(getCurrentThemedChalk().primary("test"), "test");
});

test("setCurrentTheme changes getCurrentThemedChalk output", () => {
  setCurrentTheme(LIGHT_THEME);
  const first = getCurrentThemedChalk().primary("test");

  const custom: ThemeTokens = { ...LIGHT_THEME, primary: "#ff0000" };
  setCurrentTheme(custom);
  const second = getCurrentThemedChalk().primary("test");

  assert.notEqual(first, second);

  setCurrentTheme(LIGHT_THEME);
});

test("setCurrentTheme changes getCurrentThemeTokens output", () => {
  setCurrentTheme(LIGHT_THEME);
  assert.equal(getCurrentThemeTokens().primary, LIGHT_THEME.primary);

  const custom: ThemeTokens = { ...LIGHT_THEME, primary: "#ff0000" };
  setCurrentTheme(custom);
  assert.equal(getCurrentThemeTokens().primary, "#ff0000");

  setCurrentTheme(LIGHT_THEME);
});

// ---------------------------------------------------------------------------
// Settings integration
// ---------------------------------------------------------------------------

test("resolveSettingsSources includes theme field in resolved settings", () => {
  const result = resolveSettingsSources(null, null, DEFAULTS, {});
  assert.ok("theme" in result);
  assert.equal(result.theme.primary, LIGHT_THEME.primary);
});

test("resolveSettingsSources resolves custom theme from user settings", () => {
  const result = resolveSettingsSources(
    { theme: { preset: "custom", overrides: { primary: "#abcdef" } } },
    null,
    DEFAULTS,
    {}
  );
  assert.equal(result.theme.primary, "#abcdef");
});

test("resolveSettingsSources resolves custom theme from project settings", () => {
  const result = resolveSettingsSources(
    null,
    { theme: { preset: "custom", overrides: { primary: "#123456" } } },
    DEFAULTS,
    {}
  );
  assert.equal(result.theme.primary, "#123456");
});

test("resolveSettingsSources uses default theme when preset is not custom", () => {
  const result = resolveSettingsSources(
    { theme: { preset: "light", overrides: { primary: "#abcdef" } } },
    null,
    DEFAULTS,
    {}
  );
  assert.equal(result.theme.primary, LIGHT_THEME.primary);
});

// ---------------------------------------------------------------------------
// getScopeRiskColor with theme parameter
// ---------------------------------------------------------------------------

test("getScopeRiskColor returns default theme colors when no theme is passed", () => {
  assert.equal(getScopeRiskColor("read-in-cwd"), LIGHT_THEME.success);
  assert.equal(getScopeRiskColor("write-in-cwd"), LIGHT_THEME.warning);
  assert.equal(getScopeRiskColor("write-out-cwd"), LIGHT_THEME.error);
});

test("getScopeRiskColor uses theme semantic colors when theme is provided", () => {
  const custom: Partial<ThemeTokens> = {
    success: "#aaaaaa",
    warning: "#bbbbbb",
    error: "#cccccc",
  };
  assert.equal(getScopeRiskColor("read-in-cwd", custom as ThemeTokens), "#aaaaaa");
  assert.equal(getScopeRiskColor("mcp", custom as ThemeTokens), "#bbbbbb");
  assert.equal(getScopeRiskColor("delete-out-cwd", custom as ThemeTokens), "#cccccc");
});
