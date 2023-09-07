# ATP Developer Environment

A command-line application for developers to construct and manage development environments.

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
