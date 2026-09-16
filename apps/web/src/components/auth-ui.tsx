'use client';

import { useId, useState, type ReactNode } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/marketing/icons';

/**
 * Auth-screen vocabulary.
 *
 * Separate from `components/ui.tsx` because these two screens are the only
 * place in the product with a full-bleed brand treatment: a gradient mark,
 * large centred type, and a card floating on a wash of colour. Reusing the
 * dense application primitives here would mean adding a `big` flag to each of
 * them, and reusing these inside the app would make every table look like a
 * landing page.
 *
 * Each component takes `tone`, because sign-in is light and sign-up is dark
 * and everything else about them is identical. Two copies of the same form
 * with inverted colour classes is how the two screens drift apart.
 */

export type Tone = 'light' | 'dark';

/** The gradient mark. Drawn rather than loaded, so it stays sharp at any size. */
export function BrandMark({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id="mooza-auth-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#mooza-auth-mark)" />
      <path
        d="M13 33V16l11 10 11-10v17"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLockup({ tone }: { tone: Tone }) {
  return (
    <div className="flex flex-col items-center">
      <BrandMark />
      <p
        className={`mt-3 text-2xl font-semibold tracking-tight ${
          tone === 'dark' ? 'text-white' : 'text-ink'
        }`}
      >
        Mooza<span className="brand-text">.ai</span>
      </p>
    </div>
  );
}

export function AuthShell({
  tone,
  children,
  quote,
}: {
  tone: Tone;
  children: ReactNode;
  quote: ReactNode;
}) {
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center px-4 py-12 ${
        tone === 'dark' ? 'auth-bg-dark' : 'auth-bg-light'
      }`}
    >
      <div className="w-full max-w-md">{children}</div>
      <p
        className={`mt-10 max-w-md text-center text-sm ${
          tone === 'dark' ? 'text-white/45' : 'text-ink/45'
        }`}
      >
        {quote}
      </p>
    </main>
  );
}

export function AuthCard({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div
      className={`rounded-3xl p-8 sm:p-10 ${
        tone === 'dark'
          ? 'border border-abyss-line bg-abyss-soft/80 shadow-2xl shadow-black/40 backdrop-blur'
          : 'border border-black/5 bg-white/90 shadow-xl shadow-brand/10 backdrop-blur'
      }`}
    >
      {children}
    </div>
  );
}

export function AuthHeading({
  tone,
  title,
  subtitle,
}: {
  tone: Tone;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center">
      <h1
        className={`text-2xl font-semibold tracking-tight sm:text-3xl ${
          tone === 'dark' ? 'text-white' : 'text-ink'
        }`}
      >
        {title}
      </h1>
      <p className={`mt-2 text-sm ${tone === 'dark' ? 'text-white/55' : 'text-muted'}`}>
        {subtitle}
      </p>
    </div>
  );
}

export function AuthField({
  tone,
  label,
  name,
  type = 'text',
  placeholder,
  required,
  autoComplete,
  hint,
  trailing,
}: {
  tone: Tone;
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
  /** Rendered on the label row, right-aligned — "Forgot password?" and the like. */
  trailing?: ReactNode;
}) {
  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);
  const describedBy = useId();

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={name}
          className={`text-sm font-medium ${tone === 'dark' ? 'text-white/85' : 'text-ink'}`}
        >
          {label}
        </label>
        {trailing}
      </div>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={isPassword && revealed ? 'text' : type}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`h-12 w-full rounded-xl px-4 text-sm outline-none transition ${
            isPassword ? 'pr-12' : ''
          } ${
            tone === 'dark'
              ? 'border border-abyss-line bg-white/[0.04] text-white placeholder:text-white/30 focus:border-brand-bright'
              : 'border border-black/10 bg-white text-ink placeholder:text-ink/35 focus:border-brand'
          }`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            aria-describedby={describedBy}
            className={`absolute inset-y-0 right-2 my-auto inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${
              tone === 'dark'
                ? 'text-white/45 hover:bg-white/10 hover:text-white'
                : 'text-ink/45 hover:bg-black/[0.05] hover:text-ink'
            }`}
          >
            {/* The label names the ACTION, which is what a screen reader user needs. */}
            <span className="sr-only" id={describedBy}>
              {revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            </span>
            {revealed ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      {hint ? (
        <p className={`mt-1.5 text-xs ${tone === 'dark' ? 'text-white/40' : 'text-muted'}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AuthButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="btn-brand inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold"
    >
      {children}
    </button>
  );
}

export function AuthError({ tone, message }: { tone: Tone; message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={`rounded-xl px-4 py-3 text-sm ${
        tone === 'dark'
          ? 'bg-red-500/10 text-red-300 ring-1 ring-red-500/25'
          : 'bg-red-50 text-danger ring-1 ring-red-200'
      }`}
    >
      {message}
    </p>
  );
}
