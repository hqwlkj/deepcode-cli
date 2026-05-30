import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AppContext } from "../contexts";
import App from "./App";
import { RawModeProvider } from "../contexts";
import { ThemeProvider, setCurrentTheme, resolveTheme } from "../theme";
import { resolveCurrentSettings, readSettings, readProjectSettings, writeSettings } from "../../settings";
import type { ThemeTokens, ThemePreset, ThemeSettings } from "../theme";

const AppContainer: React.FC<{
  projectRoot: string;
  version: string;
  initialPrompt: string | undefined;
  onRestart: () => void;
}> = ({ version, projectRoot, initialPrompt, onRestart }) => {
  const settings = resolveCurrentSettings(projectRoot);
  const [theme, setTheme] = useState<ThemeTokens>(settings.theme);
  const [currentPreset, setCurrentPreset] = useState<ThemePreset>(() => {
    const userSettings = readSettings();
    const projectSettings = readProjectSettings(projectRoot);
    return (userSettings?.theme?.preset ?? projectSettings?.theme?.preset ?? "light") as ThemePreset;
  });
  const [themeVersion, setThemeVersion] = useState(0);

  // 检查是否有 custom 主题配置
  const hasCustomThemeConfig = useMemo(() => {
    const userSettings = readSettings();
    const projectSettings = readProjectSettings(projectRoot);
    const themeSettings = userSettings?.theme ?? projectSettings?.theme;
    return themeSettings?.preset === "custom" && !!(themeSettings?.overrides || themeSettings?.tokens);
  }, [projectRoot]);

  useEffect(() => {
    // 初始设置全局 chalk 主题
    setCurrentTheme(theme);
  }, [theme]);

  /** 应用主题到 UI（不持久化） */
  const applyThemeToUI = useCallback((newTheme: ThemeTokens) => {
    setTheme(newTheme);
    setCurrentTheme(newTheme);
    setThemeVersion((v) => v + 1);
  }, []);

  /** 预览主题：仅切换 UI，不保存到 settings，不更新 currentPreset */
  const previewTheme = useCallback(
    (presetOrTokens: string | Partial<ThemeTokens>) => {
      const newTheme = resolveTheme(
        typeof presetOrTokens === "string"
          ? { preset: presetOrTokens as ThemePreset }
          : { preset: "custom", overrides: presetOrTokens }
      );
      applyThemeToUI(newTheme);
    },
    [applyThemeToUI]
  );

  /** 切换主题并持久化到 settings.json */
  const switchTheme = useCallback(
    (presetOrTokens: string | Partial<ThemeTokens>) => {
      const preset: ThemePreset = typeof presetOrTokens === "string" ? (presetOrTokens as ThemePreset) : "custom";
      const newTheme = resolveTheme(
        typeof presetOrTokens === "string"
          ? { preset: presetOrTokens as ThemePreset }
          : { preset: "custom", overrides: presetOrTokens }
      );

      setCurrentPreset(preset);
      applyThemeToUI(newTheme);

      // 持久化到 settings.json
      const currentSettings = readSettings() ?? {};
      const newThemeSettings: ThemeSettings = {
        preset,
        ...(typeof presetOrTokens !== "string" ? { overrides: presetOrTokens } : {}),
      };
      writeSettings({ ...currentSettings, theme: newThemeSettings });
    },
    [applyThemeToUI]
  );

  /** 回退到 settings 中已保存的主题 */
  const revertTheme = useCallback(() => {
    const savedSettings = resolveCurrentSettings(projectRoot);
    const userSettings = readSettings();
    const projectSettings = readProjectSettings(projectRoot);
    setCurrentPreset((userSettings?.theme?.preset ?? projectSettings?.theme?.preset ?? "light") as ThemePreset);
    applyThemeToUI(savedSettings.theme);
  }, [projectRoot, applyThemeToUI]);

  return (
    <AppContext.Provider
      value={{ version, hasCustomThemeConfig, themeVersion, currentPreset, switchTheme, previewTheme, revertTheme }}
    >
      <ThemeProvider value={theme}>
        <RawModeProvider>
          <App initialPrompt={initialPrompt} projectRoot={projectRoot} onRestart={onRestart} />
        </RawModeProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
};

export default AppContainer;
