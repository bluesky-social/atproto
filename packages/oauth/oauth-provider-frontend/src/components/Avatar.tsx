import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { PersonIcon } from '@radix-ui/react-icons'

export function Avatar({
  src,
  size = 40,
  displayName,
}: {
  src: string | undefined
  size?: number
  displayName: string | undefined
}) {
  const { _ } = useLingui()
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
      }}
    >
      {src ? (
        <img src={src} alt={_(msg`User avatar`)} className="absolute inset-0" />
      ) : displayName ? (
        <p
          className="absolute uppercase"
          style={{
            fontSize: size / 2 + 'px',
            lineHeight: size + 'px',
          }}
        >
          {displayName.replace(/[^A-z0-0]/g, '').slice(0, 1)}
        </p>
      ) : (
        <PersonIcon height={size * (1 / 2)} width={size * (1 / 2)} />
      )}
      <div className="border-contrast-100 absolute inset-0 rounded-full border-2" />
    </div>
  )
}
