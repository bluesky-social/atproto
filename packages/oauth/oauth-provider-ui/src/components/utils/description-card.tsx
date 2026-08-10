import { useLingui } from '@lingui/react/macro'
import { CircleQuestionMarkIcon } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { Button } from '#/components/ui/button.tsx'
import type { Override } from '#/lib/util.ts'

export type DescriptionCardProps = Override<
  HTMLAttributes<HTMLDivElement>,
  {
    hint?: string
    image: ReactNode
    title: ReactNode
    description?: ReactNode
    append?: ReactNode
    children?: ReactNode
    extra?: ReactNode
  }
>

export function DescriptionCard({
  hint,
  image,
  title,
  description,
  append,
  children,
  extra,

  // HTMLDivElement
  ...attrs
}: DescriptionCardProps) {
  const { t } = useLingui()

  return (
    <div {...attrs}>
      <div className="flex items-center justify-start gap-2">
        <div
          className="ml-2 flex w-8 flex-grow-0 items-center justify-center"
          aria-hidden
        >
          {image}
        </div>

        <div className="flex flex-1 flex-col">
          <h3>{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>

        <div className="flex shrink-0 grow-0 items-center justify-center">
          {append}
          {!!children && (
            <DialogShell
              title={title}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={hint ?? t`Expand details`}
                  aria-haspopup="dialog"
                >
                  <CircleQuestionMarkIcon className="size-4" aria-hidden />
                </Button>
              }
            >
              <div className="text-muted-foreground text-sm">{children}</div>
              {extra}
            </DialogShell>
          )}
        </div>
      </div>
    </div>
  )
}
