# SERVER

`yarn dev` runs the server in dev mode & watches for updates
`yarn temp` does the same thing as `yarn dev` but stores DB info & blocks in an in-memory store
`yarn wipe-db` wipes the current server's database & blockstore

Server defaults to running on `http://localhost:2583`

run tests with `yarn test`. This creates a separate in-memory server for each test suite. To turn this off & run it against a dev server, switch the `USE_TEST_SERVER` flag in the test files to `false`