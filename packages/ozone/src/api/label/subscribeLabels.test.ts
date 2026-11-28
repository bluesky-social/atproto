import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { expect, it, vi } from 'vitest'
import { WebSocket, type WebSocketServer } from 'ws'
import { createDeferrable } from '@atproto/common'
import { Frame, Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { com } from '../../lexicons/index.js'
import { labelStreamLogger } from '../../logger.js'
import { createSequencer, event } from '../../sequencer/_stub-sequencer.test.js'
import type { Sequencer } from '../../sequencer/sequencer.js'
import subscribeLabels from './subscribeLabels.js'

function closeServer(wss: WebSocketServer) {
  for (const client of wss.clients) client.terminate()
  return new Promise<void>((resolve, reject) =>
    wss.close((err) => (err ? reject(err) : resolve())),
  )
}

it('disconnects a stalled label socket before its send callback completes', async () => {
  const sequencer = createSequencer()
  const server = new Server()
  subscribeLabels(server, {
    sequencer,
    cfg: { service: {} },
  } as AppContext)
  const app = express()
  app.use(server.router)
  await using httpServer = app.listen(0)
  await once(httpServer, 'listening')
  const { port } = httpServer.address() as AddressInfo
  const nsid = com.atproto.label.subscribeLabels.$lxm
  const { wss } = server.subscriptions.get(nsid)!
  const url = `ws://127.0.0.1:${port}/xrpc/${nsid}`
  const connected = once(wss, 'connection')
  const slow = new WebSocket(url)
  await once(slow, 'open')
  const [socket] = (await connected) as [WebSocket]
  const healthy = new WebSocket(url)
  await once(healthy, 'open')
  const sending = createDeferrable()
  let pendingSend: ((error?: Error) => void) | undefined
  using send = vi
    .spyOn(socket, 'send')
    .mockImplementation((_data, _opts, cb) => {
      pendingSend = cb
      sending.resolve()
    })
  const disconnected = once(slow, 'close')
  try {
    for (let seq = 1; seq <= 502; seq++) {
      const received = once(healthy, 'message')
      sequencer.emit('events', [event(seq)])
      const [bytes] = await received
      expect(Frame.fromBytes(bytes).body).toEqual(event(seq))
      if (seq === 1) await sending.complete
    }
    expect(send).toHaveBeenCalledTimes(1)
    expect(pendingSend).toBeDefined()
    expect(sequencer.listenerCount('events')).toBe(1)
    await disconnected
    expect(slow.readyState).toBe(WebSocket.CLOSED)
    expect(healthy.readyState).toBe(WebSocket.OPEN)
  } finally {
    pendingSend?.(new Error('socket closed'))
    slow.terminate()
    healthy.terminate()
    await closeServer(wss)
  }
  expect(sequencer.listenerCount('events')).toBe(0)
})

it('attributes an upgraded replay connection without logging secret headers', async () => {
  const sequencer = createSequencer()
  sequencer.lastSeen = 1
  sequencer.curr = vi.fn<Sequencer['curr']>().mockResolvedValue(1)
  using _request = vi
    .spyOn(sequencer, 'requestLabelRange')
    .mockResolvedValueOnce([event(1)])
  const closed = createDeferrable()
  using info = vi
    .spyOn(labelStreamLogger, 'info')
    .mockImplementation((...args) => {
      if (args[1] === 'label subscription closed') closed.resolve()
    })
  const server = new Server()
  subscribeLabels(server, { sequencer, cfg: { service: {} } } as AppContext)
  const app = express()
  app.use(server.router)
  await using httpServer = app.listen(0)
  await once(httpServer, 'listening')
  const { port } = httpServer.address() as AddressInfo
  const nsid = com.atproto.label.subscribeLabels.$lxm
  const { wss } = server.subscriptions.get(nsid)!
  const client = new WebSocket(`ws://127.0.0.1:${port}/xrpc/${nsid}?cursor=0`, {
    headers: {
      'user-agent': 'replay-test',
      'x-forwarded-for': '198.51.100.44',
      authorization: 'Bearer secret-authorization-marker',
      cookie: 'session=secret-cookie-marker',
    },
  })
  const message = once(client, 'message')
  try {
    await once(client, 'open')
    await message
    client.terminate()
    await closed.complete
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: 0,
        userAgent: 'replay-test',
        forwardedFor: '198.51.100.44',
        remotePort: expect.any(Number),
      }),
      'label subscription started',
    )
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 0, lastSeq: 1, eventsSent: 1 }),
      'label subscription closed',
    )
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret-')
  } finally {
    client.terminate()
    await closeServer(wss)
  }
})
