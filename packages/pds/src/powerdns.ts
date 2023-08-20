import net from 'node:net'

import type { AppContext } from './context'

function emailToRname(email: string): string {
  const [username, domain] = email.split('@')
  const escaped = username.replace('.', '\\.')
  return `${escaped}.${domain}`
}

function buildAuthority(
  nameServer: string,
  email: string,
  serial: number,
  refresh: number,
  retry: number,
  expire: number,
  minimumTtl: number,
): string {
  return [
    nameServer,
    emailToRname(email),
    serial,
    refresh,
    retry,
    expire,
    minimumTtl,
  ].join(' ')
}

export class PowerDnsBackend {
  ctx: AppContext
  server: net.Server

  constructor(ctx: AppContext) {
    this.ctx = ctx
    this.server = net.createServer(this.onSocket)
  }

  start() {
    this.server.listen(this.ctx.cfg.powerDnsPipePath)
  }

  destroy(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async resolve(qtype: string, qname: string): Promise<string | null> {
    const qnameLower = qname.toLowerCase()

    const pdsDomain = this.ctx.cfg.availableUserDomains.find((d: string) =>
      qnameLower.endsWith(d),
    )
    if (pdsDomain == null) {
      return null
    }

    if (qtype === 'SOA') {
      return buildAuthority(
        this.ctx.cfg.powerDnsNameServer!,
        this.ctx.cfg.powerDnsSoaEmail!,
        this.getSerial(),
        this.ctx.cfg.powerDnsSoaRefresh!,
        this.ctx.cfg.powerDnsSoaRetry!,
        this.ctx.cfg.powerDnsSoaExpire!,
        this.ctx.cfg.powerDnsSoaMinimum!,
      )
    }

    if (qtype === 'TXT') {
      const user = await this.ctx.services
        .account(this.ctx.db)
        .getAccount(qnameLower, true)
      if (user) {
        return `did=${user.did}`
      }
      return null
    }

    return null
  }

  getSerial(): number {
    // TODO: return db write timestamp or smth?
    return 1
  }

  onSocket = (socket: net.Socket) => {
    socket.setEncoding('utf8')

    const write = (result: any) => {
      const message = JSON.stringify(result)
      socket.write(message)
    }

    socket.on('data', async (data: string) => {
      const message = JSON.parse(data)

      switch (message.method) {
        case 'initialize':
          write(true)
          break
        case 'lookup': {
          const { qtype, qname } = message.parameters
          const content = await this.resolve(qtype, qname)
          if (content == null) {
            write(false)
          } else {
            write([
              {
                qtype,
                qname,
                ttl: this.ctx.cfg.powerDnsRecordTtl,
                content,
              },
            ])
          }
          break
        }
        default:
          write(false)
          break
      }
    })
  }
}
