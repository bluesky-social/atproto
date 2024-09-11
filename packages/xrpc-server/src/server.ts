import { Readable } from 'stream'
import express, {
  Application,
  Express,
  Router,
  Request,
  Response,
  ErrorRequestHandler,
  NextFunction,
  RequestHandler,
} from 'express'
import {
  LexiconDoc,
  Lexicons,
  lexToJson,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription,
} from '@atproto/lexicon'
import { check, forwardStreamErrors, schema } from '@atproto/common'
import { ErrorFrame, Frame, MessageFrame, XrpcStreamServer } from './stream'
import {
  XRPCHandler,
  XRPCError,
  InvalidRequestError,
  HandlerOutput,
  HandlerSuccess,
  handlerSuccess,
  XRPCHandlerConfig,
  MethodNotImplementedError,
  HandlerAuth,
  AuthVerifier,
  isHandlerError,
  Options,
  XRPCStreamHandlerConfig,
  XRPCStreamHandler,
  Params,
  InternalServerError,
  XRPCReqContext,
  RateLimiterI,
  RateLimiterConsume,
  isShared,
  RateLimitExceededError,
  HandlerPipeThrough,
} from './types'
import {
  decodeQueryParams,
  getQueryParams,
  validateInput,
  validateOutput,
} from './util'
import log from './logger'
import { consumeMany } from './rate-limiter'

export function createServer(lexicons?: LexiconDoc[], options?: Options) {
  return new Server(lexicons, options)
}

export class Server {
  router: Express = express()
  routes: Router = express.Router()
  subscriptions = new Map<string, XrpcStreamServer>()
  lex = new Lexicons()
  options: Options
  middleware: Record<'json' | 'text', RequestHandler>
  globalRateLimiters: RateLimiterI[]
  sharedRateLimiters: Record<string, RateLimiterI>
  routeRateLimiterFns: Record<string, RateLimiterConsume[]>

  constructor(lexicons?: LexiconDoc[], opts?: Options) {
    if (lexicons) {
      this.addLexicons(lexicons)
    }
    this.router.use(this.routes)
    this.router.use('/xrpc/:methodId', this.catchall.bind(this))
    this.router.use(errorMiddleware)
    this.router.once('mount', (app: Application) => {
      this.enableStreamingOnListen(app)
    })
    this.options = opts ?? {}
    this.middleware = {
      json: express.json({ limit: opts?.payload?.jsonLimit }),
      text: express.text({ limit: opts?.payload?.textLimit }),
    }
    this.globalRateLimiters = []
    this.sharedRateLimiters = {}
    this.routeRateLimiterFns = {}
    if (opts?.rateLimits?.global) {
      for (const limit of opts.rateLimits.global) {
        const rateLimiter = opts.rateLimits.creator({
          ...limit,
          keyPrefix: `rl-${limit.name}`,
        })
        this.globalRateLimiters.push(rateLimiter)
      }
    }
    if (opts?.rateLimits?.shared) {
      for (const limit of opts.rateLimits.shared) {
        const rateLimiter = opts.rateLimits.creator({
          ...limit,
          keyPrefix: `rl-${limit.name}`,
        })
        this.sharedRateLimiters[limit.name] = rateLimiter
      }
    }
  }

  // handlers
  // =

  method(nsid: string, configOrFn: XRPCHandlerConfig | XRPCHandler) {
    this.addMethod(nsid, configOrFn)
  }

  addMethod(nsid: string, configOrFn: XRPCHandlerConfig | XRPCHandler) {
    const config =
      typeof configOrFn === 'function' ? { handler: configOrFn } : configOrFn
    const def = this.lex.getDef(nsid)
    if (def?.type === 'query' || def?.type === 'procedure') {
      this.addRoute(nsid, def, config)
    } else {
      throw new Error(`Lex def for ${nsid} is not a query or a procedure`)
    }
  }

  streamMethod(
    nsid: string,
    configOrFn: XRPCStreamHandlerConfig | XRPCStreamHandler,
  ) {
    this.addStreamMethod(nsid, configOrFn)
  }

  addStreamMethod(
    nsid: string,
    configOrFn: XRPCStreamHandlerConfig | XRPCStreamHandler,
  ) {
    const config =
      typeof configOrFn === 'function' ? { handler: configOrFn } : configOrFn
    const def = this.lex.getDef(nsid)
    if (def?.type === 'subscription') {
      this.addSubscription(nsid, def, config)
    } else {
      throw new Error(`Lex def for ${nsid} is not a subscription`)
    }
  }

  // schemas
  // =

  addLexicon(doc: LexiconDoc) {
    this.lex.add(doc)
  }

  addLexicons(docs: LexiconDoc[]) {
    for (const doc of docs) {
      this.addLexicon(doc)
    }
  }

  // http
  // =

  protected async addRoute(
    nsid: string,
    def: LexXrpcQuery | LexXrpcProcedure,
    config: XRPCHandlerConfig,
  ) {
    const verb: 'post' | 'get' = def.type === 'procedure' ? 'post' : 'get'
    const middleware: RequestHandler[] = []
    middleware.push(createLocalsMiddleware(nsid))
    if (config.auth) {
      middleware.push(createAuthMiddleware(config.auth))
    }
    if (verb === 'post') {
      middleware.push(this.middleware.json)
      middleware.push(this.middleware.text)
    }
    this.setupRouteRateLimits(nsid, config)
    this.routes[verb](
      `/xrpc/${nsid}`,
      ...middleware,
      this.createHandler(nsid, def, config),
    )
  }

  async catchall(req: Request, res: Response, next: NextFunction) {
    if (this.globalRateLimiters) {
      try {
        const rlRes = await consumeMany(
          {
            req,
            res,
            auth: undefined,
            params: {},
            input: undefined,
          },
          this.globalRateLimiters.map(
            (rl) => (ctx: XRPCReqContext) => rl.consume(ctx),
          ),
        )
        if (rlRes instanceof RateLimitExceededError) {
          return next(rlRes)
        }
      } catch (err) {
        return next(err)
      }
    }

    if (this.options.catchall) {
      return this.options.catchall(req, res, next)
    }

    const def = this.lex.getDef(req.params.methodId)
    if (!def) {
      return next(new MethodNotImplementedError())
    }
    // validate method
    if (def.type === 'query' && req.method !== 'GET') {
      return next(
        new InvalidRequestError(
          `Incorrect HTTP method (${req.method}) expected GET`,
        ),
      )
    } else if (def.type === 'procedure' && req.method !== 'POST') {
      return next(
        new InvalidRequestError(
          `Incorrect HTTP method (${req.method}) expected POST`,
        ),
      )
    }
    return next()
  }

  createHandler(
    nsid: string,
    def: LexXrpcQuery | LexXrpcProcedure,
    routeCfg: XRPCHandlerConfig,
  ): RequestHandler {
    const routeOpts = {
      blobLimit: routeCfg.opts?.blobLimit ?? this.options.payload?.blobLimit,
    }
    const validateReqInput = (req: Request) =>
      validateInput(nsid, def, req, routeOpts, this.lex)
    const validateResOutput =
      this.options.validateResponse === false
        ? (output?: HandlerSuccess) => output
        : (output?: HandlerSuccess) =>
            validateOutput(nsid, def, output, this.lex)
    const assertValidXrpcParams = (params: unknown) =>
      this.lex.assertValidXrpcParams(nsid, params)
    const rlFns = this.routeRateLimiterFns[nsid] ?? []
    const consumeRateLimit = (reqCtx: XRPCReqContext) =>
      consumeMany(reqCtx, rlFns)

    return async function (req, res, next) {
      try {
        // validate request
        let params = decodeQueryParams(def, req.query)
        try {
          params = assertValidXrpcParams(params) as Params
        } catch (e) {
          throw new InvalidRequestError(String(e))
        }
        const input = validateReqInput(req)

        const locals: RequestLocals = req[kRequestLocals]

        const reqCtx: XRPCReqContext = {
          params,
          input,
          auth: locals.auth,
          req,
          res,
        }

        // handle rate limits
        const result = await consumeRateLimit(reqCtx)
        if (result instanceof RateLimitExceededError) {
          return next(result)
        }

        // run the handler
        const outputUnvalidated = await routeCfg.handler(reqCtx)

        if (isHandlerError(outputUnvalidated)) {
          throw XRPCError.fromError(outputUnvalidated)
        }

        if (outputUnvalidated && isHandlerPipeThrough(outputUnvalidated)) {
          // set headers
          if (outputUnvalidated?.headers) {
            Object.entries(outputUnvalidated.headers).forEach(([name, val]) => {
              res.header(name, val)
            })
          }
          res
            .header('Content-Type', outputUnvalidated.encoding)
            .status(200)
            .send(Buffer.from(outputUnvalidated.buffer))
          return
        }

        if (!outputUnvalidated || isHandlerSuccess(outputUnvalidated)) {
          // validate response
          const output = validateResOutput(outputUnvalidated)
          // set headers
          if (output?.headers) {
            Object.entries(output.headers).forEach(([name, val]) => {
              res.header(name, val)
            })
          }
          // send response
          if (
            output?.encoding === 'application/json' ||
            output?.encoding === 'json'
          ) {
            const json = lexToJson(output.body)
            res.status(200).json(json)
          } else if (output?.body instanceof Readable) {
            res.header('Content-Type', output.encoding)
            res.status(200)
            res.once('error', (err) => res.destroy(err))
            forwardStreamErrors(output.body, res)
            output.body.pipe(res)
          } else if (output) {
            res
              .header('Content-Type', output.encoding)
              .status(200)
              .send(
                output.body instanceof Uint8Array
                  ? Buffer.from(output.body)
                  : output.body,
              )
          } else {
            res.status(200).end()
          }
        }
      } catch (err: unknown) {
        // Express will not call the next middleware (errorMiddleware in this case)
        // if the value passed to next is false-y (e.g. null, undefined, 0).
        // Hence we replace it with an InternalServerError.
        if (!err) {
          next(new InternalServerError())
        } else {
          next(err)
        }
      }
    }
  }

  protected async addSubscription(
    nsid: string,
    def: LexXrpcSubscription,
    config: XRPCStreamHandlerConfig,
  ) {
    const assertValidXrpcParams = (params: unknown) =>
      this.lex.assertValidXrpcParams(nsid, params)
    this.subscriptions.set(
      nsid,
      new XrpcStreamServer({
        noServer: true,
        handler: async function* (req, signal) {
          try {
            // authenticate request
            const auth = await config.auth?.({ req })
            if (isHandlerError(auth)) {
              throw XRPCError.fromError(auth)
            }
            // validate request
            let params = decodeQueryParams(def, getQueryParams(req.url))
            try {
              params = assertValidXrpcParams(params) as Params
            } catch (e) {
              throw new InvalidRequestError(String(e))
            }
            // stream
            const items = config.handler({ req, params, auth, signal })
            for await (const item of items) {
              if (item instanceof Frame) {
                yield item
                continue
              }
              const type = item?.['$type']
              if (!check.is(item, schema.map) || typeof type !== 'string') {
                yield new MessageFrame(item)
                continue
              }
              const split = type.split('#')
              let t: string
              if (
                split.length === 2 &&
                (split[0] === '' || split[0] === nsid)
              ) {
                t = `#${split[1]}`
              } else {
                t = type
              }
              const clone = { ...item }
              delete clone['$type']
              yield new MessageFrame(clone, { type: t })
            }
          } catch (err) {
            const xrpcErrPayload = XRPCError.fromError(err).payload
            yield new ErrorFrame({
              error: xrpcErrPayload.error ?? 'Unknown',
              message: xrpcErrPayload.message,
            })
          }
        },
      }),
    )
  }

  private enableStreamingOnListen(app: Application) {
    const _listen = app.listen
    app.listen = (...args) => {
      // @ts-ignore the args spread
      const httpServer = _listen.call(app, ...args)
      httpServer.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url || '', 'http://x')
        const sub = url.pathname.startsWith('/xrpc/')
          ? this.subscriptions.get(url.pathname.replace('/xrpc/', ''))
          : undefined
        if (!sub) return socket.destroy()
        sub.wss.handleUpgrade(req, socket, head, (ws) =>
          sub.wss.emit('connection', ws, req),
        )
      })
      return httpServer
    }
  }

  private setupRouteRateLimits(nsid: string, config: XRPCHandlerConfig) {
    this.routeRateLimiterFns[nsid] = []
    for (const limit of this.globalRateLimiters) {
      const consumeFn = async (ctx: XRPCReqContext) => {
        return limit.consume(ctx)
      }
      this.routeRateLimiterFns[nsid].push(consumeFn)
    }

    if (config.rateLimit) {
      const limits = Array.isArray(config.rateLimit)
        ? config.rateLimit
        : [config.rateLimit]
      this.routeRateLimiterFns[nsid] = []
      for (let i = 0; i < limits.length; i++) {
        const limit = limits[i]
        const { calcKey, calcPoints } = limit
        if (isShared(limit)) {
          const rateLimiter = this.sharedRateLimiters[limit.name]
          if (rateLimiter) {
            const consumeFn = (ctx: XRPCReqContext) =>
              rateLimiter.consume(ctx, {
                calcKey,
                calcPoints,
              })
            this.routeRateLimiterFns[nsid].push(consumeFn)
          }
        } else {
          const { durationMs, points } = limit
          const rateLimiter = this.options.rateLimits?.creator({
            keyPrefix: `nsid-${i}`,
            durationMs,
            points,
            calcKey,
            calcPoints,
          })
          if (rateLimiter) {
            this.sharedRateLimiters[nsid] = rateLimiter
            const consumeFn = (ctx: XRPCReqContext) =>
              rateLimiter.consume(ctx, {
                calcKey,
                calcPoints,
              })
            this.routeRateLimiterFns[nsid].push(consumeFn)
          }
        }
      }
    }
  }
}

function isHandlerSuccess(v: HandlerOutput): v is HandlerSuccess {
  return handlerSuccess.safeParse(v).success
}

function isHandlerPipeThrough(v: HandlerOutput): v is HandlerPipeThrough {
  if (v === null || typeof v !== 'object') {
    return false
  }
  if (!isString(v['encoding']) || !(v['buffer'] instanceof ArrayBuffer)) {
    return false
  }
  if (v['headers'] !== undefined) {
    if (v['headers'] === null || typeof v['headers'] !== 'object') {
      return false
    }
    if (!Object.values(v['headers']).every(isString)) {
      return false
    }
  }
  return true
}

const isString = (val: unknown): val is string => typeof val === 'string'

const kRequestLocals = Symbol('requestLocals')

function createLocalsMiddleware(nsid: string): RequestHandler {
  return function (req, _res, next) {
    const locals: RequestLocals = { auth: undefined, nsid }
    req[kRequestLocals] = locals
    return next()
  }
}

type RequestLocals = {
  auth: HandlerAuth | undefined
  nsid: string
}

function createAuthMiddleware(verifier: AuthVerifier): RequestHandler {
  return async function (req, res, next) {
    try {
      const result = await verifier({ req, res })
      if (isHandlerError(result)) {
        throw XRPCError.fromError(result)
      }
      const locals: RequestLocals = req[kRequestLocals]
      locals.auth = result
      next()
    } catch (err: unknown) {
      next(err)
    }
  }
}

const errorMiddleware: ErrorRequestHandler = function (err, req, res, next) {
  const locals: RequestLocals | undefined = req[kRequestLocals]
  const methodSuffix = locals ? ` method ${locals.nsid}` : ''
  const xrpcError = XRPCError.fromError(err)
  if (xrpcError instanceof InternalServerError) {
    // log trace for unhandled exceptions
    log.error(err, `unhandled exception in xrpc${methodSuffix}`)
  } else {
    // do not log trace for known xrpc errors
    log.error(
      {
        status: xrpcError.type,
        message: xrpcError.message,
        name: xrpcError.customErrorName,
      },
      `error in xrpc${methodSuffix}`,
    )
  }
  if (res.headersSent) {
    return next(err)
  }
  return res.status(xrpcError.type).json(xrpcError.payload)
}
