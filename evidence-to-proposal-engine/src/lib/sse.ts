/* Client-side Server-Sent Events reader over fetch().
   Parses `data: <json>\n\n` frames and invokes onEvent for each. Throws on a
   non-OK HTTP response (with the server's error message when available). */
export async function readSse(
  res: Response,
  onEvent: (data: unknown) => void
): Promise<void> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && (body as { error?: string }).error) msg = (body as { error: string }).error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  if (!res.body) throw new Error("No response body to stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload));
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}
