import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { LoginForm } from './login-form';

const replace = vi.fn();
const refresh = vi.fn();
let search = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
  useSearchParams: () => search,
}));

const apiPost = vi.fn<(url: string, body?: unknown) => Promise<unknown>>();
vi.mock('@/lib/api/client', () => ({
  apiPost: (url: string, body?: unknown) => apiPost(url, body),
}));

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('LoginForm', () => {
  beforeEach(() => {
    search = new URLSearchParams();
  });

  it('validates input before calling the API', async () => {
    renderWithClient(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText('Email wajib diisi')).toBeInTheDocument();
    expect(screen.getByText('Kata sandi wajib diisi')).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('signs in and redirects only to a safe same-origin path', async () => {
    search = new URLSearchParams({ next: 'https://evil.example/steal' });
    apiPost.mockResolvedValueOnce({});
    renderWithClient(<LoginForm />);

    await userEvent.type(screen.getByLabelText('Email'), 'olivia@acme.test');
    await userEvent.type(screen.getByLabelText(/^Kata sandi/), 'Correct-horse-battery-1');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/tenants'));
    expect(apiPost).toHaveBeenCalledWith('/auth/login', {
      email: 'olivia@acme.test',
      password: 'Correct-horse-battery-1',
    });
  });

  it('honours a valid next path', async () => {
    search = new URLSearchParams({ next: '/t/acme/members' });
    apiPost.mockResolvedValueOnce({});
    renderWithClient(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'olivia@acme.test');
    await userEvent.type(screen.getByLabelText(/^Kata sandi/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/t/acme/members'));
  });

  it('shows the generic API error and clears the password', async () => {
    apiPost.mockRejectedValueOnce(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
    );
    renderWithClient(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'olivia@acme.test');
    await userEvent.type(screen.getByLabelText(/^Kata sandi/), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByLabelText(/^Kata sandi/)).toHaveValue('');
    expect(replace).not.toHaveBeenCalled();
  });

  it('offers to resend verification for unverified accounts', async () => {
    apiPost.mockRejectedValueOnce(
      new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before signing in'),
    );
    renderWithClient(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'new@acme.test');
    await userEvent.type(screen.getByLabelText(/^Kata sandi/), 'Correct-horse-battery-1');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));

    apiPost.mockResolvedValueOnce({});
    await userEvent.click(
      await screen.findByRole('button', { name: 'Kirim ulang email verifikasi' }),
    );
    expect(apiPost).toHaveBeenLastCalledWith('/auth/resend-verification', {
      email: 'new@acme.test',
    });
  });
});
