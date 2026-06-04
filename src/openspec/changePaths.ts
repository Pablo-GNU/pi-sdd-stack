import path from "node:path";

export interface ChangePaths {
  root: string;
  prd: string;
  proposal: string;
  design: string;
  tasks: string;
  verify: string;
  specsDir: string;
}

export function getChangePaths(repoRoot: string, slug: string): ChangePaths {
  const root = path.join(repoRoot, "openspec", "changes", slug);
  return {
    root,
    prd: path.join(root, "prd.md"),
    proposal: path.join(root, "proposal.md"),
    design: path.join(root, "design.md"),
    tasks: path.join(root, "tasks.md"),
    verify: path.join(root, "verify.md"),
    specsDir: path.join(root, "specs"),
  };
}
