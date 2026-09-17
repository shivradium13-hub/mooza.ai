import { buildUrl, parseResponse } from './api-shared';

/**
 * BROWSER-side API access.
 *
 * `credentials: 'include'` sends the httpOnly session cookie; the API's CORS
 * policy names the permitted origins explicitly, so this cannot be exercised
 * from an arbitrary site.
 */
export async function browserApi<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const hasBody = init.body !== undefined;

  const response = await fetch(buildUrl(path), {
    method: init.method ?? 'GET',
    credentials: 'include',
    /*
     * ONLY WHEN THERE IS A BODY. Sent unconditionally, it told the server to
     * expect JSON on requests that carry none, and Fastify answers that with
     * "Body cannot be empty when content-type is set to 'application/json'".
     *
     * Every action with nothing to send broke on it: sign out, revoke a
     * credential, test a credential, delete a project, a document, a chat
     * thread. Each one had a button, each one failed, and the message named a
     * header the user had never set.
     */
    ...(hasBody ? { headers: { 'content-type': 'application/json' } } : {}),
    ...(hasBody ? { body: JSON.stringify(init.body) } : {}),
  });
  return parseResponse<T>(response);
}
