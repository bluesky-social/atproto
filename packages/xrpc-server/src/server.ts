import express from 'express'
import { ValidateFunction } from 'ajv'
import { MethodSchema, methodSchema, isValidMethodSchema } from '@adxp/lexicon'
import {
  XRPCHandler,
  XRPCError,
  InvalidRequestError,
  HandlerOutput,
  HandlerSuccess,
  handlerSuccess,
  HandlerError,
  handlerError,
} from './types'
import {
  ajv,
  validateReqParams,
  validateInput,
  validateOutput,
  readReqBody,
} from './util'
import log from './logger'

export function createServer(schemas?: unknown[]) {
  return new Server(schemas)
}

export class Server {
  router = express.Router()
  handlers: Map<string, XRPCHandler> = new Map()
  schemas: Map<string, MethodSchema> = new Map()
  inputValidators: Map<string, ValidateFunction> = new Map()
  outputValidators: Map<string, ValidateFunction> = new Map()

  constructor(schemas?: unknown[]) {
    if (schemas) {
      this.addSchemas(schemas)
    }
    this.router.use('/xrpc/:methodId', this.handle.bind(this))
  }

  // handlers
  // =

  method(nsid: string, fn: XRPCHandler) {
    this.addMethod(nsid, fn)
  }

  addMethod(nsid: string, fn: XRPCHandler) {
    if (!this.schemas.has(nsid)) {
      throw new Error(`No schema found for ${nsid}`)
    }
    this.handlers.set(nsid, fn)
  }

  removeMethod(nsid: string) {
    this.handlers.delete(nsid)
  }

  // schemas
  // =

  addSchema(schema: unknown) {
    if (isValidMethodSchema(schema)) {
      this.schemas.set(schema.id, schema)
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

  removeSchema(nsid: string) {
    this.schemas.delete(nsid)
    this.inputValidators.delete(nsid)
    this.outputValidators.delete(nsid)
  }

  // http
  // =

  async handle(req: express.Request, res: express.Response) {
    try {
      // lookup handler and schema
      const handler = this.handlers.get(req.params.methodId)
      const schema = this.schemas.get(req.params.methodId)
      if (!handler || !schema) {
        return res.status(501).end()
      }

      // validate method
      if (schema.type === 'query' && req.method !== 'GET') {
        throw new InvalidRequestError(
          `Incorrect HTTP method (${req.method}) expected GET`,
        )
      } else if (schema.type === 'procedure' && req.method !== 'POST') {
        throw new InvalidRequestError(
          `Incorrect HTTP method (${req.method}) expected POST`,
        )
      }

      // read request body
      const inputBody = await readReqBody(req)

      // validate request
      const params = validateReqParams(schema, req.query)
      const input = validateInput(
        schema,
        req,
        inputBody,
        this.inputValidators.get(schema.id),
      )

      // run the handler
      const outputUnvalidated = await handler(params, input, req, res)

      if (!outputUnvalidated || isHandlerSuccess(outputUnvalidated)) {
        // validate response
        const output = validateOutput(
          schema,
          outputUnvalidated,
          this.outputValidators.get(schema.id),
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
      } else if (isHandlerError(outputUnvalidated)) {
        return res.status(outputUnvalidated.status).json({
          error: outputUnvalidated.error,
          message: outputUnvalidated.message,
        })
      }
    } catch (e: any) {
      if (e instanceof XRPCError) {
        log.info(e, `error in xrpc method ${req.params.methodId}`)
        res.status(e.type).json({
          error: e.customErrorName,
          message: e.errorMessage || e.typeStr,
        })
      } else {
        log.error(
          e,
          `Unhandled exception in ${req.params.methodId} xrpc handler:`,
        )
        res.status(500).json({
          message: 'Unexpected internal server error',
        })
      }
    }
  }
}

function isHandlerSuccess(v: HandlerOutput): v is HandlerSuccess {
  return handlerSuccess.safeParse(v).success
}

function isHandlerError(v: HandlerOutput): v is HandlerError {
  return handlerError.safeParse(v).success
}
