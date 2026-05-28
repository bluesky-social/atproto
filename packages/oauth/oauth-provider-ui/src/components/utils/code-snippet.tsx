import { clsx } from 'clsx'
import { JSX } from 'react'
import { ButtonCopy } from '#/components/forms/button-copy.tsx'
import { Override } from '#/lib/util.ts'

export type CodeSnippetProps = Override<
  Omit<JSX.IntrinsicElements['div'], 'children'>,
  {
    /** Optional label shown above the code value. */
    label?: string
    /** The literal text displayed, and copied when copyable. */
    value: string
    /** Whether to render a copy-to-clipboard button. Defaults to true. */
    copyable?: boolean
  }
>

/**
 * A read-only, monospaced display of a value (DNS record, URL, ID, etc.) with
 * an optional label and a copy-to-clipboard button.
 */
export function CodeSnippet({
  label,
  value,
  copyable = true,
  className,
  ...props
}: CodeSnippetProps) {
  return (
    <div {...props} className={clsx('flex flex-col', className)}>
      {label && <span className="text-text-light text-sm">{label}</span>}
      <div className="flex items-stretch gap-2">
        <code className="flex flex-1 items-center break-all rounded-md bg-gray-100 px-2 py-1 font-mono text-sm dark:bg-gray-800">
          {value}
        </code>
        <ButtonCopy value={copyable ? value : undefined} size="sm" />
      </div>
    </div>
  )
}
