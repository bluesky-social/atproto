import { Selectable } from 'kysely'
import { AuthorizedClientData, OAuthClientId } from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db'

export interface AuthorizedClient {
  did: string
  clientId: OAuthClientId

  createdAt: DateISO
  updatedAt: DateISO

  data: JsonEncoded<AuthorizedClientData>
}

export type AuthorizedClientEntry = Selectable<AuthorizedClient>

export const tableName = 'authorized_client'

export type PartialDB = { [tableName]: AuthorizedClient }
