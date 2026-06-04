import path from "node:path";
import { hasOpenSpecCli } from "../openspec/adapter.js";
import { readVerifyStatus, VERIFY_STATUSES } from "../sdd/verifyStatus.js";

export async function runArchive(cwd: string, slug: string): Promise<string> {
  const verifyStatus = await readVerifyStatus(cwd, slug);
  if (verifyStatus === VERIFY_STATUSES.FAIL) {
    throw new Error(`Verify status is fail for \"${slug}\". Return to apply, fix the implementation issues, and rerun verify before archive.`);
  }

  if (!(await hasOpenSpecCli(cwd))) {
    throw new Error(
      `OpenSpec CLI not detected for change \"${slug}\". Install or expose the CLI, then run the archive step explicitly. v0.1 does not merge specs manually without a tested adapter.`,
    );
  }

  return `OpenSpec CLI detected. Run archive for ${slug} from ${path.join(cwd, "openspec")}.`;
}
