import {
  isOAuthClientIdDiscoverable,
  isOAuthClientIdLoopback,
  OAuthClientMetadata,
} from '@atproto/oauth-types'
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
  if (isOAuthClientIdLoopback(clientId)) {
    return <As {...attrs}>An application on your device</As>
  }

  if (isOAuthClientIdDiscoverable(clientId)) {
    return <UrlViewer as={As} {...attrs} url={clientId} proto path />
  }

  return <As {...attrs}>{clientMetadata.client_name || clientId}</As>
}
