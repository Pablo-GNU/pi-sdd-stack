import { EngramStrictAdapter } from "../memory/engramStrictAdapter.js";

export async function runMemorySearch(query: string): Promise<string> {
  const adapter = new EngramStrictAdapter();
  const result = await adapter.search(query);
  return JSON.stringify(result, null, 2);
}
