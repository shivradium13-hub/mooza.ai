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

/** Mirrors the API's floor, so the obvious mistake is caught without a round trip. */
const MIN_PASSWORD = 12;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    // Checked here and never sent: the API takes one password, and a third
    // copy of a secret on the wire buys nothing.
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setBusy(true);
    try {
      await browserApi('/v1/auth/register', {
        method: 'POST',
        body: {
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          password,
          organizationName: String(form.get('organizationName') ?? ''),
        },
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-up failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell tone="dark" quote={<>&ldquo;Create. Explore. Grow.&rdquo; With Mooza.ai</>}>
      <AuthCard tone="dark">
        <BrandLockup tone="dark" />

        <div className="mt-6">
          <AuthHeading
            tone="dark"
            title="Create your account"
            subtitle="Start a workspace and become its owner"
          />
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <AuthField
            tone="dark"
            label="Full name"
            name="name"
            placeholder="Your full name"
            autoComplete="name"
            required
          />
          <AuthField
            tone="dark"
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <AuthField
            tone="dark"
            label="Workspace name"
            name="organizationName"
            placeholder="Your team or company"
            autoComplete="organization"
            required
            hint="Everything you create lives inside this workspace."
          />
          <AuthField
            tone="dark"
            label="Password"
            name="password"
            type="password"
            placeholder="Create a password"
            autoComplete="new-password"
            required
            hint={`At least ${MIN_PASSWORD} characters.`}
          />
          <AuthField
            tone="dark"
            label="Confirm password"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            autoComplete="new-password"
            required
          />
          <AuthError tone="dark" message={error} />
          <AuthButton disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</AuthButton>
        </form>

        <p className="mt-6 text-center text-sm text-white/55">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-bright hover:underline">
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
