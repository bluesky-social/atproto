# Lexicon CLI Tool

Command-line tool to generate Lexicon schemas and APIs.

## Usage

```
Usage: lex [options] [command]

Lexicon CLI

Options:
  -V, --version                     output the version number
  -h, --help                        display help for command

Commands:
  new [options] <nsid> [outfile]    Create a new schema json file
  gen-md <schemas...>               Generate markdown documentation
  gen-ts-obj <schemas...>           Generate a TS file that exports an array of schemas
  gen-api <outdir> <schemas...>     Generate a TS client API
  gen-server <outdir> <schemas...>  Generate a TS server API
  help [command]                    display help for command
```

**Example 1:** Generate an api

```
$ lex gen-api ./api/src ./schemas/com/service/*.json ./schemas/com/another/*.json
```

**Example 2:** Generate a server

```
$ lex gen-server ./server/src/xrpc ./schemas/com/service/*.json ./schemas/com/another/*.json
```

## License

MIT
