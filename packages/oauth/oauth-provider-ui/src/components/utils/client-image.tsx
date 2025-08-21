import { useEffect, useState } from 'react'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import { CircleInfoIcon } from './icons'

export type ClientImageProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
}

export function ClientImage({
  clientId,
  clientMetadata,
  clientTrusted,
}: ClientImageProps) {
  const [errored, setErrored] = useState(false)

  const src = clientTrusted ? clientMetadata.logo_uri : undefined
  const alt = clientMetadata.client_name || clientId

  useEffect(() => {
    setErrored(false)
  }, [src])

  return src && !errored ? (
    <img
      aria-hidden
      src={src}
      alt={alt}
      className="-ml-1 size-8"
      onError={() => setErrored(true)}
    />
  ) : (
    <div
      aria-hidden
      className="bg-primary flex size-8 items-center justify-center overflow-hidden rounded-full text-white"
    >
      <CircleInfoIcon className="size-4" />
    </div>
  )
}
