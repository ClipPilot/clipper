"use client";

import { Pagination } from "@heroui/react";

interface PaginationControlProps {
  total: number;
  page: number;
  onChange: (page: number) => void;
  className?: string;
}

export function PaginationControl({ total, page, onChange, className }: PaginationControlProps) {
  if (total <= 1) return null;

  const pages: (number | "ellipsis")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i);
    if (page < total - 2) pages.push("ellipsis");
    pages.push(total);
  }

  return (
    <Pagination className={className}>
      <Pagination.Content className="gap-1">
        <Pagination.Item>
          <Pagination.Previous
            onPress={() => page > 1 && onChange(page - 1)}
            isDisabled={page === 1}
            className="h-8 w-8 rounded-lg bg-surface-elevated border border-border-base text-text-secondary hover:text-text-primary hover:border-accent-400/50 disabled:opacity-30 transition-all"
          >
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <Pagination.Item key={`e-${i}`}>
              <Pagination.Ellipsis className="text-text-tertiary px-1" />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={p}>
              <Pagination.Link
                isActive={p === page}
                onPress={() => onChange(p)}
                className={`h-8 w-8 rounded-lg text-sm font-medium transition-all ${
                  p === page
                    ? "bg-accent-400 text-white border border-accent-400"
                    : "bg-surface-elevated border border-border-base text-text-secondary hover:text-text-primary hover:border-accent-400/50"
                }`}
              >
                {p}
              </Pagination.Link>
            </Pagination.Item>
          )
        )}
        <Pagination.Item>
          <Pagination.Next
            onPress={() => page < total && onChange(page + 1)}
            isDisabled={page === total}
            className="h-8 w-8 rounded-lg bg-surface-elevated border border-border-base text-text-secondary hover:text-text-primary hover:border-accent-400/50 disabled:opacity-30 transition-all"
          >
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
