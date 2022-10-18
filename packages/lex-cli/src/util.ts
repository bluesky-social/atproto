import fs from 'fs'
import { join } from 'path'
import { methodSchema, recordSchema, Schema } from '@atproto/lexicon'
import chalk from 'chalk'
import { GeneratedAPI, FileDiff } from './types'

export function schemaTemplate(nsid: string, options?: Record<string, string>) {
  return {
    xrpc: 1,
    id: nsid,
    type: options?.type || '',
    description: options?.desc || '',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  }
}

export function readAllSchemas(paths: string[]): Schema[] {
  const schemas: any[] = []
  for (const path of paths) {
    if (!path.endsWith('.json') || !fs.statSync(path).isFile()) {
      continue
    }
    try {
      schemas.push(readSchema(path))
    } catch (e: any) {
      // skip
    }
  }
  return schemas
}

export function readSchema(path: string): Schema {
  let str: string
  let obj: any
  try {
    str = fs.readFileSync(path, 'utf8')
  } catch (e) {
    console.error(`Failed to read file`, path)
    throw e
  }
  try {
    obj = JSON.parse(str)
  } catch (e) {
    console.error(`Failed to parse JSON in file`, path)
    throw e
  }
  if (obj.type === 'query' || obj.type === 'procedure') {
    try {
      methodSchema.parse(obj)
      return obj
    } catch (e) {
      console.error(`Invalid method schema in file`, path)
      throw e
    }
  } else if (obj.type === 'record') {
    try {
      recordSchema.parse(obj)
      return obj
    } catch (e) {
      console.error(`Invalid record schema in file`, path)
      throw e
    }
  } else {
    console.error(`Not lexicon schema`, path)
    throw new Error(`Not lexicon schema`)
  }
}

export function genTsObj(schemas: Schema[]): string {
  return `export const schemas = ${JSON.stringify(schemas, null, 2)}`
}

export function genFileDiff(outDir: string, api: GeneratedAPI) {
  const diffs: FileDiff[] = []
  const existingFiles = readdirRecursiveSync(outDir)

  for (const file of api.files) {
    file.path = join(outDir, file.path)
    if (existingFiles.includes(file.path)) {
      diffs.push({ act: 'mod', path: file.path, content: file.content })
    } else {
      diffs.push({ act: 'add', path: file.path, content: file.content })
    }
  }
  for (const filepath of existingFiles) {
    if (api.files.find((f) => f.path === filepath)) {
      // do nothing
    } else {
      diffs.push({ act: 'del', path: filepath })
    }
  }

  return diffs
}

export function printFileDiff(diff: FileDiff[]) {
  for (const d of diff) {
    switch (d.act) {
      case 'add':
        console.log(`${chalk.greenBright('[+ add]')} ${d.path}`)
        break
      case 'mod':
        console.log(`${chalk.yellowBright('[* mod]')} ${d.path}`)
        break
      case 'del':
        console.log(`${chalk.redBright('[- del]')} ${d.path}`)
        break
    }
  }
}

export function applyFileDiff(diff: FileDiff[]) {
  for (const d of diff) {
    switch (d.act) {
      case 'add':
      case 'mod':
        fs.mkdirSync(join(d.path, '..'), { recursive: true }) // lazy way to make sure the parent dir exists
        fs.writeFileSync(d.path, d.content || '', 'utf8')
        break
      case 'del':
        fs.unlinkSync(d.path)
        break
    }
  }
}

function readdirRecursiveSync(
  root: string,
  files: string[] = [],
  prefix: string = '',
) {
  var dir = join(root, prefix)
  if (!fs.existsSync(dir)) return files
  if (fs.statSync(dir).isDirectory())
    fs.readdirSync(dir).forEach(function (name) {
      readdirRecursiveSync(root, files, join(prefix, name))
    })
  else if (prefix.endsWith('.ts')) {
    files.push(join(root, prefix))
  }

  return files
}
