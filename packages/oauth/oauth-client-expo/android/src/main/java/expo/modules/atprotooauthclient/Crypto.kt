package expo.modules.atprotooauthclient

import com.nimbusds.jose.Algorithm
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.jwk.KeyUse
import com.nimbusds.jose.util.Base64URL
import expo.modules.atprotooauthclient.EncodedJWK
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.interfaces.ECPrivateKey
import java.security.interfaces.ECPublicKey
import java.util.UUID

class Crypto {
  fun digest(data: ByteArray): ByteArray {
    val instance = MessageDigest.getInstance("sha256")
    return instance.digest(data)
  }

  fun getRandomValues(byteLength: Int): ByteArray {
    val random = ByteArray(byteLength)
    java.security.SecureRandom().nextBytes(random)
    return random
  }

  fun generateJwk(): EncodedJWK {
    val keyIdString = UUID.randomUUID().toString()

    val keyPairGen = KeyPairGenerator.getInstance("EC")
    keyPairGen.initialize(Curve.P_256.toECParameterSpec())
    val keyPair = keyPairGen.generateKeyPair()

    val publicKey = keyPair.public as ECPublicKey
    val privateKey = keyPair.private as ECPrivateKey

    val privateJwk =
      ECKey
        .Builder(Curve.P_256, publicKey)
        .privateKey(privateKey)
        .keyUse(KeyUse.SIGNATURE)
        .keyID(keyIdString)
        .algorithm(Algorithm.parse("ES256"))
        .build()

    return EncodedJWK().apply {
      kty = privateJwk.keyType.value
      crv = privateJwk.curve.toString()
      kid = keyIdString
      x = privateJwk.x.toString()
      y = privateJwk.y.toString()
      d = privateJwk.d.toString()
      alg = privateJwk.algorithm.name
    }
  }

  fun decodeJwk(encodedJwk: EncodedJWK): ECKey {
    val xb64url = Base64URL.from(encodedJwk.x)
    val yb64url = Base64URL.from(encodedJwk.y)
    val db64url = Base64URL.from(encodedJwk.d)
    return ECKey
      .Builder(Curve.P_256, xb64url, yb64url)
      .d(db64url)
      .keyUse(KeyUse.SIGNATURE)
      .keyID(encodedJwk.kid)
      .algorithm(Algorithm.parse(encodedJwk.alg))
      .build()
  }
}
