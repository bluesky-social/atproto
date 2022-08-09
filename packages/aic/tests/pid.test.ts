import { pid } from '../src/pid'

describe('pid test', () => {
    it('empty object', async () => {
        const out = await pid({})
        expect(out).toEqual('zckdqzcupqhnso6e')
    })

    it('empty string', async () => {
        const out = await pid("")
        expect(out).toEqual('zwisgckoszki3dar')
    })

    it('empty bytes', async () => {
        const out = await pid(new Uint8Array(0))
        expect(out).toEqual('zwisgckoszki3dar')
    })

    it('hello', async () => {
        const out = await pid({hello: 'world'})
        expect(out).toEqual('zmil5mwhd4nmypmz')
    })

    it('z', async () => {
        const out = await pid({ nonce: 8365346118065072 })
        expect(out).toEqual('z32qxjfx6fpu6hb7')
    })
    it('y', async () => {
        const out = await pid({ nonce: 5576542511148520 })
        expect(out).toEqual('y3n5k55gm2nw5gyo')
    })
    it('x', async () => {
        const out = await pid({ nonce: 573201091280868 })
        expect(out).toEqual('x55hbpfe3wovlu6l')
    })
    it('w', async () => {
        const out = await pid({ nonce: 3085492827343776 })
        expect(out).toEqual('w4k6ekav4lhtanq6')
    })
    it('v', async () => {
        const out = await pid({ nonce: 1905127058967142 })
        expect(out).toEqual('v3hepes66x6j5b55')
    })
    it('u', async () => {
        const out = await pid({ nonce: 908467084364412 })
        expect(out).toEqual('u3nhdxrvhedkrbh3')
    })
})