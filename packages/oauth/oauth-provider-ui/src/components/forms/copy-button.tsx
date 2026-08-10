import { Trans, useLingui } from '@lingui/react/macro'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { type ComponentProps, useEffect, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { cn } from '#/lib/utils.ts'

export type CopyButtonProps = Omit<
  ComponentProps<typeof Button>,
  'value' | 'children'
> & {
  /** The text to copy. When undefined the button is not rendered. */
  value?: string
}

/** Copies `value` to the clipboard, acknowledging with a tick. */
export function CopyButton({
  value,
  className,
  variant = 'ghost',
  size = 'icon',
  ...props
}: CopyButtonProps) {
  const { t } = useLingui()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  if (value === undefined) return null

  return (
    <Button
      {...props}
      type="button"
      variant={variant}
      size={size}
      className={cn('shrink-0', className)}
      aria-label={copied ? undefined : t`Copy to clipboard`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
        } catch {
          // Clipboard access can be denied; fail silently.
        }
      }}
    >
      {copied ? (
        <>
          <CheckIcon aria-hidden className="size-4" />
          <span className="sr-only">
            <Trans>Copied</Trans>
          </span>
        </>
      ) : (
        <CopyIcon aria-hidden className="size-4" />
      )}
    </Button>
  )
}
