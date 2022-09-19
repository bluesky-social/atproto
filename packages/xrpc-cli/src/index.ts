#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import { Command, InvalidArgumentError } from 'commander'
import * as nsidLib from '@adxp/nsid'
import { schemaTemplate, readAllSchemas, genMd } from './util'

const program = new Command()
program.name('xrpc-cli').description('XRPC utilities').version('0.0.0')

program
  .command('new')
  .description('Create a new schema json file')
  .argument('<nsid>', 'id of the schema to generate', toNsid)
  .argument('[outfile]', 'path of the json file to write', toPath)
  .option('-t, --type [type]', 'query or procedure', toType)
  .option('-d, --desc [type]', 'description')
  .action(
    (nsid: string, outfile?: string, options?: Record<string, string>) => {
      if (!outfile) {
        outfile = path.join(process.cwd(), `${nsidLib.parse(nsid).name}.json`)
      }
      if (!outfile.endsWith('.json')) {
        outfile = outfile + '.json'
      }
      console.log('Writing to', outfile)
      fs.writeFileSync(
        outfile,
        JSON.stringify(schemaTemplate(nsid, options), null, 2),
      )
    },
  )

program
  .command('gen-md')
  .description('Generate markdown documentation')
  .argument('<schemas...>', 'paths of the schema files to generate', toPaths)
  .action((schemaPaths: string[]) => {
    const schemas = readAllSchemas(schemaPaths)
    console.log(genMd(schemas))
  })

program.parse()

function toNsid(v: string) {
  if (!nsidLib.isValid(v)) {
    throw new InvalidArgumentError(
      'Must follow the reverse-DNS syntax of NSID.',
    )
  }
  return v
}

function toPath(v: string) {
  return v ? path.resolve(v) : undefined
}

function toPaths(v: string, acc: string[]) {
  acc = acc || []
  acc.push(path.resolve(v))
  return acc
}

function toType(v: string) {
  if (v === 'query' || v === 'procedure') {
    return v
  }
  throw new InvalidArgumentError('Must be "query" or "procedure".')
}
