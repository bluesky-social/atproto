import Foundation
import CryptoKit
import JOSESwift

class CryptoUtil: NSObject {
  static func digest(data: Data) -> Data {
    let hash = SHA256.hash(data: data)
    return Data(hash)
  }

  public static func getRandomValues(byteLength: Int) -> Data {
    let bytes = (0..<byteLength).map { _ in UInt8.random(in: UInt8.min...UInt8.max) }
    return Data(bytes)
  }

  static func generateJwk() -> EncodedJWK {
    let kid = UUID().uuidString

    let privKey = P256.Signing.PrivateKey()
    let pubKey = privKey.publicKey

    let x = pubKey.x963Representation[1..<33].base64URLEncodedString()
    let y = pubKey.x963Representation[33...].base64URLEncodedString()
    let d = privKey.rawRepresentation.base64URLEncodedString()

    let jwk = EncodedJWK()
    jwk.kty = "EC"
    jwk.crv = "P-256"
    jwk.kid = kid
    jwk.x = x
    jwk.y = y
    jwk.d = d
    jwk.alg = "ES256"

    return jwk
  }

  static func decodeJwk(x: String, y: String, d: String) throws -> SecKey {
    func base64UrlDecode(_ string: String) -> Data? {
      var base64 = string
        .replacingOccurrences(of: "-", with: "+")
        .replacingOccurrences(of: "_", with: "/")

      let remainder = base64.count % 4
      if remainder > 0 {
        base64 += String(repeating: "=", count: 4 - remainder)
      }

      return Data(base64Encoded: base64)
    }

    guard let xData = base64UrlDecode(x),
          let yData = base64UrlDecode(y),
          let dData = base64UrlDecode(d) else {
      throw ExpoAtprotoOAuthClientError.invalidJwk
    }

    var keyData = Data()
    keyData.append(0x04)
    keyData.append(xData)
    keyData.append(yData)
    keyData.append(dData)

    let attributes: [String: Any] = [
      kSecAttrKeyType as String: kSecAttrKeyTypeEC,
      kSecAttrKeyClass as String: kSecAttrKeyClassPrivate,
      kSecAttrKeySizeInBits as String: 256
    ]

    var error: Unmanaged<CFError>?

    let key = SecKeyCreateWithData(keyData as CFData, attributes as CFDictionary, &error)
    if error != nil {
      throw error!.takeUnretainedValue()
    }

    guard let key = key else {
      throw ExpoAtprotoOAuthClientError.invalidJwk
    }

    return key
  }
}
