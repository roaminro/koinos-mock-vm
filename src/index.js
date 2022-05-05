/* eslint-disable camelcase */
const chalk = require('chalk')
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
  ROLLBACK_TRANSACTION_KEY,
  COMMIT_TRANSACTION_KEY
} = require('./constants')

const { koinos } = require('test-proto-js')

class MockVM {
  constructor (disableLogging = false) {
    this.disableLogging = disableLogging
    this.db = new Database()
  }

  setInstance (instance) {
    this.memory = instance.exports.memory
  }

  invokeSystemCall (sid, ret_ptr, ret_len, arg_ptr, arg_len) {
    try {
      const argsBuf = new Uint8Array(this.memory.buffer, arg_ptr, arg_len)
      const retBuf = new Uint8Array(this.memory.buffer, ret_ptr, ret_len)

      let retVal = 0
      switch (sid) {
        case koinos.chain.system_call_id.exit_contract: {
          const { exit_code } = koinos.chain.exit_contract_arguments.decode(argsBuf)

          switch (exit_code) {
            case 0:
              throw new ExitSuccess(`Exiting the contract with exit code ${exit_code}`, argsBuf)
            case 1:
              throw new ExitFailure(`Exiting the contract with exit code ${exit_code}`, argsBuf)
            default:
              throw new ExitUnknown('Exiting the contract with unknown exit code', argsBuf)
          }
        }
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
        case koinos.chain.system_call_id.set_contract_result: {
          const { value } = koinos.chain.set_contract_result_arguments.decode(argsBuf)
          if (!this.disableLogging) {
            console.log(chalk.green('[Contract Result]'), encodeBase64(value))
          }
          this.db.putObject(METADATA_SPACE, CONTRACT_RESULT_KEY, value)
          break
        }
        case koinos.chain.system_call_id.get_entry_point: {
          const dbObject = this.db.getObject(METADATA_SPACE, ENTRY_POINT_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(ENTRY_POINT_KEY)} is not set`)
          }

          const { int32_value } = koinos.chain.value_type.decode(dbObject.value)

          const buffer = koinos.chain.get_entry_point_result.encode({ value: int32_value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
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
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_contract_arguments: {
          const dbObject = this.db.getObject(METADATA_SPACE, CONTRACT_ARGUMENTS_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CONTRACT_ARGUMENTS_KEY)} is not set`)
          }

          const buffer = koinos.chain.get_contract_arguments_result.encode({ value: dbObject.value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_contract_id: {
          const dbObject = this.db.getObject(METADATA_SPACE, CONTRACT_ID_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(CONTRACT_ID_KEY)} is not set`)
          }

          const buffer = koinos.chain.get_contract_id_result.encode({ value: dbObject.value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_head_info: {
          const dbObject = this.db.getObject(METADATA_SPACE, HEAD_INFO_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(HEAD_INFO_KEY)} is not set`)
          }

          const headInfo = koinos.chain.head_info.decode(dbObject.value)

          const buffer = koinos.chain.get_head_info_result.encode({ value: headInfo }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
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
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.require_authority: {
          const { type, account } = koinos.chain.require_authority_arguments.decode(argsBuf)

          const dbObject = this.db.getObject(METADATA_SPACE, AUTHORITY_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(AUTHORITY_KEY)} is not set`)
          }

          const { values } = koinos.chain.list_type.decode(dbObject.value)

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
        case koinos.chain.system_call_id.put_object: {
          const { space, key, obj } = koinos.chain.put_object_arguments.decode(argsBuf)

          if (space.system === METADATA_SPACE.system &&
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

            const buffer = koinos.chain.put_object_result.encode({ value: bytesUsed }).finish()
            buffer.copy(retBuf)
            retVal = buffer.byteLength
          }

          break
        }
        case koinos.chain.system_call_id.get_object: {
          const { space, key } = koinos.chain.get_object_arguments.decode(argsBuf)

          const dbObject = this.db.getObject(space, key)

          if (dbObject) {
            const buffer = koinos.chain.get_object_result.encode({ value: dbObject }).finish()
            buffer.copy(retBuf)
            retVal = buffer.byteLength
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
            retVal = buffer.byteLength
          }
          break
        }
        case koinos.chain.system_call_id.get_prev_object: {
          const { space, key } = koinos.chain.get_prev_object_arguments.decode(argsBuf)

          const dbObject = this.db.getPrevObject(space, key)

          if (dbObject) {
            const buffer = koinos.chain.get_prev_object_result.encode({ value: dbObject }).finish()
            buffer.copy(retBuf)
            retVal = buffer.byteLength
          }
          break
        }
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
              throw new ExecutionError('unknown hash code')
          }

          const buffer = koinos.chain.hash_result.encode({ value: digest }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.recover_public_key: {
          const { type, signature, digest } = koinos.chain.recover_public_key_arguments.decode(argsBuf)

          if (type !== koinos.chain.dsa.ecdsa_secp256k1) {
            throw new ExecutionError('unexpected dsa')
          }

          let recoveredKey
          try {
            recoveredKey = recoverPublicKey(digest, signature)
          } catch (error) {
            throw new ExecutionError(error.message)
          }

          const buffer = koinos.chain.recover_public_key_result.encode({ value: recoveredKey }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.verify_signature: {
          const { public_key, type, signature, digest } = koinos.chain.verify_signature_arguments.decode(argsBuf)

          if (type !== koinos.chain.dsa.ecdsa_secp256k1) {
            throw new ExecutionError('unexpected dsa')
          }

          let recoveredKey
          try {
            recoveredKey = recoverPublicKey(digest, signature)
          } catch (error) {
            throw new ExecutionError(error.message)
          }

          const buffer = koinos.chain.verify_signature_result.encode({ value: arraysAreEqual(public_key, recoveredKey) }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_transaction: {
          const dbObject = this.db.getObject(METADATA_SPACE, TRANSACTION_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(TRANSACTION_KEY)} is not set`)
          }

          const transaction = koinos.protocol.transaction.decode(dbObject.value)

          const buffer = koinos.chain.get_transaction_result.encode({ value: transaction }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_transaction_field: {
          const { field } = koinos.chain.get_transaction_field_arguments.decode(argsBuf)

          const dbObject = this.db.getObject(METADATA_SPACE, TRANSACTION_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(TRANSACTION_KEY)} is not set`)
          }

          const transaction = koinos.protocol.transaction.decode(dbObject.value)
          const value = getNestedFieldValue(koinos.protocol.transaction, koinos.chain.list_type, field, transaction)

          const buffer = koinos.chain.get_transaction_field_result.encode({ value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
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
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.get_block_field: {
          const { field } = koinos.chain.get_block_field_arguments.decode(argsBuf)
          const dbObject = this.db.getObject(METADATA_SPACE, BLOCK_KEY)

          if (!dbObject) {
            throw new ExecutionError(`${UInt8ArrayToString(BLOCK_KEY)} is not set`)
          }

          const block = koinos.protocol.block.decode(dbObject.value)
          const value = getNestedFieldValue(koinos.protocol.block, koinos.chain.list_type, field, block)

          const buffer = koinos.chain.get_block_field_result.encode({ value }).finish()
          buffer.copy(retBuf)
          retVal = buffer.byteLength
          break
        }
        case koinos.chain.system_call_id.call_contract: {
          const { contract_id, entry_point, args } = koinos.chain.call_contract_arguments.decode(argsBuf)
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

          const buffer = koinos.chain.call_contract_result.encode({ value: value.bytes_value }).finish()
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
            CALL_CONTRACT_RESULTS_KEY
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
