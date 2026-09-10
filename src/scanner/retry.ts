export async function retry<T>(
  task: () => Promise<T>,
  maxRetries: number,
  delayMs: number,
): Promise<{ value: T; retryCount: number }> {
  let last: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return { value: await task(), retryCount: attempt };
    } catch (error) {
      last = error;
      if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw last;
}
