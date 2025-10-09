import { BlobPermission } from './blob-permission.js'

describe('BlobPermission', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = BlobPermission.fromString('blob:image/png')
        expect(scope).not.toBeNull()
        expect(scope!.accept).toEqual(['image/png'])
      })

      it('should parse valid blob scope with multiple accept parameters', () => {
        const scope = BlobPermission.fromString(
          'blob?accept=image/png&accept=image/jpeg',
        )
        expect(scope).not.toBeNull()
        expect(scope!.accept).toEqual(['image/png', 'image/jpeg'])
      })

      it('should reject blob scope without accept', () => {
        const scope = BlobPermission.fromString('blob')
        expect(scope).toBeNull()
      })

      for (const invalid of [
        'invalid',
        'scope',
        'blob:invalid',
        'blob?accept=invalid-mime',
        'blob?accept=invalid',
        'blob:*/**',
        'blob:*/png',
      ]) {
        it(`should return null for invalid rpc scope: ${invalid}`, () => {
          expect(BlobPermission.fromString(invalid)).toBeNull()
        })
      }
    })

    describe('scopeNeededFor', () => {
      it('should return correct scope string for specific MIME type', () => {
        const scope = BlobPermission.scopeNeededFor({ mime: 'image/png' })
        expect(scope).toBe('blob:image/png')
      })

      // XXX: is this in the right place?
      it('should return scope that accepts all MIME types', () => {
        const scope = BlobPermission.scopeNeededFor({
          mime: 'application/json',
        })
        expect(scope).toBe('blob:application/json')
      })
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('should match exact MIME type', () => {
        const scope = BlobPermission.fromString('blob:image/png')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ mime: 'image/png' })).toBe(true)
      })

      it('should match wildcard MIME type', () => {
        const scope = BlobPermission.fromString('blob:*/*')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ mime: 'image/jpeg' })).toBe(true)
        expect(scope!.matches({ mime: 'application/json' })).toBe(true)
      })

      it('should match subtype wildcard MIME type', () => {
        const scope = BlobPermission.fromString('blob:image/*')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ mime: 'image/gif' })).toBe(true)
      })

      it('should not match different MIME type', () => {
        const scope = BlobPermission.fromString('blob:image/png')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ mime: 'image/jpeg' })).toBe(false)
      })

      it('should match multiple accept values', () => {
        const scope = BlobPermission.fromString(
          'blob?accept=image/png&accept=image/jpeg',
        )
        expect(scope).not.toBeNull()
        expect(scope!.matches({ mime: 'image/png' })).toBe(true)
        expect(scope!.matches({ mime: 'image/jpeg' })).toBe(true)
        expect(scope!.matches({ mime: 'image/gif' })).toBe(false)
      })
    })

    describe('toString', () => {
      it('should format scope with accept parameter', () => {
        const scope = new BlobPermission(['image/png', 'image/jpeg'])
        expect(scope.toString()).toBe('blob?accept=image/jpeg&accept=image/png')
      })

      it('should strip redundant accept parameters', () => {
        expect(new BlobPermission(['*/*', 'image/*']).toString()).toBe(
          'blob:*/*',
        )
        expect(new BlobPermission(['*/*', 'image/png']).toString()).toBe(
          'blob:*/*',
        )
        expect(new BlobPermission(['image/*', 'image/png']).toString()).toBe(
          'blob:image/*',
        )
      })

      it('should use positional format for single accept', () => {
        expect(new BlobPermission(['image/png']).toString()).toBe(
          'blob:image/png',
        )
        expect(new BlobPermission(['image/*']).toString()).toBe('blob:image/*')
        expect(new BlobPermission(['*/*']).toString()).toBe('blob:*/*')
      })

      it('should use query format for multiple accepts', () => {
        expect(new BlobPermission(['image/png', 'image/jpeg']).toString()).toBe(
          'blob?accept=image/jpeg&accept=image/png',
        )
      })
    })
  })
})
