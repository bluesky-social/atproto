import { useLingui } from '@lingui/react/macro'
import { HTMLAttributes, ReactNode, useState } from 'react'
import { useRandomString } from '#/hooks/use-random-string'
import { Override } from '#/lib/util'
import { ChevronRightIcon } from './icons'

export type DescriptionCardProps = Override<
  HTMLAttributes<HTMLDivElement>,
  {
    image: ReactNode
    title?: ReactNode
    description?: ReactNode
  }
>

export function DescriptionCard({
  image,
  title,
  description,

  // HTMLDivElement
  // className,
  children,
  ...attrs
}: DescriptionCardProps) {
  const { t } = useLingui()
  const [showDetails, setShowDetails] = useState(false)
  const hasChildren = children != null
  const detailsDivId = useRandomString('details-card-')

  const toggleShowDetails = () => setShowDetails((prev) => !prev)

  return (
    <div {...attrs}>
      <div className={`flex items-center justify-start gap-4`}>
        <div
          className="flex w-8 flex-grow-0 justify-center align-middle"
          aria-hidden
        >
          {image}
        </div>
        <div className={`flex flex-1 flex-col`}>
          {title && <p>{title}</p>}
          {description && <p className="text-sm">{description}</p>}
        </div>
        {hasChildren && (
          <button
            onClick={(event) => {
              if (!event.defaultPrevented) {
                event.preventDefault()
                toggleShowDetails()
              }
            }}
            type="button"
            title={t`Show details`}
            aria-expanded={showDetails}
            aria-label={showDetails ? t`Collapse details` : t`Expand details`}
            aria-haspopup="true"
            aria-controls={detailsDivId}
            className="flex h-8 w-8 flex-grow-0 cursor-pointer items-center justify-center rounded-full hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            <ChevronRightIcon
              className={`h-4 transition-transform duration-200 ${
                showDetails ? 'rotate-90' : ''
              }`}
            />
          </button>
        )}
      </div>
      {hasChildren && (
        <div
          className="py-4 pl-12"
          hidden={!showDetails}
          id={detailsDivId}
          aria-hidden={!showDetails}
        >
          {children}
        </div>
      )}
    </div>
  )
}
