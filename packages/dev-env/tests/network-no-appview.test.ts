import { describe, expect, it, vi } from 'vitest'
import { TestNetworkNoAppView } from '../src/network-no-appview.js'
import { TestPds } from '../src/pds.js'
import { TestPlc } from '../src/plc.js'

describe(TestNetworkNoAppView, () => {
  it('closes the PLC when PDS startup fails', async () => {
    const failure = new Error('PDS startup failed')
    const closePlc = vi.fn(async () => {})
    const plc = {
      url: 'http://localhost:1234',
      [Symbol.asyncDispose]: closePlc,
    } as unknown as TestPlc

    using plcCreate = vi.spyOn(TestPlc, 'create').mockResolvedValue(plc)
    using pdsCreate = vi.spyOn(TestPds, 'create').mockRejectedValue(failure)

    await expect(TestNetworkNoAppView.create()).rejects.toBe(failure)

    expect(plcCreate).toHaveBeenCalledOnce()
    expect(pdsCreate).toHaveBeenCalledOnce()
    expect(closePlc).toHaveBeenCalledOnce()
  })
})
