import path from "node:path";
import { homedir } from "node:os";
import { pathExists, readText } from "../util/fs.js";
import { resolvePackageRoot } from "../util/runtimePaths.js";

export interface PhaseRoute {
  agent: string;
  model: string;
  thinking: string;
  "caveman-output": string;
}

export interface ModelRoutesConfig {
  version: number;
  phases: Record<string, PhaseRoute>;
}

function deepMerge(base: ModelRoutesConfig, override: Partial<ModelRoutesConfig>): ModelRoutesConfig {
  return {
    ...base,
    ...override,
    phases: { ...base.phases, ...(override.phases ?? {}) },
  };
}

interface LegacyModelProfile {
  provider: string;
  model: string;
  thinking: string;
}

interface LegacyPhaseRoute {
  agent: string;
  profile: string;
  brevity: string;
}

interface DirectPhaseRouteWithLegacyKey {
  agent: string;
  model: string;
  thinking: string;
  brevity?: string;
  "caveman-output"?: string;
}

interface LegacyModelRoutesConfig {
  version?: number;
  profiles?: Record<string, LegacyModelProfile>;
  phases?: Record<string, LegacyPhaseRoute>;
}

function normalizeModelValue(profile?: LegacyModelProfile): string {
  if (!profile || profile.model === "inherit") {
    return "inherit";
  }

  if (profile.model.includes("/")) {
    return profile.model;
  }

  if (profile.provider && profile.provider !== "inherit") {
    return `${profile.provider}/${profile.model}`;
  }

  return profile.model;
}

function normalizeConfig(raw: unknown): ModelRoutesConfig {
  if (!raw || typeof raw !== "object") {
    return { version: 1, phases: {} };
  }

  const candidate = raw as Partial<ModelRoutesConfig> & LegacyModelRoutesConfig;
  const rawPhases = candidate.phases ?? {};
  const hasDirectPhaseModel = Object.values(rawPhases).some((value) => typeof value === "object" && value !== null && "model" in value);

  if (hasDirectPhaseModel) {
    const normalizedPhases = Object.fromEntries(
      Object.entries(rawPhases).map(([phase, route]) => {
        const directRoute = route as DirectPhaseRouteWithLegacyKey;
        return [phase, {
          agent: directRoute.agent,
          model: directRoute.model,
          thinking: directRoute.thinking,
          "caveman-output": directRoute["caveman-output"] ?? directRoute.brevity ?? "off",
        } satisfies PhaseRoute];
      }),
    );
    return {
      version: candidate.version ?? 1,
      phases: normalizedPhases,
    };
  }

  const legacyProfiles = candidate.profiles ?? {};
  const normalizedPhases = Object.fromEntries(
    Object.entries(rawPhases).map(([phase, route]) => {
      const legacyRoute = route as LegacyPhaseRoute;
      const profile = legacyProfiles[legacyRoute.profile];
      return [phase, {
        agent: legacyRoute.agent,
        model: normalizeModelValue(profile),
        thinking: profile?.thinking ?? "inherit",
        "caveman-output": legacyRoute.brevity,
      } satisfies PhaseRoute];
    }),
  );

  return {
    version: candidate.version ?? 1,
    phases: normalizedPhases,
  };
}

export class ModelRouter {
  constructor(private readonly routes: ModelRoutesConfig) {}

  static emptyConfig(): ModelRoutesConfig {
    return { version: 1, phases: {} };
  }

  static defaultConfigPath(moduleUrl: string): string {
    return path.join(resolvePackageRoot(moduleUrl), "assets", "models", "default-routes.json");
  }

  static userConfigPath(): string {
    return path.join(homedir(), ".pi", "sdd-stack", "models.json");
  }

  static async loadDefaults(moduleUrl: string): Promise<ModelRoutesConfig> {
    const defaultsPath = ModelRouter.defaultConfigPath(moduleUrl);
    if (!pathExists(defaultsPath)) {
      return ModelRouter.emptyConfig();
    }

    return normalizeConfig(JSON.parse((await readText(defaultsPath)) ?? '{"version":1,"phases":{}}'));
  }

  static async create(moduleUrl: string, repoRoot?: string): Promise<ModelRouter> {
    const defaults = await ModelRouter.loadDefaults(moduleUrl);
    const overridePath = ModelRouter.userConfigPath();
    const override = pathExists(overridePath)
      ? normalizeConfig(JSON.parse((await readText(overridePath)) ?? "{}"))
      : ModelRouter.emptyConfig();
    return new ModelRouter(deepMerge(defaults, override));
  }

  getPhaseRoute(phase: string): PhaseRoute | undefined {
    return this.routes.phases[phase];
  }

  getConfig(): ModelRoutesConfig {
    return this.routes;
  }
}
