'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApiError } from '@/lib/api-shared';
import { browserApi } from '@/lib/api-browser';
import {
  AuthButton,
  AuthCard,
  AuthError,
  AuthField,
  AuthHeading,
  AuthShell,
  BrandLockup,
} from '@/components/auth-ui';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    try {
      await browserApi('/v1/auth/login', {
        method: 'POST',
        body: {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        },
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      // Shown verbatim. The API returns the same message for "no such account"
      // and "wrong password", so this cannot be used to enumerate users.
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell tone="light" quote={<>&ldquo;Great ideas deserve great tools.&rdquo; — Mooza.ai</>}>
      <AuthCard tone="light">
        <BrandLockup tone="light" />

        <div className="mt-6">
          <AuthHeading
            tone="light"
            title="Welcome back"
            subtitle="Sign in to continue to your workspace"
          />
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <AuthField
            tone="light"
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <AuthField
            tone="light"
            label="Password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
          <AuthError tone="light" message={error} />
          <AuthButton disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</AuthButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don&rsquo;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-brand hover:underline">
            Sign up
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
