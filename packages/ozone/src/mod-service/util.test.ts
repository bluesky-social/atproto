import { describe, expect, it } from 'vitest'
import type { IdResolver } from '@atproto/identity'
import { getPdsClientForRepo } from './util.js'

describe(getPdsClientForRepo, () => {
  // The counterpart to the configured PDS client: its target comes from the
  // repo's DID document and may be any third-party host, so configured
  // headers -- which can be credentials scoped to our own PDS -- must never
  // ride along. Guards against the two client factories being conflated.
  it('produces a client carrying no configured headers', async () => {
    const idResolver = {
      did: {
        resolveAtprotoData: async () => ({
          pds: 'https://third-party.example',
        }),
      },
    } as unknown as IdResolver

    const { client } = await getPdsClientForRepo(idResolver, 'did:plc:example')

    expect(client).not.toBeNull()
    expect([...(client?.headers.keys() ?? [])]).toEqual([])
  })
})
