// Registers dd-trace's ESM loader hook for the rest of the process. Must be the
// first import so the hook is in place before any other module is resolved.
import 'dd-trace/register.js'
import path from 'node:path'
import ddTrace from 'dd-trace'

ddTrace
  .init()
  .use('http2', {
    client: true, // calls into dataplane
    server: false,
  })
  .use('express', {
    hooks: { request: maintainXrpcResource },
  })

// Modify tracer in order to track calls to dataplane as a service with proper
// resource names. Reaches into dd-trace internals (`_tracer.startSpan`) — keep
// an eye on this when bumping the dd-trace major version.
const DATAPLANE_PREFIX = '/bsky.Service/'
const internal = ddTrace as unknown as { _tracer: any }
const origStartSpan = internal._tracer.startSpan
internal._tracer.startSpan = function (name: string, options: any) {
  if (
    name !== 'http.request' ||
    options?.tags?.component !== 'http2' ||
    !options?.tags?.['http.url']
  ) {
    return origStartSpan.call(this, name, options)
  }
  const uri = new URL(options.tags['http.url'])
  if (!uri.pathname.startsWith(DATAPLANE_PREFIX)) {
    return origStartSpan.call(this, name, options)
  }
  options.tags['service.name'] = 'dataplane-bsky'
  options.tags['resource.name'] = uri.pathname.slice(DATAPLANE_PREFIX.length)
  return origStartSpan.call(this, name, options)
}

function maintainXrpcResource(span: any, req: any) {
  // Show actual xrpc method as resource rather than the route pattern
  if (span && req.originalUrl?.startsWith('/xrpc/')) {
    span.setTag(
      'resource.name',
      [
        req.method,
        path.posix.join(req.baseUrl || '', req.path || '', '/').slice(0, -1), // Ensures no trailing slash
      ]
        .filter(Boolean)
        .join(' '),
    )
  }
}
