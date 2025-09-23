import JOSESwift

class JoseUtil: NSObject {
  private static func headerStringToHeader(_ headerString: String) -> JWSHeader? {
    guard let headerData = headerString.data(using: .utf8) else {
      return nil
    }
    return JWSHeader(headerData)
  }

  private static func payloadStringToPayload(_ payloadString: String) -> Payload? {
    guard let payloadData = payloadString.data(using: .utf8) else {
      return nil
    }
    return Payload(payloadData)
  }

  static func createJwt(header: String, payload: String, jwk: SecKey) throws -> String {
    guard let header = headerStringToHeader(header) else {
      throw ExpoAtprotoOAuthClientError.invalidHeader("could not parse header string")
    }

    guard let payload = payloadStringToPayload(payload) else {
      throw ExpoAtprotoOAuthClientError.invalidPayload("could not parse payload string")
    }

    let signer = Signer(signingAlgorithm: .ES256, key: jwk)

    guard let signer = signer else {
      throw ExpoAtprotoOAuthClientError.nullSigner
    }

    let jws = try JWS(header: header, payload: payload, signer: signer)

    return jws.compactSerializedString
  }

  static func verifyJwt(token: String, jwk: SecKey, options: VerifyOptions) throws -> VerifyResult {
    guard let jws = try? JWS(compactSerialization: token),
          let verifier = Verifier(verifyingAlgorithm: .ES256, key: jwk),
          let validation = try? jws.validate(using: verifier)
    else {
      throw ExpoAtprotoOAuthClientError.invalidJwk
    }

    let header = validation.header
    let payload = String(data: validation.payload.data(), encoding: .utf8)
    guard let payload = payload else {
      throw ExpoAtprotoOAuthClientError.invalidPayload("unable to parse payload")
    }

    var protectedHeader: [String: Any] = [:]
    protectedHeader["alg"] = "ES256"
    if header.jku != nil {
      protectedHeader["jku"] = header.jku?.absoluteString
    }
    if header.kid != nil {
      protectedHeader["kid"] = header.kid
    }
    if header.typ != nil {
      protectedHeader["typ"] = header.typ
    }
    if header.cty != nil {
      protectedHeader["cty"] = header.cty
    }
    if header.crit != nil {
      protectedHeader["crit"] = header.crit
    }

    if let typ = options.typ {
      if header.typ != typ {
        throw ExpoAtprotoOAuthClientError.invalidPayload("typ mismatch")
      }
    }

    let claims = try JSONSerialization.jsonObject(with: validation.payload.data(), options: []) as? [String: Any]

    if let requiredClaims = options.requiredClaims {
      try requiredClaims.forEach { c in
        if claims?[c] == nil {
          throw ExpoAtprotoOAuthClientError.invalidPayload("required claim \(c) missing")
        }
      }
    }

    if let audience = options.audience {
      if claims?["aud"] as? String != audience {
        throw ExpoAtprotoOAuthClientError.invalidPayload("audience mismatch")
      }
    }

    if let subject = options.subject {
      if claims?["sub"] as? String != subject {
        throw ExpoAtprotoOAuthClientError.invalidPayload("subject mismatch")
      }
    }

    if let checkTolerance = options.clockTolerance {
      let now = Date()
      let expiryDate: Date
      if let expiryString = claims?["exp"] as? String {
        let formatter = ISO8601DateFormatter()
        expiryDate = formatter.date(from: expiryString)!
      } else {
        throw ExpoAtprotoOAuthClientError.invalidPayload("expiry missing")
      }
      if expiryDate < now - checkTolerance {
        throw ExpoAtprotoOAuthClientError.invalidPayload("token expired")
      }
    }

    if let maxTokenAge = options.maxTokenAge {
      let now = Date()
      if let expiryString = claims?["exp"] as? String {
        let formatter = ISO8601DateFormatter()
        let expiryDate = formatter.date(from: expiryString)!
        if expiryDate < now - maxTokenAge {
          throw ExpoAtprotoOAuthClientError.invalidPayload("token expired")
        }
      } else {
        throw ExpoAtprotoOAuthClientError.invalidPayload("expiry missing")
      }
    }

    if let issuer = options.issuer {
      if claims?["iss"] as? String != issuer {
        throw ExpoAtprotoOAuthClientError.invalidPayload("issuer mismatch")
      }
    }

    let res = VerifyResult()
    res.payload = payload
    res.protectedHeader = protectedHeader

    return res
  }
}
