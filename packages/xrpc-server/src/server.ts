import { Readable } from 'stream'
import express, {
  ErrorRequestHandler,
  NextFunction,
  RequestHandler,
} from 'express'
import {
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
} from './types'
import {
  decodeQueryParams,
  getQueryParams,
  validateInput,
  validateOutput,
} from './util'
import log from './logger'

export function createServer(lexicons?: unknown[], options?: Options) {
  return new Server(lexicons, options)
}

export class Server {
  router = express()
  routes = express.Router()
  subscriptions = new Map<string, XrpcStreamServer>()
  lex = new Lexicons()
  options: Options
  middleware: Record<'json' | 'text', RequestHandler>

  constructor(lexicons?: unknown[], opts?: Options) {
    if (lexicons) {
      this.addLexicons(lexicons)
    }
    this.router.use(this.routes)
    this.router.use('/xrpc/:methodId', this.catchall.bind(this))
    this.router.use(errorMiddleware)
    this.router.once('mount', (app: express.Application) => {
      this.enableStreamingOnListen(app)
    })
    this.options = opts ?? {}
    this.middleware = {
      json: express.json({ limit: opts?.payload?.jsonLimit }),
      text: express.text({ limit: opts?.payload?.textLimit }),
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

  addLexicon(doc: unknown) {
    this.lex.add(doc)
  }

  addLexicons(docs: unknown[]) {
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
    this.routes[verb](
      `/xrpc/${nsid}`,
      ...middleware,
      this.createHandler(nsid, def, config.handler),
    )
  }

  async catchall(
    req: express.Request,
    _res: express.Response,
    next: NextFunction,
  ) {
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
    handler: XRPCHandler,
  ): RequestHandler {
    const validateReqInput = (req: express.Request) =>
      validateInput(nsid, def, req, this.options, this.lex)
    const validateResOutput =
      this.options.validateResponse === false
        ? (output?: HandlerSuccess) => output
        : (output?: HandlerSuccess) =>
            validateOutput(nsid, def, output, this.lex)
    const assertValidXrpcParams = (params: unknown) =>
      this.lex.assertValidXrpcParams(nsid, params)
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

        if (input?.body instanceof Readable) {
          // If the body stream errors at any time, abort the request
          input.body.once('error', next)
        }

        const locals: RequestLocals = req[kRequestLocals]

        // run the handler
        const outputUnvalidated = await handler({
          params,
          input,
          auth: locals.auth,
          req,
          res,
        })

        if (isHandlerError(outputUnvalidated)) {
          throw XRPCError.fromError(outputUnvalidated)
        }

        if (!outputUnvalidated || isHandlerSuccess(outputUnvalidated)) {
          // validate response
          const output = validateResOutput(outputUnvalidated)
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
        next(err)
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

  private enableStreamingOnListen(app: express.Application) {
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
}

function isHandlerSuccess(v: HandlerOutput): v is HandlerSuccess {
  return handlerSuccess.safeParse(v).success
}

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
  if (err instanceof XRPCError) {
    log.error(err, `error in xrpc${methodSuffix}`)
  } else {
    log.error(err, `unhandled exception in xrpc${methodSuffix}`)
  }
  if (res.headersSent) {
    return next(err)
  }
  const xrpcError = XRPCError.fromError(err)
  return res.status(xrpcError.type).json(xrpcError.payload)
}
