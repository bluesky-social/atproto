import type { TestPds } from '@atproto/dev-env'
import { type AccountAgent, Client } from '@atproto/lex-client'
import { l } from '@atproto/lex-schema'
import type { SpaceRefString } from '@atproto/syntax'
import type { SpacePolicy } from '../src/index.js'
import { com } from '../src/lexicons/index.js'

export const note = l.record(
  'tid',
  'com.example.spaceNote',
  l.object({ text: l.string() }),
)

export const group = l.space('any', 'com.example.group', [note])

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

/** Creates a `group` space, granting `members` read and write access. */
export async function createGroup(
  authority: Client,
  members: Client[] = [],
  policy: SpacePolicy = com.atproto.memberspace.policy.$build({}),
): Promise<SpaceRefString> {
  const { space } = await authority.call(com.atproto.space.createSpace, {
    spaceType: group.nsid,
    policy,
  })
  if (members.length) {
    await authority.call(com.atproto.memberspace.putMembers, {
      space,
      members: members.map((member) => ({
        did: member.assertDid,
        read: true,
        write: true,
      })),
    })
  }
  return space
}

/**
 * A `fetch` recording the requests made through it, which `respond` serves
 * (by default, over the network).
 */
export function recordCalls(
  respond: (request: Request) => Promise<Response> = globalThis.fetch,
) {
  const requests: Request[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    return respond(request)
  }
  const to = (method: { $lxm: string }) =>
    requests.filter((request) => nsidOf(request) === method.$lxm)
  return { fetch, requests, to }
}

export function nsidOf(request: Request): string {
  return new URL(request.url).pathname.replace(/^\/xrpc\//, '')
}

export function rkeyOf(uri: string): string {
  return uri.split('/').pop()!
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
