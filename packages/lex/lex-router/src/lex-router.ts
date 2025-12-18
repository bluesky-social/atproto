import {
  XrpcError,
  XrpcInvalidResponseError,
  XrpcResponseError,
  XrpcUnexpectedError,
} from '@atproto/lex-client'
import { lexParse, lexToJson } from '@atproto/lex-json'
import {
  InferMethodInput,
  InferMethodOutput,
  InferMethodOutputBody,
  InferMethodOutputEncoding,
  InferMethodParams,
  Main,
  Procedure,
  Query,
  ValidationError,
  getMain,
} from '@atproto/lex-schema'

export type LexRouterHandlerContext<
  M extends Query | Procedure,
  Credentials = void,
> = {
  credentials: Credentials
  input: InferMethodInput<M, Body>
  params: InferMethodParams<M>
  headers: Headers
  request: Request
}

export type LexRouterHandlerOutput<M extends Query | Procedure> =
  | Response
  | ({ headers?: HeadersInit } & (InferMethodOutput<M, BodyInit> extends void
      ? { encoding?: undefined; body?: undefined }
      : InferMethodOutputEncoding<M> extends 'application/json'
        ? {
            // Allow omitting body when output is JSON
            encoding?: 'application/json'
            body: InferMethodOutputBody<M>
          }
        : InferMethodOutput<M, BodyInit>))

export type LexRouterHandler<
  M extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = (
  ctx: LexRouterHandlerContext<M, Credentials>,
) => Promise<LexRouterHandlerOutput<M>>

export type XrpcHandlerConfig<
  M extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = {
  handler: LexRouterHandler<M, Credentials>
  auth: LexRouterAuth<M, Credentials>
}

export type LexRouterAuthContext<
  M extends Query | Procedure = Query | Procedure,
> = {
  params: InferMethodParams<M>
  headers: Headers
  request: Request
}

export type LexRouterAuth<
  M extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = (ctx: LexRouterAuthContext<M>) => Promise<Credentials>

export type LexRouterOptions = {
  onError?: (
    err: unknown,
    request: Request,
    method: Query | Procedure,
  ) => void | null | Response | Promise<void | null | Response>
}

export class LexRouter {
  private routes: Map<
    string,
    {
      method: Query | Procedure
      handler: LexRouterHandler
      auth?: LexRouterAuth
    }
  > = new Map()

  readonly fetchHandler = (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const request =
      input instanceof Request && init == null
        ? input
        : new Request(input, init)
    return this.handleRequest(request)
  }

  constructor(readonly options?: LexRouterOptions) {}

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)

    const nsid = extractXrpcMethodNsid(url)
    const route = nsid ? this.routes.get(nsid) : undefined
    if (!route) {
      return Response.json({ error: 'MethodNotImplemented' }, { status: 404 })
    }

    const { method, auth, handler } = route

    try {
      const { headers } = request
      const params = method.parameters.fromURLSearchParams(url.searchParams)

      const credentials = auth
        ? await auth({ params, headers, request })
        : undefined

      const body =
        method.type === 'procedure'
          ? method.input?.encoding === 'application/json'
            ? // @TODO limit size?
              method.input.schema
              ? method.input.schema.parse(lexParse(await request.text()))
              : lexParse(await request.text())
            : method.input.encoding
              ? request
              : undefined
          : undefined

      const encoding = request.headers
        .get('content-type')
        ?.split(';')[0]
        .trim()
        .toLowerCase()

      if (method.type === 'procedure') {
        if (!method.input.matchesEncoding(encoding)) {
          throw new XrpcError(
            'InvalidRequest',
            `Invalid content-type: ${encoding}`,
          )
        }

        if (!method.input.encoding) {
          await request.body?.cancel()
        }
      } else if (encoding) {
        throw new XrpcError(
          'InvalidRequest',
          'GET requests must not have a content-type header',
        )
      }

      const input =
        method.type === 'procedure' && method.input?.encoding
          ? { encoding, body }
          : undefined

      const output = await handler({
        credentials,
        params,
        headers,
        input: input as any,
        request,
      })

      if (output instanceof Response) {
        return output
      }

      if (output.body === undefined && output.encoding === undefined) {
        return new Response(null, { status: 200, headers: output.headers })
      }

      if (method.output?.encoding === 'application/json') {
        return Response.json(lexToJson(output.body!), {
          status: 200,
          headers: output?.headers,
        })
      }

      const responseHeaders = new Headers(output?.headers)
      responseHeaders.set('content-type', output.encoding!)
      return new Response(output.body, {
        status: 200,
        headers: responseHeaders,
      })
    } catch (err) {
      const onErrorResult = await this.options?.onError?.call(
        null,
        err,
        request,
        method,
      )

      // Ensure request body is closed to free resources
      if (!request.bodyUsed) await request.body?.cancel()

      if (onErrorResult instanceof Response) {
        return onErrorResult
      }

      if (err instanceof ValidationError) {
        return Response.json(
          { error: 'InvalidRequest', message: err.message },
          { status: 400 },
        )
      }

      if (err instanceof XrpcResponseError) {
        return Response.json(
          { error: err.error, message: err.message },
          { status: err.status, headers: err.headers },
        )
      }

      if (err instanceof XrpcUnexpectedError) {
        return Response.json(
          { error: err.error, message: err.message },
          { status: 500 },
        )
      }

      if (err instanceof XrpcInvalidResponseError) {
        return Response.json(
          { error: err.error, message: err.message },
          { status: 502 },
        )
      }

      if (err instanceof XrpcError) {
        return Response.json(
          { error: err.error, message: err.message },
          { status: 400 },
        )
      }

      return Response.json(
        { error: 'InternalError', message: 'An internal error occurred' },
        { status: 500 },
      )
    }
  }

  add<M extends Query | Procedure>(
    ns: Main<M>,
    handler: LexRouterHandler<M, void>,
  ): this
  add<M extends Query | Procedure, Credentials>(
    ns: Main<M>,
    config: XrpcHandlerConfig<M, Credentials>,
  ): this
  add(
    ns: Query | Procedure,
    config: LexRouterHandler<any, any> | XrpcHandlerConfig<any, any>,
  ) {
    const method = getMain(ns)
    if (this.routes.has(method.nsid)) {
      throw new TypeError(`Method ${method.nsid} already registered`)
    }
    const { handler, auth = undefined } =
      typeof config === 'function' ? { handler: config } : config
    this.routes.set(method.nsid, { method, auth, handler })
    return this
  }
}

function extractXrpcMethodNsid({ pathname }: URL): string | null {
  if (!pathname.startsWith('/xrpc/')) return null
  if (pathname.includes('/', 6)) return null
  return pathname.slice(6)
}
