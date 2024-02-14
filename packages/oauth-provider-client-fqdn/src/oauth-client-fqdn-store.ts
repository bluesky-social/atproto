import {
  ClientId,
  ClientStore,
  InvalidClientMetadataError,
} from '@atproto/oauth-provider'
import {
  OAuthClientUriStore,
  OAuthClientUriStoreConfig,
} from '@atproto/oauth-provider-client-uri'

/**
 * @see {@link https://regexr.com/3g5j0}
 */
const FQDN_REGEXP =
  /^(?!:\/\/)(?=.{1,255}$)((.{1,63}\.){1,127}(?![0-9]*$)[a-z0-9-]+\.?)$/

export type OAuthClientFQDNStoreConfig = OAuthClientUriStoreConfig

export class OAuthClientFQDNStore
  extends OAuthClientUriStore
  implements ClientStore
{
  override async buildClientUrl(clientId: ClientId): Promise<URL> {
    if (clientId === 'localhost') {
      return super.buildClientUrl('http://localhost/')
    }

    if (!clientId.endsWith('.') && FQDN_REGEXP.test(clientId)) {
      return super.buildClientUrl(`https://${clientId}/`)
    }

    throw new InvalidClientMetadataError(
      `ClientID must be a fully qualified domain name (FQDN) or "localhost"`,
    )
  }
}
