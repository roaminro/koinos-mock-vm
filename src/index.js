/* eslint-disable camelcase */
const protobuf = require('protobufjs')
const chalk = require('chalk')
const path = require('path')
const { Database } = require('./database')
const { ExitSuccess, ExitFailure, ExitUnknown, ExecutionError } = require('./errors')
const {
  UInt8ArrayToString,
  recoverPublicKey,
  arraysAreEqual,
  getNestedFieldValue,
  encodeBase58,
  encodeBase64,
  hashSHA1,
  hashSHA256,
  hashSHA512,
  hashKeccak256,
  hashRIPEMD160
} = require('./util')
const {
  METADATA_SPACE,
  ENTRY_POINT_KEY,
  CONTRACT_ARGUMENTS_KEY,
  CONTRACT_RESULT_KEY,
  CALL_CONTRACT_RESULTS_KEY,
  CONTRACT_ID_KEY,
  HEAD_INFO_KEY,
  CALLER_KEY,
  LAST_IRREVERSIBLE_BLOCK_KEY,
  TRANSACTION_KEY,
  BLOCK_KEY,
  AUTHORITY_KEY,
  RESET_KEY,
  LOGS_KEY,
  EVENTS_KEY,
  EXIT_CODE_KEY,
  BEGIN_TRANSACTION_KEY,
  ROLLBACK_TRANSACTION_KEY,
  COMMIT_TRANSACTION_KEY
} = require('./constants')

class MockVM {
  constructor (disableLogging = false) {
    this.disableLogging = disableLogging

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

    this.callContractArgs = koinosProto.lookupType('koinos.chain.call_contract_arguments')
    this.callContractRes = koinosProto.lookupType('koinos.chain.call_contract_result')

    this.db = new Database(koinosProto)
  }

  setInstance (instance) {
    this.memory = instance.exports.memory
  }

  invokeSystemCall (sid, ret_ptr, ret_len, arg_ptr, arg_len) {
    try {
      const argsBuf = new Uint8Array(this.memory.buffer, arg_ptr, arg_len)
      const retBuf = new Uint8Array(this.memory.buffer, ret_ptr, ret_len)

      let retVal = 0
      switch (this.systemCallIDs.valuesById[sid]) {
        case 'exit_contract': {
          const { exit_code } = this.exitContractArgs.decode(argsBuf)

          switch (exit_code) {
            case 0:
              throw new ExitSuccess(`Exiting the contract with exit code ${exit_code}`, argsBuf)
            case 1:
              throw new ExitFailure(`Exiting the contract with exit code ${exit_code}`, argsBuf)
            default:
              throw new ExitUnknown('Exiting the contract with unknown exit code', argsBuf)
          }
        }
        case 'log': {
          const { message } = this.logArgs.decode(argsBuf)
          if (!this.disableLogging) {
            console.log(chalk.green('[Log]'), message)
          }

          const logsBytes = this.db.getObject(METADATA_SPACE, LOGS_KEY)

          let logs
          if (logsBytes) {
            logs = this.listType.decode(logsBytes.value)
          } else {
            logs = this.listType.create()
          }

          logs.values.push(this.valueType.create({ string_value: message }))

          this.db.putObject(METADATA_SPACE, LOGS_KEY, this.listType.encode(logs).finish())
          break
        }
        case 'event': {
          const { name, impacted, data } = this.eventArgs.decode(argsBuf)
          if (!this.disableLogging) {
            console.log(chalk.green('[Event]'), name, '/', impacted.map((acc) => encodeBase58(acc)), '/', encodeBase64(data))
          }

          const eventsBytes = this.db.getObject(METADATA_SPACE, EVENTS_KEY)

          let events
          if (eventsBytes) {
            events = this.listType.decode(eventsBytes.value)
          } else {
            events = this.listType.create()
          }

          events.values.push(this.valueType.create({ bytes_value: argsBuf }))

          this.db.putObject(METADATA_SPACE, EVENTS_KEY, this.listType.encode(events).finish())
          break
        }
        case 'set_contract_result': {
          const { value } = this.setContractResultArgs.decode(argsBuf)
          if (!this.disableLogging) {
            console.log(chalk.green('[Contract Result]'), encodeBase64(value))
          }
          this.db.putObject(METADATA_SPACE, CONTRACT_RESULT_KEY, value)
          break
        }
        case 'get_entry_point': {
          const dbObject = this.db.getObject(METADATA_SPACE, ENTRY_POINT_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(ENTRY_POINT_KEY)} is not set`)
          }

          const { int32_value } = this.valueType.decode(dbObject.value)

          const buffer = this.getEntryPointRes.encode({ value: int32_value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_last_irreversible_block': {
          const dbObject = this.db.getObject(METADATA_SPACE, LAST_IRREVERSIBLE_BLOCK_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(LAST_IRREVERSIBLE_BLOCK_KEY)} is not set`)
          }

          const { uint64_value } = this.valueType.decode(dbObject.value)

          const buffer = this.getLastIrreversibleBlock.encode({ value: uint64_value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_contract_arguments': {
          const dbObject = this.db.getObject(METADATA_SPACE, CONTRACT_ARGUMENTS_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CONTRACT_ARGUMENTS_KEY)} is not set`)
          }

          const buffer = this.getContractArgumentsRes.encode({ value: dbObject.value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_contract_id': {
          const dbObject = this.db.getObject(METADATA_SPACE, CONTRACT_ID_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CONTRACT_ID_KEY)} is not set`)
          }

          const buffer = this.getContractIdRes.encode({ value: dbObject.value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_head_info': {
          const dbObject = this.db.getObject(METADATA_SPACE, HEAD_INFO_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(HEAD_INFO_KEY)} is not set`)
          }

          const headInfo = this.headInfo.decode(dbObject.value)

          const buffer = this.getHeadInfoRes.encode({ value: headInfo }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_caller': {
          const dbObject = this.db.getObject(METADATA_SPACE, CALLER_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CALLER_KEY)} is not set`)
          }

          const callerData = this.callerData.decode(dbObject.value)

          const buffer = this.getCallerRes.encode({ value: callerData }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'require_authority': {
          const { type, account } = this.requireAuthorityArgs.decode(argsBuf)

          const dbObject = this.db.getObject(METADATA_SPACE, AUTHORITY_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(AUTHORITY_KEY)} is not set`)
          }

          const { values } = this.listType.decode(dbObject.value)

          let authorized = false

          for (let index = 0; index < values.length; index++) {
            const authority = values[index]

            if (arraysAreEqual(authority.bytes_value, account) &&
              authority.int32_value === type) {
              authorized = authority.bool_value
              break
            }
          }

          if (!authorized) {
            throw new ExecutionError(`account ${encodeBase58(account)} has not authorized action`)
          }

          break
        }
        case 'put_object': {
          const { space, key, obj } = this.putObjectArgs.decode(argsBuf)

          if (space.system === METADATA_SPACE.system &&
            space.id === METADATA_SPACE.id &&
            arraysAreEqual(key, BEGIN_TRANSACTION_KEY)) {
            this.db.beginTransaction()
          } else if (space.system === METADATA_SPACE.system &&
            space.id === METADATA_SPACE.id &&
            arraysAreEqual(key, COMMIT_TRANSACTION_KEY)) {
            this.db.commitTransaction()
          } else if (space.system === METADATA_SPACE.system &&
            space.id === METADATA_SPACE.id &&
            arraysAreEqual(key, ROLLBACK_TRANSACTION_KEY)) {
            this.db.rollbackTransaction()
          } else if (space.system === METADATA_SPACE.system &&
            space.id === METADATA_SPACE.id &&
            arraysAreEqual(key, RESET_KEY)) {
            this.db.initDb()
          } else {
            const bytesUsed = this.db.putObject(space, key, obj)

            const buffer = this.putObjectRes.encode({ value: bytesUsed }).finish()
            buffer.copy(retBuf)
            retVal = buffer.byteLength
          }

          break
        }
        case 'get_object': {
          const { space, key } = this.getObjectArgs.decode(argsBuf)

          const dbObject = this.db.getObject(space, key)

          if (dbObject) {
            const buffer = this.getObjectRes.encode({ value: dbObject }).finish()
            buffer.copy(retBuf)
            retVal = buffer.byteLength
          }
          break
        }
        case 'remove_object': {
          const { space, key } = this.removeObjectArgs.decode(argsBuf)

          this.db.removeObject(space, key)

          break
        }
        case 'get_next_object': {
          const { space, key } = this.getNextObjectArgs.decode(argsBuf)

          const dbObject = this.db.getNextObject(space, key)

          if (dbObject) {
            const buffer = this.getNextObjectRes.encode({ value: dbObject }).finish()
            buffer.copy(retBuf)
            retVal = buffer.byteLength
          }
          break
        }
        case 'get_prev_object': {
          const { space, key } = this.getPrevObjectArgs.decode(argsBuf)

          const dbObject = this.db.getPrevObject(space, key)

          if (dbObject) {
            const buffer = this.getPrevObjectRes.encode({ value: dbObject }).finish()
            buffer.copy(retBuf)
            retVal = buffer.byteLength
          }
          break
        }
        case 'hash': {
          const { code, obj } = this.hashArgs.decode(argsBuf)
          let digest = null

          const hashCode = code.toInt()

          switch (hashCode) {
            // SHA1: 0x11
            case 0x11:
              digest = hashSHA1(obj)
              break
            // SHA2_256: 0x12
            case 0x12:
              digest = hashSHA256(obj)
              break
            // SHA2_512: 0x13
            case 0x13:
              digest = hashSHA512(obj)
              break
            // Keccak_256: 0x1b
            case 0x1b:
              digest = hashKeccak256(obj)
              break
            // RIPEMD_160: 0x1053
            case 0x1053:
              digest = hashRIPEMD160(obj)
              break
            default:
              throw new ExecutionError('unknown hash code')
          }

          const buffer = this.hashRes.encode({ value: digest }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'recover_public_key': {
          const { type, signature, digest } = this.recoverPublicKeyArgs.decode(argsBuf)

          if (this.dsa.valuesById[type] !== 'ecdsa_secp256k1') {
            throw new ExecutionError('unexpected dsa')
          }

          const recoveredKey = recoverPublicKey(digest, signature)

          const buffer = this.recoverPublicKeyRes.encode({ value: recoveredKey }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'verify_signature': {
          const { public_key, type, signature, digest } = this.verifySignatureArgs.decode(argsBuf)

          if (this.dsa.valuesById[type] !== 'ecdsa_secp256k1') {
            throw new ExecutionError('unexpected dsa')
          }

          const recoveredKey = recoverPublicKey(digest, signature)

          const buffer = this.verifySignatureRes.encode({ value: arraysAreEqual(public_key, recoveredKey) }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_transaction': {
          const dbObject = this.db.getObject(METADATA_SPACE, TRANSACTION_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(TRANSACTION_KEY)} is not set`)
          }

          const transaction = this.transaction.decode(dbObject.value)

          const buffer = this.getTransactionRes.encode({ value: transaction }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_transaction_field': {
          const { field } = this.getTransactionFieldArgs.decode(argsBuf)

          const dbObject = this.db.getObject(METADATA_SPACE, TRANSACTION_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(TRANSACTION_KEY)} is not set`)
          }

          const transaction = this.transaction.decode(dbObject.value)
          const value = getNestedFieldValue(this.transaction, this.listType, field, transaction)

          const buffer = this.getTransactionFieldRes.encode({ value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_block': {
          const dbObject = this.db.getObject(METADATA_SPACE, BLOCK_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(BLOCK_KEY)} is not set`)
          }

          const block = this.block.decode(dbObject.value)

          const buffer = this.getBlockRes.encode({ value: block }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'get_block_field': {
          const { field } = this.getBlockFiledArgs.decode(argsBuf)
          const dbObject = this.db.getObject(METADATA_SPACE, BLOCK_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(BLOCK_KEY)} is not set`)
          }

          const block = this.block.decode(dbObject.value)
          const value = getNestedFieldValue(this.block, this.listType, field, block)

          const buffer = this.getBlockFiledRes.encode({ value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case 'call_contract': {
          // const { contract_id, entry_point, args } = this.callContractArgs.decode(argsBuf)
          const dbObject = this.db.getObject(METADATA_SPACE, CALL_CONTRACT_RESULTS_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CALL_CONTRACT_RESULTS_KEY)} is not set`)
          }

          const callContractResults = this.listType.decode(dbObject.value)

          const value = callContractResults.values.shift()

          this.db.putObject(METADATA_SPACE, CALL_CONTRACT_RESULTS_KEY, this.listType.encode(callContractResults).finish())

          const buffer = this.callContractRes.encode({ value: value.bytes_value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        default:
          break
      }

      return retVal
    } catch (error) {
      if (error instanceof ExitSuccess ||
        error instanceof ExitFailure) {
        if (error instanceof ExitFailure) {
          // revert database changes
          // backup logs and events
          const logsBytes = this.db.getObject(METADATA_SPACE, LOGS_KEY)
          const eventsBytes = this.db.getObject(METADATA_SPACE, EVENTS_KEY)

          let logs
          if (logsBytes) {
            logs = this.listType.decode(logsBytes.value)
          }

          let events
          if (eventsBytes) {
            events = this.listType.decode(eventsBytes.value)
          }

          this.db.rollbackTransaction()

          // restore log and events
          if (logsBytes) {
            this.db.putObject(METADATA_SPACE, LOGS_KEY, this.listType.encode(logs).finish())
          }

          if (eventsBytes) {
            this.db.putObject(METADATA_SPACE, EVENTS_KEY, this.listType.encode(events).finish())
          }
        }

        this.db.putObject(METADATA_SPACE, EXIT_CODE_KEY, error.exitArgs)
        this.db.commitTransaction()
        if (!this.disableLogging) {
          console.log(chalk.yellow('[Contract Exit]'), error.message)
        }
      } else {
        this.db.rollbackTransaction()

        if (error instanceof ExecutionError) {
          console.log(chalk.red('[Error]', error))
        } else {
          console.error(error)
        }
      }

      throw error
    }
  }

  getImports () {
    return {
      invoke_system_call: (sid, ret_ptr, ret_len, arg_ptr, arg_len) => {
        return this.invokeSystemCall(sid, ret_ptr, ret_len, arg_ptr, arg_len)
      }
    }
  }
}

module.exports = {
  MockVM
}
