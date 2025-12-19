import { LexError, LexValue } from '@atproto/lex-data'
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
  getMain,
} from '@atproto/lex-schema'

type Fetch = (request: Request) => Promise<Response>
type Route = { method: Query | Procedure; fetch: Fetch }

export type LexRouterHandlerContext<
  M extends Query | Procedure,
  Credentials = void,
> = {
  credentials: Credentials
  input: InferMethodInput<M, Body>
  params: InferMethodParams<M>
  request: Request
}

type AsOptionalPayloadOptions<T> = T extends undefined | void
  ? { encoding?: undefined; body?: undefined }
  : T

export type LexRouterHandlerOutput<M extends Query | Procedure> =
  | Response
  | ({
      headers?: HeadersInit
    } & (InferMethodOutputEncoding<M> extends 'application/json'
      ? {
          // Allow omitting body when output is JSON
          encoding?: 'application/json'
          body: InferMethodOutputBody<M>
        }
      : AsOptionalPayloadOptions<InferMethodOutput<M, BodyInit>>))

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
  request: Request
}

export type LexRouterAuth<
  M extends Query | Procedure = Query | Procedure,
  Credentials = unknown,
> = (ctx: LexRouterAuthContext<M>) => Promise<Credentials>

export type LexRouterOptions = {
  onHandlerError?: (data: {
    error: unknown
    request: Request
    method: Query | Procedure
  }) => void | null | Response | Promise<void | null | Response>

  onMethodNotFound?: (data: {
    request?: Request
  }) => void | null | Response | Promise<void | null | Response>

  onResponse?: (data: {
    response: Response
    request: Request
    method?: Query | Procedure
  }) => void | null | Response | Promise<void | null | Response>
}

export class LexRouter {
  private routes: Map<string, Route> = new Map()

  constructor(readonly options: LexRouterOptions = {}) {}

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
    if (method.type !== 'procedure' && method.type !== 'query') {
      throw new TypeError(`Invalid method type`)
    }
    if (this.routes.has(method.nsid)) {
      throw new TypeError(`Method ${method.nsid} already registered`)
    }
    const { handler, auth = undefined } =
      typeof config === 'function' ? { handler: config } : config

    const fetch = this.buildFetch(method, handler, auth)

    this.routes.set(method.nsid, { method, fetch })

    return this
  }

  private buildFetch<M extends Query | Procedure>(
    method: M,
    handler: LexRouterHandler<M, void>,
    auth?: LexRouterAuth<M, void>,
  ): Fetch
  private buildFetch<M extends Query | Procedure, Credentials>(
    method: M,
    handler: LexRouterHandler<M, Credentials>,
    auth: LexRouterAuth<M, Credentials>,
  ): Fetch
  private buildFetch<M extends Query | Procedure, Credentials>(
    method: M,
    handler: LexRouterHandler<M, Credentials>,
    auth?: LexRouterAuth<M, Credentials>,
  ): Fetch {
    const getInput = (
      method.type === 'procedure'
        ? getProcedureInput.bind(method)
        : getQueryInput.bind(method)
    ) as (request: Request) => Promise<InferMethodInput<M, Body>>

    return async (request: Request): Promise<Response> => {
      if (
        (method.type === 'procedure' && request.method !== 'POST') ||
        (method.type === 'query' &&
          request.method !== 'GET' &&
          request.method !== 'HEAD')
      ) {
        await request.body?.cancel()
        return Response.json(
          { error: 'InvalidRequest', message: 'Method not allowed' },
          { status: 405 },
        )
      }

      try {
        const url = new URL(request.url)
        const params = method.parameters.fromURLSearchParams(url.searchParams)

        const credentials = auth
          ? await auth({ params, request })
          : (undefined as Credentials)

        const input = await getInput(request)

        const output = await handler({ credentials, params, input, request })

        if (output instanceof Response) {
          return output
        }

        // @NOTE we don't validate the output here, as it should be the
        // responsibility of the handler to ensure it returns valid output.

        if (output.body === undefined && output.encoding === undefined) {
          return new Response(null, { status: 200, headers: output.headers })
        }

        if (method.output?.encoding === 'application/json') {
          return Response.json(lexToJson(output.body as LexValue), {
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
      } catch (error) {
        const response = await this.options.onHandlerError?.call(null, {
          request,
          method,
          error,
        })

        if (response != null) {
          return response
        }

        // Ensure request body is closed to free resources
        if (!request.bodyUsed) await request.body?.cancel()

        if (error instanceof LexError) {
          return error.toResponse()
        }

        return Response.json(
          { error: 'InternalError', message: 'An internal error occurred' },
          { status: 500 },
        )
      }
    }
  }

  async fetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    const request =
      input instanceof Request && init == null
        ? input
        : new Request(input, init)
    const url = new URL(request.url)

    const nsid = extractXrpcMethodNsid(url)
    const route = nsid ? this.routes.get(nsid) : null

    const response = route
      ? await route.fetch(request)
      : await this.fallback(request)

    const modifiedResponse = await this.options.onResponse?.call(null, {
      request,
      response,
      method: route?.method,
    })
    if (modifiedResponse) return modifiedResponse

    return response
  }

  async fallback(request: Request): Promise<Response> {
    const fallbackResponse = await this.options.onMethodNotFound?.call(null, {
      request,
    })
    if (fallbackResponse) return fallbackResponse

    return Response.json({ error: 'MethodNotImplemented' }, { status: 404 })
  }
}

function extractXrpcMethodNsid({ pathname }: URL): string | null {
  if (!pathname.startsWith('/xrpc/')) return null
  if (pathname.includes('/', 6)) return null
  if (pathname.length <= 11) return null // "/xrpc/a.b.c" is minimum
  // We don't really need to validate the NSID here, the existence of the route
  // (which is looked up based on an NSID) is sufficient.
  return pathname.slice(6)
}

async function getProcedureInput<M extends Procedure>(
  this: M,
  request: Request,
): Promise<InferMethodInput<M, Body>> {
  const encodingRaw = request.headers
    .get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase()

  const encoding =
    encodingRaw ||
    // If the caller did not provide a content-type, but the method
    // expects an input, assume binary
    (request.body != null && this.input.encoding != null
      ? 'application/octet-stream'
      : undefined)

  if (!this.input.matchesEncoding(encoding)) {
    await request.body?.cancel()
    throw new LexError('InvalidRequest', `Invalid content-type: ${encoding}`)
  }

  if (this.input.encoding === 'application/json') {
    // @TODO limit size?
    const body = this.input.schema
      ? this.input.schema.parse(lexParse(await request.text()))
      : lexParse(await request.text())
    return { encoding, body } as InferMethodInput<M, Body>
  } else if (this.input.encoding) {
    const body: Body = request
    return { encoding, body } as InferMethodInput<M, Body>
  } else {
    await request.body?.cancel()
    return undefined as InferMethodInput<M, Body>
  }
}

async function getQueryInput<M extends Query>(
  this: M,
  request: Request,
): Promise<InferMethodInput<M, Body>> {
  if (
    request.body ||
    request.headers.has('content-type') ||
    request.headers.has('content-length')
  ) {
    await request.body?.cancel()
    throw new LexError('InvalidRequest', 'GET requests must not have a body')
  }

  return undefined as InferMethodInput<M, Body>
}
