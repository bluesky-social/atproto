import { useLingui } from '@lingui/react/macro'
import { XIcon } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { ReactNode } from 'react'
import { Override } from '#/lib/util.ts'

export type DialogSimpleProps = Override<
  Dialog.DialogProps,
  {
    title: string
    trigger: ReactNode
    children: ReactNode
  }
>
export function DialogSimple({
  title,
  trigger,
  children,

  // Dialog.DialogProps
  ...props
}: DialogSimpleProps) {
  const { t } = useLingui()
  return (
    <Dialog.Root {...props}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-contrast-900/30 dark:bg-contrast-0/70 fixed inset-0" />

        <Dialog.Content
          role="dialog"
          aria-label={title}
          className="bg-contrast-0 fixed inset-0 flex flex-col overflow-y-auto border-slate-200 p-6 shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[90vw] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border dark:border-slate-700"
        >
          {children}

          {/* @NOTE we use -order-1 so that the close button is not focused first when the dialog opens */}
          <div className="-order-1 mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="text-text-default text-lg font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Close
              className="text-text-light shrink-0 rounded-full p-1 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:hover:bg-slate-700"
              aria-label={t`Close`}
            >
              <XIcon className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
