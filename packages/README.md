# Packages

## Applications

- [PDS](./pds): The Personal Data Server (PDS). This is ATP's main server-side implementation.
- [Dev Env](./dev-env): A command-line application for developers to construct and manage development environments.
- [Lexicon CLI](./lex-cli/): A command-line application for generating code and documentation from Lexicon schemas.

## Libraries

- [API](./api): A library for communicating with ATP servers.
- [Common](./common): A library containing code which is shared between ATP packages.
- [Crypto](./crypto): ATP's common cryptographic operations.
- [DID Resolver](./did-resolver): A library for resolving ATP's Decentralized ID methods.
- [Lexicon](./lexicon): A library for validating data using ATP's schema system.
- [NSID](./nsid): A parser and generator of NSIDs.
- [Repo](./repo): The "ATP repository" core implementation (a Merkle Search Tree).
- [URI](./uri): A parser and generator of `at://` uris.
- [XRPC](./xrpc): An XRPC client implementation.
- [XRPC Server](./xrpc-server): An XRPC server implementation.

## Benchmarking and profiling

Only applicable to packages which contain benchmarks(`jest.bench.config.js`).

You can run benchmarks with `yarn bench`.

### Attaching a profiler

Running `yarn bench:profile` will launch `bench` with `--inspect-brk` flag.
Execution will be paused until a debugger is attached, you can read more 
about node debuggers [here](https://nodejs.org/en/docs/guides/debugging-getting-started#inspector-clients)

An easy way to profile is:

1. open `about://inspect` in chrome
2. select which process to connect to(there will probably only be one)
3. go to performance tab
4. press record, this will unpause execution
5. wait for the benches to run
6. finish recording
