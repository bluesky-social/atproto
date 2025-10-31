import { useLingui } from '@lingui/react/macro'
import { Override } from '../../lib/util.ts'
import { EyeIcon, EyeSlashIcon } from '../utils/icons.tsx'
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
        <EyeIcon className="w-5" aria-hidden />
      ) : (
        <EyeSlashIcon className="w-5" aria-hidden />
      )}
    </Button>
  )
}
