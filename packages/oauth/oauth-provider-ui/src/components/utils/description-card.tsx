import { useLingui } from '@lingui/react/macro'
import { QuestionIcon, XIcon } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { HTMLAttributes, ReactNode } from 'react'
import { Button } from '#/components/forms/button.tsx'
import { Override } from '#/lib/util.ts'

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
      <div className={`flex items-center justify-start gap-2`}>
        <div
          className="ml-2 flex w-8 flex-grow-0 items-center justify-center"
          aria-hidden
        >
          {image}
        </div>

        <div className={`flex flex-1 flex-col`}>
          <h3>{title}</h3>
          {description && <p className="text-sm">{description}</p>}
        </div>

        <div className="flex shrink-0 grow-0 items-center justify-center">
          {append}
          {!!children && (
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <Button
                  shape="circle"
                  aria-label={hint ?? t`Expand details`}
                  aria-haspopup="dialog"
                  size="sm"
                >
                  <QuestionIcon className="size-4" aria-hidden />
                </Button>
              </Dialog.Trigger>

              <Dialog.Portal>
                <Dialog.Overlay className="bg-contrast-900/30 dark:bg-contrast-0/60 fixed inset-0" />

                <Dialog.Content
                  role="dialog"
                  aria-label={!title ? t`Details` : undefined}
                  className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="relative flex flex-col gap-4">
                    <Dialog.Title className="text-text-default text-lg font-semibold">
                      {title}
                    </Dialog.Title>
                    <Dialog.Description className="text-text-light text-sm">
                      {children}
                    </Dialog.Description>
                    {extra}
                    <Dialog.Close
                      className="absolute right-0 top-0 rounded-full bg-slate-100 p-1 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:bg-slate-700 dark:hover:bg-slate-600"
                      aria-label={t`Close details`}
                    >
                      <XIcon className="text-text-light size-4" aria-hidden />
                    </Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
      </div>
    </div>
  )
}
