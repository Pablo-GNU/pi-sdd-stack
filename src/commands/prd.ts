import path from "node:path";
import { getChangePaths } from "../openspec/changePaths.js";
import { readText, writeText } from "../util/fs.js";
import { resolvePackageRoot } from "../util/runtimePaths.js";

function renderTemplate(template: string, slug: string): string {
  const title = slug.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase());
  return template.replaceAll("{{title}}", title).replaceAll("{{slug}}", slug);
}

export async function runPrd(cwd: string, slug: string): Promise<string> {
  const packageRoot = resolvePackageRoot(import.meta.url);
  const templatePath = path.join(packageRoot, "assets", "openspec-schema", "pi-sdd-stack", "templates", "prd.md");
  const template = await readText(templatePath);
  if (!template) throw new Error("PRD template is missing.");
  const paths = getChangePaths(cwd, slug);
  await writeText(paths.prd, renderTemplate(template, slug));
  return path.relative(cwd, paths.prd);
}
