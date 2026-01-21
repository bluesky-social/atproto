package expo.modules.atprotooauthclient

import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.ECDSASigner
import com.nimbusds.jose.crypto.ECDSAVerifier
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import expo.modules.atprotooauthclient.VerifyOptions
import expo.modules.atprotooauthclient.VerifyResult

class InvalidPayloadException(
  message: String,
) : Exception(message)

class Jose {
  fun createJwt(
    header: String,
    payload: String,
    jwk: ECKey,
  ): String {
    val parsedHeader = JWSHeader.parse(header)
    val parsedPayload = JWTClaimsSet.parse(payload)

    val signer = ECDSASigner(jwk)
    val jwt = SignedJWT(parsedHeader, parsedPayload)
    jwt.sign(signer)

    return jwt.serialize()
  }

  fun verifyJwt(
    token: String,
    jwk: ECKey,
    options: VerifyOptions,
  ): VerifyResult {
    val jwt = SignedJWT.parse(token)
    val verifier = ECDSAVerifier(jwk)

    if (!jwt.verify(verifier)) {
      throw InvalidPayloadException("invalid JWT signature")
    }

    val protectedHeader = emptyMap<String, Any>().toMutableMap()
    protectedHeader["alg"] = jwt.header.algorithm

    jwt.header.getCustomParam("jku")?.let {
      protectedHeader["jku"] = it.toString()
    }
    jwt.header.keyID?.let {
      protectedHeader["kid"] = it
    }
    jwt.header.type?.let {
      protectedHeader["typ"] = it.toString()
    }
    jwt.header.contentType?.let {
      protectedHeader["cty"] = it
    }
    jwt.header.criticalParams?.let {
      protectedHeader["crit"] = it.toList()
    }

    options.typ?.let {
      if (jwt.header.type.toString() != it) {
        throw InvalidPayloadException("typ mismatch")
      }
    }

    val claims = jwt.jwtClaimsSet

    options.requiredClaims?.let { requiredClaims ->
      requiredClaims.forEach { claim ->
        if (!claims.claims.containsKey(claim)) {
          throw InvalidPayloadException("required claim '$claim' missing")
        }
      }
    }

    options.audience?.let {
      if (!claims.audience.contains(it)) {
        throw InvalidPayloadException("audience mismatch")
      }
    }

    options.subject?.let {
      if (claims.subject != it) {
        throw InvalidPayloadException("subject mismatch")
      }
    }

    options.checkTolerance?.let {
      val currentTime = options.currentDate ?: (System.currentTimeMillis() / 1000.0)
      if (claims.issueTime.time / 1000.0 + it < currentTime) {
        throw InvalidPayloadException("token expired")
      }
    }

    options.maxTokenAge?.let {
      val currentTime = options.currentDate ?: (System.currentTimeMillis() / 1000.0)
      if (claims.issueTime.time / 1000.0 + it < currentTime) {
        throw InvalidPayloadException("token expired")
      }
    }

    options.issuer?.let {
      if (claims.issuer != it) {
        throw InvalidPayloadException("issuer mismatch")
      }
    }

    return VerifyResult().apply {
      payload = jwt.payload.toString()
      this.protectedHeader = protectedHeader
    }
  }
}
