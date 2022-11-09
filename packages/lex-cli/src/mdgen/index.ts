import fs from 'fs'
import {
  methodSchema,
  MethodSchema,
  recordSchema,
  RecordSchema,
  tokenSchema,
  TokenSchema,
  Schema,
} from '@atproto/lexicon'
import * as jsonSchemaToTs from 'json-schema-to-typescript'

const INSERT_START = [
  '<!-- START lex generated content. Please keep comment here to allow auto update -->',
  "<!-- DON'T EDIT THIS SECTION! INSTEAD RE-RUN lex TO UPDATE -->",
]
const INSERT_END = [
  '<!-- END lex generated TOC please keep comment here to allow auto update -->',
]

export async function process(outFilePath: string, schemas: Schema[]) {
  let existingContent = ''
  try {
    existingContent = fs.readFileSync(outFilePath, 'utf8')
  } catch (e) {
    // ignore - no existing content
  }
  const fileLines: StringTree = existingContent.split('\n')

  // find previously generated content
  let startIndex = fileLines.findIndex((line) => matchesStart(line))
  let endIndex = fileLines.findIndex((line) => matchesEnd(line))
  if (startIndex === -1) {
    startIndex = fileLines.length
  }
  if (endIndex === -1) {
    endIndex = fileLines.length
  }

  // generate & insert content
  fileLines.splice(startIndex, endIndex - startIndex + 1, [
    INSERT_START,
    await genMdLines(schemas),
    INSERT_END,
  ])

  fs.writeFileSync(outFilePath, merge(fileLines), 'utf8')
}

async function genMdLines(schemas: Schema[]): Promise<StringTree> {
  let xprcMethods: StringTree = []
  let recordTypes: StringTree = []
  let tokenTypes: StringTree = []
  for (const schema of schemas) {
    console.log(schema.id)
    if (methodSchema.safeParse(schema).success) {
      xprcMethods = xprcMethods.concat(
        await genMethodSchemaMd(schema as MethodSchema),
      )
    } else if (recordSchema.safeParse(schema).success) {
      recordTypes = recordTypes.concat(
        await genRecordSchemaMd(schema as RecordSchema),
      )
    } else if (tokenSchema.safeParse(schema).success) {
      tokenTypes = tokenTypes.concat(genTokenSchemaMd(schema as TokenSchema))
    }
  }
  const doc = [
    recordTypes?.length ? recordTypes : undefined,
    xprcMethods?.length ? xprcMethods : undefined,
    tokenTypes?.length ? tokenTypes : undefined,
  ]
  return doc
}

async function genMethodSchemaMd(schema: MethodSchema): Promise<StringTree> {
  const desc: StringTree = []
  const params: StringTree = []
  const input: StringTree = []
  const output: StringTree = []
  const doc: StringTree = [
    `---`,
    ``,
    `## ${schema.id}`,
    '',
    desc,
    params,
    input,
    output,
  ]

  desc.push(`<mark>RPC ${schema.type}</mark> ${schema.description || ''}`, ``)

  if (schema.parameters) {
    if (schema.type === 'query') {
      params.push(`Parameters:`, ``)
    } else if (schema.type === 'procedure') {
      params.push(`QP options:`, ``)
    }
    params.push(`- Schema:`, ``)
    params.push('```typescript')
    params.push(
      (
        await jsonSchemaToTs.compile(schema.parameters, 'Parameters', {
          bannerComment: '',
          additionalProperties: false,
        })
      ).trim(),
    )
    params.push('```')
    params.push('')
  }

  if (schema.input) {
    input.push(`Parameters:`, ``)
    if (schema.input.encoding) {
      if (typeof schema.input.encoding === 'string') {
        input.push(`- Encoding: ${schema.input.encoding}`)
      } else if (Array.isArray(schema.input.encoding)) {
        input.push(`- Possible encodings: ${schema.input.encoding.join(', ')}`)
      }
    }
    if (schema.input.schema) {
      input.push(`- Schema:`, ``)
      input.push('```typescript')
      input.push(
        (
          await jsonSchemaToTs.compile(schema.input.schema, 'Parameters', {
            bannerComment: '',
            additionalProperties: false,
          })
        ).trim(),
      )
      input.push('```')
    }
    input.push('')
  }

  if (schema.output) {
    output.push(`Response:`, ``)
    if (schema.output.encoding) {
      if (typeof schema.output.encoding === 'string') {
        output.push(`- Encoding: ${schema.output.encoding}`)
      } else if (Array.isArray(schema.output.encoding)) {
        output.push(
          `- Possible encodings: ${schema.output.encoding.join(', ')}`,
        )
      }
    }
    if (schema.output.schema) {
      output.push(`- Schema:`, ``)
      output.push('```typescript')
      output.push(
        (
          await jsonSchemaToTs.compile(schema.output.schema, 'Response', {
            bannerComment: '',
            additionalProperties: false,
          })
        ).trim(),
      )
      output.push('```')
    }
    output.push('')
  }

  return doc
}

async function genRecordSchemaMd(schema: RecordSchema): Promise<StringTree> {
  const desc: StringTree = []
  const record: StringTree = []
  const doc: StringTree = [`---`, ``, `## ${schema.id}`, '', desc, record]

  desc.push(`<mark>Record type</mark> ${schema.description || ''}`, ``)

  if (schema.record) {
    record.push('```typescript')
    record.push(
      (
        await jsonSchemaToTs.compile(schema.record, 'Record', {
          bannerComment: '',
          additionalProperties: false,
        })
      ).trim(),
    )
    record.push('```')
    record.push('')
  }

  return doc
}

function genTokenSchemaMd(schema: TokenSchema): StringTree {
  const desc: StringTree = []
  const doc: StringTree = [`---`, ``, `## ${schema.id}`, '', desc]
  desc.push(`<mark>Token</mark> ${schema.description || ''}`, ``)
  return doc
}

type StringTree = (StringTree | string | undefined)[]
function merge(arr: StringTree): string {
  return arr
    .flat(10)
    .filter((v) => typeof v === 'string')
    .join('\n')
}

function matchesStart(line) {
  return /<!-- START lex /.test(line)
}

function matchesEnd(line) {
  return /<!-- END lex /.test(line)
}
