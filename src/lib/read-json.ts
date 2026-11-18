/** Stop consuming request data once it exceeds the route's body limit. */
export async function readJson(
  request: Request,
  limit: number,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(body + decoder.decode());
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
