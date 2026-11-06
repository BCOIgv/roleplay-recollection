const transientWindowsErrors = new Set(['EPERM', 'EACCES', 'EBUSY']);
const waitBuffer = new Int32Array(new SharedArrayBuffer(4));

// Windows may briefly keep an empty directory in delete-pending state.
// Retry only the filesystem operation, never the surrounding transaction.
export function retryWindowsFileOperation(operation, timeoutMs = 250, platform = process.platform) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try { return operation(); }
    catch (error) {
      if (platform !== 'win32' || !transientWindowsErrors.has(error.code) || Date.now() >= deadline) throw error;
      Atomics.wait(waitBuffer, 0, 0, 2);
    }
  }
}
