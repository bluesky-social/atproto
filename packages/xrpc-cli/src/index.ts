#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import { Command, InvalidArgumentError } from 'commander'
import yesno from 'yesno'
import { NSID } from '@adxp/nsid'
import { schemaTemplate, readAllSchemas, genMd, genTsObj } from './util'
import { genClientApi } from './codegen/client'
import { genServerApi } from './codegen/server'

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
        outfile = path.join(process.cwd(), `${NSID.parse(nsid).name}.json`)
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
  .argument('<schemas...>', 'paths of the schema files to include', toPaths)
  .action((schemaPaths: string[]) => {
    const schemas = readAllSchemas(schemaPaths)
    console.log(genMd(schemas))
  })

program
  .command('gen-ts-obj')
  .description('Generate a TS file that exports an array of schemas')
  .argument('<schemas...>', 'paths of the schema files to include', toPaths)
  .action((schemaPaths: string[]) => {
    const schemas = readAllSchemas(schemaPaths)
    console.log(genTsObj(schemas))
  })

program
  .command('gen-api')
  .description('Generate a TS client API')
  .argument('<outdir>', 'path of the directory to write to', toPath)
  .argument('<schemas...>', 'paths of the schema files to include', toPaths)
  .action(async (outDir: string, schemaPaths: string[]) => {
    const schemas = readAllSchemas(schemaPaths)
    const api = await genClientApi(schemas)
    console.log('This will write the following files:')
    for (const file of api.files) {
      file.path = path.join(outDir, file.path)
      console.log('-', file.path)
    }
    const ok = await yesno({
      question: 'Are you sure you want to continue? [y/N]',
      defaultValue: false,
    })
    if (!ok) {
      console.log('Aborted.')
      process.exit(0)
    }
    for (const file of api.files) {
      fs.mkdirSync(path.join(file.path, '..'), { recursive: true })
      fs.writeFileSync(file.path, file.content, 'utf8')
    }
    console.log('API generated.')
  })

program
  .command('gen-server')
  .description('Generate a TS server API')
  .argument('<outdir>', 'path of the directory to write to', toPath)
  .argument('<schemas...>', 'paths of the schema files to include', toPaths)
  .action(async (outDir: string, schemaPaths: string[]) => {
    const schemas = readAllSchemas(schemaPaths)
    const api = await genServerApi(schemas)
    console.log('This will write the following files:')
    for (const file of api.files) {
      file.path = path.join(outDir, file.path)
      console.log('-', file.path)
    }
    const ok = await yesno({
      question: 'Are you sure you want to continue? [y/N]',
      defaultValue: false,
    })
    if (!ok) {
      console.log('Aborted.')
      process.exit(0)
    }
    for (const file of api.files) {
      fs.mkdirSync(path.join(file.path, '..'), { recursive: true })
      fs.writeFileSync(file.path, file.content, 'utf8')
    }
    console.log('API generated.')
  })

program.parse()

function toNsid(v: string) {
  if (!NSID.isValid(v)) {
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
