import { JSX } from 'react'
import {
  OAuthClientMetadata,
  isOAuthClientIdDiscoverable,
  isOAuthClientIdLoopback,
} from '@atproto/oauth-types'
import { Override } from '../../lib/util'
import { UrlViewer } from './url-viewer'

export type ClientNameProps = Override<
  Omit<JSX.IntrinsicElements['span'], 'children'>,
  {
    clientId: string
    clientMetadata: OAuthClientMetadata
    clientTrusted: boolean
  }
>

export function ClientName({
  clientId,
  clientMetadata,
  clientTrusted,

  // span
  ...attrs
}: ClientNameProps) {
  if (clientTrusted && clientMetadata.client_name) {
    return <span {...attrs}>{clientMetadata.client_name}</span>
  }

  if (isOAuthClientIdLoopback(clientId)) {
    // @TODO translate
    return <span {...attrs}>An application on your device</span>
  }

  if (isOAuthClientIdDiscoverable(clientId)) {
    return <UrlViewer {...attrs} url={clientId} path />
  }

  return <span {...attrs}>{clientId}</span>
}
