import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserApi } from './api-browser';

/**
 * What the client puts on the wire.
 *
 * One property, and it had been wrong since the file was written: a
 * `content-type: application/json` header was sent on every request, including
 * the ones with no body. Fastify answers that with "Body cannot be empty when
 * content-type is set to 'application/json'", so sign out, revoke a
 * credential, test a credential and every DELETE in the application failed —
 * each with a message naming a header the user had never heard of.
 *
 * Nothing caught it because every call typechecks either way. The header is a
 * string in an object; there is no type that knows whether a body follows.
 */

function captureFetch(): ReturnType<typeof vi.fn> {
  const fake = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fake);
  return fake;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browserApi', () => {
  it('sends no content-type when there is no body', async () => {
    const fetchMock = captureFetch();
    await browserApi('/v1/auth/logout', { method: 'POST' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it('sends no content-type on a bodyless DELETE either', async () => {
    const fetchMock = captureFetch();
    await browserApi('/v1/projects/abc', { method: 'DELETE' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toBeUndefined();
  });

  it('declares JSON when there is a body to declare', async () => {
    const fetchMock = captureFetch();
    await browserApi('/v1/projects', { method: 'POST', body: { name: 'Alpha' } });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.body).toBe('{"name":"Alpha"}');
  });

  it('declares JSON for a body that is falsy but present', async () => {
    // `null` and `0` are bodies. `init.body !== undefined` is the test, and
    // a truthiness check here would drop them and resurrect the bug.
    const fetchMock = captureFetch();
    await browserApi('/v1/things', { method: 'POST', body: null });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.body).toBe('null');
  });

  it('always sends the session cookie', async () => {
    const fetchMock = captureFetch();
    await browserApi('/v1/auth/me');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(init.method).toBe('GET');
  });
});
