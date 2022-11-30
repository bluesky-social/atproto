import express, {
  ErrorRequestHandler,
  NextFunction,
  RequestHandler,
} from 'express'
import { ValidateFunction } from 'ajv'
import {
  MethodSchema,
  methodSchema,
  isValidMethodSchema,
} from '@atproto/lexicon'
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
} from './types'
import {
  ajv,
  paramsAjv,
  validateReqParams,
  validateInput,
  validateOutput,
} from './util'
import log from './logger'

export type Options = {
  payload?: {
    jsonLimit?: string | number
    rawLimit?: string | number
    textLimit?: string | number
  }
}

export function createServer(schemas?: unknown[], options?: Options) {
  return new Server(schemas, options)
}

export class Server {
  router = express.Router()
  routes = express.Router()
  schemas: Map<string, MethodSchema> = new Map()
  paramValidators: Map<string, ValidateFunction> = new Map()
  inputValidators: Map<string, ValidateFunction> = new Map()
  outputValidators: Map<string, ValidateFunction> = new Map()
  middleware: Record<'json' | 'raw' | 'text', RequestHandler>

  constructor(schemas?: unknown[], opts?: Options) {
    if (schemas) {
      this.addSchemas(schemas)
    }
    this.router.use(this.routes)
    this.router.use('/xrpc/:methodId', this.catchall.bind(this))
    this.router.use(errorMiddleware)
    this.middleware = {
      json: express.json({ limit: opts?.payload?.jsonLimit }),
      raw: express.raw({ limit: opts?.payload?.rawLimit }),
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
    const schema = this.schemas.get(nsid)
    if (!schema) {
      throw new Error(`No schema found for ${nsid}`)
    }
    this.addRoute(schema, config)
  }

  // schemas
  // =

  addSchema(schema: unknown) {
    if (isValidMethodSchema(schema)) {
      this.schemas.set(schema.id, schema)
      if (schema.parameters) {
        this.paramValidators.set(
          schema.id,
          paramsAjv.compile(schema.parameters),
        )
      }
      if (schema.input?.schema) {
        this.inputValidators.set(schema.id, ajv.compile(schema.input.schema))
      }
      if (schema.output?.schema) {
        this.outputValidators.set(schema.id, ajv.compile(schema.output.schema))
      }
    } else {
      methodSchema.parse(schema) // will throw with the validation error
    }
  }

  addSchemas(schemas: unknown[]) {
    for (const schema of schemas) {
      this.addSchema(schema)
    }
  }

  // http
  // =

  protected async addRoute(schema: MethodSchema, config: XRPCHandlerConfig) {
    const verb: 'post' | 'get' = schema.type === 'procedure' ? 'post' : 'get'
    const middleware: RequestHandler[] = []
    middleware.push(createLocalsMiddleware(schema))
    if (config.auth) {
      middleware.push(createAuthMiddleware(config.auth))
    }
    if (verb === 'post') {
      middleware.push(this.middleware.json)
      middleware.push(this.middleware.raw)
      middleware.push(this.middleware.text)
    }
    this.routes[verb](
      `/xrpc/${schema.id}`,
      ...middleware,
      this.createHandler(schema, config.handler),
    )
  }

  async catchall(
    req: express.Request,
    _res: express.Response,
    next: NextFunction,
  ) {
    const schema = this.schemas.get(req.params.methodId)
    if (!schema) {
      return next(new MethodNotImplementedError())
    }
    // validate method
    if (schema.type === 'query' && req.method !== 'GET') {
      return next(
        new InvalidRequestError(
          `Incorrect HTTP method (${req.method}) expected GET`,
        ),
      )
    } else if (schema.type === 'procedure' && req.method !== 'POST') {
      return next(
        new InvalidRequestError(
          `Incorrect HTTP method (${req.method}) expected POST`,
        ),
      )
    }
    return next()
  }

  createHandler(schema: MethodSchema, handler: XRPCHandler): RequestHandler {
    const paramValidator = this.paramValidators.get(schema.id)
    const inputValidator = this.inputValidators.get(schema.id)
    const outputValidator = this.outputValidators.get(schema.id)
    return async function (req, res, next) {
      try {
        // validate request
        const params = validateReqParams(req.query, paramValidator)
        const input = validateInput(schema, req, inputValidator)
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
          const output = validateOutput(
            schema,
            outputUnvalidated,
            outputValidator,
          )
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

function createLocalsMiddleware(schema: MethodSchema): RequestHandler {
  return function (req, _res, next) {
    const locals: RequestLocals = { auth: undefined, schemaId: schema.id }
    req[kRequestLocals] = locals
    return next()
  }
}

type RequestLocals = {
  auth: HandlerAuth | undefined
  schemaId: string
}

function createAuthMiddleware(verifier: AuthVerifier): RequestHandler {
  return async function (req, _res, next) {
    try {
      const result = await verifier(req)
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
  const methodSuffix = locals ? ` method ${locals.schemaId}` : ''
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
