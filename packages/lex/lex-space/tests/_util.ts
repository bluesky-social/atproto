import type { TestNetworkNoAppView, TestPds } from '@atproto/dev-env'
import { type AccountAgent, Client } from '@atproto/lex-client'
import { l } from '@atproto/lex-schema'

// @NOTE The package only vendors the space lexicons. This is a trimmed mirror
// of com.atproto.server.createAccount, enough to create the test accounts.
const createAccount = l.procedure(
  'com.atproto.server.createAccount',
  l.params(),
  l.jsonPayload({
    handle: l.string({ format: 'handle' }),
    email: l.optional(l.string()),
    password: l.optional(l.string()),
  }),
  l.jsonPayload({
    did: l.string({ format: 'did' }),
    handle: l.string({ format: 'handle' }),
    accessJwt: l.string(),
    refreshJwt: l.string(),
  }),
)

export async function createUser(
  pds: TestPds,
  handle: `${string}.${string}`,
): Promise<Client> {
  const name = handle.split('.')[0]
  const { did, accessJwt } = await pds.getClient().call(createAccount, {
    handle,
    email: `${name}@test.com`,
    password: `${name}-pass`,
  })
  return new Client({
    did,
    service: pds.url,
    headers: { authorization: `Bearer ${accessJwt}` },
  })
}

export async function processNotifications(network: TestNetworkNoAppView) {
  for (const pds of [network.pds, ...network.extraPdses]) {
    await pds.ctx.backgroundQueue.processAll()
  }
}

export function agentOf(client: Client): AccountAgent {
  client.assertAuthenticated()
  return client.agent
}

export async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable) items.push(item)
  return items
}
