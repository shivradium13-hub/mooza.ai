/**
 * Carry the first message across the navigation into a new thread.
 *
 * "New chat" is two things at once: create a thread, and ask the first
 * question. The thread has to exist before it has a URL, so the question is
 * typed on one route and answered on another.
 *
 * A MODULE VARIABLE, DELIBERATELY. The alternatives are worse:
 *
 *   - a query parameter puts the user's question in the address bar, in
 *     browser history, and in any log that records paths;
 *   - `sessionStorage` outlives the navigation it was meant for, so a reload
 *     or a back-button days later re-sends a question nobody asked twice;
 *   - answering inside the create endpoint gives the API two code paths that
 *     produce a turn.
 *
 * This lives exactly as long as the client-side navigation does. A full page
 * load starts a new module instance with nothing in it, which is the correct
 * answer: on a reload there is no pending question, only the transcript.
 */

let pending: { threadId: string; text: string } | null = null;

export function setPendingMessage(threadId: string, text: string): void {
  pending = { threadId, text };
}

/** Reads and clears, so a message is sent once or not at all. */
export function takePendingMessage(threadId: string): string | null {
  if (!pending || pending.threadId !== threadId) return null;
  const { text } = pending;
  pending = null;
  return text;
}
