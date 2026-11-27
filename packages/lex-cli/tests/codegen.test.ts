import { describe, expect, it } from 'vitest'
import { type LexiconDoc, parseLexiconDoc } from '@atproto/lexicon'
import { genClientApi } from '../src/codegen/client.js'
import { genServerApi } from '../src/codegen/server.js'
import type { GeneratedAPI } from '../src/types.js'
import { lexicons } from './_lexicons.js'

describe('genClientApi', () => {
  it('generates the client API', async () => {
    expectApiToMatchSnapshot(await genClientApi(parseLexicons()))
  })
})

describe('genServerApi', () => {
  it('generates the server API', async () => {
    expectApiToMatchSnapshot(await genServerApi(parseLexicons()))
  })
})

// `Lexicons` mutates the documents it is given, so each run gets its own copy.
function parseLexicons(): LexiconDoc[] {
  return lexicons.map((doc) => parseLexiconDoc(structuredClone(doc)))
}

function expectApiToMatchSnapshot(api: GeneratedAPI) {
  expect(api.files.map((file) => file.path)).toMatchSnapshot('files')
  for (const file of api.files) {
    expect(file.content).toMatchSnapshot(file.path)
  }
}
