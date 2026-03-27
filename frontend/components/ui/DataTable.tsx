"use client";

import { Table } from "@heroui/react";
import { PaginationControl } from "./PaginationControl";

export interface DataTableColumn {
  id: string;
  label: string;
  align?: "start" | "center" | "end";
  width?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn[];
  rows: T[];
  getKey: (row: T) => string | number;
  renderCell: (row: T, columnId: string) => React.ReactNode;
  onRowClick?: (row: T) => void;
  emptyContent?: string;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  ariaLabel?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getKey,
  renderCell,
  onRowClick,
  emptyContent = "No data",
  page,
  totalPages,
  totalItems,
  onPageChange,
  ariaLabel = "Data table",
}: DataTableProps<T>) {
  return (
    <div className="rounded-xl overflow-hidden">
      <Table aria-label={ariaLabel}>
        <Table.Content>
          <Table.Header>
            {columns.map((col) => (
              <Table.Column
                key={col.id}
                id={col.id}
                isRowHeader={col.id === columns[0]?.id}
                className={`bg-white/[0.04] text-text-tertiary text-xs font-medium uppercase tracking-wider py-3 px-4 ${
                  col.align === "end" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                }`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <div className="flex items-center justify-center py-12 text-text-tertiary text-sm">
                {emptyContent}
              </div>
            )}
          >
            {rows.map((row) => (
              <Table.Row
                key={getKey(row)}
                id={String(getKey(row))}
                className={`border-t border-border-base hover:bg-white/[0.02] transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((col) => (
                  <Table.Cell
                    key={col.id}
                    className={`py-3 px-4 text-sm ${
                      col.align === "end" ? "text-right" : col.align === "center" ? "text-center" : ""
                    }`}
                  >
                    {renderCell(row, col.id)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table>

      {totalPages && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-base">
          <span className="text-xs text-text-tertiary">
            {totalItems != null ? `${totalItems} total` : `Page ${page} of ${totalPages}`}
          </span>
          <PaginationControl total={totalPages} page={page || 1} onChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
