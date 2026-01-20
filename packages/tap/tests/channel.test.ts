import { describe, expect, it } from 'vitest'
import { AddressInfo } from 'ws'
import { TapChannel, TapHandler } from '../src/channel'
import { TapEvent } from '../src/types'
import { createWebSocketServer } from './_util'

const createRecordEvent = (id: number) => ({
  id,
  type: 'record' as const,
  record: {
    did: 'did:example:alice',
    rev: '3abc123',
    collection: 'com.example.post',
    rkey: 'abc123',
    action: 'create' as const,
    record: { text: 'hello' },
    cid: 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq',
    live: true,
  },
})

const createIdentityEvent = (id: number) => ({
  id,
  type: 'identity' as const,
  identity: {
    did: 'did:example:alice',
    handle: 'alice.test',
    is_active: true,
    status: 'active' as const,
  },
})

describe('TapChannel', () => {
  describe('receiving events', () => {
    it('receives and parses record events', async () => {
      await using server = await createWebSocketServer()

      const { port } = server.address() as AddressInfo

      const receivedEvents: TapEvent[] = []

      server.on('connection', (socket) => {
        socket.send(JSON.stringify(createRecordEvent(1)))
        socket.on('message', (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ack') {
            socket.close()
          }
        })
      })

      const handler: TapHandler = {
        onEvent: async (evt, opts) => {
          receivedEvents.push(evt)
          await opts.ack()
        },
        onError: (err) => {
          throw err
        },
      }

      await using channel = new TapChannel(`ws://localhost:${port}`, handler)
      await channel.start()

      expect(receivedEvents).toHaveLength(1)
      expect(receivedEvents[0].type).toBe('record')
      expect(receivedEvents[0].did).toBe('did:example:alice')
      if (receivedEvents[0].type === 'record') {
        expect(receivedEvents[0].collection).toBe('com.example.post')
        expect(receivedEvents[0].action).toBe('create')
      }
    })

    it('receives and parses identity events', async () => {
      await using server = await createWebSocketServer()

      const { port } = server.address() as AddressInfo

      const receivedEvents: TapEvent[] = []

      server.on('connection', (socket) => {
        socket.send(JSON.stringify(createIdentityEvent(1)))
        socket.on('message', (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ack') {
            socket.close()
          }
        })
      })

      const handler: TapHandler = {
        onEvent: async (evt, opts) => {
          receivedEvents.push(evt)
          await opts.ack()
        },
        onError: (err) => {
          throw err
        },
      }

      await using channel = new TapChannel(`ws://localhost:${port}`, handler)
      await channel.start()

      expect(receivedEvents).toHaveLength(1)
      expect(receivedEvents[0].type).toBe('identity')
      expect(receivedEvents[0].did).toBe('did:example:alice')
      if (receivedEvents[0].type === 'identity') {
        expect(receivedEvents[0].handle).toBe('alice.test')
        expect(receivedEvents[0].status).toBe('active')
      }
    })
  })

  describe('ack behavior', () => {
    it('sends ack when handler calls ack()', async () => {
      await using server = await createWebSocketServer()

      const { port } = server.address() as AddressInfo

      const receivedAcks: number[] = []

      server.on('connection', (socket) => {
        socket.send(JSON.stringify(createRecordEvent(42)))
        socket.on('message', (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ack') {
            receivedAcks.push(msg.id)
            socket.close()
          }
        })
      })

      const handler: TapHandler = {
        onEvent: async (_evt, opts) => {
          await opts.ack()
        },
        onError: (err) => {
          throw err
        },
      }

      await using channel = new TapChannel(`ws://localhost:${port}`, handler)
      await channel.start()

      expect(receivedAcks).toEqual([42])
    })

    it('does not send ack if handler throws', async () => {
      await using server = await createWebSocketServer()

      const { port } = server.address() as AddressInfo

      const receivedAcks: number[] = []
      const errors: Error[] = []

      server.on('connection', (socket) => {
        socket.send(JSON.stringify(createRecordEvent(1)))
        socket.on('message', (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ack') {
            receivedAcks.push(msg.id)
          }
        })
        // Close after a short delay to let error propagate
        setTimeout(() => socket.close(), 100)
      })

      const handler: TapHandler = {
        onEvent: async () => {
          throw new Error('Handler failed')
        },
        onError: (err) => {
          errors.push(err)
        },
      }

      await using channel = new TapChannel(`ws://localhost:${port}`, handler)
      await channel.start()

      expect(receivedAcks).toHaveLength(0)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('Failed to process event')
    })

    it('does not send ack if handler does not call ack()', async () => {
      await using server = await createWebSocketServer()

      const { port } = server.address() as AddressInfo

      const receivedAcks: number[] = []

      server.on('connection', (socket) => {
        socket.send(JSON.stringify(createRecordEvent(1)))
        socket.on('message', (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ack') {
            receivedAcks.push(msg.id)
          }
        })
        // Close after a short delay
        setTimeout(() => socket.close(), 100)
      })

      const handler: TapHandler = {
        onEvent: async () => {
          // Don't call ack
        },
        onError: (err) => {
          throw err
        },
      }

      await using channel = new TapChannel(`ws://localhost:${port}`, handler)
      await channel.start()

      expect(receivedAcks).toHaveLength(0)
    })

    it('handles reconnection and receives events from new connection', async () => {
      await using server = await createWebSocketServer()

      const { port } = server.address() as AddressInfo

      const receivedEvents: TapEvent[] = []
      const receivedAcks: number[] = []
      let connectionCount = 0

      server.on('connection', (socket) => {
        connectionCount++
        // Send a different event each connection
        const eventId = connectionCount
        socket.send(JSON.stringify(createRecordEvent(eventId)))
        socket.on('message', (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ack') {
            receivedAcks.push(msg.id)
            if (connectionCount === 1) {
              // After first ack, terminate to trigger reconnect
              socket.terminate()
            } else {
              // After second ack, close cleanly
              socket.close()
            }
          }
        })
      })

      const handler: TapHandler = {
        onEvent: async (evt, opts) => {
          receivedEvents.push(evt)
          await opts.ack()
        },
        onError: () => {},
      }

      await using channel = new TapChannel(`ws://localhost:${port}`, handler, {
        maxReconnectSeconds: 1,
      })

      await channel.start()

      // Should have connected twice and received two events
      expect(connectionCount).toBe(2)
      expect(receivedEvents).toHaveLength(2)
      expect(receivedEvents[0].id).toBe(1)
      expect(receivedEvents[1].id).toBe(2)
      expect(receivedAcks).toContain(1)
      expect(receivedAcks).toContain(2)
    })
  })

  describe('multiple events', () => {
    it('processes multiple events in sequence', async () => {
      await using server = await createWebSocketServer()

      const { port } = server.address() as AddressInfo

      const receivedEvents: TapEvent[] = []
      const receivedAcks: number[] = []

      server.on('connection', (socket) => {
        socket.send(JSON.stringify(createRecordEvent(1)))
        socket.send(JSON.stringify(createRecordEvent(2)))
        socket.send(JSON.stringify(createIdentityEvent(3)))
        socket.on('message', (data) => {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ack') {
            receivedAcks.push(msg.id)
            if (receivedAcks.length === 3) {
              socket.close()
            }
          }
        })
      })

      const handler: TapHandler = {
        onEvent: async (evt, opts) => {
          receivedEvents.push(evt)
          await opts.ack()
        },
        onError: (err) => {
          throw err
        },
      }

      await using channel = new TapChannel(`ws://localhost:${port}`, handler)
      await channel.start()

      expect(receivedEvents).toHaveLength(3)
      expect(receivedEvents[0].id).toBe(1)
      expect(receivedEvents[1].id).toBe(2)
      expect(receivedEvents[2].id).toBe(3)
      expect(receivedAcks).toEqual([1, 2, 3])
    })
  })

  describe('auth', () => {
    it('includes auth header when adminPassword is provided', async () => {
      await using server = await createWebSocketServer()

      const { port } = server.address() as AddressInfo

      let receivedAuthHeader: string | undefined

      server.on('connection', (socket, request) => {
        receivedAuthHeader = request.headers.authorization
        socket.close()
      })

      const handler: TapHandler = {
        onEvent: async () => {},
        onError: () => {},
      }

      await using channel = new TapChannel(`ws://localhost:${port}`, handler, {
        adminPassword: 'secret',
      })
      await channel.start()

      expect(receivedAuthHeader).toBe('Basic YWRtaW46c2VjcmV0')
    })
  })

  describe('error handling', () => {
    it('calls onError for malformed messages', async () => {
      await using server = await createWebSocketServer()

      const { port } = server.address() as AddressInfo

      const errors: Error[] = []

      server.on('connection', (socket) => {
        socket.send('not valid json')
        setTimeout(() => socket.close(), 100)
      })

      const handler: TapHandler = {
        onEvent: async () => {},
        onError: (err) => {
          errors.push(err)
        },
      }

      await using channel = new TapChannel(`ws://localhost:${port}`, handler)
      await channel.start()

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('Failed to parse message')
    })
  })
})
