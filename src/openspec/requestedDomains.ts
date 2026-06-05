import YAML from "yaml";
import { readText, writeText } from "../util/fs.js";
import { getChangePaths } from "./changePaths.js";

interface RequestedDomainsFrontmatter {
  requestedDomains?: unknown;
  [key: string]: unknown;
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractFrontmatterBlock(content: string): { raw: string; body: string } | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return undefined;
  }

  return {
    raw: match[1] ?? "",
    body: content.slice(match[0].length),
  };
}

export function parseRequestedDomainsFromPrd(content?: string): string[] {
  if (!content) {
    return [];
  }

  const frontmatter = extractFrontmatterBlock(content);
  if (!frontmatter) {
    return [];
  }

  try {
    const parsed = YAML.parse(frontmatter.raw) as RequestedDomainsFrontmatter | null;
    if (!parsed || !Array.isArray(parsed.requestedDomains)) {
      return [];
    }

    return [...new Set(
      parsed.requestedDomains
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => normalizeDomain(entry))
        .filter((entry) => entry.length > 0),
    )];
  } catch {
    return [];
  }
}

function parseRequestedDomainsInput(input: string[] | string): string[] {
  if (Array.isArray(input)) {
    return [...new Set(input.map((entry) => normalizeDomain(entry)).filter((entry) => entry.length > 0))];
  }

  return [...new Set(
    input
      .split(/[\s,]+/)
      .map((entry) => normalizeDomain(entry))
      .filter((entry) => entry.length > 0),
  )];
}

function serializeFrontmatter(data: RequestedDomainsFrontmatter): string {
  return `---\n${YAML.stringify(data).trimEnd()}\n---`;
}

function joinFrontmatterAndBody(frontmatter: string, body: string): string {
  if (body.length === 0) {
    return `${frontmatter}\n`;
  }

  return body.startsWith("\n") ? `${frontmatter}\n${body}` : `${frontmatter}\n\n${body}`;
}

function buildDefaultPrdBody(slug: string): string {
  const title = slug.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase());
  return `# PRD: ${title}\n`;
}

export async function readRequestedDomainsForChange(repoRoot: string, slug: string): Promise<string[]> {
  const prdContent = await readText(getChangePaths(repoRoot, slug).prd);
  return parseRequestedDomainsFromPrd(prdContent);
}

export async function writeRequestedDomainsForChange(repoRoot: string, slug: string, input: string[] | string): Promise<{ domains: string[]; updated: boolean }> {
  const prdPath = getChangePaths(repoRoot, slug).prd;
  const nextDomains = parseRequestedDomainsInput(input);
  const currentContent = await readText(prdPath);

  if (!currentContent) {
    const nextContent = joinFrontmatterAndBody(serializeFrontmatter({ requestedDomains: nextDomains }), buildDefaultPrdBody(slug));
    await writeText(prdPath, nextContent);
    return { domains: nextDomains, updated: true };
  }

  const block = extractFrontmatterBlock(currentContent);
  if (!block) {
    const nextContent = joinFrontmatterAndBody(serializeFrontmatter({ requestedDomains: nextDomains }), currentContent);
    await writeText(prdPath, nextContent);
    return { domains: nextDomains, updated: true };
  }

  let parsed: RequestedDomainsFrontmatter | null;
  try {
    parsed = YAML.parse(block.raw) as RequestedDomainsFrontmatter | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown YAML parse error.";
    throw new Error(`Could not update requestedDomains in ${prdPath}: invalid YAML frontmatter (${message})`);
  }

  if (parsed && (typeof parsed !== "object" || Array.isArray(parsed))) {
    throw new Error(`Could not update requestedDomains in ${prdPath}: frontmatter must be a YAML object.`);
  }

  const nextFrontmatter = {
    ...(parsed ?? {}),
    requestedDomains: nextDomains,
  } satisfies RequestedDomainsFrontmatter;
  const nextContent = joinFrontmatterAndBody(serializeFrontmatter(nextFrontmatter), block.body);
  if (nextContent === currentContent) {
    return { domains: nextDomains, updated: false };
  }

  await writeText(prdPath, nextContent);
  return { domains: nextDomains, updated: true };
}
