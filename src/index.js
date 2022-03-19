const protobuf = require('protobufjs')
const path = require('path')
const { Database } = require('./database')
const { encodeBase58, hashSHA256, hashRIPEMD160, recoverPublicKey, arraysAreEqual } = require('./util')

const METADATA_SPACE = {
  system: true,
  id: 0
}

const ENTRY_POINT_KEY = new TextEncoder('utf-8').encode('entry_point')
const CONTRACT_ARGUMENTS_KEY = new TextEncoder('utf-8').encode('contract_arguments')
const CONTRACT_ID_KEY = new TextEncoder('utf-8').encode('contract_id')
const HEAD_INFO_KEY = new TextEncoder('utf-8').encode('head_info')
const CALLER_KEY = new TextEncoder('utf-8').encode('caller')
const LAST_IRREVERSIBLE_BLOCK_KEY = new TextEncoder('utf-8').encode('last_irreversible_block')

const AUTHORITY_KEY_PREFIX = 'authority_'

class MockVM {
  init () {
    const koinosProto = new protobuf.Root()
    koinosProto.resolvePath = (origin, target) => {
      if (target === 'google/protobuf/descriptor.proto') {
        return path.join(__dirname, '/google/protobuf/descriptor.proto')
      }

      if (target === 'google/protobuf/any.proto') {
        return path.join(__dirname, '/google/protobuf/any.proto')
      }

      return path.join(__dirname, '/koinos-proto/', target)
    }

    koinosProto.loadSync([
      'koinos/chain/chain.proto',
      'koinos/chain/system_calls.proto',
      'koinos/chain/system_call_ids.proto',
      'koinos/chain/value.proto'
    ], { keepCase: true })

    this.valueType = koinosProto.lookupType('koinos.chain.value_type')
    this.headInfo = koinosProto.lookupType('koinos.chain.head_info')
    this.callerData = koinosProto.lookupType('koinos.chain.caller_data')
    this.systemCallIDs = koinosProto.lookupEnum('koinos.chain.system_call_id')

    this.logArgs = koinosProto.lookupType('koinos.chain.log_arguments')

    this.getEntryPointRes = koinosProto.lookupType('koinos.chain.get_entry_point_result')
    this.getLastIrreversibleBlock = koinosProto.lookupType('koinos.chain.get_last_irreversible_block_result')
    this.getContractArgumentsRes = koinosProto.lookupType('koinos.chain.get_contract_arguments_result')
    this.getContractIdRes = koinosProto.lookupType('koinos.chain.get_contract_id_result')
    this.getHeadInfoRes = koinosProto.lookupType('koinos.chain.get_head_info_result')
    this.getCallerRes = koinosProto.lookupType('koinos.chain.get_caller_result')
    this.requireAuthorityArgs = koinosProto.lookupType('koinos.chain.require_authority_arguments')

    this.putObjectArgs = koinosProto.lookupType('koinos.chain.put_object_arguments')
    this.putObjectRes = koinosProto.lookupType('koinos.chain.put_object_result')

    this.getObjectArgs = koinosProto.lookupType('koinos.chain.get_object_arguments')
    this.getObjectRes = koinosProto.lookupType('koinos.chain.get_object_result')

    this.removeObjectArgs = koinosProto.lookupType('koinos.chain.remove_object_arguments')

    this.getNextObjectArgs = koinosProto.lookupType('koinos.chain.get_next_object_arguments')
    this.getNextObjectRes = koinosProto.lookupType('koinos.chain.get_next_object_result')

    this.getPrevObjectArgs = koinosProto.lookupType('koinos.chain.get_prev_object_arguments')
    this.getPrevObjectRes = koinosProto.lookupType('koinos.chain.get_prev_object_result')

    this.hashArgs = koinosProto.lookupType('koinos.chain.hash_arguments')
    this.hashRes = koinosProto.lookupType('koinos.chain.hash_result')

    this.recoverPublicKeyArgs = koinosProto.lookupType('koinos.chain.recover_public_key_arguments')
    this.recoverPublicKeyRes = koinosProto.lookupType('koinos.chain.recover_public_key_result')

    this.verifySignatureArgs = koinosProto.lookupType('koinos.chain.verify_signature_arguments')
    this.verifySignatureRes = koinosProto.lookupType('koinos.chain.verify_signature_result')

    this.db = new Database(koinosProto)
  }

  setInstance (_instance) {
    this.memory = _instance.exports.memory
  }

  // eslint-disable-next-line camelcase
  invokeSystemCall (sid, ret_ptr, ret_len, arg_ptr, arg_len) {
    const argsBuf = new Uint8Array(this.memory.buffer, arg_ptr, arg_len)
    const retBuf = new Uint8Array(this.memory.buffer, ret_ptr, ret_len)

    let retVal = 0
    switch (this.systemCallIDs.valuesById[sid]) {
      case 'log': {
        const args = this.logArgs.decode(argsBuf)
        console.log('System.log:', args.message)
        break
      }
      case 'get_entry_point': {
        const args = {
          space: METADATA_SPACE,
          key: ENTRY_POINT_KEY
        }
        const dbObject = this.db.getObject(args.space, args.key)

        if (!dbObject) {
          throw new Error(`${ENTRY_POINT_KEY} is not set`)
        }

        const entryPointObj = this.valueType.decode(dbObject.value)

        const buffer = this.getEntryPointRes.encode({ value: entryPointObj.int32_value }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      case 'get_last_irreversible_block': {
        const args = {
          space: METADATA_SPACE,
          key: LAST_IRREVERSIBLE_BLOCK_KEY
        }
        const dbObject = this.db.getObject(args.space, args.key)

        if (!dbObject) {
          throw new Error(`${LAST_IRREVERSIBLE_BLOCK_KEY} is not set`)
        }

        const lastIrreversibleBlockObj = this.valueType.decode(dbObject.value)

        const buffer = this.getLastIrreversibleBlock.encode({ value: lastIrreversibleBlockObj.uint64_value }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      case 'get_contract_arguments': {
        const args = {
          space: METADATA_SPACE,
          key: CONTRACT_ARGUMENTS_KEY
        }
        const dbObject = this.db.getObject(args.space, args.key)

        if (!dbObject) {
          throw new Error(`${CONTRACT_ARGUMENTS_KEY} is not set`)
        }

        const buffer = this.getContractArgumentsRes.encode({ value: dbObject.value }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      case 'get_contract_id': {
        const args = {
          space: METADATA_SPACE,
          key: CONTRACT_ID_KEY
        }
        const dbObject = this.db.getObject(args.space, args.key)

        if (!dbObject) {
          throw new Error(`${CONTRACT_ID_KEY} is not set`)
        }

        const buffer = this.getContractIdRes.encode({ value: dbObject.value }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      case 'get_head_info': {
        const args = {
          space: METADATA_SPACE,
          key: HEAD_INFO_KEY
        }
        const dbObject = this.db.getObject(args.space, args.key)

        if (!dbObject) {
          throw new Error(`${HEAD_INFO_KEY} is not set`)
        }

        const headInfo = this.headInfo.decode(dbObject.value)

        const buffer = this.getHeadInfoRes.encode({ value: headInfo }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      case 'get_caller': {
        const args = {
          space: METADATA_SPACE,
          key: CALLER_KEY
        }
        const dbObject = this.db.getObject(args.space, args.key)

        if (!dbObject) {
          throw new Error(`${CALLER_KEY} is not set`)
        }

        const callerData = this.callerData.decode(dbObject.value)

        const buffer = this.getCallerRes.encode({ value: callerData }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      case 'require_authority': {
        const args = this.requireAuthorityArgs.decode(argsBuf)

        const dbARgs = {
          space: METADATA_SPACE,
          key: new TextEncoder('utf-8').encode(`${AUTHORITY_KEY_PREFIX}${encodeBase58(args.account)}_${args.type}`)
        }

        const dbObject = this.db.getObject(dbARgs.space, dbARgs.key)

        if (!dbObject) {
          throw new Error('not authorized')
        }

        const authority = this.valueType.decode(dbObject.value)

        if (!authority.bool_value) {
          throw new Error('not authorized')
        }

        break
      }
      case 'put_object': {
        const args = this.putObjectArgs.decode(argsBuf)

        const bytesUsed = this.db.putObject(args.space, args.key, args.obj)

        const buffer = this.putObjectRes.encode({ value: bytesUsed }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      case 'get_object': {
        const args = this.getObjectArgs.decode(argsBuf)

        const dbObject = this.db.getObject(args.space, args.key)

        if (dbObject) {
          const buffer = this.getObjectRes.encode({ value: dbObject }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
        }
        break
      }
      case 'remove_object': {
        const args = this.removeObjectArgs.decode(argsBuf)

        this.db.removeObject(args.space, args.key)
        break
      }
      case 'get_next_object': {
        const args = this.getNextObjectArgs.decode(argsBuf)

        const dbObject = this.db.getNextObject(args.space, args.key)
        if (dbObject) {
          const buffer = this.getNextObjectRes.encode({ value: dbObject }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
        }
        break
      }
      case 'get_prev_object': {
        const args = this.getPrevObjectArgs.decode(argsBuf)

        const dbObject = this.db.getPrevObject(args.space, args.key)
        if (dbObject) {
          const buffer = this.getPrevObjectRes.encode({ value: dbObject }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
        }
        break
      }
      case 'hash': {
        const args = this.hashArgs.decode(argsBuf)
        let digest = null

        // SHA2_256
        if (args.code.toInt() === 0x12) {
          digest = hashSHA256(args.obj)
        } else if (args.code.toInt() === 0x1053) {
          // RIPEMD_160
          digest = hashRIPEMD160(args.obj)
        } else {
          throw new Error('hash method not supported')
        }

        const buffer = this.hashRes.encode({ value: digest }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      case 'recover_public_key': {
        const args = this.recoverPublicKeyArgs.decode(argsBuf)

        const recoveredKey = recoverPublicKey(args.digest, args.signature)

        const buffer = this.recoverPublicKeyRes.encode({ value: recoveredKey }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      case 'verify_signature': {
        const args = this.verifySignatureArgs.decode(argsBuf)

        const recoveredKey = recoverPublicKey(args.digest, args.signature)

        const buffer = this.verifySignatureRes.encode({ value: arraysAreEqual(args.public_key, recoveredKey) }).finish()
        buffer.copy(retBuf)
        retVal = buffer.byteLength
        break
      }
      default:
        break
    }

    return retVal
  }

  getImports () {
    return {
      // eslint-disable-next-line camelcase
      invoke_system_call: (sid, ret_ptr, ret_len, arg_ptr, arg_len) => {
        return this.invokeSystemCall(sid, ret_ptr, ret_len, arg_ptr, arg_len)
      }
    }
  }
}

module.exports = {
  MockVM
}
