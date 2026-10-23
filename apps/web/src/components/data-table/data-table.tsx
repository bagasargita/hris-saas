'use client';

import {
  tableFeatures,
  useTable,
  type CellData,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table';
import type { PaginationMeta } from '@saas/contracts';
import { EmptyState, ErrorState } from '@/components/states';
import { Skeleton } from '@/components/ui/misc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from './pagination';

/** Core features only: sorting, filtering and pagination happen on the server. */
export const tableFeatureSet = tableFeatures({});
export type AppFeatures = typeof tableFeatureSet;
export type AppColumnDef<TData extends RowData> = ColumnDef<AppFeatures, TData, CellData>;

export function DataTable<TData extends RowData>({
  columns,
  data,
  meta,
  isLoading,
  isError,
  onRetry,
  onPageChange,
  getRowId,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
}: {
  columns: AppColumnDef<TData>[];
  data: TData[] | undefined;
  meta?: PaginationMeta;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onPageChange?: (page: number) => void;
  getRowId: (row: TData) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const table = useTable({
    features: tableFeatureSet,
    columns,
    data: data ?? [],
    getRowId,
  });

  if (isError) return <ErrorState onRetry={onRetry} />;

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && !data
              ? Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!isLoading && rows.length === 0 && (
          <div className="p-4">
            <EmptyState title={emptyTitle} description={emptyDescription} className="border-0" />
          </div>
        )}
      </div>
      {meta && onPageChange && <Pagination meta={meta} onPageChange={onPageChange} />}
    </div>
  );
}
