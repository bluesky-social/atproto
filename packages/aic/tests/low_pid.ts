import { pid } from '../src/pid'

const run = async () => {
    let min_p = "y";
    const tic = Number(new Date())
    const iterations = 100_000_000
    for (let i = 0; i < iterations; i++) {
        const data = {
            nonce: Math.random() * (Number.MAX_SAFE_INTEGER + 1),
            a: 1,
            b: 2,
            c: 3,
            'adx/account_keys': ['did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV'],
        }
        const p = await pid(data)
        if (p < min_p) {
            min_p = p
            console.log(i, min_p, data)
        }
        if (i % 500_000 == 0) {
            console.log(i, min_p, 'hashrate KH/s', i / (Number(new Date()) - tic))
        }
    }
    const toc = Number(new Date())
    console.log("time", toc - tic, 'iterations', iterations, 'hashrate KH/s', iterations / (toc - tic))
}

run()