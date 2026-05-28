import { useLingui } from '@lingui/react/macro'
import * as Dialog from '@radix-ui/react-dialog'
import { ReactNode, useState } from 'react'
import { Override } from '#/lib/util.ts'
import {
  UpdateHandleForm,
  UpdateHandleFormProps,
} from './update-handle-form.tsx'

export type UpdateHandleDialogProps = Override<
  UpdateHandleFormProps,
  {
    children: Exclude<ReactNode, false | null | undefined>
  }
>

export function UpdateHandleDialog({
  onSubmit,
  onCancel,
  children,

  ...props
}: UpdateHandleDialogProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="bg-contrast-900/30 dark:bg-contrast-0/60 fixed inset-0" />

        <Dialog.Content
          role="dialog"
          aria-label={t`Update username`}
          className="fixed inset-0 overflow-y-auto border-slate-200 bg-white p-6 shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[90vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border dark:border-slate-700 dark:bg-slate-800"
        >
          <UpdateHandleForm
            {...props}
            onSubmit={async (data) => {
              await onSubmit(data)
              setOpen(false)
            }}
            onCancel={() => {
              onCancel?.()
              setOpen(false)
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
