import ExpoModulesCore

enum ExpoAtprotoOAuthClientError: Error {
  case unsupportedAlgorithm(String)
  case invalidJwk
  case invalidHeader(String)
  case invalidPayload(String)
  case nullSigner
}

public class ExpoAtprotoOAuthClientModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAtprotoOAuthClient")

    Function("digest") { (data: Data, algo: String) throws -> Data in
      if algo != "sha256" {
        throw ExpoAtprotoOAuthClientError.unsupportedAlgorithm(algo)
      }
      return CryptoUtil.digest(data: data)
    }

    Function("getRandomValues") { (byteLength: Int) -> Data in
      return CryptoUtil.getRandomValues(byteLength: byteLength)
    }

    Function("generatePrivateJwk") { (algo: String) throws -> EncodedJWK in
      if algo != "ES256" {
        throw ExpoAtprotoOAuthClientError.unsupportedAlgorithm(algo)
      }
      return CryptoUtil.generateJwk()
    }

    Function("createJwt") { (header: String, payload: String, jwk: EncodedJWK) throws -> String in
      let jwk = try CryptoUtil.decodeJwk(x: jwk.x, y: jwk.y, d: jwk.d)
      let jwt = try JoseUtil.createJwt(header: header, payload: payload, jwk: jwk)
      return jwt
    }

    Function("verifyJwt") { (token: String, jwk: EncodedJWK, options: VerifyOptions) throws -> VerifyResult in
      let jwk = try CryptoUtil.decodeJwk(x: jwk.x, y: jwk.y, d: jwk.d)
      let res = try JoseUtil.verifyJwt(token: token, jwk: jwk, options: options)
      return res
    }
  }
}
