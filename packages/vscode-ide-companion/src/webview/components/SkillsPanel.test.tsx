/**
 * Unit tests for SkillsPanel component
 *
 * Tests cover:
 * - Disabled button when no skills available
 * - Enabled button when skills available
 * - CommandDialog open/close
 * - Skill selection and toggling
 * - Marking loaded skills as checked
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SkillsPanel from "./SkillsPanel";
import type { SkillInfo } from "@/webview/types";

vi.mock("./ui/input-group", () => ({
  InputGroupButton: vi.fn(
    ({
      children,
      disabled,
      onClick,
      ...props
    }: {
      children: React.ReactNode;
      disabled?: boolean;
      onClick?: () => void;
    }) => (
      <button data-testid="skills-trigger" disabled={disabled} onClick={onClick} {...props}>
        {children}
      </button>
    )
  ),
}));

vi.mock("./ui/command", () => ({
  Command: vi.fn(({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="command" {...props}>
      {children}
    </div>
  )),
  CommandDialog: vi.fn(
    ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) =>
      open ? (
        <div data-testid="command-dialog">
          <button data-testid="command-close" onClick={() => onOpenChange(false)}>
            Close
          </button>
          {children}
        </div>
      ) : null
  ),
  CommandEmpty: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-empty">{children}</div>
  )),
  CommandGroup: vi.fn(({ children, heading }: { children: React.ReactNode; heading: string }) => (
    <div data-testid="command-group" data-heading={heading}>
      {children}
    </div>
  )),
  CommandInput: vi.fn(({ placeholder }: { placeholder: string }) => (
    <input data-testid="command-input" placeholder={placeholder} />
  )),
  CommandItem: vi.fn(
    ({
      children,
      onSelect,
      ...props
    }: {
      children: React.ReactNode;
      onSelect?: () => void;
      [key: string]: unknown;
    }) => (
      <div data-testid="command-item" onClick={() => onSelect?.()} {...props}>
        {children}
      </div>
    )
  ),
  CommandList: vi.fn(({ children }: { children: React.ReactNode }) => <div data-testid="command-list">{children}</div>),
}));

vi.mock("lucide-react", () => ({
  GraduationCap: vi.fn(() => <span data-testid="grad-cap-icon" />),
}));

vi.mock("@/webview/utils", () => ({
  toTitleCase: vi.fn((s: string) =>
    s
      .split(/[-_]/)
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  ),
}));

const mockSkills: SkillInfo[] = [
  { name: "code-review", description: "Review code", path: "/skills/cr", isLoaded: false },
  { name: "test-gen", description: "Generate tests", path: "/skills/tg", isLoaded: true },
  { name: "refactor", description: "Refactor code", path: "/skills/ref", isLoaded: false },
];

describe("SkillsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders disabled button when no skills available", () => {
    render(<SkillsPanel availableSkills={[]} selectedSkills={[]} onToggle={vi.fn()} />);
    const trigger = screen.getByTestId("skills-trigger");
    expect(trigger).toBeDisabled();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByTestId("grad-cap-icon")).toBeInTheDocument();
  });

  it("renders enabled button when skills available", () => {
    render(<SkillsPanel availableSkills={mockSkills} selectedSkills={[]} onToggle={vi.fn()} />);
    const trigger = screen.getByTestId("skills-trigger");
    expect(trigger).not.toBeDisabled();
    expect(screen.getByText("Skills")).toBeInTheDocument();
  });

  it("opens CommandDialog when button clicked", () => {
    render(<SkillsPanel availableSkills={mockSkills} selectedSkills={[]} onToggle={vi.fn()} />);
    expect(screen.queryByTestId("command-dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("skills-trigger"));
    expect(screen.getByTestId("command-dialog")).toBeInTheDocument();
  });

  it("closes CommandDialog when onOpenChange called", () => {
    render(<SkillsPanel availableSkills={mockSkills} selectedSkills={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTestId("skills-trigger"));
    expect(screen.getByTestId("command-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("command-close"));
    expect(screen.queryByTestId("command-dialog")).not.toBeInTheDocument();
  });

  it("renders all available skills in command group", () => {
    render(<SkillsPanel availableSkills={mockSkills} selectedSkills={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTestId("skills-trigger"));

    const items = screen.getAllByTestId("command-item");
    expect(items).toHaveLength(3);
  });

  it("displays skill names in title case", () => {
    render(<SkillsPanel availableSkills={mockSkills} selectedSkills={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTestId("skills-trigger"));

    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.getByText("Test Gen")).toBeInTheDocument();
    expect(screen.getByText("Refactor")).toBeInTheDocument();
  });

  it("marks loaded skills as checked", () => {
    render(<SkillsPanel availableSkills={mockSkills} selectedSkills={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTestId("skills-trigger"));

    const items = screen.getAllByTestId("command-item");
    // test-gen is loaded (index 1)
    expect(items[1].getAttribute("data-checked")).toBe("true");
    // code-review is not loaded (index 0)
    expect(items[0].getAttribute("data-checked")).toBe("false");
  });

  it("marks selected skills as checked", () => {
    render(
      <SkillsPanel
        availableSkills={mockSkills}
        selectedSkills={[mockSkills[0]]} // code-review is selected
        onToggle={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("skills-trigger"));

    const items = screen.getAllByTestId("command-item");
    // code-review is selected (index 0)
    expect(items[0].getAttribute("data-checked")).toBe("true");
  });

  it("calls onToggle when a skill is selected", () => {
    const onToggle = vi.fn();
    render(<SkillsPanel availableSkills={mockSkills} selectedSkills={[]} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId("skills-trigger"));

    fireEvent.click(screen.getAllByTestId("command-item")[0]);
    expect(onToggle).toHaveBeenCalledWith(mockSkills[0]);
  });

  it("renders command input with search placeholder", () => {
    render(<SkillsPanel availableSkills={mockSkills} selectedSkills={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTestId("skills-trigger"));

    const input = screen.getByTestId("command-input");
    expect(input).toHaveAttribute("placeholder", "Search skills...");
  });

  it("renders empty state message", () => {
    render(<SkillsPanel availableSkills={mockSkills} selectedSkills={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTestId("skills-trigger"));

    expect(screen.getByTestId("command-empty")).toBeInTheDocument();
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });
});
