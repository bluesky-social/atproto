import { Trans, useLingui } from '@lingui/react/macro'
import { SearchIcon } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Input } from '#/components/ui/input.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table.tsx'
import { cn } from '#/lib/utils.ts'

export type SessionListColumn<T> = {
  /** Column heading. Rendered visually and as the row's `<th>` scope. */
  header: ReactNode
  /** Cell contents for one row. */
  cell: (item: T) => ReactNode
  /** Tailwind width/alignment classes for both header and cells. */
  className?: string
  /** Type and colour for the cells, so the headings stay uniform. */
  cellClassName?: string
  /** Hidden below `md`, where the card layout takes over. */
  hideOnMobile?: boolean
}

export type SessionListProps<T> = {
  items: readonly T[]
  columns: ReadonlyArray<SessionListColumn<T>>
  /** Stable key per row. */
  rowKey: (item: T) => string
  /** Free-text haystack for the filter box, per row. */
  searchText: (item: T) => string
  /** Trailing action for the row — a button, usually. */
  action: (item: T) => ReactNode
  /** Card-layout title for narrow screens. */
  mobileTitle: (item: T) => ReactNode
  /** Shown when the list itself is empty (before any filtering). */
  empty: ReactNode
  filterLabel: string
  /**
   * Renders placeholder rows in place of the data. Owned by this component
   * rather than a separate skeleton so the two cannot drift apart — the
   * placeholder is built from the same `columns`, so it always has the right
   * number of columns at the right widths.
   */
  loading?: boolean
}

/** How many placeholder rows to draw while loading. */
const SKELETON_ROWS = 4

/**
 * Tabular list of sessions, for the connected-apps and devices pages.
 *
 * These lists are unbounded — an account that has signed in to many apps, or
 * from many devices, accumulates rows indefinitely — so this favours density
 * and findability over the stacked `Item` rows it replaces: one line per row,
 * a filter box, and a count.
 *
 * @NOTE The table collapses to a card layout below `md`. A four-column table
 * at 390px either overflows horizontally or crushes every column, and these
 * pages are reached from a mobile-first account manager. The same data is
 * rendered twice rather than horizontally scrolled, which is why `columns`
 * carries both `hideOnMobile` and a separate `mobileTitle`.
 */
export function SessionList<T>({
  items,
  columns,
  rowKey,
  searchText,
  action,
  mobileTitle,
  empty,
  filterLabel,
  loading = false,
}: SessionListProps<T>) {
  const { t } = useLingui()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => searchText(item).toLowerCase().includes(q))
  }, [items, query, searchText])

  if (!loading && !items.length) return <p>{empty}</p>

  return (
    <div className="flex flex-col gap-4">
      {/* @NOTE Always shown, not gated on a row count. Hiding it below a
        threshold means it appears and disappears as sessions come and go, so
        nobody learns it is there — and the list length is exactly what you
        cannot predict. The early return above keeps it off an empty list. */}
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={filterLabel}
          aria-label={filterLabel}
          className="pl-9"
        />
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead key={index} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
              <TableHead className="w-0 text-right">
                <span className="sr-only">{t`Actions`}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <TableRow key={`skeleton-${row}`}>
                  {columns.map((column, index) => (
                    <TableCell key={index} className={column.className}>
                      <Skeleton className="h-4 w-full max-w-[12rem]" />
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-8 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            {!loading &&
              filtered.map((item) => (
                <TableRow key={rowKey(item)}>
                  {columns.map((column, index) => (
                    <TableCell
                      key={index}
                      className={cn(column.className, column.cellClassName)}
                    >
                      {column.cell(item)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">{action(item)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading &&
          Array.from({ length: SKELETON_ROWS }, (_, row) => (
            <div
              key={`skeleton-${row}`}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="ml-auto h-8 w-20" />
            </div>
          ))}
        {!loading &&
          filtered.map((item) => (
            <div
              key={rowKey(item)}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="min-w-0 text-sm font-medium">
                {mobileTitle(item)}
              </div>
              <dl className="text-muted-foreground flex flex-col gap-1 text-xs">
                {columns
                  .filter((column) => !column.hideOnMobile)
                  .map((column, index) => (
                    <div key={index} className="flex justify-between gap-4">
                      <dt>{column.header}</dt>
                      <dd className="min-w-0 truncate text-right">
                        {column.cell(item)}
                      </dd>
                    </div>
                  ))}
              </dl>
              <div className="flex justify-end">{action(item)}</div>
            </div>
          ))}
      </div>

      {!loading && !filtered.length && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          <Trans>No matches</Trans>
        </p>
      )}
    </div>
  )
}
