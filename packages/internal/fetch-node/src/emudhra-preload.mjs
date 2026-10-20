import { X509Certificate, createHash } from 'node:crypto'
import { syncBuiltinESMExports } from 'node:module'
import tls from 'node:tls'

// @NOTE SPKI SHA-256 hashes from https://github.com/nodejs/node/pull/66871.
// Key hashes also cover reissued and cross-signed certificates.
const compromisedKeys = new Set([
  '49dd353dc2b919a3770645117d0e60c16115e7d1bc259eefe734b00ea434fe5f',
  '5c0660a2b164910d8ff589c18e14552e9e0ec237dcefe2cb736d41a4811f81a0',
  '63ecefee431d49523bc1136c4e72d0206a477086caf606cd5cf025686c109cf8',
  '92c063d67e8f14db71d288e11266ffdaf69cbf115f7bab14f3bc2f68d25e0e30',
  'ebed6475c2c2d80fcb199f3fe8dd6e6b3ce60b77eb15d4e42c3dec0c6f5b5105',
  'ec4ffa1ad0ac88081314b7aaffef6a91f97cd57291bb5ba686c5415f5eb4f6b6',
  '43bffa19d6ef651451f6841e019931e96f6f2eaeff28ab4b6f1ce4576de2717b',
  'e0254c7fcdc265e2f0f8a428dabb75ab4ae039b4872d62f5ee57f0877d5a8a41',
])

// @NOTE Cache only key classification, never hostname or trust decisions.
// Bound memory even when connecting to many attacker-controlled certificates.
const cacheLimit = 256
/** @type {Map<string, boolean>} */
const compromisedCertificates = new Map()

/** @param {import('node:tls').PeerCertificate} peer */
function checkKeys(peer) {
  const seen = new Set()
  try {
    for (
      let cert = /** @type {import('node:tls').DetailedPeerCertificate} */ (
        peer
      );
      cert && !seen.has(cert);
      cert = cert.issuerCertificate
    ) {
      seen.add(cert)
      let blocked = compromisedCertificates.get(cert.fingerprint256)
      if (blocked === undefined) {
        const spki = new X509Certificate(cert.raw).publicKey.export({
          type: 'spki',
          format: 'der',
        })
        blocked = compromisedKeys.has(
          createHash('sha256').update(spki).digest('hex'),
        )
        if (cert.fingerprint256) {
          if (compromisedCertificates.size >= cacheLimit) {
            compromisedCertificates.clear()
          }
          compromisedCertificates.set(cert.fingerprint256, blocked)
        }
      }
      if (blocked) {
        return Object.assign(
          new Error('Certificate chain contains a compromised eMudhra key'),
          { code: 'CERT_REVOKED' },
        )
      }
    }
  } catch (cause) {
    return Object.assign(
      new Error('Unable to check TLS certificate keys', { cause }),
      { code: 'ERR_TLS_CERT_CHAIN_CHECK' },
    )
  }
}

const connect = tls.connect

// @NOTE Compose at connection creation so custom hostname checks cannot bypass
// the blocklist. Node runs this before secureConnect and application writes.
/** @param {any[]} args */
tls.connect = function (...args) {
  const index =
    args[0] !== null && typeof args[0] === 'object'
      ? 0
      : args[1] !== null && typeof args[1] === 'object'
        ? 1
        : (args[2] !== null && typeof args[2] === 'object') ||
            typeof args[1] === 'string'
          ? 2
          : 1
  const options = args[index]
  const checkIdentity = options?.checkServerIdentity ?? tls.checkServerIdentity
  if (typeof checkIdentity !== 'function') {
    return Reflect.apply(connect, this, args)
  }

  const guardedOptions = {
    ...(typeof options === 'object' ? options : undefined),
    /**
     * @param {string} hostname
     * @param {import('node:tls').PeerCertificate} peer
     */
    checkServerIdentity(hostname, peer) {
      return checkKeys(peer) || checkIdentity.call(this, hostname, peer)
    },
  }
  if (typeof options === 'function' || options === undefined) {
    args.splice(index, 0, guardedOptions)
  } else {
    args[index] = guardedOptions
  }
  return Reflect.apply(connect, this, args)
}

syncBuiltinESMExports()
