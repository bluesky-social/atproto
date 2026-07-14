import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { CopyIcon } from '@phosphor-icons/react'
import * as Popover from '@radix-ui/react-popover'
import { useEffect, useRef, useState } from 'react'
import type { Override } from '#/lib/util.ts'
import { Button, type ButtonProps } from './button.tsx'

export type ButtonCopyProps = Override<
  Omit<ButtonProps, 'children'>,
  {
    label?: MessageDescriptor
    /**
     * The text to copy to the clipboard. If omitted, the button is rendered
     * disabled (useful while the value is still being computed).
     */
    value?: string
    /**
     * How long to keep the "copied" popover visible after a successful copy.
     * Defaults to 1500ms.
     */
    feedbackDurationMs?: number
  }
>

export function ButtonCopy({
  value,
  label = msg`Copy to clipboard`,
  feedbackDurationMs = 1500,

  // ButtonProps
  shape = 'padded',
  size = 'sm',
  disabled,
  'aria-label': ariaLabel,
  title,
  onClick,
  ...props
}: ButtonCopyProps) {
  const { _ } = useLingui()
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const isDisabled = disabled || value == null

  return (
    <Popover.Root open={copied}>
      <Popover.Trigger asChild>
        <Button
          {...props}
          size={size}
          shape={shape}
          disabled={isDisabled}
          title={title ?? _(label)}
          aria-label={ariaLabel ?? _(label)}
          onClick={async (event) => {
            onClick?.(event)
            if (event.defaultPrevented || value == null) return

            try {
              await navigator.clipboard.writeText(value)

              setCopied(true)
              if (timeoutRef.current) clearTimeout(timeoutRef.current)
              timeoutRef.current = setTimeout(
                () => setCopied(false),
                feedbackDurationMs,
              )
            } catch (err) {
              console.warn('Failed to copy to clipboard', err)
            }
          }}
        >
          <CopyIcon
            aria-hidden
            weight="regular"
            className={
              size === 'sm' ? 'size-4' : size === 'lg' ? 'size-6' : 'size-5'
            }
          />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="center" role="status">
          <div className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <Trans>Copied</Trans>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
