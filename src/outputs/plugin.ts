import type { DigestResult } from "../types.js";

export interface OutputPlugin {
  name: string;
  enabled: boolean;
  send(digest: DigestResult): Promise<void>;
}
