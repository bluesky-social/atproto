import { once } from 'node:events'
import { createServer } from 'node:http'
import { AddressInfo } from 'node:net'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { WebSocket, WebSocketServer } from 'ws'
import { AppBskyGraphVerification, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from './_util.js'

describe('verification-listener', () => {
  let network: TestNetwork
  let sc: SeedClient
  let adminAgent: AtpAgent
  let jetstream: WebSocketServer
  let relay: WebSocket
  let terminator: httpTerminator.HttpTerminator

  beforeAll(async () => {
    const server = createServer()
    terminator = httpTerminator.createHttpTerminator({ server })

    await once(server.listen(0), 'listening')
    const jetstreamPort = (server.address() as AddressInfo).port

    jetstream = new WebSocketServer({ server })
    const relayPromise = new Promise<WebSocket>((resolve, reject) => {
      const cleanup = () => {
        jetstream.off('connection', onConnection)
        jetstream.off('error', onError)
      }

      const onConnection = (ws: WebSocket) => {
        cleanup()
        resolve(ws)
      }

      const onError = (err: Error) => {
        cleanup()
        reject(err)
      }

      jetstream.on('connection', onConnection)
      jetstream.on('error', onError)
    })
    relayPromise.catch(() => {})

    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_verification_listener_test',
      ozone: {
        verifierUrl: 'http://localhost:2583',
        verifierDid: 'did:example:verifier',
        verifierPassword: 'test',
        jetstreamUrl: `ws://localhost:${jetstreamPort}`,
      },
    })
    sc = network.getSeedClient()
    await basicSeed(sc)

    adminAgent = network.pds.getAgent()
    await adminAgent.login({
      identifier: sc.accounts[sc.dids.alice].handle,
      password: sc.accounts[sc.dids.alice].password,
    })
    await network.ozone.addAdminDid(sc.dids.alice)

    relay = await relayPromise
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())
  afterAll(async () => relay.close())
  afterAll(async () => terminator?.terminate())

  it('indexes new and revoked verifications', async () => {
    const { verificationListener } = network.ozone.daemon.ctx
    const createEvent = {
      kind: 'commit',
      did: sc.dids.bob,
      time_us: 123456789,
      commit: {
        rev: 'xyz',
        operation: 'create',
        collection: 'app.bsky.graph.verification',
        rkey: 'abcdefg',
        cid: 'xyz',
        record: {
          $type: 'app.bsky.graph.verification',
          subject: sc.dids.alice,
          handle: sc.accounts[sc.dids.alice].handle,
          displayName: 'Alice',
          createdAt: new Date().toISOString(),
        } satisfies AppBskyGraphVerification.Record,
      },
    }
    const deleteEvent = {
      kind: 'commit',
      did: sc.dids.bob,
      time_us: 123456799,
      commit: {
        rev: 'yza',
        operation: 'delete',
        collection: 'app.bsky.graph.verification',
        rkey: 'abcdefg',
      },
    }
    relay.send(JSON.stringify(createEvent))
    relay.send(JSON.stringify(deleteEvent))
    const verificationService = network.ozone.ctx.verificationService(
      network.ozone.ctx.db,
    )
    // Wait for the listener to process the events
    let hasCursorUpdated = false
    let attempt = 0
    do {
      const cursor = await verificationService.getFirehoseCursor()
      hasCursorUpdated = cursor === 123456799
      attempt++
    } while (!hasCursorUpdated && attempt < 20)
    // Give the processor enough time to handle the events
    const {
      data: { verifications },
    } = await adminAgent.tools.ozone.verification.listVerifications({})
    const cursor = await verificationListener?.getCursor()

    expect(forSnapshot(verifications)).toMatchSnapshot()
    expect(cursor).toEqual(123456799)
  })
})
