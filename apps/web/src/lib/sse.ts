import { API_URL, buildUrl, parseResponse } from './api-shared';

/**
 * POST something and read the Server-Sent Events that come back.
 *
 * `EventSource` is not usable here: it only issues GET requests and cannot
 * carry a body, and the message being sent is a body. So this is a plain
 * `fetch` whose response stream is decoded by hand.
 *
 * A NON-STREAMING RESPONSE IS NOT A STREAM. If the server answers with an
 * error status the body is JSON, not events, so it is parsed as an ordinary
 * API response — which raises the same `ApiError` every other call raises,
 * rather than a parser failing strangely three frames in.
 */

export interface SseHandlers {
  /** Called for each event, with the event name and its decoded JSON payload. */
  onEvent: (event: string, data: Record<string, unknown>) => void;
  signal?: AbortSignal;
}

export async function postEventStream(
  path: string,
  body: unknown,
  handlers: SseHandlers,
): Promise<void> {
  const response = await fetch(buildUrl(path, API_URL), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    ...(handlers.signal ? { signal: handlers.signal } : {}),
  });

  if (!response.ok || !response.body) {
    // Throws ApiError with the server's code and message.
    await parseResponse<unknown>(response);
    throw new Error('The server accepted the request but sent no stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      /*
       * Frames are separated by a blank line. Anything after the last blank
       * line is a partial frame and stays in the buffer — a chunk boundary
       * falls wherever the network puts it, not where the protocol would like.
       */
      let split = buffer.indexOf('\n\n');
      while (split !== -1) {
        emit(buffer.slice(0, split), handlers.onEvent);
        buffer = buffer.slice(split + 2);
        split = buffer.indexOf('\n\n');
      }
    }
  } finally {
    // Releasing matters on an aborted read: without it the connection can be
    // held open by a reader nobody is going to call again.
    reader.releaseLock();
  }
}

function emit(frame: string, onEvent: SseHandlers['onEvent']): void {
  let name = 'message';
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }

  if (dataLines.length === 0) return;

  try {
    onEvent(name, JSON.parse(dataLines.join('\n')) as Record<string, unknown>);
  } catch {
    // A frame we cannot parse is dropped rather than allowed to kill the
    // stream: the turn in progress is worth more than one malformed event.
  }
}
