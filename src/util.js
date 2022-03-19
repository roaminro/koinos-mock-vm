const multibase = require('multibase')
const secp = require('@noble/secp256k1')
const { ripemd160 } = require('@noble/hashes/ripemd160')
const crypto = require('crypto')
/**
 * Encodes an Uint8Array in base58
 */
function encodeBase58 (buffer) {
  return new TextDecoder().decode(multibase.encode('z', buffer)).slice(1)
}

/**
 * Decodes a buffer formatted in base58
 */
function decodeBase58 (bs58) {
  return multibase.decode(`z${bs58}`)
}

function hashSHA256 (obj) {
  const digest = crypto.createHash('sha256').update(obj).digest()

  return new Uint8Array([18, 32, ...digest])
}

function hashRIPEMD160 (obj) {
  return new Uint8Array([18, 20, ...ripemd160(obj)])
}

function toUint8Array (hex) {
  const pairs = hex.match(/[\dA-F]{2}/gi)
  if (!pairs) throw new Error('Invalid hex')
  return new Uint8Array(
    pairs.map((s) => parseInt(s, 16)) // convert to integers
  )
}

function toHexString (buffer) {
  return Array.from(buffer)
    .map((n) => `0${Number(n).toString(16)}`.slice(-2))
    .join('')
}

function bitcoinEncode (
  buffer, // : Uint8Array,
  type, // : "public" | "private",
  compressed = false
) {
  let bufferCheck
  let prefixBuffer
  let offsetChecksum
  if (type === 'public') {
    bufferCheck = new Uint8Array(25)
    prefixBuffer = new Uint8Array(21)
    bufferCheck[0] = 0
    prefixBuffer[0] = 0
    offsetChecksum = 21
  } else {
    if (compressed) {
      bufferCheck = new Uint8Array(38)
      prefixBuffer = new Uint8Array(34)
      offsetChecksum = 34
      bufferCheck[33] = 1
      prefixBuffer[33] = 1
    } else {
      bufferCheck = new Uint8Array(37)
      prefixBuffer = new Uint8Array(33)
      offsetChecksum = 33
    }
    bufferCheck[0] = 128
    prefixBuffer[0] = 128
  }
  prefixBuffer.set(buffer, 1)
  const firstHash = crypto.createHash('sha256').update(prefixBuffer).digest()
  const doubleHash = crypto.createHash('sha256').update(firstHash).digest()
  const checksum = new Uint8Array(4)
  checksum.set(doubleHash.slice(0, 4))
  bufferCheck.set(buffer, 1)
  bufferCheck.set(checksum, offsetChecksum)
  return encodeBase58(bufferCheck)
}

function bitcoinAddress (publicKey) {
  const hash = crypto.createHash('sha256').update(publicKey).digest()
  const hash160 = ripemd160(hash)
  return bitcoinEncode(hash160, 'public')
}

/**
 * Decodes a buffer formatted in base64
 */
function decodeBase64 (bs64) {
  return multibase.decode(`M${bs64}`)
}

function encodeBase64 (buffer) {
  return new TextDecoder().decode(multibase.encode('M', buffer)).slice(1)
}

function recoverPublicKey (
  digest,
  signature
) {
  const compactSignatureHex = toHexString(signature)
  const recovery = Number(`0x${compactSignatureHex.slice(0, 2)}`) - 31
  const rHex = compactSignatureHex.slice(2, 66)
  const sHex = compactSignatureHex.slice(66)
  const r = BigInt(`0x${rHex}`)
  const s = BigInt(`0x${sHex}`)
  const sig = new secp.Signature(r, s)
  const publicKey = secp.recoverPublicKey(
    toHexString(digest.slice(2)),
    sig.toHex(),
    recovery
  )

  if (!publicKey) throw new Error('Public key cannot be recovered')

  return secp.Point.fromHex(publicKey).toRawBytes(true)
}

function arraysAreEqual (first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index])
}

module.exports = {
  toUint8Array,
  encodeBase58,
  decodeBase58,
  encodeBase64,
  decodeBase64,
  hashSHA256,
  hashRIPEMD160,
  bitcoinAddress,
  recoverPublicKey,
  arraysAreEqual
}
