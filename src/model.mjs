/**
 * The only place that knows how to call a host-provided model hook.
 * Keeping abort and timeout handling here prevents the two recollection
 * paths (cue recall and solitude) from drifting apart.
 */
export async function callModel(hook, request, {signal, timeoutMs, label}) {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error(label + ' interrupted'));
  signal.addEventListener('abort', abort, {once: true});
  if (signal.aborted) abort();
  const timer = setTimeout(() => controller.abort(new Error(label + ' timeout')), timeoutMs);
  let onAbort;
  try {
    const cancelled = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, {once: true});
      if (controller.signal.aborted) onAbort();
    });
    return await Promise.race([
      Promise.resolve().then(() => hook({...request, signal: controller.signal})),
      cancelled,
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
