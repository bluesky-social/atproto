import * as pino from 'pino'

export type Logger = pino.Logger & {
  xrpcServer: pino.Logger
  xrpcStream: pino.Logger
}

export type LoggerOpts = {
  enabled: boolean
  level: string
  destination: string
}

export const isLogger = (obj: unknown): obj is Logger => {
  return (
    obj && typeof obj === 'object' && obj['xrpcServer'] && obj['xrpcStream']
  )
}

export const createLogger = (
  opts: Logger | Partial<LoggerOpts> = {},
): Logger => {
  if (isLogger(opts)) {
    return opts
  }
  const cfg = {
    enabled: opts.enabled ?? true,
    level: opts.level ?? 'info',
  }
  const root = opts.destination
    ? pino.default(cfg, pino.destination(opts.destination))
    : pino.default(cfg)
  root['xrpcServer'] = root.child({ name: 'xrpc-server' })
  root['xrpcStream'] = root.child({ name: 'xrpc-stream' })
  return root as Logger
}
