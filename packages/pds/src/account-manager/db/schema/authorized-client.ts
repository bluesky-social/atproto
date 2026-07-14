import type { Selectable } from 'kysely'
import type {
  AuthorizedClientData,
  ClientId,
  Did,
} from '@atproto/oauth-provider/store'
import type { DateISO, JsonEncoded } from '../../../db/index.js'

export interface AuthorizedClient {
  did: Did
  clientId: ClientId

  createdAt: DateISO
  updatedAt: DateISO

  data: JsonEncoded<AuthorizedClientData>
}

export type AuthorizedClientEntry = Selectable<AuthorizedClient>

export const tableName = 'authorized_client'

export type PartialDB = { [tableName]: AuthorizedClient }
