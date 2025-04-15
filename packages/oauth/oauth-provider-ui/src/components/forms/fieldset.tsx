import { JSX, ReactNode, createContext, useMemo } from 'react'
import { useRandomString } from '../../hooks/use-random-string.ts'
import { Override } from '../../lib/util.ts'

export type FieldsetContextValue = {
  disabled: boolean
  labelId?: string
}

export const FieldsetContext = createContext<FieldsetContextValue>({
  disabled: false,
})
FieldsetContext.displayName = 'FieldsetContext'

export type FieldsetCardProps = Override<
  Omit<JSX.IntrinsicElements['fieldset'], 'aria-labelledby'>,
  {
    label?: ReactNode
  }
>

export function Fieldset({
  label,
  children,
  disabled,
  ...props
}: FieldsetCardProps) {
  const labelId = useRandomString({ prefix: 'fieldset-' })

  const contextValue = useMemo(
    () => ({
      disabled: disabled ?? false,
      labelId: label ? labelId : undefined,
    }),
    [disabled, label, labelId],
  )

  return (
    <fieldset {...props} aria-labelledby={labelId} disabled={disabled}>
      {label && (
        <legend
          id={labelId}
          key="title"
          className="mb-1 text-sm font-medium text-slate-600 dark:text-slate-400"
        >
          {label}
        </legend>
      )}

      <div className="flex flex-col space-y-4">
        <FieldsetContext value={contextValue}>{children}</FieldsetContext>
      </div>
    </fieldset>
  )
}
