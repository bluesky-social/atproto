import { IncomingMessage } from 'node:http'
import { Duplex } from 'node:stream'
import { RawData, WebSocket, WebSocketServer } from 'ws'
import { AssignmentService } from '.'
import { Database } from '../db'

interface ModeratorClient {
  ws: WebSocket
  moderatorDid: string
  moderatorHandle: string
  subscribedQueues: string[] // Queues they're viewing
}

type ClientMessage =
  | {
      type: 'subscribe'
      queues: string[] // Subscribe to queue updates
    }
  | {
      type: 'unsubscribe'
      queues: string[]
    }
  | {
      type: 'report:review:start'
      reportId: number
    }
  | {
      type: 'report:review:end'
      reportId: number
    }
  | {
      type: 'ping' // Heartbeat
    }

export interface AssignmentEvent {
  id: number
  did: string
  queueId: number | null
  reportId: number | null
  startAt: string
  endAt: string
}

export class AssignmentWebSocketServer {
  wss: WebSocketServer
  clients: Map<string, ModeratorClient> = new Map()
  private reportService: AssignmentService

  constructor(db: Database) {
    this.wss = new WebSocketServer({ noServer: true })
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req))
    this.reportService = new AssignmentService(db)
  }

  /** Upgrade HTTP connection to WebSocket connection */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req)
    })
  }

  /** Broadcast assignment to relevant connections */
  broadcast(assignment: AssignmentEvent) {
    const msg = JSON.stringify(assignment)
    for (const client of this.clients.values()) {
      if (
        assignment.queueId === null ||
        client.subscribedQueues.includes(String(assignment.queueId))
      ) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(msg)
        }
      }
    }
  }

  /** Handle new connection */
  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`
    const client = {
      ws,
      moderatorDid: '',
      moderatorHandle: '',
      subscribedQueues: [],
    }
    this.clients.set(clientId, client)

    ws.on('message', (message) => {
      this.handleConnectionMessage(clientId, message)
    })

    ws.on('close', () => {
      this.handleConnectionClose(clientId)
    })
  }
  private async handleConnectionMessage(clientId: string, message: RawData) {
    const client = this.clients.get(clientId)
    if (!client) {
      console.error('Received message from unknown client:', clientId)
      this.handleConnectionClose(clientId)
      return
    }

    let parsed: ClientMessage
    try {
      parsed = JSON.parse(message.toString())
    } catch (e) {
      console.error('Invalid message format', e)
      return
    }

    switch (parsed.type) {
      case 'subscribe':
        client.subscribedQueues = parsed.queues
        break
      case 'unsubscribe':
        client.subscribedQueues = client.subscribedQueues.filter(
          (queue) => !parsed.queues.includes(queue),
        )
        break
      case 'report:review:start':
        if (client.moderatorDid) {
          try {
            const result = await this.reportService.claimReport({
              did: client.moderatorDid,
              reportId: parsed.reportId,
              assign: true,
            })
            this.broadcast(result)
          } catch (e) {
            client.ws.send(
              JSON.stringify({ type: 'error', message: String(e) }),
            )
          }
        }
        break
      case 'report:review:end':
        if (client.moderatorDid) {
          try {
            const result = await this.reportService.claimReport({
              did: client.moderatorDid,
              reportId: parsed.reportId,
              assign: false,
            })
            this.broadcast(result)
          } catch (e) {
            client.ws.send(
              JSON.stringify({ type: 'error', message: String(e) }),
            )
          }
        }
        break
      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong' }))
        break
    }
  }
  private handleConnectionClose(clientId: string) {
    this.clients.delete(clientId)
  }

  destroy() {
    for (const client of this.wss.clients) {
      client.close()
    }
    this.wss.close()
  }
}
