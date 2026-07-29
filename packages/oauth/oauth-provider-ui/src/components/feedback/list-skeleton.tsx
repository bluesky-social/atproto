import { Fragment } from 'react'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemSeparator,
} from '#/components/ui/item.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'

export type ListSkeletonProps = {
  /** How many placeholder rows to draw. */
  rows?: number
}

/**
 * Loading placeholder for the connected-apps and devices lists, shaped like the
 * rows it stands in for so the page does not jump when the data lands.
 *
 * @NOTE The bars are `aria-hidden` — they carry no information — but the
 * wrapper keeps `role="status"` and `aria-busy` so the loading state is still
 * announced. No visible label, which would need a new message.
 */
export function ListSkeleton({ rows = 3 }: ListSkeletonProps) {
  return (
    <div role="status" aria-busy="true">
      {/* @NOTE gap-0 to match the real lists, where the separator's own margin
        supplies the rhythm. Any difference shows up as rows shifting. */}
      <ItemGroup aria-hidden className="gap-0">
        {Array.from({ length: rows }, (_, index) => (
          <Fragment key={index}>
            {index > 0 && <ItemSeparator />}
            <Item>
              <ItemContent>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-48" />
              </ItemContent>
              <ItemActions>
                <Skeleton className="h-8 w-20" />
              </ItemActions>
            </Item>
          </Fragment>
        ))}
      </ItemGroup>
    </div>
  )
}
