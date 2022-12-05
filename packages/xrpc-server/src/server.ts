import express from 'express'
import { Lexicons } from '@atproto/lexicon'
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
import { decodeQueryParams, validateInput, validateOutput } from './util'
import log from './logger'

export type Options = {
  payload?: {
    jsonLimit?: string | number
    rawLimit?: string | number
    textLimit?: string | number
  }
}

export function createServer(lexicons?: unknown[], options?: Options) {
  return new Server(lexicons, options)
}

export class Server {
  router = express.Router()
  handlers: Map<string, XRPCHandler> = new Map()
  lex = new Lexicons()

  constructor(lexicons?: unknown[], opts?: Options) {
    if (lexicons) {
      this.addLexicons(lexicons)
    }
    this.router.use(express.json({ limit: opts?.payload?.jsonLimit }))
    this.router.use(express.raw({ limit: opts?.payload?.rawLimit }))
    this.router.use(express.text({ limit: opts?.payload?.textLimit }))
    this.router.use('/xrpc/:methodId', this.handle.bind(this))
  }

  // handlers
  // =

  method(nsid: string, fn: XRPCHandler) {
    this.addMethod(nsid, fn)
  }

  addMethod(nsid: string, fn: XRPCHandler) {
    if (!this.lex.get(nsid)) {
      throw new Error(`No schema found for ${nsid}`)
    }
    this.handlers.set(nsid, fn)
  }

  removeMethod(nsid: string) {
    this.handlers.delete(nsid)
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

  removeLexicon(nsid: string) {
    this.lex.remove(nsid)
  }

  // http
  // =

  async handle(req: express.Request, res: express.Response) {
    try {
      // lookup handler and schema
      const handler = this.handlers.get(req.params.methodId)
      const def = this.lex.getDef(req.params.methodId)
      if (
        !handler ||
        !def ||
        (def.type !== 'query' && def.type !== 'procedure')
      ) {
        return res.status(501).end()
      }

      // validate method
      if (def.type === 'query' && req.method !== 'GET') {
        throw new InvalidRequestError(
          `Incorrect HTTP method (${req.method}) expected GET`,
        )
      } else if (def.type === 'procedure' && req.method !== 'POST') {
        throw new InvalidRequestError(
          `Incorrect HTTP method (${req.method}) expected POST`,
        )
      }

      // validate request
      const params = decodeQueryParams(def, req.query)
      try {
        this.lex.assertValidXrpcParams(req.params.methodId, params)
      } catch (e) {
        throw new InvalidRequestError(String(e))
      }
      const input = validateInput(req.params.methodId, def, req, this.lex)

      // run the handler
      const outputUnvalidated = await handler(params, input, req, res)

      if (!outputUnvalidated || isHandlerSuccess(outputUnvalidated)) {
        // validate response
        const output = validateOutput(
          req.params.methodId,
          def,
          outputUnvalidated,
          this.lex,
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
    } catch (e: unknown) {
      if (e instanceof XRPCError) {
        log.error(e, `error in xrpc method ${req.params.methodId}`)
        res.status(e.type).json(e.payload)
      } else {
        log.error(
          e,
          `unhandled exception in xrpc method ${req.params.methodId}`,
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
