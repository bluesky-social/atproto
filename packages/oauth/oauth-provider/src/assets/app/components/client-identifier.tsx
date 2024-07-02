import { OAuthClientMetadata } from '@atproto/oauth-types'
import { HTMLAttributes } from 'react'

import { UrlViewer } from './url-viewer'

export type ClientIdentifierProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  as?: keyof JSX.IntrinsicElements
}

export function ClientIdentifier({
  clientId,
  clientMetadata,
  as: As = 'span',
  ...attrs
}: ClientIdentifierProps & HTMLAttributes<Element>) {
  if (clientMetadata.client_uri) {
    return (
      <UrlViewer
        as={As}
        {...attrs}
        url={clientMetadata.client_uri}
        proto
        path
      />
    )
  }

  // Fallback to the client ID
  return <As {...attrs}>{clientId}</As>
}
