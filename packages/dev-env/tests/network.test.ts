import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestNetwork } from '../src/network.js'
import { TestPds } from '../src/pds.js'
import { TestPlc } from '../src/plc.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe(TestNetwork, () => {
  it('closes the PLC when the first dependent service fails', async () => {
    vi.stubEnv('DB_POSTGRES_URL', 'postgres://test')
    vi.stubEnv('REDIS_HOST', 'localhost')

    const failure = new Error('PDS startup failed')
    const closePlc = vi.fn(async () => {})
    const plc = {
      url: 'http://localhost:1234',
      [Symbol.asyncDispose]: closePlc,
    } as unknown as TestPlc

    using plcCreate = vi.spyOn(TestPlc, 'create').mockResolvedValue(plc)
    using pdsCreate = vi.spyOn(TestPds, 'create').mockRejectedValue(failure)

    await expect(TestNetwork.create()).rejects.toBe(failure)

    expect(plcCreate).toHaveBeenCalledOnce()
    expect(pdsCreate).toHaveBeenCalledOnce()
    expect(closePlc).toHaveBeenCalledOnce()
  })
})
