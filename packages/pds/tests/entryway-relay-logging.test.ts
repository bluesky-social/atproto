import { type Logger, symbols } from 'pino'
import {
  type MockInstance,
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { subsystemLogger } from '@atproto/common'
import { type Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import * as pdsLoggers from '../dist/logger.js'

const ENTRYWAY_DID = 'did:example:entryway'

const isLogger = (value: unknown): value is Logger =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Logger).child === 'function'

// Every logger on the request path: the PDS's subsystem loggers (httpLogger,
// which pino-http and the per-request loggers derive from, among them) and
// xrpc-server's, which subsystemLogger() returns from its cache.
const loggers = [
  ...Object.values(pdsLoggers).filter(isLogger),
  subsystemLogger('xrpc-server'),
]

describe('entryway relay logging', () => {
  let plc: TestPlc
  let pds: TestPds
  let jwtSigningKey: Secp256k1Keypair
  let otherKey: Keypair
  const levels = new Map<Logger, string>()
  let write: MockInstance<(chunk: string) => boolean> | undefined
  const written: string[] = []

  const relayToken = async (
    clientIp: string,
    keypair: Keypair,
  ): Promise<string> => {
    const b64 = (obj: Record<string, unknown>) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url')
    const iat = Math.floor(Date.now() / 1000)
    const toSign = `${b64({ alg: 'ES256K', typ: 'JWT' })}.${b64({
      iss: ENTRYWAY_DID,
      aud: pds.ctx.cfg.service.did,
      client_ip: clientIp,
      iat,
      exp: iat + 60,
    })}`
    const sig = await keypair.sign(Buffer.from(toSign, 'utf8'))
    return `${toSign}.${Buffer.from(sig).toString('base64url')}`
  }

  const describeServer = (headers: Record<string, string>) =>
    fetch(
      new URL(
        '/xrpc/com.atproto.server.describeServer',
        `http://127.0.0.1:${pds.port}`,
      ),
      { headers },
    )

  // Log lines are written asynchronously, after the response.
  const readLogsUntil = async (predicate: (logs: string) => boolean) => {
    for (let i = 0; i < 50; i++) {
      const logs = written.join('')
      if (predicate(logs)) return logs
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('expected log lines were not written')
  }

  beforeAll(async () => {
    // @NOTE The loggers read LOG_* when first imported, which may already have
    // happened in this worker, so logging is enabled at runtime instead. Every
    // logger writes to the root logger's stream.
    for (const logger of loggers) {
      levels.set(logger, logger.level)
      logger.level = 'debug'
    }
    write = vi
      .spyOn(pdsLoggers.httpLogger[symbols.streamSym], 'write')
      .mockImplementation((chunk: string) => {
        written.push(chunk)
        return true
      })

    jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    otherKey = await Secp256k1Keypair.create()
    const plcRotationKey = await Secp256k1Keypair.create()

    plc = await TestPlc.create({})
    pds = await TestPds.create({
      didPlcUrl: plc.url,
      bskyAppViewUrl: undefined,
      bskyAppViewDid: undefined,
      serviceDid: 'did:example:pds',
      entrywayUrl: 'https://entryway.invalid',
      entrywayDid: ENTRYWAY_DID,
      entrywayJwtVerifyKeyK256PublicKeyHex: jwtSigningKey.publicKeyStr('hex'),
      entrywayPlcRotationKey: plcRotationKey.did(),
    })
  })

  afterAll(async () => {
    try {
      await pds?.close()
      await plc?.close()
    } finally {
      write?.mockRestore()
      for (const [logger, level] of levels) logger.level = level
    }
  })

  it('logs neither relay tokens nor client addresses.', async () => {
    const valid = await relayToken('198.51.100.91', jwtSigningKey)
    const invalid = await relayToken('198.51.100.92', otherKey)

    expect((await describeServer({ 'x-entryway-relay': valid })).status).toBe(
      200,
    )
    expect((await describeServer({ 'x-entryway-relay': invalid })).status).toBe(
      200,
    )

    // one access log line per request
    const logs = await readLogsUntil(
      (logs) =>
        logs.split('/xrpc/com.atproto.server.describeServer').length > 2,
    )

    expect(logs.split('"x-entryway-relay":"***"')).toHaveLength(3)
    expect(logs).toContain('"reason":"ERR_JWS_SIGNATURE_VERIFICATION_FAILED"')
    for (const token of [valid, invalid]) {
      const [, payload, signature] = token.split('.')
      expect(logs).not.toContain(payload)
      expect(logs).not.toContain(signature)
    }
    expect(logs).not.toContain('198.51.100.91')
    expect(logs).not.toContain('198.51.100.92')
  })
})
