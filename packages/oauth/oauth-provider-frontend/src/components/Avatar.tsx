import React from 'react'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'
import { UserIcon } from '@heroicons/react/24/solid'

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
      className="relative rounded-full overflow-hidden flex align-center justify-center"
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
        <UserIcon width={size * (1 / 2)} />
      )}
      <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
    </div>
  )
}
