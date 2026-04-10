import { useLingui } from '@lingui/react/macro'
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { Override } from '../../lib/util.ts'
import { Button, ButtonProps } from './button.tsx'

export type ButtonToggleVisibilityProps = Override<
  Omit<ButtonProps, 'aria-label' | 'square'>,
  {
    visible: boolean
    toggleVisible: () => void
  }
>

/**
 * Generic button to toggle visibility of an item (e.g. password).
 */
export function ButtonToggleVisibility({
  visible,
  toggleVisible,

  // button
  onClick,
  ...props
}: ButtonToggleVisibilityProps) {
  const { t } = useLingui()
  return (
    <Button
      {...props}
      shape="padded"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) toggleVisible()
      }}
      aria-label={visible ? t`Hide` : t`Make visible`}
    >
      {visible ? (
        <EyeIcon className="size-5" aria-hidden />
      ) : (
        <EyeSlashIcon className="size-5" aria-hidden />
      )}
    </Button>
  )
}
