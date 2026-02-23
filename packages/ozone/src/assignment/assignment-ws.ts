import { IncomingMessage } from 'node:http'
import { Duplex } from 'node:stream'
import { RawData, WebSocket, WebSocketServer } from 'ws'
import { IdResolver } from '@atproto/identity'
import { verifyJwt } from '@atproto/xrpc-server'
import type { AssignmentService } from '.'
import { TeamService } from '../team'

export interface ModeratorClient {
  id: string
  ws: WebSocket
  moderatorDid: string
  subscribedQueues: number[] // Queues they're viewing
}

export type ClientMessage =
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

export interface AssignmentWebSocketServerOpts {
  serviceDid: string
  idResolver: IdResolver
  teamService: TeamService
}

export class AssignmentWebSocketServer {
  wss: WebSocketServer
  clients: Map<string, ModeratorClient> = new Map()
  private assignmentService: AssignmentService
  private serviceDid: string
  private idResolver: IdResolver
  private teamService: TeamService

  constructor(
    assignmentService: AssignmentService,
    opts: AssignmentWebSocketServerOpts,
  ) {
    this.wss = new WebSocketServer({ noServer: true })
    this.assignmentService = assignmentService
    this.serviceDid = opts.serviceDid
    this.idResolver = opts.idResolver
    this.teamService = opts.teamService
  }

  // Protocol Layer
  /** Upgrade HTTP connection to WebSocket connection */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    this.authenticateRequest(req)
      .then((moderatorDid) => {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.onConnection(ws, req, moderatorDid)
        })
      })
      .catch(() => {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
      })
  }

  private async authenticateRequest(req: IncomingMessage): Promise<string> {
    const authorization = req.headers.authorization
    if (!authorization?.startsWith('Bearer ')) {
      throw new Error('Missing authorization')
    }
    const jwtStr = authorization.slice('Bearer '.length).trim()
    const getSigningKey = async (
      did: string,
      forceRefresh: boolean,
    ): Promise<string> => {
      const atprotoData = await this.idResolver.did.resolveAtprotoData(
        did,
        forceRefresh,
      )
      return atprotoData.signingKey
    }
    const payload = await verifyJwt(
      jwtStr,
      this.serviceDid,
      null,
      getSigningKey,
    )
    const member = await this.teamService.getMember(payload.iss)
    if (!member || member.disabled) {
      throw new Error('Not a team member')
    }
    const { isTriage } = this.teamService.getMemberRole(member)
    if (!isTriage) {
      throw new Error('Not a moderator')
    }
    return payload.iss
  }

  private onConnection(
    ws: WebSocket,
    req: IncomingMessage,
    moderatorDid: string,
  ) {
    const clientId = `${moderatorDid}:${req.socket.remotePort}`
    const client: ModeratorClient = {
      id: clientId,
      ws,
      moderatorDid,
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
            const result = await this.assignmentService.claimReport({
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
          const result = await this.assignmentService.claimReport({
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
    const assignments = await this.assignmentService.getAssignments({
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
