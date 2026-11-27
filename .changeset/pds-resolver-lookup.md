---
'@atproto/pds': patch
---

Resolve the hostnames of user-provided URLs and of proxied services named in DID documents with a `dns.Resolver` rather than `dns.lookup`. A service whose nameservers don't answer no longer holds a libuv threadpool thread, which the PDS shares with file, crypto and compression work, until the system resolver gives up. These lookups no longer read `/etc/hosts` or apply search domains. Set `PDS_USE_SYSTEM_DNS_LOOKUP=true` to resolve them with `dns.lookup` again. Requests to the configured AppView, and every request when `PDS_DISABLE_SSRF_PROTECTION` is set, still use `dns.lookup`.
