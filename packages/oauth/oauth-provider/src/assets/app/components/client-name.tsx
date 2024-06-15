import { OAuthClientMetadata } from '@atproto/oauth-types'
import { HTMLAttributes } from 'react'

import { ClientIdentifier } from './client-identifier'

export type ClientNameProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  as?: keyof JSX.IntrinsicElements
}

export function ClientName({
  clientId,
  clientMetadata,
  as: As = 'span',
  ...attrs
}: ClientNameProps & HTMLAttributes<Element>) {
  if (clientMetadata.client_name) {
    return <As {...attrs}>{clientMetadata.client_name}</As>
  }

  return (
    <ClientIdentifier
      clientId={clientId}
      clientMetadata={clientMetadata}
      as={As}
      {...attrs}
    />
  )
}
