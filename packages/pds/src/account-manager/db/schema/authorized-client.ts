import { Selectable } from 'kysely'
import {
  AuthorizedClientData,
  Did,
  OAuthClientId,
} from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db/index.js'

export interface AuthorizedClient {
  did: Did
  clientId: OAuthClientId

  createdAt: DateISO
  updatedAt: DateISO

  data: JsonEncoded<AuthorizedClientData>
}

export type AuthorizedClientEntry = Selectable<AuthorizedClient>

export const tableName = 'authorized_client'

export type PartialDB = { [tableName]: AuthorizedClient }
