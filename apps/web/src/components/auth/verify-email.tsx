'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { FormAlert } from './auth-card';

/**
 * Verification requires an explicit click (a POST) instead of happening on page load, so link
 * scanners in mail gateways that prefetch URLs cannot consume the single-use token.
 */
export function VerifyEmail() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const verify = async () => {
    setState('pending');
    try {
      await apiPost('/auth/verify-email', { token });
      setState('done');
    } catch (error) {
      setMessage(errorMessage(error));
      setState('error');
    }
  };

  if (!token)
    return (
      <FormAlert>
        Tautan verifikasi ini tidak lengkap. Minta tautan baru dari halaman masuk.
      </FormAlert>
    );

  if (state === 'done') {
    return (
      <div className="grid gap-4">
        <FormAlert tone="success">
          Alamat email Anda telah diverifikasi. Anda dapat masuk sekarang.
        </FormAlert>
        <Button asChild className="w-full">
          <Link href="/login">Lanjutkan masuk</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {state === 'error' && message && <FormAlert>{message}</FormAlert>}
      <Button onClick={() => void verify()} disabled={state === 'pending'} className="w-full">
        {state === 'pending' ? 'Memverifikasi…' : 'Verifikasi email saya'}
      </Button>
    </div>
  );
}
