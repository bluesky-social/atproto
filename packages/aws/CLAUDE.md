# @atproto/aws — AWS helpers

Shared AWS clients for atproto services: S3 blob stores, CloudFront invalidation, SES, etc. We don't currently run on AWS for W Social production (we use UpCloud + Hetzner via `w-social-infrastructure/`), but tests and migration scripts may still pull this in.

## Don't add credentials here

Configuration comes from env vars at the service level. This package only exposes typed helpers.
