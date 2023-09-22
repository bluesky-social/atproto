# @atproto/dev-env: Local Developer Environment

A command-line application for developers to construct and manage development environments.

[![NPM](https://img.shields.io/npm/v/@atproto/dev-env)](https://www.npmjs.com/package/@atproto/dev-env)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## REPL API

The following methods are available in the REPL.

### `status()`

List the currently active servers.

### `startPds(port?: number)`

Create a new PDS instance. Data is stored in memory.

### `stop(port: number)`

Stop the server at the given port.

### `mkuser(handle: string, pdsPort?: number)`

Create a new user.

### `user(handle: string): ServiceClient`

Get the `ServiceClient` for the given user.

## License

MIT License
