import { useLingui } from '@lingui/react/macro'
import { ReactNode, useState } from 'react'
import { Override } from '#/lib/util.ts'
import { DialogSimple } from './dialog-simple.tsx'
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
  children,

  ...props
}: UpdateHandleDialogProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)

  return (
    <DialogSimple
      trigger={children}
      title={t`Update username`}
      open={open}
      onOpenChange={setOpen}
    >
      <UpdateHandleForm
        {...props}
        onSubmit={async (data) => {
          await onSubmit(data)
          setOpen(false)
        }}
      />
    </DialogSimple>
  )
}
