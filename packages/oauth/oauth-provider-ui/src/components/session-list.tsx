import { Trans, useLingui } from '@lingui/react/macro'
import { type LucideIcon, SearchIcon } from 'lucide-react'
import { Fragment, type ReactNode, useMemo, useState } from 'react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '#/components/ui/empty.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Separator } from '#/components/ui/separator.tsx'
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
  /** Hidden below `md`, where the stacked layout takes over. */
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
  /** Row title for narrow screens. */
  mobileTitle: (item: T) => ReactNode
  /** Shown when the list itself is empty (before any filtering). */
  empty: ReactNode
  /** Illustrates the empty state — the page's own nav icon. */
  emptyIcon: LucideIcon
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
 * @NOTE Below `md` the table becomes one stacked row per session: a
 * four-column table at 390px either scrolls sideways or crushes every column.
 * The same data is rendered twice rather than scrolled, which is why `columns`
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
  emptyIcon: EmptyIcon,
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

  if (!loading && !items.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <EmptyIcon aria-hidden />
          </EmptyMedia>
          <EmptyDescription>{empty}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

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

      {/* @NOTE Mobile: one row per session. Not the registry's `Item`, whose
        `ItemDescription` is a line of text and whose row wraps — a labelled
        pair per column needs neither. */}
      <div className="flex flex-col md:hidden">
        {loading &&
          Array.from({ length: SKELETON_ROWS }, (_, row) => (
            <Fragment key={`skeleton-${row}`}>
              {row > 0 && <Separator />}
              <div className="flex items-start justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full max-w-[12rem]" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0" />
              </div>
            </Fragment>
          ))}
        {!loading &&
          filtered.map((item, index) => (
            <Fragment key={rowKey(item)}>
              {index > 0 && <Separator />}
              <div className="flex items-start justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="truncate text-sm font-medium">
                    {mobileTitle(item)}
                  </div>
                  <dl className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                    {columns
                      .filter((column) => !column.hideOnMobile)
                      .map((column, index) => (
                        <div key={index} className="flex justify-between gap-4">
                          <dt className="shrink-0">{column.header}</dt>
                          <dd className="min-w-0 truncate text-right">
                            {column.cell(item)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
                <div className="shrink-0">{action(item)}</div>
              </div>
            </Fragment>
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
