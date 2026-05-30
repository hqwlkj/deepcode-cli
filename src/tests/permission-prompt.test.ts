import { test } from "node:test";
import assert from "node:assert/strict";
import { getScopeRiskColor } from "../ui/views/PermissionPrompt";
import { LIGHT_THEME } from "../ui/theme";

test("getScopeRiskColor maps permission scopes by risk", () => {
  assert.equal(getScopeRiskColor("read-in-cwd"), LIGHT_THEME.success);
  assert.equal(getScopeRiskColor("query-git-log"), LIGHT_THEME.success);

  assert.equal(getScopeRiskColor("read-out-cwd"), LIGHT_THEME.warning);
  assert.equal(getScopeRiskColor("write-in-cwd"), LIGHT_THEME.warning);
  assert.equal(getScopeRiskColor("network"), LIGHT_THEME.warning);
  assert.equal(getScopeRiskColor("mcp"), LIGHT_THEME.warning);

  assert.equal(getScopeRiskColor("write-out-cwd"), LIGHT_THEME.error);
  assert.equal(getScopeRiskColor("delete-in-cwd"), LIGHT_THEME.error);
  assert.equal(getScopeRiskColor("delete-out-cwd"), LIGHT_THEME.error);
  assert.equal(getScopeRiskColor("mutate-git-log"), LIGHT_THEME.error);
  assert.equal(getScopeRiskColor("unknown"), LIGHT_THEME.error);
});
