'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-shared';
import { browserApi } from '@/lib/api-browser';
import { Button, Card, CardHeader, ErrorNote, Field } from '@/components/ui';

/** Mirrors the API's floor, so the obvious mistake is caught without a round trip. */
const MIN_LENGTH = 12;

/**
 * Change-password form.
 *
 * The confirmation field is checked here and never sent: the API takes the
 * current and the new password only. A server has nothing useful to say about
 * two values the user typed into the same browser, and sending a third copy of
 * a secret over the wire to have it compared for equality earns nothing.
 *
 * A successful change revokes every session, this one included, so the only
 * honest next step is the sign-in page.
 */
export function ChangePassword() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match.');
      return;
    }
    if (newPassword.length < MIN_LENGTH) {
      setError(`The new password must be at least ${MIN_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    try {
      await browserApi('/v1/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setDone(true);
      // Every session is gone, so there is nothing left to refresh into.
      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader title="Password" />
        <div className="px-5 py-6">
          <p className="text-sm font-medium">Password changed.</p>
          <p className="mt-1 text-xs text-muted">
            Every session has been signed out, including this one. Taking you to the sign-in page…
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Password"
        description="Changing it signs you out everywhere, including on this device."
      />
      <form onSubmit={onSubmit} className="max-w-sm space-y-4 p-5">
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
        <Field
          label="New password"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          hint={`At least ${MIN_LENGTH} characters.`}
        />
        <Field
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
        />
        <ErrorNote message={error} />
        <Button type="submit" disabled={busy}>
          {busy ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </Card>
  );
}
