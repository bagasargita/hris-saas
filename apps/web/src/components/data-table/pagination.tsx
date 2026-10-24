'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { PaginationMeta } from '@saas/contracts';
import { Button } from '@/components/ui/button';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const { page, limit, total, totalPages } = meta;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
      <p aria-live="polite">
        {total === 0 ? 'Tidak ada hasil' : `Menampilkan ${from}–${to} dari ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeftIcon /> Sebelumnya
        </Button>
        <span className="tabular-nums">
          Halaman {Math.min(page, Math.max(totalPages, 1))} dari {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Halaman berikutnya"
        >
          Berikutnya <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
