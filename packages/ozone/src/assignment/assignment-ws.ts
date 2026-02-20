import { IncomingMessage } from 'node:http'
import { Duplex } from 'node:stream'
import { RawData, WebSocket, WebSocketServer } from 'ws'
import { AssignmentService } from '.'
import { Database } from '../db'

export interface ModeratorClient {
  id: string
  ws: WebSocket
  moderatorDid: string
  subscribedQueues: number[] // Queues they're viewing
}

export type ClientMessage =
  | {
      type: 'authenticate'
      did: string
    }
  | {
      type: 'subscribe'
      queues: number[] // Subscribe to queue updates
    }
  | {
      type: 'unsubscribe'
      queues: number[]
    }
  | {
      type: 'report:review:start'
      reportId: number
      queueId?: number
    }
  | {
      type: 'report:review:end'
      reportId: number
      queueId?: number
    }
  | {
      type: 'ping' // Heartbeat
    }
export type ServerMessage =
  | {
      type: 'snapshot'
      events: AssignmentEvent[]
    }
  | {
      type: 'report:review:started'
      reportId: number
      moderator: { did: string }
      queues: number[]
    }
  | {
      type: 'report:review:ended'
      reportId: number
      moderator: { did: string }
      queues: number[]
    }
  | {
      type: 'report:actioned'
      reportIds: number[]
      actionEventId: number
      moderator: { did: string }
      queues: number[] // Which queues this affects
    }
  | {
      type: 'report:created'
      reportId: number
      queues: number[] // Which queues this should appear in
    }
  | {
      type: 'queue:assigned'
      queueId: number
    }
  | {
      type: 'pong'
    }
  | {
      type: 'error'
      message: string
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
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req))
    this.reportService = new AssignmentService(db)
  }

  // Protocol Layer
  /** Upgrade HTTP connection to WebSocket connection */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req)
    })
  }
  private async onConnection(ws: WebSocket, req: IncomingMessage) {
    const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`
    const client = {
      id: clientId,
      ws,
      moderatorDid: '',
      moderatorHandle: '',
      subscribedQueues: [],
    }
    this.clients.set(clientId, client)
    ws.on('message', (message) => this.onMessage(clientId, message))
    ws.on('close', () => this.onClose(clientId))
  }
  private async onMessage(clientId: string, data: RawData) {
    const client = this.clients.get(clientId)
    if (!client) {
      console.error('Received message from unknown client:', clientId)
      this.onClose(clientId)
      return
    }
    let parsed: ClientMessage
    try {
      parsed = JSON.parse(data.toString()) satisfies ClientMessage
    } catch (e) {
      console.error('Invalid message format', e)
      return
    }
    this.handleClientMessage(client, parsed)
  }
  private onClose(clientId: string) {
    this.clients.delete(clientId)
  }
  private send(clientId: string, messsage: ServerMessage) {
    const client = this.clients.get(clientId)
    if (!client) {
      console.error('Attempted to send message to unknown client:', clientId)
      return
    }
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(messsage))
    } else {
      console.warn('Attempted to send message to non-open WebSocket:', clientId)
    }
  }
  destroy() {
    for (const client of this.wss.clients) {
      client.close()
    }
    this.wss.close()
  }

  // Application Layer
  /** Handle messages from clients */
  private async handleClientMessage(
    client: ModeratorClient,
    message: ClientMessage,
  ) {
    try {
      switch (message.type) {
        case 'authenticate':
          client.moderatorDid = message.did
          break
        case 'subscribe':
          client.subscribedQueues = message.queues
          await this.sendSnapshot(client)
          break
        case 'unsubscribe':
          client.subscribedQueues = client.subscribedQueues.filter(
            (queue) => !message.queues.includes(queue),
          )
          break
        case 'report:review:start':
          try {
            const result = await this.reportService.claimReport({
              did: client.moderatorDid,
              reportId: message.reportId,
              queueId: message.queueId,
              assign: true,
            })
            this.broadcast({
              type: 'report:review:started',
              reportId: result.reportId,
              moderator: {
                did: client.moderatorDid,
              },
              queues: result.queueId != null ? [result.queueId] : [],
            })
          } catch (e) {
            console.error('Error claiming report:', e)
          }
          break
        case 'report:review:end':
          const result = await this.reportService.claimReport({
            did: client.moderatorDid,
            reportId: message.reportId,
            queueId: message.queueId,
            assign: false,
          })
          this.broadcast({
            type: 'report:review:ended',
            reportId: result.reportId,
            moderator: {
              did: client.moderatorDid,
            },
            queues: result.queueId != null ? [result.queueId] : [],
          })
          break
        case 'ping':
          this.send(client.id, { type: 'pong' })
          client.ws.pong(() => {}) // Respond to WebSocket-level ping for connection health
          break
      }
    } catch (e) {
      console.error('Error handling client message:', e)
      this.send(client.id, { type: 'error', message: 'Internal server error' })
    }
  }
  /** Broadcast message to relevant connections */
  broadcast(message: ServerMessage) {
    for (const clientId of this.clients.keys()) {
      const client = this.clients.get(clientId)
      if (!client) continue
      if ('queues' in message) {
        // Only send to clients subscribed to affected queues
        const subscibed = client.subscribedQueues.some((q) =>
          message.queues.includes(q),
        )
        if (!subscibed) continue
        this.send(clientId, message)
      }
    }
  }
  /** Send active assignments to client */
  private async sendSnapshot(client: ModeratorClient) {
    const assignments = await this.reportService.getAssignments({
      onlyActiveAssignments: true,
      queueIds: client.subscribedQueues,
    })
    const message: ServerMessage = {
      type: 'snapshot',
      events: assignments,
    }
    this.send(client.id, message)
  }
}
