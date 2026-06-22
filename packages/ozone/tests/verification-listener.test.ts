import { once } from 'node:events'
import { createServer } from 'node:http'
import { AddressInfo } from 'node:net'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { WebSocketServer } from 'ws'
import { AppBskyGraphVerification } from '@atproto/api'
import { TestNetwork, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from './_util.js'

describe('verification-listener', () => {
  it('indexes new and revoked verifications', async () => {
    const server = createServer()

    // make sure to always close the server (even in case of test failure)
    const { terminate } = httpTerminator.createHttpTerminator({ server })

    // @TODO use an disposable stack when it becomes available (NodeJS 24+)
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }

    const jetstream = new WebSocketServer({ server })
    jetstream.on('connection', (ws) => {
      ws.send(JSON.stringify(createEvent))
      ws.send(JSON.stringify(deleteEvent))
    })

    // @TODO use an disposable stack when it becomes available (NodeJS 24+)
    await using __ = {
      [Symbol.asyncDispose]: async () =>
        new Promise<void>((res) => jetstream.close(res)),
    }

    await once(server.listen(0), 'listening')
    const jetstreamPort = (server.address() as AddressInfo).port

    await using network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_verification_listener_test',
      ozone: {
        verifierUrl: 'http://localhost:2583',
        verifierDid: 'did:example:verifier',
        verifierPassword: 'test',
        jetstreamUrl: `ws://localhost:${jetstreamPort}`,
      },
    })

    const sc = network.getSeedClient()
    await basicSeed(sc)

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

    const adminAgent = network.pds.getAgent()
    await adminAgent.login({
      identifier: sc.accounts[sc.dids.alice].handle,
      password: sc.accounts[sc.dids.alice].password,
    })
    await network.ozone.addAdminDid(sc.dids.alice)

    await network.processAll()

    const { verificationListener } = network.ozone.daemon.ctx

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
