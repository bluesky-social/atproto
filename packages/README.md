# Packages

## Applications

- [PDS](./pds): The Personal Data Server (PDS). This is atproto's main server-side implementation.
- [Dev Env](./dev-env): A command-line application for developers to construct and manage development environments.
- [Lexicon CLI](./lex-cli/): A command-line application for generating code and documentation from Lexicon schemas.

## Libraries

- [API](./api): A library for communicating with atproto servers.
- [Common](./common): A library containing code which is shared between atproto packages.
- [Crypto](./crypto): Atproto's common cryptographic operations.
- [Syntax](./syntax): A library for identifier syntax: NSID, AT URI, handles, etc.
- [Lexicon](./lexicon): A library for validating data using atproto's schema system.
- [OAuth Provider](./oauth/oauth-provider): A library for supporting ATPROTO's OAuth.
- [Repo](./repo): The "atproto repository" core implementation (a Merkle Search Tree).
- [WebSocket Client](./ws-client): A library for working with long-lived WebSocket client connections.
- [XRPC](./xrpc): An XRPC client implementation.
- [XRPC Server](./xrpc-server): An XRPC server implementation.

## Benchmarking and profiling

Only applicable to packages which contain benchmarks(`jest.bench.config.js`).

You can run benchmarks with `pnpm bench`.

### Attaching a profiler

Running `pnpm bench:profile` will launch `bench` with `--inspect-brk` flag.
Execution will be paused until a debugger is attached, you can read more
about node debuggers [here](https://nodejs.org/en/docs/guides/debugging-getting-started#inspector-clients)

An easy way to profile is:

1. open `about://inspect` in chrome
2. select which process to connect to(there will probably only be one)
3. go to performance tab
4. press record, this will unpause execution
5. wait for the benches to run
6. finish recording
