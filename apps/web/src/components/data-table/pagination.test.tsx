import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './pagination';

describe('Pagination', () => {
  it('shows the visible range and navigates', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        meta={{ page: 2, limit: 10, total: 25, totalPages: 3 }}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByText('Menampilkan 11–20 dari 25')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    await userEvent.click(screen.getByRole('button', { name: 'Halaman sebelumnya' }));
    expect(onPageChange.mock.calls).toEqual([[3], [1]]);
  });

  it('disables navigation at the edges', () => {
    render(
      <Pagination meta={{ page: 1, limit: 10, total: 5, totalPages: 1 }} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Halaman sebelumnya' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Halaman berikutnya' })).toBeDisabled();
  });

  it('handles empty results', () => {
    render(
      <Pagination meta={{ page: 1, limit: 10, total: 0, totalPages: 0 }} onPageChange={vi.fn()} />,
    );
    expect(screen.getByText('Tidak ada hasil')).toBeInTheDocument();
    expect(screen.getByText('Halaman 1 dari 1')).toBeInTheDocument();
  });
});
