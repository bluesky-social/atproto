import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useState } from 'react'
import { Button } from '#/components/Button'
import * as Dialog from '#/components/Dialog'

export function Prompt({
  children,
  title,
  description,
  confirmCTA,
  cancelCTA,
  onConfirm,
  onCancel,
}: {
  children: React.ReactNode
  title: string
  description?: string
  confirmCTA?: string
  cancelCTA?: string
  onConfirm?: () => void
  onCancel?: () => void
}) {
  const { _ } = useLingui()
  const [open, setOpen] = useState(false)

  const handleOnConfirm = () => {
    setOpen(false)
    onConfirm?.()
  }
  const handleOnCancel = () => {
    setOpen(false)
    onCancel?.()
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Outer>
        <Dialog.Inner role="alertdialog" className="max-w-[400px]!">
          <Dialog.Title className="text-xl font-semibold leading-snug">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="text-text-light pt-1 leading-snug">
              {description}
            </Dialog.Description>
          )}
          <div className="flex flex-wrap-reverse items-center gap-2 pt-4">
            <Button
              className="w-full min-w-[150px]"
              color="secondary"
              onClick={handleOnCancel}
            >
              {cancelCTA || _(msg`Cancel`)}
            </Button>
            {confirmCTA && (
              <Button
                className="w-full min-w-[150px]"
                color="primary"
                onClick={handleOnConfirm}
              >
                {confirmCTA}
              </Button>
            )}
          </div>
          <Dialog.Close />
        </Dialog.Inner>
      </Dialog.Outer>
    </Dialog.Root>
  )
}
