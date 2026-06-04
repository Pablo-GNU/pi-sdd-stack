import path from "node:path";
import { getChangePaths } from "../openspec/changePaths.js";
import { EngramStrictAdapter } from "../memory/engramStrictAdapter.js";
import { assessVerifyStatus, readVerifyStatus, VERIFY_STATUSES } from "../sdd/verifyStatus.js";
import { describeTddMode, readTddMode } from "../testing/tddMode.js";
import { readText, writeText } from "../util/fs.js";
import { resolvePackageRoot } from "../util/runtimePaths.js";

export async function runVerify(cwd: string, slug: string): Promise<string> {
  const tddMode = await readTddMode(cwd);
  const previousStatus = await readVerifyStatus(cwd, slug);
  const packageRoot = resolvePackageRoot(import.meta.url);
  const template = await readText(path.join(packageRoot, "assets", "openspec-schema", "pi-sdd-stack", "templates", "verify.md"));
  if (!template) {
    throw new Error("Verify template is missing.");
  }
  const paths = getChangePaths(cwd, slug);
  const title = slug.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase());
  const assessment = await assessVerifyStatus(cwd, slug);
  const content = template
    .replaceAll("{{title}}", title)
    .replaceAll("{{slug}}", slug)
    .replaceAll("{{status}}", assessment.status)
    .replaceAll("{{nextPhase}}", assessment.recommendedNextPhase)
    .replaceAll("{{summary}}", assessment.summary);
  await writeText(paths.verify, content);

  if (previousStatus === VERIFY_STATUSES.FAIL && assessment.status === VERIFY_STATUSES.PASS) {
    const engram = new EngramStrictAdapter();
    if (await engram.isAvailable()) {
      await engram.saveStrict({
        category: "bug_fix",
        title: `Resolved verification failure for ${slug}`,
        summary: `Implementation issues identified during verify were resolved and the change now passes verification.`,
        rootCause: "Previous verification reported blocking implementation issues or incomplete evidence.",
        fix: "Applied follow-up implementation changes and reran verification until it passed.",
        evidence: [path.relative(cwd, paths.verify), path.relative(cwd, path.join(paths.root, "apply-progress.md"))],
        references: [path.relative(cwd, paths.tasks), path.relative(cwd, paths.design)],
        capturePrompt: false,
      });
    }
  }

  const diagnostics = [
    ...assessment.failures.map((entry) => `failure: ${entry}`),
    ...assessment.warnings.map((entry) => `warning: ${entry}`),
  ];

  return [
    path.relative(cwd, paths.verify),
    `tdd-mode=${tddMode}`,
    describeTddMode(tddMode),
    `status=${assessment.status}`,
    `recommended-next-phase=${assessment.recommendedNextPhase}`,
    ...diagnostics,
  ].join("\n");
}
