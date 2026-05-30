import React, { useMemo } from "react";
import { Box } from "ink";

type Props<T> = {
  items: T[];
  themeVersion: number;
  /** 当此值变化时强制重新挂载，用于清除终端旧内容（如 /new 切换会话） */
  resetKey?: number;
  children: (item: T, index: number) => React.ReactNode;
};

/**
 * 支持主题重新渲染的 Static 组件。
 *
 * Ink 的 <Static> 组件只渲染新增的 items，已渲染的 items 不会重新渲染。
 * 这个组件始终渲染所有 items，使用 key={themeVersion}:{resetKey} 在主题变化或内容重置时强制重新挂载。
 */
export default function ThemeableStatic<T>({
  items,
  themeVersion,
  resetKey,
  children: render,
}: Props<T>): React.ReactElement {
  const children = useMemo(() => {
    return items.map((item, index) => render(item, index));
  }, [items, render]);

  const compositeKey = `${themeVersion}:${resetKey ?? 0}`;

  return (
    <Box key={compositeKey} flexDirection="column">
      {children}
    </Box>
  );
}
