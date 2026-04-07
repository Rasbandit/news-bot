import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { FeedsConfig, PromptConfig, OutputsConfig, InterestsConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, "../config");

function loadYaml<T>(filename: string): T {
  const content = readFileSync(resolve(CONFIG_DIR, filename), "utf-8");
  return parse(content) as T;
}

function resolveEnvVars(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? "");
  }
  if (Array.isArray(obj)) return obj.map(resolveEnvVars);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, resolveEnvVars(v)])
    );
  }
  return obj;
}

export function loadFeedsConfig(): FeedsConfig {
  return loadYaml<FeedsConfig>("feeds.yaml");
}

export function loadPromptsConfig(): PromptConfig {
  return loadYaml<PromptConfig>("prompts.yaml");
}

export function loadOutputsConfig(): OutputsConfig {
  return resolveEnvVars(loadYaml("outputs.yaml")) as OutputsConfig;
}

export function formatInterests(interests: InterestsConfig): string {
  const lines: string[] = [];
  if (interests.boost.length) {
    lines.push("BOOST: " + interests.boost.join(", "));
  }
  if (interests.deprioritize.length) {
    lines.push("DEPRIORITIZE: " + interests.deprioritize.join(", "));
  }
  return lines.join("\n");
}
