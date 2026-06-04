const DOCUMENTATION_CHOICES = {
  AGENTS: "agents",
  README: "readme",
  OPENSPEC: "openspec",
  TECHNICAL_DOCS: "technical-docs",
  ALL: "all",
  OTHER: "other",
} as const;

export type DocumentationChoice = (typeof DOCUMENTATION_CHOICES)[keyof typeof DOCUMENTATION_CHOICES];

const DOCUMENTATION_LOCALES = {
  EN: "en",
  ES: "es",
} as const;

export type DocumentationLocale = (typeof DOCUMENTATION_LOCALES)[keyof typeof DOCUMENTATION_LOCALES];

export interface DocumentationPromptPack {
  title: string;
  customPromptTitle: string;
  customPromptPlaceholder: string;
  options: string[];
}

export interface DocumentationChoiceMetadata {
  choice: DocumentationChoice;
  label: string;
  instruction: string;
}

export function detectDocumentationLocale(text: string): DocumentationLocale {
  const spanishPatterns = [
    /\bquiero\b/i,
    /\bdocumentaci[oó]n\b/i,
    /\bc[oó]digo\b/i,
    /\bproyecto\b/i,
    /\bincompleta\b/i,
  ] as const;

  return spanishPatterns.some((pattern) => pattern.test(text))
    ? DOCUMENTATION_LOCALES.ES
    : DOCUMENTATION_LOCALES.EN;
}

export function getDocumentationPromptPack(locale: DocumentationLocale): DocumentationPromptPack {
  if (locale === DOCUMENTATION_LOCALES.EN) {
    return {
      title: "Which documentation should we improve first? Examples: AGENTS.md for project context, README.md for human onboarding, OpenSpec for requirements and active changes.",
      customPromptTitle: "What documentation do you want exactly?",
      customPromptPlaceholder: "Example: AGENTS.md, API endpoints, local onboarding, payment architecture...",
      options: [
        "1. Operational project context (AGENTS.md) — stack, repository layout, commands, testing, constraints. Recommended when you want Pi to work better in this repo.",
        "2. Human overview (README.md) — project summary, setup, run instructions, onboarding basics.",
        "3. Specifications (OpenSpec) — domains, requirements, and active changes under openspec/.",
        "4. Technical documentation — modules, endpoints, services, architecture, and implementation notes.",
        "5. All of the above — make a plan and do them in order.",
        "6. Other — tell me exactly which documentation you want.",
      ],
    };
  }

  return {
    title: "¿Qué documentación quieres completar primero? Ejemplos: AGENTS.md para contexto operativo, README.md para onboarding humano y OpenSpec para requisitos y cambios activos.",
    customPromptTitle: "¿Qué documentación quieres exactamente?",
    customPromptPlaceholder: "Ejemplo: AGENTS.md, endpoints del API, onboarding local, arquitectura de pagos...",
    options: [
      "1. Contexto operativo del proyecto (AGENTS.md) — stack, estructura del repositorio, comandos, testing y restricciones. Recomendado cuando quieres que Pi trabaje mejor en este repo.",
      "2. Visión general humana (README.md) — resumen del proyecto, setup, ejecución y onboarding básico.",
      "3. Especificaciones (OpenSpec) — dominios, requisitos y cambios activos en openspec/.",
      "4. Documentación técnica — módulos, endpoints, servicios, arquitectura y notas de implementación.",
      "5. Todo lo anterior — hago un plan y lo trabajo en orden.",
      "6. Otro — dime exactamente qué documentación quieres.",
    ],
  };
}

export function mapDocumentationSelection(selection: string): DocumentationChoice {
  if (selection.startsWith("1.")) return DOCUMENTATION_CHOICES.AGENTS;
  if (selection.startsWith("2.")) return DOCUMENTATION_CHOICES.README;
  if (selection.startsWith("3.")) return DOCUMENTATION_CHOICES.OPENSPEC;
  if (selection.startsWith("4.")) return DOCUMENTATION_CHOICES.TECHNICAL_DOCS;
  if (selection.startsWith("5.")) return DOCUMENTATION_CHOICES.ALL;
  return DOCUMENTATION_CHOICES.OTHER;
}

export function getDocumentationChoiceMetadata(locale: DocumentationLocale): DocumentationChoiceMetadata[] {
  const promptPack = getDocumentationPromptPack(locale);
  const [agentsLabel, readmeLabel, openspecLabel, technicalLabel, allLabel, otherLabel] = promptPack.options;
  return [
    {
      choice: DOCUMENTATION_CHOICES.AGENTS,
      label: agentsLabel!,
      instruction: locale === DOCUMENTATION_LOCALES.EN
        ? "Prioritize AGENTS.md first for operational project context."
        : "Prioriza AGENTS.md primero para el contexto operativo del proyecto.",
    },
    {
      choice: DOCUMENTATION_CHOICES.README,
      label: readmeLabel!,
      instruction: locale === DOCUMENTATION_LOCALES.EN
        ? "Prioritize README.md first for human-facing onboarding."
        : "Prioriza README.md primero para el onboarding humano.",
    },
    {
      choice: DOCUMENTATION_CHOICES.OPENSPEC,
      label: openspecLabel!,
      instruction: locale === DOCUMENTATION_LOCALES.EN
        ? "Prioritize OpenSpec first for source-of-truth specifications."
        : "Prioriza OpenSpec primero para las especificaciones source-of-truth.",
    },
    {
      choice: DOCUMENTATION_CHOICES.TECHNICAL_DOCS,
      label: technicalLabel!,
      instruction: locale === DOCUMENTATION_LOCALES.EN
        ? "Prioritize targeted technical documentation first."
        : "Prioriza primero la documentación técnica específica.",
    },
    {
      choice: DOCUMENTATION_CHOICES.ALL,
      label: allLabel!,
      instruction: locale === DOCUMENTATION_LOCALES.EN
        ? "Create a plan and cover AGENTS, README, OpenSpec, and technical docs in order."
        : "Crea un plan y cubre AGENTS, README, OpenSpec y docs técnicas en orden.",
    },
    {
      choice: DOCUMENTATION_CHOICES.OTHER,
      label: otherLabel!,
      instruction: locale === DOCUMENTATION_LOCALES.EN
        ? "Use the user's custom documentation target exactly as clarified."
        : "Usa exactamente el objetivo de documentación que el usuario aclare.",
    },
  ];
}

export function buildDocumentationTransformPrompt(choice: DocumentationChoice, originalPrompt: string, customRequest?: string): string {
  switch (choice) {
    case DOCUMENTATION_CHOICES.AGENTS:
      return `The user asked: "${originalPrompt}". Prioritize operational project context. Analyze the repository shallowly and create or improve AGENTS.md first. Focus on stack, repository layout, services/packages, common commands, testing expectations, constraints, and a brief reference to openspec/specs and openspec/changes if OpenSpec exists. Do not default to writing README.md.`;
    case DOCUMENTATION_CHOICES.README:
      return `The user asked: "${originalPrompt}". Create or improve a human-facing README.md first. Focus on repository overview, setup, how to run the project, and onboarding basics. Do not use README as a substitute for AGENTS.md or OpenSpec.`;
    case DOCUMENTATION_CHOICES.OPENSPEC:
      return `The user asked: "${originalPrompt}". Focus first on the OpenSpec surface. Inspect openspec/specs and openspec/changes, identify gaps in source-of-truth behavior documentation, and improve specifications there instead of writing a general README.`;
    case DOCUMENTATION_CHOICES.TECHNICAL_DOCS:
      return `The user asked: "${originalPrompt}". Focus on technical documentation first: modules, endpoints, services, architecture, and implementation notes. Prefer targeted docs over a broad repository README.`;
    case DOCUMENTATION_CHOICES.ALL:
      return `The user asked: "${originalPrompt}". Make a documentation plan that covers, in order: 1) AGENTS.md for operational context, 2) README.md for human onboarding, 3) OpenSpec references/specifications if applicable, and 4) targeted technical docs. Ask before writing a broad README if the repo context is still unclear.`;
    case DOCUMENTATION_CHOICES.OTHER:
      return `The user asked: "${originalPrompt}". They clarified the documentation target as: "${customRequest ?? "No extra detail provided."}". Follow that clarification exactly and avoid defaulting to README if another documentation surface fits better.`;
  }
}

export { DOCUMENTATION_CHOICES };
