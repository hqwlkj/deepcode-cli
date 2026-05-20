import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import type { SessionMessage } from "../session";

type Props = {
  messages: SessionMessage[];
  rewindImpact: Map<string, { fileChangeCount: number; untrackableCount: number }>;
  onSelect: (messageId: string) => void;
  onCancel: () => void;
};

const ROLE_LABELS: Record<string, string> = {
  user: "You",
  assistant: "Assistant",
};

/**
 * Interactive list that lets the user pick a message to rewind to.
 * Navigation mirrors SessionList: up/down arrows, Enter to select, Esc to cancel.
 */
export function RewindMessageList({ messages, rewindImpact, onSelect, onCancel }: Props): React.ReactElement {
  const [index, setIndex] = useState(0);
  const { columns, rows } = useWindowSize();

  const maxVisible = useMemo(() => {
    const reservedLines = 8;
    const linesPerItem = 2;
    const available = Math.max(0, Math.min(rows, 30) - reservedLines);
    return Math.max(1, Math.floor(available / linesPerItem));
  }, [rows]);

  const safeIndex = useMemo(() => {
    if (messages.length === 0) return 0;
    return Math.max(0, Math.min(index, messages.length - 1));
  }, [index, messages.length]);

  const scrollOffset = useMemo(() => {
    if (safeIndex < maxVisible) return 0;
    return safeIndex - maxVisible + 1;
  }, [safeIndex, maxVisible]);

  const visibleMessages = useMemo(() => {
    return messages.slice(scrollOffset, scrollOffset + maxVisible);
  }, [messages, scrollOffset, maxVisible]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && (input === "c" || input === "C"))) {
      onCancel();
      return;
    }
    if (messages.length === 0) {
      return;
    }
    if (key.upArrow) {
      setIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((i) => Math.min(messages.length - 1, i + 1));
      return;
    }
    if (key.pageUp) {
      setIndex((i) => Math.max(0, i - maxVisible));
      return;
    }
    if (key.pageDown) {
      setIndex((i) => Math.min(messages.length - 1, i + maxVisible));
      return;
    }
    if (key.home) {
      setIndex(0);
      return;
    }
    if (key.end) {
      setIndex(messages.length - 1);
      return;
    }
    if (key.return) {
      const message = messages[safeIndex];
      if (message) {
        onSelect(message.id);
      }
    }
  });

  if (messages.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No messages to rewind to.</Text>
        <Text dimColor>Press Esc to go back.</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      width={Math.max(20, columns - 6)}
      height={Math.max(5, Math.min(rows - 1, 30))}
      overflow="hidden"
      paddingX={1}
      marginTop={1}
    >
      <Box flexDirection="column" borderStyle="round" borderDimColor flexGrow={1} overflow="hidden">
        {/* Header */}
        <Box paddingX={1}>
          <Text bold color="cyanBright">
            Select message to rewind to
          </Text>
          <Text bold color="#229ac3">
            {" "}
            ({messages.length} messages)
          </Text>
        </Box>

        {/* Message list */}
        <Box
          borderTop={true}
          borderBottom={true}
          borderLeft={false}
          borderRight={false}
          borderStyle="round"
          borderDimColor
          flexDirection="column"
          flexGrow={1}
          paddingX={1}
          overflow="hidden"
        >
          {visibleMessages.map((message, i) => {
            const actualIndex = scrollOffset + i;
            const roleLabel = ROLE_LABELS[message.role] ?? message.role;
            const preview = formatMessagePreview(message.content ?? "", 60);
            const time = formatTimestamp(message.createTime);
            const impact = rewindImpact.get(message.id);
            const fileChanges = impact?.fileChangeCount ?? 0;
            const untracked = impact?.untrackableCount ?? 0;
            return (
              <Box key={message.id} height={2} marginBottom={1}>
                <Box>
                  <Text color="#229ac3">{actualIndex === safeIndex ? "> " : "  "}</Text>
                </Box>
                <Box flexDirection="column" flexGrow={1}>
                  <Box width="100%">
                    <Text
                      {...(actualIndex === safeIndex ? { bold: true } : {})}
                      color={actualIndex === safeIndex ? "#229ac3" : undefined}
                    >
                      {roleLabel}
                    </Text>
                    {time ? <Text dimColor> ({time})</Text> : null}
                    {fileChanges > 0 ? (
                      <Text color="yellow">
                        {" "}
                        -- will revert {fileChanges} file change{fileChanges > 1 ? "s" : ""}
                      </Text>
                    ) : null}
                    {untracked > 0 ? (
                      <Text color="red">
                        {" "}
                        + {untracked} untrackable command{untracked > 1 ? "s" : ""}
                      </Text>
                    ) : null}
                  </Box>
                  <Box width="100%">
                    <Text dimColor>{preview}</Text>
                  </Box>
                </Box>
              </Box>
            );
          })}

          {/* Scroll indicator */}
          {scrollOffset > 0 || scrollOffset + maxVisible < messages.length ? (
            <Box marginTop={1}>
              {scrollOffset > 0 ? <Text dimColor>… {scrollOffset} newer messages above. </Text> : null}
              {scrollOffset + maxVisible < messages.length ? (
                <Text dimColor>… {messages.length - scrollOffset - maxVisible} older messages below.</Text>
              ) : null}
            </Box>
          ) : null}
        </Box>

        {/* Footer */}
        <Box>
          <Text dimColor>↑/↓ navigate · PgUp/PgDn page · Home/End jump · Enter select · Esc cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}

function formatTimestamp(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      return "";
    }
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatMessagePreview(content: string, max = 60): string {
  const singleLine = content.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (singleLine.length <= max) {
    return singleLine;
  }
  return `${singleLine.slice(0, max)}…`;
}
