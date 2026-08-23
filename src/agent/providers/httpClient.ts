// Bounded network I/O for model providers.
//
// React Native's fetch has NO default timeout: a stalled TCP connection (common
// on flaky mobile networks) hangs until the OS socket timeout, which can be
// minutes. In the planner that manifests as the UI sitting on "PLANNING"
// forever. Every provider request therefore goes through fetchWithTimeout so a
// slow reasoner is abandoned quickly and the router can fall through to the next
// one instead of stranding the user.

// Text reasoning on Groq/NVIDIA normally returns in 1-3s; 9s is a generous
// ceiling that still fails over well before a human gives up.
export const TEXT_REQUEST_TIMEOUT_MS = 9000;

// A screenshot + VLM round-trip is legitimately heavier (large base64 payload,
// slower model), so vision calls get a longer leash before we abort.
export const VISION_REQUEST_TIMEOUT_MS = 20000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = TEXT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
