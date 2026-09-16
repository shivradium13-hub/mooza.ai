'use client';

import { useId, useState } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/marketing/icons';
import { Field } from '@/components/ui';

/**
 * A password input that can be revealed.
 *
 * It exists because a typo in a password you cannot see is invisible until
 * something else catches it — and on the change-password form what catches it
 * is "The two new passwords do not match", which tells you there is a mistake
 * without telling you where. Being able to look is the fix.
 *
 * Wraps `Field` rather than reimplementing it: this file holds the state, and
 * `ui.tsx` stays free of it, so the eleven server components that import `Card`
 * from there are not pulled into the client bundle to pay for a toggle they
 * never render.
 *
 * Nothing is remembered. Revealing is per-field and resets on every render of
 * a fresh form, so a password is never left on screen by a previous visit.
 */
export function PasswordField({
  label,
  name,
  placeholder,
  required,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const describedBy = useId();

  return (
    <Field
      label={label}
      name={name}
      type={revealed ? 'text' : 'password'}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      hint={hint}
      adornment={
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-pressed={revealed}
          aria-describedby={describedBy}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-black/[0.05] hover:text-ink"
        >
          {/* The label names the ACTION, which is what a screen reader user needs. */}
          <span className="sr-only" id={describedBy}>
            {revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          </span>
          {revealed ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      }
    />
  );
}
