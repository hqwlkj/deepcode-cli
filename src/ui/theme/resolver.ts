import { type ThemeTokens, type ThemeSettings } from "./types";
import { LIGHT_THEME, PRESETS } from "./presets";

/**
 * 深度合并两个对象。right 的值覆盖 left。
 * 仅支持最多两层嵌套（ThemeTokens）。
 */
function deepMerge<T extends object>(left: T, right: object): T {
  const result = { ...left };
  for (const key of Object.keys(right) as string[]) {
    const rv = (right as Record<string, unknown>)[key];
    if (rv === undefined) {
      continue;
    }
    const lv = (result as Record<string, unknown>)[key];
    if (lv && typeof lv === "object" && !Array.isArray(lv) && rv && typeof rv === "object" && !Array.isArray(rv)) {
      (result as Record<string, unknown>)[key] = deepMerge(lv as object, rv);
    } else {
      (result as Record<string, unknown>)[key] = rv;
    }
  }
  return result;
}

/**
 * 解析主题配置，返回最终的 ThemeTokens。
 *
 * - 未配置 / preset="light"：使用浅色主题 LIGHT_THEME
 * - preset 为预设名称（如 "dark", "monokai", "dracula"）：使用对应预设
 * - preset="custom"：使用用户自定义 tokens 或 overrides 合并到 LIGHT_THEME
 */
export function resolveTheme(themeSettings: ThemeSettings | undefined): ThemeTokens {
  if (!themeSettings) {
    return LIGHT_THEME;
  }

  const { preset } = themeSettings;

  // preset 为预设名称时使用对应预设
  if (preset && preset !== "custom" && preset in PRESETS) {
    return PRESETS[preset];
  }

  // preset="custom"：应用用户自定义
  if (preset === "custom") {
    if (themeSettings.tokens) {
      return deepMerge(LIGHT_THEME, themeSettings.tokens);
    }
    if (themeSettings.overrides) {
      return deepMerge(LIGHT_THEME, themeSettings.overrides);
    }
  }

  // 未配置或无效 preset，回退默认
  return LIGHT_THEME;
}
