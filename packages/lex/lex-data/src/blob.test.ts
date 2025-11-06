import { parseLexBlob } from './blob.js'
import { CID } from './cid.js'

describe('parseLexBlob', () => {
  describe('valid inputs', () => {
    for (const { note, json } of [
      {
        note: 'valid',
        json: {
          $type: 'blob',
          ref: {
            $link:
              'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
          },
          mimeType: 'image/jpeg',
          size: 10000,
        },
      },
    ]) {
      it(note, () => {
        const blob = parseLexBlob(json)
        expect(blob.$type).toBe('blob')
        expect(blob.ref).toBeInstanceOf(CID)
        expect(typeof blob.mimeType).toBe('string')
        expect(typeof blob.size).toBe('number')
        expect(blob.mimeType).toBe(json.mimeType)
        expect(blob.size).toBe(json.size)
      })
    }
  })

  describe('invalid inputs', () => {
    for (const { note, json } of [
      {
        note: 'blob with string size',
        json: {
          $type: 'blob',
          ref: {
            $link:
              'bafkreiccldh766hwcnuxnf2wh6jgzepf2nlu2lvcllt63eww5p6chi4ity',
          },
          mimeType: 'image/jpeg',
          size: '10000',
        },
      },
      {
        note: 'blob with missing key',
        json: {
          $type: 'blob',
          mimeType: 'image/jpeg',
          size: 10000,
        },
      },
    ]) {
      it(note, () => {
        expect(() => parseLexBlob(json)).toThrow()
      })
    }
  })
})
