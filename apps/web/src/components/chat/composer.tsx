'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

/** Mirrors THREAD_LIMITS.MAX_MESSAGE_CHARS in the API. */
const MAX_CHARS = 32_000;

/**
 * The message box.
 *
 * ENTER SENDS ON A KEYBOARD AND NOT ON A TOUCHSCREEN. On a phone the Return
 * key sits where a newline belongs and there is a visible send button an inch
 * away; making Return send there means every second message goes half-written.
 * On a desktop the opposite is true — reaching for the mouse to send a line of
 * text is the annoyance. `(pointer: fine)` is the honest question to ask, and
 * it is asked at keypress time rather than at mount, because a tablet with a
 * keyboard attached mid-session should change its mind.
 */
export function Composer({
  onSend,
  busy,
  onStop,
  placeholder = 'Ask anything',
  autoFocus = false,
}: {
  onSend: (text: string) => void;
  busy: boolean;
  onStop?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);

  // Grow with the content, to a ceiling — past that the box scrolls rather
  // than pushing the conversation off the screen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus) box.current?.focus();
  }, [autoFocus]);

  function submit(event?: FormEvent): void {
    event?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setText('');
    onSend(value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const keyboardDriven =
      typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
    if (!keyboardDriven) return;
    event.preventDefault();
    submit();
  }

  const over = text.length > MAX_CHARS;

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm focus-within:border-accent/50">
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <textarea
          id="composer"
          ref={box}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted sm:text-sm"
        />

        {busy && onStop ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink transition hover:bg-black/[0.04]"
          >
            <span className="sr-only">Stop generating</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
              <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy || !text.trim() || over}
            className="btn-brand inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="sr-only">Send</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          </button>
        )}
      </div>

      {over ? (
        <p className="mt-1.5 text-xs text-danger">
          {text.length.toLocaleString()} characters. The limit is {MAX_CHARS.toLocaleString()}.
        </p>
      ) : null}
    </form>
  );
}
