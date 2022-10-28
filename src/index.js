/* eslint-disable camelcase */
const protobuf = require('protobufjs')
const chalk = require('chalk')
const { Database } = require('./database')
const { KoinosError, ExecutionError } = require('./errors')
const {
  UInt8ArrayToString,
  StringToUInt8Array,
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
  SYSTEM_AUTHORITY_KEY,
  RESET_KEY,
  LOGS_KEY,
  EVENTS_KEY,
  ROLLBACK_TRANSACTION_KEY,
  COMMIT_TRANSACTION_KEY,
  CHAIN_ID_KEY,
  EXIT_CODE_KEY,
  ERROR_MESSAGE_KEY,
  VERIFY_VRF_KEY,
  OPERATION_KEY
} = require('./constants')

const { koinos } = require('@koinos/proto-js')
const koinosJson = require('@koinos/proto-js/index.json')

class MockVM {
  constructor (disableLogging = false) {
    this.disableLogging = disableLogging

    const koinosProto = protobuf.Root.fromJSON(koinosJson)

    this.listTypeProto = koinosProto.lookupType('koinos.chain.list_type')
    this.blockProto = koinosProto.lookupType('koinos.protocol.block')
    // force protobufjs to resolve all the types
    this.blockProto.encode({})
    this.transactionProto = koinosProto.lookupType('koinos.protocol.transaction')
    // force protobufjs to resolve all the types
    this.transactionProto.encode({})

    this.db = new Database()
  }

  setInstance (instance) {
    this.memory = instance.exports.memory
  }

  invokeSystemCall (sid, ret_ptr, ret_len, arg_ptr, arg_len, ret_bytes) {
    const retBytesBuffer = new Uint32Array(this.memory.buffer, ret_bytes, 1)
    const retBuf = new Uint8Array(this.memory.buffer, ret_ptr, ret_len)
    let retBytes = 0
    let retVal = 0

    try {
      const argsBuf = new Uint8Array(this.memory.buffer, arg_ptr, arg_len)

      switch (sid) {
        /// ///////////////////////////////////////////////
        // General Blockchain Management                //
        /// ///////////////////////////////////////////////
        case koinos.chain.system_call_id.get_head_info: {
          const dbObject = this.db.getObject(METADATA_SPACE, HEAD_INFO_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(HEAD_INFO_KEY)} is not set`)
          }

          const headInfo = koinos.chain.head_info.decode(dbObject.value)

          const buffer = koinos.chain.get_head_info_result.encode({ value: headInfo }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }

        case koinos.chain.system_call_id.get_chain_id: {
          const dbObject = this.db.getObject(METADATA_SPACE, CHAIN_ID_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CHAIN_ID_KEY)} is not set`)
          }

          const buffer = koinos.chain.get_chain_id_result.encode({ value: dbObject.value }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }

        /// ///////////////////////////////////////////////
        // System Helpers                               //
        /// ///////////////////////////////////////////////
        case koinos.chain.system_call_id.get_transaction: {
          const dbObject = this.db.getObject(METADATA_SPACE, TRANSACTION_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(TRANSACTION_KEY)} is not set`)
          }

          const transaction = koinos.protocol.transaction.decode(dbObject.value)

          const buffer = koinos.chain.get_transaction_result.encode({ value: transaction }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_transaction_field: {
          const { field } = koinos.chain.get_transaction_field_arguments.decode(argsBuf)

          const dbObject = this.db.getObject(METADATA_SPACE, TRANSACTION_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(TRANSACTION_KEY)} is not set`)
          }

          const transaction = koinos.protocol.transaction.decode(dbObject.value)
          const value = getNestedFieldValue(this.transactionProto, this.listTypeProto, field, transaction)

          const buffer = koinos.chain.get_transaction_field_result.encode({ value }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_operation: {
          const dbObject = this.db.getObject(METADATA_SPACE, OPERATION_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(OPERATION_KEY)} is not set`)
          }

          const operation = koinos.protocol.operation.decode(dbObject.value)

          const buffer = koinos.chain.get_operation_result.encode({ value: operation }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_block: {
          const dbObject = this.db.getObject(METADATA_SPACE, BLOCK_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(BLOCK_KEY)} is not set`)
          }

          const block = koinos.protocol.block.decode(dbObject.value)

          const buffer = koinos.chain.get_block_result.encode({ value: block }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_block_field: {
          const { field } = koinos.chain.get_block_field_arguments.decode(argsBuf)
          const dbObject = this.db.getObject(METADATA_SPACE, BLOCK_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(BLOCK_KEY)} is not set`)
          }

          const block = koinos.protocol.block.decode(dbObject.value)

          const value = getNestedFieldValue(this.blockProto, this.listTypeProto, field, block)

          const buffer = koinos.chain.get_block_field_result.encode({ value }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_last_irreversible_block: {
          const dbObject = this.db.getObject(METADATA_SPACE, LAST_IRREVERSIBLE_BLOCK_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(LAST_IRREVERSIBLE_BLOCK_KEY)} is not set`)
          }

          const { uint64_value } = koinos.chain.value_type.decode(dbObject.value)

          const buffer = koinos.chain.get_last_irreversible_block_result.encode({ value: uint64_value }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }

        /// ///////////////////////////////////////////////
        // Resource Subsystem                           //
        /// ///////////////////////////////////////////////

        /// ///////////////////////////////////////////////
        // Database                                     //
        /// ///////////////////////////////////////////////
        case koinos.chain.system_call_id.put_object: {
          const { space, key, obj } = koinos.chain.put_object_arguments.decode(argsBuf)

          if (space.system === METADATA_SPACE.system &&
            (space.id === METADATA_SPACE.id || space.id === null) &&
            arraysAreEqual(key, COMMIT_TRANSACTION_KEY)) {
            this.db.commitTransaction()
          } else if (space.system === METADATA_SPACE.system &&
            (space.id === METADATA_SPACE.id || space.id === null) &&
            arraysAreEqual(key, ROLLBACK_TRANSACTION_KEY)) {
            this.db.rollbackTransaction()
          } else if (space.system === METADATA_SPACE.system &&
            (space.id === METADATA_SPACE.id || space.id === null) &&
            arraysAreEqual(key, RESET_KEY)) {
            this.db.initDb()
          } else {
            this.db.putObject(space, key, obj)
          }

          break
        }
        case koinos.chain.system_call_id.get_object: {
          const { space, key } = koinos.chain.get_object_arguments.decode(argsBuf)

          const dbObject = this.db.getObject(space, key)

          if (dbObject) {
            const buffer = koinos.chain.get_object_result.encode({ value: dbObject }).finish()
            buffer.copy(retBuf)
            retBytes = buffer.byteLength
          }
          break
        }
        case koinos.chain.system_call_id.remove_object: {
          const { space, key } = koinos.chain.remove_object_arguments.decode(argsBuf)

          this.db.removeObject(space, key)

          break
        }
        case koinos.chain.system_call_id.get_next_object: {
          const { space, key } = koinos.chain.get_next_object_arguments.decode(argsBuf)

          const dbObject = this.db.getNextObject(space, key)

          if (dbObject) {
            const buffer = koinos.chain.get_next_object_result.encode({ value: dbObject }).finish()
            buffer.copy(retBuf)
            retBytes = buffer.byteLength
          }
          break
        }
        case koinos.chain.system_call_id.get_prev_object: {
          const { space, key } = koinos.chain.get_prev_object_arguments.decode(argsBuf)

          const dbObject = this.db.getPrevObject(space, key)

          if (dbObject) {
            const buffer = koinos.chain.get_prev_object_result.encode({ value: dbObject }).finish()
            buffer.copy(retBuf)
            retBytes = buffer.byteLength
          }
          break
        }

        /// ///////////////////////////////////////////////
        // Logging                                      //
        /// ///////////////////////////////////////////////
        case koinos.chain.system_call_id.log: {
          const { message } = koinos.chain.log_arguments.decode(argsBuf)
          if (!this.disableLogging) {
            console.log(chalk.green('[Log]'), message)
          }

          const logsBytes = this.db.getObject(METADATA_SPACE, LOGS_KEY)

          let logs
          if (logsBytes) {
            logs = koinos.chain.list_type.decode(logsBytes.value)
          } else {
            logs = koinos.chain.list_type.create()
          }

          logs.values.push(koinos.chain.value_type.create({ string_value: message }))

          this.db.putObject(METADATA_SPACE, LOGS_KEY, koinos.chain.list_type.encode(logs).finish())
          break
        }
        case koinos.chain.system_call_id.event: {
          const { name, impacted, data } = koinos.chain.event_arguments.decode(argsBuf)
          if (!this.disableLogging) {
            console.log(chalk.green('[Event]'), name, '/', impacted.map((acc) => encodeBase58(acc)), '/', encodeBase64(data))
          }

          const eventsBytes = this.db.getObject(METADATA_SPACE, EVENTS_KEY)

          let events
          if (eventsBytes) {
            events = koinos.chain.list_type.decode(eventsBytes.value)
          } else {
            events = koinos.chain.list_type.create()
          }

          events.values.push(koinos.chain.value_type.create({ bytes_value: argsBuf }))

          this.db.putObject(METADATA_SPACE, EVENTS_KEY, koinos.chain.list_type.encode(events).finish())
          break
        }

        /// ///////////////////////////////////////////////
        // Cryptography                                 //
        /// ///////////////////////////////////////////////

        case koinos.chain.system_call_id.hash: {
          const { code, obj } = koinos.chain.hash_arguments.decode(argsBuf)
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
              throw new KoinosError('unknown hash code', koinos.chain.error_code.unknown_hash_code)
          }

          const buffer = koinos.chain.hash_result.encode({ value: digest }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.recover_public_key: {
          const { type, signature, digest } = koinos.chain.recover_public_key_arguments.decode(argsBuf)

          if (type !== koinos.chain.dsa.ecdsa_secp256k1) {
            throw new KoinosError('unexpected dsa', koinos.chain.error_code.unknown_dsa)
          }

          let recoveredKey
          try {
            recoveredKey = recoverPublicKey(digest, signature)
          } catch (error) {
            throw new KoinosError(error.message, koinos.chain.error_code.reversion)
          }

          const buffer = koinos.chain.recover_public_key_result.encode({ value: recoveredKey }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.verify_signature: {
          const { public_key, type, signature, digest } = koinos.chain.verify_signature_arguments.decode(argsBuf)

          if (type !== koinos.chain.dsa.ecdsa_secp256k1) {
            throw new KoinosError('unexpected dsa', koinos.chain.error_code.unknown_dsa)
          }

          let recoveredKey
          try {
            recoveredKey = recoverPublicKey(digest, signature)
          } catch (error) {
            throw new KoinosError(error.message, koinos.chain.error_code.reversion)
          }

          const buffer = koinos.chain.verify_signature_result.encode({ value: arraysAreEqual(public_key, recoveredKey) }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }

        case koinos.chain.system_call_id.verify_vrf_proof: {
          koinos.chain.verify_vrf_proof_arguments.decode(argsBuf)
          const dbObject = this.db.getObject(METADATA_SPACE, VERIFY_VRF_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(VERIFY_VRF_KEY)} is not set`)
          }

          const verifyVrfResults = koinos.chain.list_type.decode(dbObject.value)

          const value = verifyVrfResults.values.shift()

          if (!value) {
            throw new ExecutionError('You did not set a result for verify_vrf_proof')
          }

          this.db.putObject(METADATA_SPACE, VERIFY_VRF_KEY, koinos.chain.list_type.encode(verifyVrfResults).finish())

          const buffer = koinos.chain.verify_vrf_proof_result.encode({ value: value.bool_value }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }

        /// ///////////////////////////////////////////////
        // Contract Management                          //
        /// ///////////////////////////////////////////////

        case koinos.chain.system_call_id.call: {
          const { contract_id, entry_point, args } = koinos.chain.call_arguments.decode(argsBuf)
          const dbObject = this.db.getObject(METADATA_SPACE, CALL_CONTRACT_RESULTS_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CALL_CONTRACT_RESULTS_KEY)} is not set`)
          }

          const callContractResults = koinos.chain.list_type.decode(dbObject.value)

          const value = callContractResults.values.shift()

          if (!value) {
            throw new ExecutionError(`You did not set a call contract result for the call: contract ${encodeBase58(contract_id)} / entry point: ${entry_point} / args: ${encodeBase64(args)}`)
          }

          this.db.putObject(METADATA_SPACE, CALL_CONTRACT_RESULTS_KEY, koinos.chain.list_type.encode(callContractResults).finish())

          const result = koinos.chain.exit_arguments.decode(value.bytes_value)

          if (result.code !== 0) {
            throw new KoinosError(result.res.error.message, result.code)
          }

          const buffer = koinos.chain.call_result.encode({ value: result.res.object }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }

        case koinos.chain.system_call_id.exit: {
          const exit_args = koinos.chain.exit_arguments.decode(argsBuf)

          if (exit_args.code === 0) {
            if (exit_args.res && exit_args.res.object) {
              if (!this.disableLogging) {
                console.log(chalk.green('[Contract Result]'), encodeBase64(exit_args.res.object))
              }

              this.db.putObject(METADATA_SPACE, CONTRACT_RESULT_KEY, exit_args.res.object)
            }

            throw new KoinosError('', koinos.chain.error_code.success)
          }

          if (exit_args.res && exit_args.res.error && exit_args.res.error.message) {
            throw new KoinosError(exit_args.res.error.message, exit_args.code)
          }

          throw new KoinosError('', exit_args.code)
        }

        case koinos.chain.system_call_id.get_arguments: {
          let dbObject = this.db.getObject(METADATA_SPACE, CONTRACT_ARGUMENTS_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CONTRACT_ARGUMENTS_KEY)} is not set`)
          }

          const args = dbObject.value

          dbObject = this.db.getObject(METADATA_SPACE, ENTRY_POINT_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(ENTRY_POINT_KEY)} is not set`)
          }

          const { int32_value } = koinos.chain.value_type.decode(dbObject.value)

          const buffer = koinos.chain.get_arguments_result.encode({ value: { entry_point: int32_value, arguments: args } }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }

        case koinos.chain.system_call_id.get_contract_id: {
          const dbObject = this.db.getObject(METADATA_SPACE, CONTRACT_ID_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CONTRACT_ID_KEY)} is not set`)
          }

          const buffer = koinos.chain.get_contract_id_result.encode({ value: dbObject.value }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }

        case koinos.chain.system_call_id.get_caller: {
          const dbObject = this.db.getObject(METADATA_SPACE, CALLER_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CALLER_KEY)} is not set`)
          }

          const callerData = koinos.chain.caller_data.decode(dbObject.value)

          const buffer = koinos.chain.get_caller_result.encode({ value: callerData }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.check_authority: {
          const { type, account } = koinos.chain.check_authority_arguments.decode(argsBuf)

          const dbObject = this.db.getObject(METADATA_SPACE, AUTHORITY_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(AUTHORITY_KEY)} is not set`)
          }

          const { values } = koinos.chain.list_type.decode(dbObject.value)

          let authorized = false

          for (let index = 0; index < values.length; index++) {
            const authority = values[index]

            if (arraysAreEqual(authority.bytes_value, account) &&
              (authority.int32_value === type || (type === 0 && authority.int32_value === null))) {
              authorized = authority.bool_value
              break
            }
          }

          const buffer = koinos.chain.check_authority_result.encode({ value: authorized }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.check_system_authority: {
          const dbObject = this.db.getObject(METADATA_SPACE, SYSTEM_AUTHORITY_KEY)

          let authorized = false

          if (dbObject) {
            authorized = koinos.chain.value_type.decode(dbObject.value).bool_value
          }

          const buffer = koinos.chain.check_system_authority_result.encode({ value: authorized }).finish()
          buffer.copy(retBuf)
          retBytes = buffer.byteLength
          break
        }

        default:
          throw new KoinosError(`thunk ${sid} is not implemented`, koinos.chain.error_code.unknown_thunk)
      }
    } catch (error) {
      if (error instanceof KoinosError) {
        // Still store this metadata for testing purposes
        // eslint-disable-next-line new-cap
        const exitCodeObj = new koinos.chain.value_type()
        exitCodeObj.int32_value = error.code

        this.db.putObject(METADATA_SPACE, EXIT_CODE_KEY, koinos.chain.value_type.encode(exitCodeObj).finish())

        if (error.code !== koinos.chain.error_code.success) {
          const msgBytes = StringToUInt8Array(error.message)
          retBuf.set(msgBytes)
          retBytes = msgBytes.byteLength

          this.db.putObject(METADATA_SPACE, ERROR_MESSAGE_KEY, StringToUInt8Array(error.message))
        }

        if (error.code >= koinos.chain.error_code.reversion) {
          // revert database changes
          // backup metadata space
          const keys = [
            LOGS_KEY,
            EVENTS_KEY,
            CONTRACT_RESULT_KEY,
            HEAD_INFO_KEY,
            LAST_IRREVERSIBLE_BLOCK_KEY,
            CALLER_KEY,
            TRANSACTION_KEY,
            BLOCK_KEY,
            AUTHORITY_KEY,
            CALL_CONTRACT_RESULTS_KEY,
            EXIT_CODE_KEY,
            ERROR_MESSAGE_KEY
          ]

          const bytes = keys.map((key) => {
            return this.db.getObject(METADATA_SPACE, key)
          })

          this.db.rollbackTransaction()

          // restore state of metadata space
          keys.forEach((key, i) => {
            if (bytes[i]) this.db.putObject(METADATA_SPACE, key, bytes[i].value)
          })
        }

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

      if (error.code <= koinos.chain.error_code.success || sid === koinos.chain.system_call_id.exit) { throw error }

      retVal = error.code
    }

    retBytesBuffer[0] = retBytes

    return retVal
  }

  getImports () {
    return {
      invoke_system_call: (sid, ret_ptr, ret_len, arg_ptr, arg_len, ret_bytes) => {
        return this.invokeSystemCall(sid, ret_ptr, ret_len, arg_ptr, arg_len, ret_bytes)
      }
    }
  }
}

module.exports = {
  MockVM
}
