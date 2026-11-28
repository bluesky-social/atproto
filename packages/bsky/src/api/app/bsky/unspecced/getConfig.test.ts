import { describe, expect, it, vi } from 'vitest'
import type { Server } from '@atproto/xrpc-server'
import { ServerConfig, type ServerConfigValues } from '../../../../config.js'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import register from './getConfig.js'

const defs = app.bsky.unspecced.getConfig

async function getConfig(values: Partial<ServerConfigValues>) {
  const add = vi.fn(
    (
      _schema: unknown,
      _config: {
        handler: () => Promise<{
          body: app.bsky.unspecced.getConfig.$OutputBody
        }>
      },
    ) => {},
  )
  const cfg = new ServerConfig(values as ServerConfigValues)
  register({ add } as unknown as Server, { cfg } as AppContext)

  expect(add).toHaveBeenCalledOnce()
  const [schema, { handler }] = add.mock.calls[0]
  expect(schema).toBe(defs)
  const { body } = await handler()
  expect(defs.$output.schema.$matches(body)).toBe(true)
  return body
}

describe('app.bsky.unspecced.getConfig', () => {
  it('omits the live now config when it is not configured', async () => {
    const body = await getConfig({})
    expect(body.liveNow).toBeUndefined()
  })

  it('returns the configured live now config', async () => {
    const liveNowConfig = [
      {
        did: 'did:plc:asdf123' as const,
        domains: ['example.com', 'atproto.com'],
      },
      { did: 'did:plc:sdfg234' as const, domains: ['example.com'] },
    ]
    const body = await getConfig({ liveNowConfig })
    expect(body.liveNow).toEqual(liveNowConfig)
  })
})
