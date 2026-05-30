import type { ThemeTokens } from "./types";

/** 浅色主题（默认主题） */
export const LIGHT_THEME: ThemeTokens = {
  primary: "#229ac3",
  secondary: "#229ac3e6",
  success: "#1a7f37",
  error: "#d1242f",
  warning: "#fa8c16",
  info: "#0969da",
  text: "#3D4149",
  textDim: "#646A71",
  textBright: "#1F2329",
  code: "#787f8a",
  border: "#999",
  gradients: ["#229ac3", "#8250df"],
};

/** 暗色主题 */
export const DARK_THEME: ThemeTokens = {
  primary: "#229ac3",
  secondary: "#229ac3e6",
  success: "#3fb950",
  error: "#f85149",
  warning: "#d29922",
  info: "#58a6ff",
  text: "#c9d1d9",
  textDim: "#8b949e",
  textBright: "#f0f6fc",
  code: "#8b949e",
  border: "#30363d",
  gradients: ["#229ac3", "#8250df"],
};

/** Monokai 主题 */
export const MONOKAI_THEME: ThemeTokens = {
  primary: "#f92672",
  secondary: "#f92672cc",
  success: "#a6e22e",
  error: "#f92672",
  warning: "#fd971f",
  info: "#66d9ef",
  text: "#f8f8f2",
  textDim: "#75715e",
  textBright: "#f8f8f2",
  code: "#75715e",
  border: "#49483e",
  gradients: ["#f92672", "#ae81ff"],
};

/** Dracula 主题 */
export const DRACULA_THEME: ThemeTokens = {
  primary: "#bd93f9",
  secondary: "#bd93f9cc",
  success: "#50fa7b",
  error: "#ff5555",
  warning: "#ffb86c",
  info: "#8be9fd",
  text: "#f8f8f2",
  textDim: "#6272a4",
  textBright: "#f8f8f2",
  code: "#6272a4",
  border: "#44475a",
  gradients: ["#bd93f9", "#ff79c6"],
};

/** GitHub Light 主题 */
export const GITHUB_LIGHT_THEME: ThemeTokens = {
  primary: "#0969da",
  secondary: "#0969dae6",
  success: "#1a7f37",
  error: "#cf222e",
  warning: "#9a6700",
  info: "#0969da",
  text: "#1F2328",
  textDim: "#656d76",
  textBright: "#0d1117",
  code: "#656d76",
  border: "#d0d7de",
  gradients: ["#0969da", "#8250df"],
};

/** GitHub Dark 主题 */
export const GITHUB_DARK_THEME: ThemeTokens = {
  primary: "#58a6ff",
  secondary: "#58a6ffcc",
  success: "#3fb950",
  error: "#f85149",
  warning: "#d29922",
  info: "#58a6ff",
  text: "#c9d1d9",
  textDim: "#8b949e",
  textBright: "#f0f6fc",
  code: "#8b949e",
  border: "#30363d",
  gradients: ["#58a6ff", "#bc8cff"],
};

/** GitLab Light 主题 */
export const GITLAB_LIGHT_THEME: ThemeTokens = {
  primary: "#1068bf",
  secondary: "#1068bfe6",
  success: "#108548",
  error: "#dd2b0e",
  warning: "#c17d10",
  info: "#1068bf",
  text: "#1f1e24",
  textDim: "#626168",
  textBright: "#0f0e11",
  code: "#626168",
  border: "#dcdcde",
  gradients: ["#1068bf", "#694cc0"],
};

/** GitLab Dark 主题 */
export const GITLAB_DARK_THEME: ThemeTokens = {
  primary: "#63a0d4",
  secondary: "#63a0d4cc",
  success: "#26a269",
  error: "#e24329",
  warning: "#c17d10",
  info: "#63a0d4",
  text: "#ececef",
  textDim: "#a1a1a9",
  textBright: "#ffffff",
  code: "#a1a1a9",
  border: "#3b3b3f",
  gradients: ["#63a0d4", "#9785d4"],
};

/** 预设主题映射表 */
export const PRESETS: Record<string, ThemeTokens> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
  monokai: MONOKAI_THEME,
  dracula: DRACULA_THEME,
  "github-light": GITHUB_LIGHT_THEME,
  "github-dark": GITHUB_DARK_THEME,
  "gitlab-light": GITLAB_LIGHT_THEME,
  "gitlab-dark": GITLAB_DARK_THEME,
};
