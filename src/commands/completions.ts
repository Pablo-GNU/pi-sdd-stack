import path from "node:path";
import { listDir, pathExists } from "../util/fs.js";

interface AutocompleteItemLike {
  value: string;
  label: string;
  description?: string;
}

const INIT_FLAGS = {
  WITH_INTEGRATIONS: "--with-integrations",
  FORCE_AGENTS_SUGGESTION: "--force-agents-suggestion",
  SKIP_OPENSPEC: "--skip-openspec",
} as const;

const INIT_FLAG_ITEMS: AutocompleteItemLike[] = [
  {
    value: INIT_FLAGS.WITH_INTEGRATIONS,
    label: INIT_FLAGS.WITH_INTEGRATIONS,
    description: "Request explicit optional integration install flow.",
  },
  {
    value: INIT_FLAGS.FORCE_AGENTS_SUGGESTION,
    label: INIT_FLAGS.FORCE_AGENTS_SUGGESTION,
    description: "Write .pi/sdd-stack/AGENTS.suggested.md even if AGENTS.md is missing.",
  },
  {
    value: INIT_FLAGS.SKIP_OPENSPEC,
    label: INIT_FLAGS.SKIP_OPENSPEC,
    description: "Skip OpenSpec schema installation.",
  },
];

export async function completeInitArgs(prefix: string): Promise<AutocompleteItemLike[] | null> {
  const trimmed = prefix.trim();
  const filtered = INIT_FLAG_ITEMS.filter((item) => item.value.startsWith(trimmed));
  return filtered.length > 0 ? filtered : null;
}

async function readChangeSlugs(cwd: string): Promise<string[]> {
  const changesRoot = path.join(cwd, "openspec", "changes");
  if (!pathExists(changesRoot)) {
    return [];
  }

  const entries = await listDir(changesRoot);
  const slugs: string[] = [];
  for (const entry of entries) {
    if (pathExists(path.join(changesRoot, entry))) {
      slugs.push(entry);
    }
  }

  return slugs.sort();
}

export async function completeChangeSlug(cwd: string, prefix: string, description: string): Promise<AutocompleteItemLike[] | null> {
  const trimmed = prefix.trim();
  const slugs = await readChangeSlugs(cwd);
  const filtered = slugs
    .filter((slug) => slug.startsWith(trimmed))
    .map((slug) => ({
      value: slug,
      label: slug,
      description,
    }));

  return filtered.length > 0 ? filtered : null;
}
