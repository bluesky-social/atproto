import {
  AuthorizedClientData,
  AuthorizedClients,
  ClientId,
  Sub,
} from '@atproto/oauth-provider'
import { fromJson, toDateISO, toJson } from '../../db'
import { AccountDb } from '../db'

export async function upsert(
  db: AccountDb,
  did: string,
  clientId: ClientId,
  data: AuthorizedClientData,
) {
  const now = new Date()

  return db.db
    .insertInto('authorized_client')
    .values({
      did,
      clientId,
      createdAt: toDateISO(now),
      updatedAt: toDateISO(now),
      data: toJson(data),
    })
    .onConflict((oc) =>
      // uses "authorized_client_pk" idx
      oc.columns(['did', 'clientId']).doUpdateSet({
        updatedAt: toDateISO(now),
        data: toJson(data),
      }),
    )
    .executeTakeFirst()
}

export async function getAuthorizedClients(
  db: AccountDb,
  did: string,
): Promise<AuthorizedClients> {
  return (await getAuthorizedClientsMulti(db, [did])).get(did)!
}

export async function getAuthorizedClientsMulti(
  db: AccountDb,
  dids: Iterable<string>,
): Promise<Map<Sub, AuthorizedClients>> {
  // Using a Map will ensure unicity of dids (through unicity of keys)
  const map = new Map<Sub, AuthorizedClients>(
    Array.from(dids, (did) => [did, new Map()]),
  )

  if (map.size) {
    const found = await db.db
      .selectFrom('authorized_client')
      .select('did')
      .select('clientId')
      .select('data')
      // uses "authorized_client_pk"
      .where('did', 'in', [...map.keys()])
      .execute()

    for (const { did, clientId, data } of found) {
      map.get(did)!.set(clientId, fromJson(data))
    }
  }

  return map
}
