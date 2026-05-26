import { describe, expect, it } from 'vitest'
import { LtHash } from '../src/lthash.js'

const STATE_BYTES = 2048

describe('LtHash', () => {
  it('starts as 2048 zero bytes', () => {
    const h = new LtHash()
    expect(h.toBytes()).toEqual(Buffer.alloc(STATE_BYTES))
  })

  it('add then remove returns to zero state', () => {
    const h = new LtHash()
    h.add('element')
    expect(h.toBytes()).not.toEqual(Buffer.alloc(STATE_BYTES))
    h.remove('element')
    expect(h.toBytes()).toEqual(Buffer.alloc(STATE_BYTES))
  })

  it('is order-independent across many adds', () => {
    const a = new LtHash()
    const b = new LtHash()
    const items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
    for (const x of items) a.add(x)
    for (const x of [...items].reverse()) b.add(x)
    expect(a.equals(b)).toBe(true)
  })

  it('round-trips via toBytes/constructor', () => {
    const a = new LtHash()
    a.add('one')
    a.add('two')
    const b = new LtHash(a.toBytes())
    expect(a.equals(b)).toBe(true)
  })

  it('rejects construction from wrong-length bytes', () => {
    expect(() => new LtHash(new Uint8Array(32))).toThrow()
  })

  it('does not share state with constructor argument', () => {
    const init = new Uint8Array(STATE_BYTES)
    init[0] = 0xff
    const h = new LtHash(init)
    init[0] = 0x00
    expect(h.toBytes()[0]).toBe(0xff)
  })

  it('double-add of same element does NOT zero out (multiset)', () => {
    const h = new LtHash()
    h.add('x')
    h.add('x')
    expect(h.toBytes()).not.toEqual(Buffer.alloc(STATE_BYTES))
  })

  it('digest() of empty state is sha256 of zeros_2048', () => {
    const h = new LtHash()
    expect(h.digest()).toHaveLength(32)
    expect(h.digest().toString('hex')).toBe(
      'e5a00aa9991ac8a5ee3109844d84a55583bd20572ad3ffcd42792f3c36b183ad',
    )
  })

  it('fromHex round-trips a hex-encoded state', () => {
    const a = new LtHash()
    a.add('one')
    a.add('two')
    const b = LtHash.fromHex(a.toBytes().toString('hex'))
    expect(a.equals(b)).toBe(true)
  })

  it('digest() is deterministic and order-independent', () => {
    const a = new LtHash()
    const b = new LtHash()
    a.add('alpha')
    a.add('beta')
    b.add('beta')
    b.add('alpha')
    expect(a.digest()).toEqual(b.digest())
    expect(a.digest()).toHaveLength(32)
  })

  it('snapshot vector locks the algorithm', () => {
    // Algorithm: n=1024 lanes of u16, q=2^16, BLAKE3 XOF dkLen=2048,
    // lane-wise modular add. If this snapshot ever changes, the
    // on-disk state format has changed and storage migration is
    // required.
    const h = new LtHash()
    h.add('atproto')
    h.add('space')
    const hex = Buffer.from(h.toBytes()).toString('hex')
    expect(hex.length).toBe(STATE_BYTES * 2)
    expect(hex).toBe(
      '34a3d4a5e9f4ae93fdb1580c14a8e8013342cd303117862c89ec906b462706aaaa26ffa4ae4159c4c6c2b81cc0fa83582d7c05c31ae64e302284dd1bfccad846c94b2e9b4d704b9d21cf8953d28610f5a0af710c99958f107a28a3b1a71017ebd47a14e184d95ca4affc534cba38882b46a6e52350c836ad7b5374246bf354f52dcff8b7dae5255b410b70ed5dfd54ac94ffa083dfb3708c9d923190399a65d108ef05d7ec928e98bbf865f1229a1b497ec09458a9a08d17631a4fa28dc96d384748d544660b116e25066b5b012f7d94fe6e1e8f4b45e9588523a714390e1f61f6a65f21b4e230973b055ae371cd697f4d2733ee0bdf20fde6e934b222cf065ed61a765f09ab8332d36bcaffedaaff483c4f0ba19c2c684e3f1744b073e89ab901d208e0bcf60f9918b820bbb5bb005085d7e2e71df2ad4be0c2d879cce17ea2a46e9d71ef9708715b0a5f34680cb8977f13d9082b141d9638df35eafce0693845a4ab810fd213bbd0dbd12e74d5297e11c9f601df603eb357d80669eacb97051df757a500b16d0edacc8d556e108430e868eae78312985110b20692a3738300221d361d30d02274d662b22808f381564aa966f117383e6b923663dd28c1cca46b8099938fde309ce91a7e99b188f152db7e691752757cf897883be25cf0a9fda51106e6c735f55ff9e77cad2cd8f5041d0c746175eddeb70762efec9604d31254e9ddd9ded2b186e45b40010d595068b94cfb7017553986402646424038fb06cd0d91711caccee3a1e53a1b6849e5b61bb6bc432a1466f3c2bfb9c2503e02e3c8dade31afa7c57b50adb9fbe95706bfec45036a16664184ce3ef4c906b161a640f64708b12c6361f1fab2c14f3fa25281c1cc722b3913a5cdcbfe91690ff98096809271cdf9b9f814d6644227a3d80b4bfd195f352755ae89bc79329d7aa11eed4321b2fffaf7c1a927c394fd59508815ed3881dbf5a17b23e26aa8ea2bb5f0b3c9b207007a96eb1638d499bb211f594cfe0420457b1c0cf827ea14629324c07c087e71509b22dbdcfe2c985e4539c096df8fc02ffe932bf28d68df58abe162eca7683a41f85203d11d9d6decfe157139814b259f2f94fda2fc2f4527e94bd56c0bbfe5344befac7213eaf3acff4cd7148d95ad6babc3381d2abf97b4526787378579519c362e7692817ca885c967f003a65fb76cbcdfe8dd90c48c298c5e2935364957cf3b9a5bfb73a1534341e5fe8c9dc5f9a15afee4fdd2c7d5b6b2cd50112c83bf7901b28575e162fd91565153a2e165f8cc6d0bab13ce0b910eadbc9aff9316531d1fc15bb8aba1f94e0178a43e5935dffaa7d00fa7c57439074f1ae95ef7aa34f76a6d797c722a76ffcf5aeb69bf7490a7237935091e86517201d24d8a68a24bf0c606322a91a34650765151e56bf355f89aeb14bb598d1b1bb19e5508d5d0452117bfec1da43c3533c9cc350ec68f898dc4ff7360a6246f3fd0263fa0aa759699bb29e1f6935b59df39df0f46633b83e3f4cf420a4a9a1ea3331f2b0168007d1f58e40e2b7cb1e5da28477be11f3cdf8798660023bcef29b4c057398a8f7f96c61f2ea983e91a8dc3b4dc9dfba9c50d9060d5618e10cc5bac7bbb6517466c4b112dd9b642a80297f48d2aa3fd231663f508a065bf73e35f7d39c5095330ef8b6b25df0a08e43cfd3d278b5151a845f8e9fd7c1e52a8338716b1f2275a7279a0245e3d5e1de68f0f15d4ac73476a368dc9d8544fc082c11995b80c9ea5812ad2bcc9510d9e1a56d0441fb0cfe0350e5e90dcde9dfb5f174d1639d53c4c42253133fed45e6da16b9da15defe621d27bcfb7a61224474390b5756f1ca7565ae81477793a8c3607aede9ee5805d5b69d67cdb9036f4931f2d4c04df415111dc4f0d143d101fb85a653e940a85a3aee71b8941fe2191dfdbc0a4d4cc7fce6e4ac91aa3f9c679afc0e6314ed492ab1ff9d105f1f0b967a13a45c56b27f66e01376bcdedab1c2ef7e3aa38a37ba7a8fef22682ab8e58e24ae1c6236c365f4198b8de1cf5a052623e6f8c2073b0c3efa464dd435986fd80e0afeea36b0fb1b06c6b1e58b40673563cbe45434defb3b194e3e481896847236cb91154d2badda206655e5be4f36f97ccc38cfca49a66fd1be468ba97dec7ff7f56b37d77d1acd345d2f3e4143643bd4c6f6ac904aa34cc2eb39b16e89d8367a8579821f143804b20f15427224db7618f4bef582c9607a4603022bbfc156f54a85199cc05781c844e517a9074f4037e292ffe74f8c4d923b2a220d6b2da1e91822fd574081a0244e5de9007b358311ffc1f02f7133076302790b71e1f73116ee0dc6fd95290bf1fda2a1c0ebeb669f2d03cda8dc3e817d9e2893f9bd193e4d5908ed4f080452686e8a2a84374a0f678823ead2d8d1f45b245d338955503803471cb732d1f00369e989c016cd718a63a5e3454cf505c69d546ba3da3d8d7fc049d2b7d980a5c7a44bce02d23ad056d9cbe4d61d690c0c7afd3d1d80c3b1a5daf31a2acd4d00de7090b2531c0c9e3a999eca6bd69982328235a65466578469ab96f5aff8d8016d893e92bc3aaf8e603e9910f83b5519953bdbd0c1d94e0cae48889c4d37ac53f47f3d9d340ace07a657b052b800960f79d08e01032759796103e037e1c8af7c1373d953ad50c28cfbbefd0ac3ef1287a7d3efeb3e7416925e21d2122937d39460699945407cb6962f2f31824989510f91c8c558b58b7f09ddccb4c21a3977bb6332a962edbffb86e0a743c217ab39d18125be525cba097ed98895c827246b9e3fa1e965003cf6e919122969b8635051a3ceeeaf9fb45adee52543a2e61c0f75a4ca62c7af10498117fcfb7f296c54176a3b2a1f83c124495afdbcb85dcb0abb2b46c',
    )
  })
})
