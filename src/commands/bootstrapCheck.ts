import { inspectRequirements } from "../util/requirements.js";

export async function runBootstrapCheck(cwd: string): Promise<string> {
  const report = await inspectRequirements(cwd);
  const lines = [
    "pi-sdd-stack bootstrap check",
    "",
    `status: ${report.allOk ? "ready" : "missing requirements"}`,
    "",
    "requirements:",
    ...report.statuses.map((status) => `- ${status.id}: ${status.ok ? "ok" : "missing"}`),
  ];

  const missing = report.statuses.filter((status) => !status.ok);
  if (missing.length > 0) {
    lines.push("", "install steps:");
    lines.push(...missing.map((status) => `- ${status.install}`));
  }

  return lines.join("\n");
}
