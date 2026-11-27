import { afterEach, describe, expect, it, vi } from 'vitest'
import { envToCfg } from '../src/config/config.js'
import { readEnv } from '../src/config/env.js'

describe('report tagging configuration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    [undefined, false],
    ['', false],
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
  ])('OZONE_REPORT_TAGS_DISABLED=%s disables tags: %s', (value, disabled) => {
    vi.spyOn(process, 'env', 'get').mockReturnValue({
      ...(value === undefined ? {} : { OZONE_REPORT_TAGS_DISABLED: value }),
    })

    const cfg = envToCfg({
      ...readEnv(),
      publicUrl: 'https://ozone.example.com',
      serverDid: 'did:plc:ozone',
      dbPostgresUrl: 'postgresql://localhost/ozone',
      appviewUrl: 'https://appview.example.com',
      appviewDid: 'did:plc:appview',
      didPlcUrl: 'https://plc.example.com',
    })

    expect(cfg.service.reportTagsDisabled).toBe(disabled)
  })
})
