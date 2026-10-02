# @atproto/ozone: Bluesky Moderation Service

Backend service for moderating the Bluesky network.

[![NPM](https://img.shields.io/npm/v/@atproto/ozone)](https://www.npmjs.com/package/@atproto/ozone)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Moderation inbox standing

Set `NEXT_PUBLIC_STRIKE_SUSPENSION_CONFIG` to the same value used by Ozone UI, for example `4:72,8:168,12:336,16:Infinity`. Each entry maps a strike count to suspension hours; `Infinity` represents a permanent suspension. The backend retains the full map and uses the second and third thresholds, sorted by strike count, for `warning` and `atRisk`. The first tier does not change standing. With no configuration, standing derives from the account's enforcement and restrictions; strike thresholds are disabled. Invalid entries fail configuration at startup.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
