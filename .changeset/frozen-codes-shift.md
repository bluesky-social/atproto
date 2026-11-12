---
'@atproto/lex-rpc': minor
'@atproto/lex-client': minor
'@atproto/lex': minor
---

**Breaking:** `RETRYABLE_HTTP_STATUS_CODES` is now a frozen, literal-typed array instead of a `ReadonlySet<number>`. Replace `RETRYABLE_HTTP_STATUS_CODES.has(status)` with the new `isRetryableHttpStatus(status)` type guard (narrowing to the new `RetryableHttpStatus` type).

Also add `RETRYABLE_ERROR_CODES` and its `isRetryableErrorCode()` type guard (the XRPC error codes matching a retryable HTTP status, for classifying an error by code alone), and `getStatusErrorCode()`, mapping an HTTP status to the XRPC error code used for non-XRPC error responses.
