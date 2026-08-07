import type { JSX } from 'react'
import { CopyButton } from '#/components/forms/copy-button.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type CodeSnippetProps = Override<
  JSX.IntrinsicElements['div'],
  {
    /** Optional label shown above the code value. */
    label?: string
    /** The literal text displayed, and copied when copyable. */
    children: string
    /** Whether to render a copy-to-clipboard button. Defaults to true. */
    copyable?: boolean
  }
>

/**
 * A read-only `<code>` display of a value (DNS record, URL, ID, etc.) with an
 * optional label and a copy-to-clipboard button.
 */
export function CodeSnippet({
  label,
  children,
  copyable = true,
  className,
  ...props
}: CodeSnippetProps) {
  return (
    <div {...props} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
      )}
      <div className="border-input bg-muted/40 flex items-stretch gap-1 rounded-md border">
        <code className="flex flex-1 items-center break-all px-2.5 py-1.5 font-mono text-sm">
          {children}
        </code>
        <CopyButton
          value={copyable ? children : undefined}
          size="icon-sm"
          className="my-1 mr-1 self-center"
        />
      </div>
    </div>
  )
}
