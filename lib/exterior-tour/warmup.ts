/** An abortable quiet period: cancellation also clears the pending timer. */
export function waitForWarmup(ms: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Preview + useful detail for the likely next node BEFORE secondary previews.
 * At most one speculative panorama is downloading at a time. Signing/metadata
 * may stay shared, but image requests must subscribe with this run's signal.
 */
export async function warmNavigationCandidates(
  nodeIds: string[],
  signal: AbortSignal,
  warmPreview: (nodeId: string, signal: AbortSignal) => Promise<unknown>,
  warmFocus: (nodeId: string, signal: AbortSignal) => Promise<unknown>,
) {
  for (let index = 0; index < nodeIds.length; index += 1) {
    signal.throwIfAborted();
    try {
      await warmPreview(nodeIds[index], signal);
      signal.throwIfAborted();
      if (index === 0) await warmFocus(nodeIds[index], signal);
    } catch {
      signal.throwIfAborted();
      // A missing neighbour must not prevent preparing another valid exit.
    }
  }
}
