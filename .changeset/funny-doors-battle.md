---
'@atproto/lex-client': patch
---

Improve handling of XRPC response errors by always using `XrpcResponseError` errors when upstream server responds with an error status code. Before, `XrpcResponseError` would only be used if the upstream server responded with a valid XRPC payload (json with `error` field). Any other response payload (e.g. non-json, invalid "error" payload) would be treated as the upstream server not being able to output a valid XRPC response, and would throw `XrpcUpstreamError` instead. This change allows to better reflect upstream server errors to downstream services (eg. return a 429 if the upstream server responds with a 429 status code, instead of a 502, even if the response payload is not a valid XRPC error payload).

`XrpcUpstreamError` was removed and replaced with `XrpcInvalidResponseError` to better reflect the intent to those errors (invalid status code, non-json, or invalid payload). `XrpcResponseValidationError` is a special case of `XrpcInvalidResponseError` that is thrown when the response does not conform to the expected XRPC output schema.
