# @atproto/pds: Personal Data Server (PDS)

TypeScript reference implementation of an atproto PDS.

[![NPM](https://img.shields.io/npm/v/@atproto/pds)](https://www.npmjs.com/package/@atproto/pds)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

If you are interested in self-hosting a PDS, you probably want this repository instead, which has a thin service wrapper, documentation, a Dockerfile, etc: https://github.com/bluesky-social/pds

## Blob downloads

With S3 blob storage, `com.atproto.sync.getBlob` responds with a non-cacheable
307 redirect to a presigned download URL valid for one minute. Disk blob
storage streams the response directly. Downloads retain their MIME type and
use `Content-Disposition: attachment`.

Presigned URLs use the configured S3 region, endpoint, and path style. For
Cloudflare R2, set `PDS_BLOBSTORE_S3_REGION=auto` and
`PDS_BLOBSTORE_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
along with the bucket and access credentials. The endpoint must be reachable
by clients. Browser applications fetching redirected blobs also need the
bucket's CORS rules to allow their origins and GET requests.

Account and blob availability are checked before issuing each redirect.
Already-issued URLs may remain usable until they expire, unless the object
is removed or quarantined.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
