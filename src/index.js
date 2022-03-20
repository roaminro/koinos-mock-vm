const protobuf = require('protobufjs')
const path = require('path')
const { Database } = require('./database')
const { hashSHA256, hashRIPEMD160, recoverPublicKey, arraysAreEqual, getNestedFieldValue, encodeBase58, hashSHA1, hashSHA512, hashKeccak256 } = require('./util')

const METADATA_SPACE = {
  system: true,
  id: 0
}

const ENTRY_POINT_KEY = new TextEncoder('utf-8').encode('entry_point')
const CONTRACT_ARGUMENTS_KEY = new TextEncoder('utf-8').encode('contract_arguments')
const CONTRACT_RESULT_KEY = new TextEncoder('utf-8').encode('contract_result')
const CONTRACT_ID_KEY = new TextEncoder('utf-8').encode('contract_id')
const HEAD_INFO_KEY = new TextEncoder('utf-8').encode('head_info')
const CALLER_KEY = new TextEncoder('utf-8').encode('caller')
const LAST_IRREVERSIBLE_BLOCK_KEY = new TextEncoder('utf-8').encode('last_irreversible_block')
const TRANSACTION_KEY = new TextEncoder('utf-8').encode('transaction')
const BLOCK_KEY = new TextEncoder('utf-8').encode('block')
const AUTHORITY_KEY = new TextEncoder('utf-8').encode('authority')
const RESET_KEY = new TextEncoder('utf-8').encode('reset')
const LOGS_KEY = new TextEncoder('utf-8').encode('logs')
const EVENTS_KEY = new TextEncoder('utf-8').encode('events')
const EXIT_CODE_KEY = new TextEncoder('utf-8').encode('exit_code')
const BEGIN_TRANSACTION_KEY = new TextEncoder('utf-8').encode('begin_transaction')
const ROLLBACK_TRANSACTION_KEY = new TextEncoder('utf-8').encode('rollback_transaction')
const COMMIT_TRANSACTION_KEY = new TextEncoder('utf-8').encode('commit_transaction')

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
      'koinos/chain/value.proto',
      'koinos/protocol/protocol.proto'
    ], { keepCase: true })

    this.any = koinosProto.lookupType('google.protobuf.Any')
    this.valueType = koinosProto.lookupType('koinos.chain.value_type')
    this.listType = koinosProto.lookupType('koinos.chain.list_type')
    this.headInfo = koinosProto.lookupType('koinos.chain.head_info')
    this.callerData = koinosProto.lookupType('koinos.chain.caller_data')
    this.systemCallIDs = koinosProto.lookupEnum('koinos.chain.system_call_id')
    this.dsa = koinosProto.lookupEnum('koinos.chain.dsa')
    this.transaction = koinosProto.lookupType('koinos.protocol.transaction')
    this.block = koinosProto.lookupType('koinos.protocol.block')

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

    this.getTransactionRes = koinosProto.lookupType('koinos.chain.get_transaction_result')

    this.getTransactionFieldArgs = koinosProto.lookupType('koinos.chain.get_transaction_field_arguments')
    this.getTransactionFieldRes = koinosProto.lookupType('koinos.chain.get_transaction_field_result')

    this.getBlockRes = koinosProto.lookupType('koinos.chain.get_block_result')

    this.getBlockFiledArgs = koinosProto.lookupType('koinos.chain.get_block_field_arguments')
    this.getBlockFiledRes = koinosProto.lookupType('koinos.chain.get_block_field_result')

    this.eventArgs = koinosProto.lookupType('koinos.chain.event_arguments')

    this.setContractResultArgs = koinosProto.lookupType('koinos.chain.set_contract_result_arguments')

    this.exitContractArgs = koinosProto.lookupType('koinos.chain.exit_contract_arguments')

    this.db = new Database(koinosProto)
  }

  setInstance (_instance) {
    this.memory = _instance.exports.memory
  }

  // eslint-disable-next-line camelcase
  invokeSystemCall (sid, ret_ptr, ret_len, arg_ptr, arg_len) {
    try {
      const argsBuf = new Uint8Array(this.memory.buffer, arg_ptr, arg_len)
      const retBuf = new Uint8Array(this.memory.buffer, ret_ptr, ret_len)

      let retVal = 0
      switch (this.systemCallIDs.valuesById[sid]) {
        case 'exit_contract': {
          const args = this.exitContractArgs.decode(argsBuf)

          const dbArgs = {
            space: METADATA_SPACE,
            key: EXIT_CODE_KEY
          }

          if (args.exit_code === 0) {
            this.db.commitTransaction()
          } else {
            this.db.rollbackTransaction()
          }

          this.db.putObject(dbArgs.space, dbArgs.key, argsBuf)

          throw new Error(`Exiting the contract with exit code ${args.exit_code}`)
        }
        case 'log': {
          const args = this.logArgs.decode(argsBuf)
          console.log('Log:', args.message)

          const dbArgs = {
            space: METADATA_SPACE,
            key: LOGS_KEY
          }
          const logsBytes = this.db.getObject(dbArgs.space, dbArgs.key)

          let logs
          if (logsBytes) {
            logs = this.listType.decode(logsBytes.value)
          } else {
            logs = this.listType.create()
          }

          logs.values.push(this.valueType.create({ string_value: args.message }))

          this.db.putObject(dbArgs.space, dbArgs.key, this.listType.encode(logs).finish())
          break
        }
        case 'event': {
          const args = this.eventArgs.decode(argsBuf)
          console.log('Event:', args.name, '/', args.impacted.map((acc) => encodeBase58(acc)), '/', args.data.toString())

          const dbArgs = {
            space: METADATA_SPACE,
            key: EVENTS_KEY
          }
          const eventsBytes = this.db.getObject(dbArgs.space, dbArgs.key)

          let events
          if (eventsBytes) {
            events = this.listType.decode(eventsBytes.value)
          } else {
            events = this.listType.create()
          }

          events.values.push(this.valueType.create({ bytes_value: argsBuf }))

          this.db.putObject(dbArgs.space, dbArgs.key, this.listType.encode(events).finish())
          break
        }
        case 'set_contract_result': {
          const args = this.setContractResultArgs.decode(argsBuf)

          const dbArgs = {
            space: METADATA_SPACE,
            key: CONTRACT_RESULT_KEY
          }

          this.db.putObject(dbArgs.space, dbArgs.key, args.value)
          break
        }
        case 'get_entry_point': {
          const args = {
            space: METADATA_SPACE,
            key: ENTRY_POINT_KEY
          }
          const dbObject = this.db.getObject(args.space, args.key)

          if (!dbObject) {
            throw new Error(`${new TextDecoder().decode(ENTRY_POINT_KEY)} is not set`)
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
            throw new Error(`${new TextDecoder().decode(LAST_IRREVERSIBLE_BLOCK_KEY)} is not set`)
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
            throw new Error(`${new TextDecoder().decode(CONTRACT_ARGUMENTS_KEY)} is not set`)
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
            throw new Error(`${new TextDecoder().decode(CONTRACT_ID_KEY)} is not set`)
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
            throw new Error(`${new TextDecoder().decode(HEAD_INFO_KEY)} is not set`)
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
            throw new Error(`${new TextDecoder().decode(CALLER_KEY)} is not set`)
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
            key: AUTHORITY_KEY
          }

          const dbObject = this.db.getObject(dbARgs.space, dbARgs.key)

          if (!dbObject) {
            throw new Error('not authorized')
          }

          const authorities = this.listType.decode(dbObject.value)

          let authorized = false

          for (let index = 0; index < authorities.values.length; index++) {
            const authority = authorities.values[index]

            if (arraysAreEqual(authority.bytes_value, args.account) &&
              authority.int32_value === args.type) {
              authorized = authority.bool_value
              break
            }
          }

          if (!authorized) {
            throw new Error('not authorized')
          }

          break
        }
        case 'put_object': {
          const args = this.putObjectArgs.decode(argsBuf)

          if (args.space.system === METADATA_SPACE.system &&
            args.space.id === METADATA_SPACE.id &&
            arraysAreEqual(args.key, BEGIN_TRANSACTION_KEY)) {
            this.db.beginTransaction()
          } else if (args.space.system === METADATA_SPACE.system &&
            args.space.id === METADATA_SPACE.id &&
            arraysAreEqual(args.key, COMMIT_TRANSACTION_KEY)) {
            this.db.commitTransaction()
          } else if (args.space.system === METADATA_SPACE.system &&
            args.space.id === METADATA_SPACE.id &&
            arraysAreEqual(args.key, ROLLBACK_TRANSACTION_KEY)) {
            this.db.rollbackTransaction()
          } else if (args.space.system === METADATA_SPACE.system &&
            args.space.id === METADATA_SPACE.id &&
            arraysAreEqual(args.key, RESET_KEY)) {
            this.db.initDb()
          } else {
            const bytesUsed = this.db.putObject(args.space, args.key, args.obj)

            const buffer = this.putObjectRes.encode({ value: bytesUsed }).finish()
            buffer.copy(retBuf)
            retVal = buffer.byteLength
          }

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

          const hashCode = args.code.toInt()

          switch (hashCode) {
            // SHA1: 0x11
            case 0x11:
              digest = hashSHA1(args.obj)
              break
            // SHA2_256: 0x12
            case 0x12:
              digest = hashSHA256(args.obj)
              break
            // SHA2_512: 0x13
            case 0x13:
              digest = hashSHA512(args.obj)
              break
            // Keccak_256: 0x1b
            case 0x1b:
              digest = hashKeccak256(args.obj)
              break
            // RIPEMD_160: 0x1053
            case 0x1053:
              digest = hashRIPEMD160(args.obj)
              break
            default:
              throw new Error('unknown hash code')
          }

          const buffer = this.hashRes.encode({ value: digest }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'recover_public_key': {
          const args = this.recoverPublicKeyArgs.decode(argsBuf)

          if (this.dsa.valuesById[args.type] !== 'ecdsa_secp256k1') {
            throw new Error('unexpected dsa')
          }

          const recoveredKey = recoverPublicKey(args.digest, args.signature)

          const buffer = this.recoverPublicKeyRes.encode({ value: recoveredKey }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'verify_signature': {
          const args = this.verifySignatureArgs.decode(argsBuf)

          if (this.dsa.valuesById[args.type] !== 'ecdsa_secp256k1') {
            throw new Error('unexpected dsa')
          }

          const recoveredKey = recoverPublicKey(args.digest, args.signature)

          const buffer = this.verifySignatureRes.encode({ value: arraysAreEqual(args.public_key, recoveredKey) }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_transaction': {
          const args = {
            space: METADATA_SPACE,
            key: TRANSACTION_KEY
          }
          const dbObject = this.db.getObject(args.space, args.key)

          if (!dbObject) {
            throw new Error(`${new TextDecoder().decode(TRANSACTION_KEY)} is not set`)
          }

          const transaction = this.transaction.decode(dbObject.value)

          const buffer = this.getTransactionRes.encode({ value: transaction }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_transaction_field': {
          const { field } = this.getTransactionFieldArgs.decode(argsBuf)

          const dbArgs = {
            space: METADATA_SPACE,
            key: TRANSACTION_KEY
          }
          const dbObject = this.db.getObject(dbArgs.space, dbArgs.key)

          if (!dbObject) {
            throw new Error(`${new TextDecoder().decode(TRANSACTION_KEY)} is not set`)
          }

          const transaction = this.transaction.decode(dbObject.value)
          const value = getNestedFieldValue(this.transaction, this.listType, field, transaction)

          const buffer = this.getTransactionFieldRes.encode({ value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_block': {
          const args = {
            space: METADATA_SPACE,
            key: BLOCK_KEY
          }
          const dbObject = this.db.getObject(args.space, args.key)

          if (!dbObject) {
            throw new Error(`${new TextDecoder().decode(BLOCK_KEY)} is not set`)
          }

          const block = this.block.decode(dbObject.value)

          const buffer = this.getBlockRes.encode({ value: block }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_block_field': {
          const { field } = this.getBlockFiledArgs.decode(argsBuf)

          const dbArgs = {
            space: METADATA_SPACE,
            key: BLOCK_KEY
          }
          const dbObject = this.db.getObject(dbArgs.space, dbArgs.key)

          if (!dbObject) {
            throw new Error(`${new TextDecoder().decode(BLOCK_KEY)} is not set`)
          }

          const block = this.block.decode(dbObject.value)
          const value = getNestedFieldValue(this.block, this.listType, field, block)

          const buffer = this.getBlockFiledRes.encode({ value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        default:
          break
      }

      return retVal
    } catch (error) {
      if (error.message.includes('Exiting the contract with exit code')) {
        console.log(error.message)
      } else {
        console.error(error)
      }
      throw error
    }
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
