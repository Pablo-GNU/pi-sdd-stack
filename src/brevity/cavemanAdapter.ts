const BREVITY_LEVELS = {
  OFF: "off",
  MICRO: "micro",
  LITE: "lite",
} as const;

export type BrevityLevel = (typeof BREVITY_LEVELS)[keyof typeof BREVITY_LEVELS];

export class CavemanAdapter {
  async isAvailable(): Promise<boolean> {
    return Boolean((globalThis as { __PI_SDD_CAVEMAN__?: unknown }).__PI_SDD_CAVEMAN__);
  }

  async apply(level: BrevityLevel, text: string, artifact = false): Promise<string> {
    if (artifact || level === BREVITY_LEVELS.OFF) {
      return text;
    }

    const caveman = (globalThis as { __PI_SDD_CAVEMAN__?: { rewrite?: (value: string, brevity: string) => Promise<string> } }).__PI_SDD_CAVEMAN__;
    if (caveman?.rewrite) {
      return caveman.rewrite(text, level);
    }

    if (level === BREVITY_LEVELS.MICRO) {
      return text.split(". ").slice(0, 2).join(". ");
    }

    return text;
  }
}
