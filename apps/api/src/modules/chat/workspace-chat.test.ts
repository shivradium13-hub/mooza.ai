import { describe, expect, it } from 'vitest';
import { THREAD_LIMITS, titleFrom, windowHistory } from './workspace-chat.service.js';

/**
 * The two pieces of workspace chat that are pure logic rather than plumbing.
 *
 * Everything else in the service is a query under `withTenant`, covered by the
 * tenant-isolation suite; these two decide what a thread is CALLED and what
 * the model is SHOWN, and both get those decisions wrong in ways no type
 * catches.
 */

describe('titleFrom', () => {
  it('uses the message when it is short enough', () => {
    expect(titleFrom('How do I rotate the encryption key?')).toBe(
      'How do I rotate the encryption key?',
    );
  });

  it('collapses the whitespace a paste brings with it', () => {
    expect(titleFrom('  two   lines\n\nof  text ')).toBe('two lines of text');
  });

  it('never returns an empty title, which the table forbids', () => {
    // workspace_threads_title_present is a CHECK constraint: an empty title is
    // a failed INSERT, not a blank row.
    expect(titleFrom('   \n\t ')).toBe('New chat');
    expect(titleFrom('')).toBe('New chat');
  });

  it('cuts a long title at a word boundary rather than mid-word', () => {
    const title = titleFrom(
      'Explain why row level security needs to be forced as well as enabled on every tenant table',
    );
    expect(title.length).toBeLessThanOrEqual(THREAD_LIMITS.MAX_TITLE_CHARS + 1);
    expect(title.endsWith('…')).toBe(true);
    // The character before the ellipsis is part of a whole word.
    expect(title).not.toMatch(/\s…$/);
    expect(title.slice(0, -1).split(' ').pop()).not.toBe('');
  });

  it('still cuts when there is no word boundary to cut at', () => {
    const title = titleFrom('x'.repeat(200));
    expect(title.length).toBe(THREAD_LIMITS.MAX_TITLE_CHARS + 1);
  });
});

describe('windowHistory', () => {
  const message = (role: string, content: string, errorCode: string | null = null) => ({
    role,
    content,
    errorCode,
  });

  it('keeps the order of what survives', () => {
    const kept = windowHistory([
      message('user', 'one'),
      message('assistant', 'two'),
      message('user', 'three'),
    ]);
    expect(kept.map((m) => m.content)).toEqual(['one', 'two', 'three']);
  });

  it('drops the OLDEST turns when there are too many', () => {
    const many = Array.from({ length: THREAD_LIMITS.MAX_HISTORY_MESSAGES + 10 }, (_, i) =>
      message(i % 2 === 0 ? 'user' : 'assistant', `m${i}`),
    );
    const kept = windowHistory(many);

    expect(kept).toHaveLength(THREAD_LIMITS.MAX_HISTORY_MESSAGES);
    // What survives is the END of the conversation — the part being referred to.
    expect(kept.at(-1)?.content).toBe(`m${many.length - 1}`);
    expect(kept.at(0)?.content).toBe(`m${many.length - THREAD_LIMITS.MAX_HISTORY_MESSAGES}`);
  });

  it('stops on the character bound even when the message count is fine', () => {
    // Exactly the whole budget on its own, so anything kept after it overflows.
    const big = 'x'.repeat(THREAD_LIMITS.MAX_HISTORY_CHARS);
    const kept = windowHistory([message('user', big), message('assistant', 'later')]);

    // 'later' is nearest the end and fits; the huge earlier message then
    // crosses the bound, so it is the one dropped.
    expect(kept.map((m) => m.content)).toEqual(['later']);
  });

  it('omits failed turns, so the model is not asked about our outage', () => {
    const kept = windowHistory([
      message('user', 'what is 2+2'),
      message('assistant', 'This turn could not be completed.', 'provider_unavailable'),
      message('user', 'try again'),
    ]);

    expect(kept.map((m) => m.content)).toEqual(['what is 2+2', 'try again']);
  });

  it('is empty for an empty thread rather than throwing', () => {
    expect(windowHistory([])).toEqual([]);
  });
});
