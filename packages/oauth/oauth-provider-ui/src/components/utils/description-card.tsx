import { useLingui } from '@lingui/react/macro'
import { HTMLAttributes, ReactNode, useCallback, useRef, useState } from 'react'
import { Button } from '#/components/forms/button.tsx'
import { useClickOutside } from '#/hooks/use-click-outside'
import { useEscapeKey } from '#/hooks/use-escape-key'
import { useRandomString } from '#/hooks/use-random-string.ts'
import { Override } from '#/lib/util.ts'
import { Admonition } from './admonition'

export type DescriptionCardProps = Override<
  HTMLAttributes<HTMLDivElement>,
  {
    hint?: string
    image: ReactNode
    title?: ReactNode
    description?: ReactNode
    append?: ReactNode
  }
>

export function DescriptionCard({
  hint,
  image,
  title,
  description,
  append,

  // HTMLDivElement
  className,
  children,
  ...attrs
}: DescriptionCardProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  const ref = useRef<HTMLDivElement>(null)
  useEscapeKey(close)
  useClickOutside(ref, close)

  const hasChildren = children != null
  const detailsDivId = useRandomString('details-card-')

  return (
    <div ref={ref} className={className} {...attrs}>
      <div className={`flex items-center justify-start gap-2`}>
        <div
          className="ml-2 flex w-8 flex-grow-0 items-center justify-center"
          aria-hidden
        >
          {image}
        </div>
        <div
          className={`flex flex-1 flex-col`}
          aria-describedby={hasChildren ? detailsDivId : undefined}
        >
          {title && <h3>{title}</h3>}
          {description && <p className="text-sm">{description}</p>}
        </div>
        {append && (
          <div className="flex shrink-0 grow-0 items-center justify-center">
            {append}
          </div>
        )}
        {hasChildren && (
          <Button
            onClick={(event) => {
              if (!event.defaultPrevented) {
                event.preventDefault()
                setOpen((prev) => !prev)
              }
            }}
            shape="circle"
            title={open ? t`Collapse details` : hint ?? t`Expand details`}
            aria-expanded={open}
            aria-label={open ? t`Collapse details` : hint ?? t`Expand details`}
            aria-haspopup="true"
            aria-controls={detailsDivId}
          >
            ?
          </Button>
        )}
      </div>
      {hasChildren && (
        <Admonition
          className="mt-4"
          hidden={!open}
          id={detailsDivId}
          aria-hidden={!open}
        >
          {children}
        </Admonition>
      )}
    </div>
  )
}
