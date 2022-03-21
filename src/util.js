const multibase = require('multibase')
const secp = require('@noble/secp256k1')
const { ripemd160 } = require('@noble/hashes/ripemd160')
const { sha256 } = require('@noble/hashes/sha256')
const { sha512 } = require('@noble/hashes/sha512')
// eslint-disable-next-line camelcase
const { keccak_256 } = require('@noble/hashes/sha3')
const crypto = require('crypto')

function UInt8ArrayToString (array) {
  return new TextDecoder().decode(array)
}

// see https://github.com/joticajulian/koilib/blob/main/src/utils.ts
function encodeBase58 (buffer) {
  return new TextDecoder().decode(multibase.encode('z', buffer)).slice(1)
}

// see https://github.com/joticajulian/koilib/blob/main/src/utils.ts
function decodeBase58 (bs58) {
  return multibase.decode(`z${bs58}`)
}

// see https://github.com/joticajulian/koilib/blob/main/src/utils.ts
function toUint8Array (hex) {
  const pairs = hex.match(/[\dA-F]{2}/gi)
  if (!pairs) throw new Error('Invalid hex')
  return new Uint8Array(
    pairs.map((s) => parseInt(s, 16)) // convert to integers
  )
}

// see https://github.com/joticajulian/koilib/blob/main/src/utils.ts
function toHexString (buffer) {
  return Array.from(buffer)
    .map((n) => `0${Number(n).toString(16)}`.slice(-2))
    .join('')
}

// see https://github.com/joticajulian/koilib/blob/main/src/utils.ts
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
  const firstHash = sha256(prefixBuffer)
  const doubleHash = sha256(firstHash)
  const checksum = new Uint8Array(4)
  checksum.set(doubleHash.slice(0, 4))
  bufferCheck.set(buffer, 1)
  bufferCheck.set(checksum, offsetChecksum)
  return encodeBase58(bufferCheck)
}

// see https://github.com/joticajulian/koilib/blob/main/src/utils.ts
function bitcoinAddress (publicKey) {
  const hash = sha256(publicKey)
  const hash160 = ripemd160(hash)
  return bitcoinEncode(hash160, 'public')
}

// see https://github.com/joticajulian/koilib/blob/main/src/utils.ts
function decodeBase64 (bs64) {
  return multibase.decode(`M${bs64}`)
}

// see https://github.com/joticajulian/koilib/blob/main/src/utils.ts
function encodeBase64 (buffer) {
  return new TextDecoder().decode(multibase.encode('M', buffer)).slice(1)
}

// see https://github.com/joticajulian/koilib/blob/main/src/utils.ts
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

function hashSHA1 (obj) {
  const digest = crypto.createHash('sha1').update(obj).digest()

  return new Uint8Array([18, 20, ...digest])
}

function hashSHA256 (obj) {
  const digest = sha256(obj)

  return new Uint8Array([18, 32, ...digest])
}

function hashSHA512 (obj) {
  const digest = sha512(obj)

  return new Uint8Array([18, 64, ...digest])
}

function hashKeccak256 (obj) {
  const digest = keccak_256(obj)

  return new Uint8Array([18, 32, ...digest])
}

function hashRIPEMD160 (obj) {
  return new Uint8Array([18, 20, ...ripemd160(obj)])
}

function arraysAreEqual (first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index])
}

function getValueType (fieldType, message) {
  const valueType = {}

  switch (fieldType.type) {
    case 'double':
      valueType.double_value = message
      break
    case 'float':
      valueType.float_value = message
      break
    case 'int32':
      valueType.int32_value = message
      break
    case 'uint32':
      valueType.uint32_value = message
      break
    case 'sint32':
      valueType.sint32_value = message
      break
    case 'fixed32':
      valueType.fixed32_value = message
      break
    case 'sfixed32':
      valueType.sfixed32_value = message
      break
    case 'int64':
      valueType.int64_value = message
      break
    case 'uint64':
      valueType.uint64_value = message
      break
    case 'sint64':
      valueType.sint64_value = message
      break
    case 'fixed64':
      valueType.fixed64_value = message
      break
    case 'sfixed64':
      valueType.sfixed64_value = message
      break
    case 'string':
      valueType.string_value = message
      break
    case 'bool':
      valueType.bool_value = message
      break
    case 'bytes':
      valueType.bytes_value = message
      break
    default:
      // message
      valueType.message_value = fieldType.resolvedType.encode(message).finish()
      break
  }

  return valueType
}

function getNestedFieldValue (parentDescriptor, listTypeDescriptor, field, parentMessage) {
  const fieldPath = field.split('.')

  let fieldDescriptor = parentDescriptor
  let fieldType = null
  let message = parentMessage
  for (let index = 0; index < fieldPath.length; index++) {
    const segment = fieldPath[index]

    if (fieldDescriptor.fields[segment]) {
      fieldType = fieldDescriptor.fields[segment]
      message = message[segment]

      if (fieldDescriptor.fields[segment].resolvedType) {
        fieldDescriptor = fieldDescriptor.fields[segment].resolvedType
      } else {
        break
      }
    } else {
      throw new Error(`unable to find field ${segment}`)
    }
  }

  if (fieldType && message) {
    if (fieldType.repeated === true) {
      const values = []
      for (let index = 0; index < message.length; index++) {
        const element = message[index]
        values.push(getValueType(fieldType, element))
      }
      return {
        message_value: {
          value: listTypeDescriptor.encode({ values }).finish()
        }
      }
    } else {
      return getValueType(fieldType, message)
    }
  }

  return null
}

module.exports = {
  UInt8ArrayToString,
  toUint8Array,
  encodeBase58,
  decodeBase58,
  encodeBase64,
  decodeBase64,
  hashSHA1,
  hashSHA256,
  hashSHA512,
  hashKeccak256,
  hashRIPEMD160,
  bitcoinAddress,
  recoverPublicKey,
  arraysAreEqual,
  getNestedFieldValue
}
