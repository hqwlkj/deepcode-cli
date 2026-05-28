import { test } from "node:test";
import assert from "node:assert/strict";
import { getScopeRiskColor } from "../ui/views/PermissionPrompt";

test("getScopeRiskColor maps permission scopes by risk", () => {
  assert.equal(getScopeRiskColor("read-in-cwd"), "#52c41a");
  assert.equal(getScopeRiskColor("query-git-log"), "#52c41a");

  assert.equal(getScopeRiskColor("read-out-cwd"), "#faad14");
  assert.equal(getScopeRiskColor("write-in-cwd"), "#faad14");
  assert.equal(getScopeRiskColor("network"), "#faad14");
  assert.equal(getScopeRiskColor("mcp"), "#faad14");

  assert.equal(getScopeRiskColor("write-out-cwd"), "#ff4d4f");
  assert.equal(getScopeRiskColor("delete-in-cwd"), "#ff4d4f");
  assert.equal(getScopeRiskColor("delete-out-cwd"), "#ff4d4f");
  assert.equal(getScopeRiskColor("mutate-git-log"), "#ff4d4f");
  assert.equal(getScopeRiskColor("unknown"), "#ff4d4f");
});
