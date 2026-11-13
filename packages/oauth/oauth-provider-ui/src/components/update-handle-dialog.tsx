import { Trans } from '@lingui/react/macro'
import { ChevronRightIcon } from 'lucide-react'
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from 'react'
import type { HandleString } from '@atproto/syntax'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '#/components/ui/item.tsx'
import { LinkExternal } from '#/components/utils/link-external.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'
import { UpdateHandleCustomForm } from './update-handle-custom-form.tsx'
import { UpdateHandleDefaultForm } from './update-handle-default-form.tsx'

export type UpdateHandleDialogProps = {
  children: ReactElement

  domains: string[]
  currentHandle?: HandleString
  /** The current user's DID, used in own-domain verification instructions. */
  did: string
  handler: (
    data: { handle: HandleString },
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

enum HandleType {
  Default,
  Custom,
}

export function UpdateHandleDialog({
  handler,
  children,
  domains,
  currentHandle,
  did,
}: UpdateHandleDialogProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<HandleType | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setView(null)
  }, [open])

  const dismissable = !submitting

  const [defaultHandle, customHandle] =
    currentHandle && domains.some((dom) => currentHandle.endsWith(dom))
      ? [currentHandle, undefined]
      : [undefined, currentHandle]

  if (view === HandleType.Default && domains.length) {
    return (
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        dismissable={dismissable}
        trigger={children}
        title={<Trans>Update your username</Trans>}
        description={<Trans>Choose a new default username.</Trans>}
      >
        <UpdateHandleDefaultForm
          domains={domains}
          onBack={() => setView(null)}
          handleDefault={defaultHandle}
          onLoadingChange={setSubmitting}
          handler={async (data, signal) => {
            await handler(data, signal)
            setOpen(false)
          }}
        />
      </DialogShell>
    )
  }

  if (view === HandleType.Custom) {
    return (
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        dismissable={dismissable}
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
          did={did}
          onBack={() => setView(null)}
          submitLabel={<Trans>Verify and Save</Trans>}
          domainDefault={customHandle}
          onLoadingChange={setSubmitting}
          handler={async (data, signal) => {
            await handler(data, signal)
            setOpen(false)
          }}
        />
      </DialogShell>
    )
  }

  return (
    <DialogShell
      trigger={children}
      title={<Trans>Update your username</Trans>}
      description={
        <Trans>
          If you have your own domain, you can use that as your handle. This
          lets you self-verify your identity.{' '}
          <LinkExternal
            href="https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial"
            className="text-foreground hover:underline"
          >
            Learn more here
          </LinkExternal>
          .
        </Trans>
      }
      open={open}
      onOpenChange={setOpen}
    >
      {/* @NOTE A choice list, not two form actions, so these are built on
        `Item` rather than `Button` — a fixed-height single-line control would
        clip the example line. `render={<button/>}` keeps each option keyboard
        focusable, which `Item`'s default `<div>` is not. */}
      <ItemGroup className="gap-3">
        <Option
          onClick={() => setView(HandleType.Default)}
          disabled={!domains.length}
          label={<Trans>Use a default username</Trans>}
          example={
            <Trans>
              e.g. <em>alice{domains[0]}</em>
            </Trans>
          }
        />

        <Option
          onClick={() => setView(HandleType.Custom)}
          label={<Trans>Use a domain name I own</Trans>}
          example={
            <Trans>
              e.g. <em>alice.com</em>
            </Trans>
          }
        />
      </ItemGroup>
    </DialogShell>
  )
}

type OptionProps = Override<
  Omit<ComponentProps<typeof Item>, 'render'>,
  { label: ReactNode; example: ReactNode; disabled?: boolean }
>

function Option({
  label,
  example,
  disabled,
  className,
  ...props
}: OptionProps) {
  return (
    <Item
      {...props}
      variant="outline"
      // @NOTE `disabled` goes on the rendered element rather than on `Item`,
      // which is typed as a div and has no such prop.
      render={<button type="button" disabled={disabled} />}
      className={cn(
        'hover:bg-muted w-full text-left disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      <ItemContent>
        <ItemTitle>
          <span>{label}</span>
        </ItemTitle>
        <ItemDescription>{example}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <ChevronRightIcon aria-hidden className="size-4 shrink-0 opacity-60" />
      </ItemActions>
    </Item>
  )
}
