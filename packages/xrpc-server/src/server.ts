import assert from 'node:assert'
import { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import express, {
  Application,
  ErrorRequestHandler,
  Express,
  Request,
  RequestHandler,
  Router,
} from 'express'
import { check, schema } from '@atproto/common'
import { LexMap, LexValue } from '@atproto/lex-data'
import {
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription,
  LexiconDoc,
  Lexicons,
  lexToJson,
} from '@atproto/lexicon'
import {
  InternalServerError,
  InvalidRequestError,
  MethodNotImplementedError,
  XRPCError,
  excludeErrorResult,
  isErrorResult,
} from './errors'
import log, { LOGGER_NAME } from './logger'
import {
  CalcKeyFn,
  CalcPointsFn,
  RateLimiterI,
  RateLimiterOptions,
  RouteRateLimiter,
  WrappedRateLimiter,
} from './rate-limiter'
import { ErrorFrame, Frame, MessageFrame, XrpcStreamServer } from './stream'
import {
  Auth,
  AuthResult,
  AuthVerifier,
  CatchallHandler,
  HandlerContext,
  HandlerSuccess,
  Input,
  MethodConfig,
  MethodConfigOrHandler,
  Options,
  Params,
  RouteOptions,
  ServerRateLimitDescription,
  StreamConfig,
  StreamConfigOrHandler,
  isHandlerPipeThroughBuffer,
  isHandlerPipeThroughStream,
  isSharedRateLimitOpts,
} from './types'
import {
  asArray,
  createInputVerifier,
  decodeQueryParams,
  extractUrlNsid,
  getQueryParams,
  setHeaders,
  validateOutput,
} from './util'

export function createServer(lexicons?: LexiconDoc[], options?: Options) {
  return new Server(lexicons, options)
}

export class Server {
  router: Express = express()
  routes: Router = Router()
  subscriptions = new Map<string, XrpcStreamServer>()
  lex = new Lexicons()
  options: Options
  globalRateLimiter?: RouteRateLimiter<HandlerContext>
  sharedRateLimiters?: Map<string, RateLimiterI<HandlerContext>>

  constructor(lexicons?: LexiconDoc[], opts: Options = {}) {
    if (lexicons) {
      this.addLexicons(lexicons)
    }
    this.router.use(this.routes)
    this.router.use(this.catchall)
    this.router.use(createErrorMiddleware(opts))
    this.router.once('mount', (app: Application) => {
      this.enableStreamingOnListen(app)
    })
    this.options = opts

    if (opts.rateLimits) {
      const { global, shared, creator, bypass } = opts.rateLimits

      if (global) {
        this.globalRateLimiter = RouteRateLimiter.from(
          global.map((options) => creator(buildRateLimiterOptions(options))),
          { bypass },
        )
      }

      if (shared) {
        this.sharedRateLimiters = new Map(
          shared.map((options) => [
            options.name,
            creator(buildRateLimiterOptions(options)),
          ]),
        )
      }
    }
  }

  // handlers
  // =

  method<A extends Auth = Auth>(
    nsid: string,
    configOrFn: MethodConfigOrHandler<A>,
  ) {
    this.addMethod(nsid, configOrFn)
  }

  addMethod<A extends Auth = Auth>(
    nsid: string,
    configOrFn: MethodConfigOrHandler<A>,
  ) {
    const config =
      typeof configOrFn === 'function' ? { handler: configOrFn } : configOrFn
    const def = this.lex.getDef(nsid)
    if (def?.type === 'query' || def?.type === 'procedure') {
      this.addRoute(nsid, def, config)
    } else {
      throw new Error(`Lex def for ${nsid} is not a query or a procedure`)
    }
  }

  streamMethod<A extends Auth = Auth>(
    nsid: string,
    configOrFn: StreamConfigOrHandler<A>,
  ) {
    this.addStreamMethod(nsid, configOrFn)
  }

  addStreamMethod<A extends Auth = Auth>(
    nsid: string,
    configOrFn: StreamConfigOrHandler<A>,
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

  protected async addRoute<A extends Auth = Auth>(
    nsid: string,
    def: LexXrpcQuery | LexXrpcProcedure,
    config: MethodConfig<A>,
  ) {
    const path = `/xrpc/${nsid}`
    const handler = this.createHandler(nsid, def, config)

    if (def.type === 'procedure') {
      this.routes.post(path, handler)
    } else {
      this.routes.get(path, handler)
    }
  }

  catchall: CatchallHandler = async (req, res, next) => {
    // catchall handler only applies to XRPC routes
    if (!req.url.startsWith('/xrpc/')) return next()

    // Validate the NSID
    const nsid = extractUrlNsid(req.url)
    if (!nsid) {
      return next(new InvalidRequestError('invalid xrpc path'))
    }

    if (this.globalRateLimiter) {
      try {
        await this.globalRateLimiter.handle({
          req,
          res,
          auth: undefined,
          params: {},
          input: undefined,
          async resetRouteRateLimits() {},
        })
      } catch (err) {
        return next(err)
      }
    }

    // Ensure that known XRPC methods are only called with the correct HTTP
    // method.
    const def = this.lex.getDef(nsid)
    if (def) {
      const expectedMethod =
        def.type === 'procedure' ? 'POST' : def.type === 'query' ? 'GET' : null
      if (expectedMethod != null && expectedMethod !== req.method) {
        return next(
          new InvalidRequestError(
            `Incorrect HTTP method (${req.method}) expected ${expectedMethod}`,
          ),
        )
      }
    }

    if (this.options.catchall) {
      this.options.catchall.call(null, req, res, next)
    } else if (!def) {
      next(new MethodNotImplementedError())
    } else {
      next()
    }
  }

  protected createParamsVerifier(
    nsid: string,
    def: LexXrpcQuery | LexXrpcProcedure | LexXrpcSubscription,
  ) {
    return (req: Request | IncomingMessage): Params => {
      const queryParams = 'query' in req ? req.query : getQueryParams(req.url)
      const params: Params = decodeQueryParams(def, queryParams)
      try {
        return this.lex.assertValidXrpcParams(nsid, params) as Params
      } catch (e) {
        throw new InvalidRequestError(String(e))
      }
    }
  }

  protected createInputVerifier(
    nsid: string,
    def: LexXrpcQuery | LexXrpcProcedure,
    routeOpts: RouteOptions,
  ) {
    return createInputVerifier(nsid, def, routeOpts, this.lex)
  }

  protected createAuthVerifier<C, A extends Auth>(cfg: {
    auth?: AuthVerifier<C, A & AuthResult>
  }): null | ((ctx: C) => Promise<A>) {
    const { auth } = cfg
    if (!auth) return null

    return async (ctx: C) => {
      const result = await auth(ctx)
      return excludeErrorResult(result)
    }
  }

  createHandler<A extends Auth = Auth>(
    nsid: string,
    def: LexXrpcQuery | LexXrpcProcedure,
    cfg: MethodConfig<A>,
  ): RequestHandler {
    const authVerifier = this.createAuthVerifier(cfg)
    const paramsVerifier = this.createParamsVerifier(nsid, def)
    const inputVerifier = this.createInputVerifier(nsid, def, {
      blobLimit: cfg.opts?.blobLimit ?? this.options.payload?.blobLimit,
      jsonLimit: cfg.opts?.jsonLimit ?? this.options.payload?.jsonLimit,
      textLimit: cfg.opts?.textLimit ?? this.options.payload?.textLimit,
    })

    const validateResOutput =
      this.options.validateResponse === false
        ? null
        : (output: void | HandlerSuccess) =>
            validateOutput(nsid, def, output, this.lex)

    const routeLimiter = this.createRouteRateLimiter(nsid, cfg)

    return async function (req, res, next) {
      try {
        // parse & validate params
        const params: Params = paramsVerifier(req)

        // authenticate request
        const auth: A = authVerifier
          ? await authVerifier({ req, res, params })
          : (undefined as A)

        // parse & validate input
        const input: Input = await inputVerifier(req, res)

        const ctx: HandlerContext<A> = {
          params,
          input,
          auth,
          req,
          res,
          resetRouteRateLimits: async () => routeLimiter?.reset(ctx),
        }

        // handle rate limits
        if (routeLimiter) await routeLimiter.handle(ctx)

        // run the handler
        const output = await cfg.handler(ctx)

        if (!output) {
          validateResOutput?.(output)
          res.status(200)
          res.end()
        } else if (isHandlerPipeThroughStream(output)) {
          setHeaders(res, output.headers)
          res.status(200)
          res.header('Content-Type', output.encoding)
          await pipeline(output.stream, res)
        } else if (isHandlerPipeThroughBuffer(output)) {
          setHeaders(res, output.headers)
          res.status(200)
          res.header('Content-Type', output.encoding)
          res.end(output.buffer)
        } else if (isErrorResult(output)) {
          next(XRPCError.fromError(output))
        } else {
          validateResOutput?.(output)

          res.status(200)
          setHeaders(res, output.headers)

          if (
            output.encoding === 'application/json' ||
            output.encoding === 'json'
          ) {
            const json = lexToJson(output.body)
            res.json(json)
          } else if (output.body instanceof Readable) {
            res.header('Content-Type', output.encoding)
            await pipeline(output.body, res)
          } else {
            res.header('Content-Type', output.encoding)
            res.send(
              Buffer.isBuffer(output.body)
                ? output.body
                : output.body instanceof Uint8Array
                  ? Buffer.from(output.body)
                  : output.body,
            )
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

  protected async addSubscription<A extends Auth = Auth>(
    nsid: string,
    def: LexXrpcSubscription,
    cfg: StreamConfig<A>,
  ) {
    const paramsVerifier = this.createParamsVerifier(nsid, def)
    const authVerifier = this.createAuthVerifier(cfg)

    const { handler } = cfg
    this.subscriptions.set(
      nsid,
      new XrpcStreamServer({
        noServer: true,
        handler: async function* (req, signal) {
          try {
            // validate request
            const params = paramsVerifier(req)
            // authenticate request
            const auth = authVerifier
              ? await authVerifier({ req, params })
              : (undefined as A)
            // stream
            for await (const item of handler({ req, params, auth, signal })) {
              if (item instanceof Frame) {
                yield item
                continue
              }
              const type = item?.['$type']
              if (!check.is(item, schema.map) || typeof type !== 'string') {
                yield new MessageFrame(item as LexValue)
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
              const { $type: _, ...clone } = item as LexMap
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
        const nsid = req.url ? extractUrlNsid(req.url) : undefined
        const sub = nsid ? this.subscriptions.get(nsid) : undefined
        if (!sub) return socket.destroy()
        sub.wss.handleUpgrade(req, socket, head, (ws) =>
          sub.wss.emit('connection', ws, req),
        )
      })
      return httpServer
    }
  }

  private createRouteRateLimiter<A extends Auth, C extends HandlerContext>(
    nsid: string,
    config: MethodConfig<A>,
  ): RouteRateLimiter<C> | undefined {
    // @NOTE global & shared rate limiters are instantiated with a context of
    // HandlerContext which is compatible (more generic) with the context of
    // this route specific rate limiters (C). For this reason, it's safe to
    // cast these with an `any` context

    const globalRateLimiter = this.globalRateLimiter as
      | RouteRateLimiter<any>
      | undefined

    // No route specific rate limiting configured, use the global rate limiter.
    if (!config.rateLimit) return globalRateLimiter

    const { rateLimits } = this.options

    // @NOTE Silently ignore creation of route specific rate limiter if the
    // `rateLimits` options was not provided to the constructor.
    if (!rateLimits) return globalRateLimiter

    const { creator, bypass } = rateLimits

    const rateLimiters = asArray(config.rateLimit).map((options, i) => {
      if (isSharedRateLimitOpts(options)) {
        const rateLimiter = this.sharedRateLimiters?.get(options.name)

        // The route config references a shared rate limiter that does not
        // exist. This is a configuration error.
        assert(rateLimiter, `Shared rate limiter "${options.name}" not defined`)

        return WrappedRateLimiter.from<any>(rateLimiter, options)
      } else {
        return creator({
          ...options,
          calcKey: options.calcKey ?? defaultKey,
          calcPoints: options.calcPoints ?? defaultPoints,
          keyPrefix: `${nsid}-${i}`,
        })
      }
    })

    // If the route config contains an empty array, use global rate limiter.
    if (!rateLimiters.length) return globalRateLimiter

    // The global rate limiter (if present) should be applied in addition to
    // the route specific rate limiters.
    if (globalRateLimiter) rateLimiters.push(globalRateLimiter)

    return RouteRateLimiter.from<any>(rateLimiters, { bypass })
  }
}

function createErrorMiddleware({
  errorParser = (err) => XRPCError.fromError(err),
}: Options): ErrorRequestHandler {
  return (err, req, res, next) => {
    const nsid = extractUrlNsid(req.originalUrl)
    const xrpcError = errorParser(err)

    // Use the request's logger (if available) to benefit from request context
    // (id, timing) and logging configuration (serialization, etc.).
    const logger = isPinoHttpRequest(req) ? req.log : log

    const isInternalError = xrpcError instanceof InternalServerError

    const msgPrefix = isInternalError ? 'unhandled exception' : 'error'
    const msgSuffix = nsid ? `xrpc method ${nsid}` : `${req.method} ${req.url}`
    const msg = `${msgPrefix} in ${msgSuffix}`

    logger.error(
      {
        // @NOTE Computation of error stack is an expensive operation, so
        // we strip it for expected errors.
        err:
          isInternalError || process.env.NODE_ENV === 'development'
            ? err
            : toSimplifiedErrorLike(err),

        // XRPC specific properties, for easier browsing of logs
        nsid,
        type: xrpcError.type,
        status: xrpcError.statusCode,
        payload: xrpcError.payload,

        // Ensure that the logged item's name is set to LOGGER_NAME, instead of
        // the name of the pino-http logger, to ensure consistency across logs.
        name: LOGGER_NAME,
      },
      msg,
    )

    if (res.headersSent) {
      return next(err)
    }

    return res.status(xrpcError.statusCode).json(xrpcError.payload)
  }
}

function isPinoHttpRequest(req: IncomingMessage): req is IncomingMessage & {
  log: { error: (obj: unknown, msg: string) => void }
} {
  return typeof (req as { log?: any }).log?.error === 'function'
}

function toSimplifiedErrorLike(err: unknown): unknown {
  if (err instanceof Error) {
    // Transform into an "ErrorLike" for pino's std "err" serializer
    return {
      ...err,
      // Carry over non-enumerable properties
      message: err.message,
      name:
        !Object.hasOwn(err, 'name') &&
        Object.prototype.toString.call(err.constructor) === '[object Function]'
          ? err.constructor.name // extract the class name for sub-classes of Error
          : err.name,
      // @NOTE Error.stack, Error.cause and AggregateError.error are non
      // enumerable properties so they won't be spread to the ErrorLike
    }
  }

  return err
}

function buildRateLimiterOptions<C extends HandlerContext = HandlerContext>({
  name,
  calcKey = defaultKey,
  calcPoints = defaultPoints,
  ...desc
}: ServerRateLimitDescription<C>): RateLimiterOptions<C> {
  return { ...desc, calcKey, calcPoints, keyPrefix: `rl-${name}` }
}

const defaultPoints: CalcPointsFn = () => 1

/**
 * @note when using a proxy, ensure headers are getting forwarded correctly:
 * `app.set('trust proxy', true)`
 *
 * @see {@link https://expressjs.com/en/guide/behind-proxies.html}
 */
const defaultKey: CalcKeyFn<HandlerContext> = ({ req }) => req.ip
