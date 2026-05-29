import { Trans } from '@lingui/react/macro'
import { ReactNode, useCallback, useEffect, useState } from 'react'
import { DialogSimple } from './dialog-simple.tsx'
import { Button } from './forms/button.tsx'
import { UpdateHandleCustomForm } from './update-handle-custom-form.tsx'
import { UpdateHandleDefaultForm } from './update-handle-default-form.tsx'
import { LinkExternal } from './utils/link-external.tsx'

export type UpdateHandleDialogProps = {
  children: Exclude<ReactNode, false | null | undefined>

  domains: string[]
  currentHandle?: string
  /** The current user's DID, used in own-domain verification instructions. */
  did: string
  onSubmit: (data: { handle: string }) => void | PromiseLike<void>
}

enum HandleType {
  Default,
  Custom,
}

export function UpdateHandleDialog({
  onSubmit,
  children,
  domains,
  currentHandle,
  did,
}: UpdateHandleDialogProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<HandleType | null>(null)

  const submitAndClose = useCallback(
    async (...args: Parameters<typeof onSubmit>) => {
      await onSubmit(...args)
      setOpen(false)
    },
    [onSubmit],
  )

  useEffect(() => {
    if (!open) setView(null)
  }, [open])

  if (view === HandleType.Default && domains.length) {
    return (
      <DialogSimple
        open={open}
        onOpenChange={setOpen}
        trigger={children}
        title={<Trans>Update your username</Trans>}
        description={<Trans>Choose a new default username.</Trans>}
      >
        <UpdateHandleDefaultForm
          domains={domains}
          currentHandle={currentHandle}
          cancelLabel={<Trans>Back</Trans>}
          onCancel={() => setView(null)}
          onSubmit={submitAndClose}
        />
      </DialogSimple>
    )
  }

  if (view === HandleType.Custom) {
    return (
      <DialogSimple
        open={open}
        onOpenChange={setOpen}
        trigger={children}
        title={<Trans>Update your username</Trans>}
        description={
          <Trans>
            Update your username to a domain name you own to self-verify your
            identity.
          </Trans>
        }
      >
        <UpdateHandleCustomForm
          domains={domains}
          currentHandle={currentHandle}
          did={did}
          cancelLabel={<Trans>Back</Trans>}
          onCancel={() => setView(null)}
          submitLabel={<Trans>Verify and Save</Trans>}
          onSubmit={submitAndClose}
        />
      </DialogSimple>
    )
  }

  return (
    <DialogSimple
      trigger={children}
      title={<Trans>Update your username</Trans>}
      description={
        <Trans>
          If you have your own domain, you can use that as your handle. This
          lets you self-verify your identity.{' '}
          <LinkExternal
            href="https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial"
            className="text-blue-600 hover:underline"
          >
            Learn more here
          </LinkExternal>
          .
        </Trans>
      }
      open={open}
      onOpenChange={setOpen}
    >
      <div className="align-stretch flex flex-col gap-4">
        <Button
          onClick={() => setView(HandleType.Default)}
          disabled={!domains.length}
        >
          <ButtonContent
            label={<Trans>Use a default username</Trans>}
            example={
              <Trans>
                e.g. <em>alice{domains[0]}</em>
              </Trans>
            }
          />
        </Button>

        <Button onClick={() => setView(HandleType.Custom)}>
          <ButtonContent
            label={<Trans>Use a domain name I own</Trans>}
            example={
              <Trans>
                e.g. <em>alice.com</em>
              </Trans>
            }
          />
        </Button>
      </div>
    </DialogSimple>
  )
}

type ButtonContentProps = {
  label: ReactNode
  example: ReactNode
}

function ButtonContent({ label, example }: ButtonContentProps) {
  return (
    <span className="flex w-full flex-col gap-0.5 text-left">
      <span>{label}</span>
      <span className="text-text-light text-sm leading-snug">{example}</span>
    </span>
  )
}
