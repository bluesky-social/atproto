import type { TestNetworkNoAppView, TestPds } from '@atproto/dev-env'
import { type AuthenticatedAgent, Client } from '@atproto/lex-client'
import { com } from './lexicons/index.js'

export async function createUser(
  pds: TestPds,
  handle: `${string}.${string}`,
): Promise<Client> {
  const name = handle.split('.')[0]
  const { did, accessJwt } = await pds
    .getClient()
    .call(com.atproto.server.createAccount, {
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

export function agentOf(client: Client): AuthenticatedAgent {
  client.assertAuthenticated()
  return client.agent
}

export async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable) items.push(item)
  return items
}
