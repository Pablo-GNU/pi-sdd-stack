import { spawn } from "node:child_process";
import { loadDefaultMemoryPolicy, validateMemoryWrite } from "./memoryPolicy.js";
import type { MemoryWriteRequest } from "./memoryTypes.js";

export class EngramStrictAdapter {
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn("engram", ["version"], { stdio: "ignore" });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
  }

  async search(query: string): Promise<unknown> {
    if (!(await this.isAvailable())) {
      return {
        available: false,
        message: "Engram CLI is not available. Install the `engram` binary if you want explicit memory search support.",
      };
    }

    return new Promise((resolve) => {
      const chunks: string[] = [];
      const errors: string[] = [];
      const child = spawn("engram", ["search", query], { stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", (chunk) => chunks.push(String(chunk)));
      child.stderr.on("data", (chunk) => errors.push(String(chunk)));
      child.on("error", (error) => resolve({ available: false, message: error.message }));
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ available: true, output: chunks.join("").trim() });
          return;
        }

        resolve({ available: false, message: errors.join("").trim() || "Engram search failed." });
      });
    });
  }

  async saveStrict(request: MemoryWriteRequest): Promise<unknown> {
    const policy = await loadDefaultMemoryPolicy(import.meta.url);
    const validation = validateMemoryWrite(policy, request);
    if (!validation.allowed) {
      throw new Error(validation.error);
    }

    if (!(await this.isAvailable())) {
      return {
        available: false,
        message: "Engram CLI is not available. Install the `engram` binary if you want explicit memory saves.",
        request: validation.normalized,
      };
    }

    return new Promise((resolve) => {
      const errors: string[] = [];
      const child = spawn(
        "engram",
        ["save", validation.normalized.title, validation.normalized.summary, "--type", validation.normalized.category],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      child.stderr.on("data", (chunk) => errors.push(String(chunk)));
      child.on("error", (error) => resolve({ available: false, message: error.message, request: validation.normalized }));
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ available: true, saved: true, request: validation.normalized });
          return;
        }

        resolve({ available: false, message: errors.join("").trim() || "Engram save failed.", request: validation.normalized });
      });
    });
  }
}
