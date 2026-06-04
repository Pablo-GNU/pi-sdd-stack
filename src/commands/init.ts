import path from "node:path";
import { generateAgentsFile } from "../init/agentsFile.js";
import { scanProject } from "../init/projectScanner.js";
import { ModelRouter } from "../models/modelRouter.js";
import { installOpenSpecSchema } from "../openspec/schemaInstaller.js";
import { ensureDir, writeText, writeYaml } from "../util/fs.js";
import { assertRequirements } from "../util/requirements.js";
import { resolvePackageRoot } from "../util/runtimePaths.js";

export interface InitOptions {
  withIntegrations?: boolean;
  forceAgentsSuggestion?: boolean;
  skipOpenSpec?: boolean;
}

function parseInitArgs(args: string): InitOptions {
  return {
    withIntegrations: args.includes("--with-integrations"),
    forceAgentsSuggestion: args.includes("--force-agents-suggestion"),
    skipOpenSpec: args.includes("--skip-openspec"),
  };
}

export async function runInit(cwd: string, args: string): Promise<string> {
  const options = parseInitArgs(args);
  const scan = await scanProject(cwd);
  await assertRequirements(scan.root);
  const packageRoot = resolvePackageRoot(import.meta.url);
  const agentsOptions: {
    repoRoot: string;
    scan: typeof scan;
    templatePath: string;
    forceSuggestion?: boolean;
  } = {
    repoRoot: scan.root,
    scan,
    templatePath: path.join(packageRoot, "assets", "project", "AGENTS.template.md"),
  };
  if (options.forceAgentsSuggestion) {
    agentsOptions.forceSuggestion = true;
  }
  const agentsResult = await generateAgentsFile({
    ...agentsOptions,
  });

  const projectDir = path.join(scan.root, ".pi", "sdd-stack");
  await ensureDir(path.join(projectDir, "cache"));
  await writeText(path.join(projectDir, "cache", ".gitkeep"), "");
  await writeYaml(path.join(projectDir, "project-profile.yaml"), scan);
  await writeYaml(path.join(projectDir, "settings.yaml"), {
    version: 1,
    stack: "pi-sdd-stack",
    integrations: {
      engram: false,
      caveman: false,
      subagents: false,
    },
    openspec: {
      schema: "pi-sdd-stack",
      createConfigIfMissing: true,
    },
    memory: {
      mode: "strict",
    },
    models: {
      userRoutesPath: "~/.pi/sdd-stack/models.json",
    },
  });
  const defaultModelConfig = await ModelRouter.loadDefaults(import.meta.url);
  await writeText(
    ModelRouter.userConfigPath(),
    `${JSON.stringify(defaultModelConfig, null, 2)}\n`,
  );

  const schemaOptions: { repoRoot: string; skipOpenSpec?: boolean } = { repoRoot: scan.root };
  if (options.skipOpenSpec) {
    schemaOptions.skipOpenSpec = true;
  }
  const schemaResult = await installOpenSpecSchema(import.meta.url, schemaOptions);

  const notes = [
    `AGENTS: ${agentsResult.mode} ${agentsResult.status} at ${path.relative(scan.root, agentsResult.targetPath)}`,
    `project profile: .pi/sdd-stack/project-profile.yaml`,
    `settings: .pi/sdd-stack/settings.yaml`,
    `models: ${ModelRouter.userConfigPath()}`,
    `openspec: ${schemaResult.skipped ? "skipped" : `ready at ${path.relative(scan.root, schemaResult.schemaPath ?? scan.root)}`}`,
  ];

  if (options.withIntegrations) {
    notes.push("optional integrations requested: install step must be wired explicitly by the host command runner in a later iteration");
  }

  return notes.join("\n");
}
