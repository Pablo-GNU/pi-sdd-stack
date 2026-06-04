import { readText, writeText } from "../util/fs.js";

export async function writeIfDifferent(targetPath: string, content: string): Promise<"created" | "updated" | "unchanged"> {
  const existing = await readText(targetPath);
  if (existing === undefined) {
    await writeText(targetPath, content);
    return "created";
  }

  if (existing === content) {
    return "unchanged";
  }

  await writeText(targetPath, content);
  return "updated";
}
