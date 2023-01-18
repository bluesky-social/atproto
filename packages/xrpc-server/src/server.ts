import { Readable } from 'stream'
import express, {
  ErrorRequestHandler,
  NextFunction,
  RequestHandler,
} from 'express'
import { Lexicons, LexXrpcProcedure, LexXrpcQuery } from '@atproto/lexicon'
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
} from './types'
import { decodeQueryParams, validateInput, validateOutput } from './util'
import log from './logger'

export function createServer(lexicons?: unknown[], options?: Options) {
  return new Server(lexicons, options)
}

export class Server {
  router = express.Router()
  routes = express.Router()
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
    if (!def || (def.type !== 'query' && def.type !== 'procedure')) {
      throw new Error(`Lex def for ${nsid} is not a query or a procedure`)
    }
    this.addRoute(nsid, def, config)
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
        const params = decodeQueryParams(def, req.query)
        try {
          assertValidXrpcParams(params)
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
            res.status(200).json(output.body)
          } else if (output) {
            res.header('Content-Type', output.encoding)
            res
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
