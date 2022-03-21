# koinos-mock-vm

Koinos-Mock-VM is a NodeJS application/package that allows you to run WASM Koinos smart contracts without deploying the contracts to the Koinos blockchain. It is a tool that you can leverage to build unit tests for your smart contracts.

## Requirements:
You need to install NodeJS v12 or higher [download](https://nodejs.org/en/download/)

## Installation:

```sh
# with npm
npm install -g koinos-mock-vm

# with yarn
yarn global add koinos-mock-vm
```

## Interact with the mock vm
koinos-mock-vm leverages the Koinos system calls to enable a wasm contract to interact with the mock vm, which means that `any` Koinos wasm contract can use it out of the box.

The `put_object` system call is used to insert mock data in the database powering the mock vm. When calling a system call, like `get_entry_point`, the mock vm will pull the mock data that was initially set in the database.
The metadata system space is used to store the mock data. (space zone = "", space id = 0, system = true)

List of keys used to store the mock data:
- `entry_point`:
    - object of type `koinos.chain.value_type` with the `int32_value` property set with the entry point
    - used by the system call `get_entry_point`
- `contract_arguments`: 
    - object of type `bytes` set with the contract arguments
    - used by the system call `get_contract_argument`
- `contract_result`:
    - object of type `bytes` set with the contract result
    - used by the system call `set_contract_result`
- `contract_id`:
    - object of type `bytes` set with the contract id
    - usde by the system call `get_contract_id`
- `head_info`: 
    - object of type `koinos.chain.head_info` set with the head info
    - used by the system call `get_head_info`
- `caller`:
    - object of type `koinos.chain.caller_data` set with the caller data info
    - used by the system call `get_caller`
- `last_irreversible_block`:
    - object of type `koinos.chain.value_type` with the `uint64_value` property set with the last irreversible block height
    - used by the system call `get_last_irreversible_block`
- `transaction`: 
    - object of type `koinos.protocol.transaction` set with the transaction info
    - used by the system calls `get_transaction` and `get_transaction_field`
- `block`: 
    - object of type `koinos.protocol.block` set with the block info
    - used by the system calls `get_block` and `get_block_field`
- `authority`:
    - object of type `koinos.chain.list_type`. Each `koinos.chain.value_type` elements represent an authorization:
        - `int32_value`: value of the `koinos.chain.authorization_type`
        - `bytes_value`: bytes of the account address
        - `bool_value`: "autorized" boolean 
    - used by the system call `require_authority`:
        - will use the `require_authority` arguments (type and account) to lookup the autorization in the previously set `koinos.chain.list_type`
- `call_contract_results`:
    - object of type `koinos.chain.list_type`. Each `koinos.chain.value_type` elements represent a contract call result:
        - `bytes_value`: bytes of the contract call result
    - used by the system call `call_contract`: 
        - will use the previously set `koinos.chain.list_type` to return a call  result. The call contract results are FIFO meaning that the first `call_contract` will use the first element you set in the list, the second call the second element in the list, etc...
- `logs`:
    - object of type `koinos.chain.list_type`. Each `koinos.chain.value_type` has its `string_value` set with a log
    - used by the system call `log`
- `events`:
    - object of type `koinos.chain.list_type`. Each `koinos.chain.value_type` has its `bytes_value` set with a `koinos.protocol.event_data` object
    - used by the system call `event` 
- `exit_code`:
    - object of type `koinos.chain.exit_contract_arguments`
    - used by the system call `exit_contract` 

The following keys are additional commands that allow you to interact with the mock vm's database:
 - `reset`:
    - whatever object as argument
    - will reset the database   
 - `begin_transaction`:
    - whatever object as argument
    - will start a database transaction (useful when trying to build unit tests around transaction reversions)
    - it basically backs up the database so that ic can be rolledback to the backedup state if the transaction reverts
 - `rollback_transaction`:
    - whatever object as argument
    - will restore the backup made via `begin_transaction`
 - `commit_transaction`:
    - whatever object as argument
    - will clear the backup made via `begin_transaction` (hence make it impossible to rollback)

## Usage as a cli
You can execute multiple smart contracts in one run, they will be executed in the order they appear in the command parameters. The koinos-mock-vm database will be shared between each execution allowing you to build complex executions cases that involve several contracts.

```sh
koinos-mock-vm <path to contract wasm 1> <path to contract wasm 2> ... <path to contract wasm n>
```

## Usage as a NodeJS package
See `index.js` file in the `bin` folder.

## Example
```sh
koinos-mock-vm contract.wasm

[Starting VM] 1 contracts to execute
(node:79763) ExperimentalWarning: WASI is an experimental feature. This feature could change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
[Execution started] contract.wasm
[Log] entryPoint: 3282800625
[Log] contract_arguments: myArgs
[Log] contract_id: 1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqe
[Log] headInfo.head_block_time: 123456789
[Log] headInfo.last_irreversible_block: 3
[Log] headInfo.head_topology.height: 10
[Log] headInfo.head_topology.id: IHhJwlD7P+o6x7L38den1MnumUhnYmNhTZhIUQQhezvEMf7rx89NbIIioNCIQSk1PQYdQ9mOI4+rDYiwO2pLvM4=
[Log] headInfo.head_topology.previous: IHhJwlD7P+o6x7L38den1MnumUhnYmNhTZhIUQQhezvEMf7rx89NbIIioNCIQSk1PQYdQ9mOI4+rDYiwO2pLvM4=
[Log] callerData.caller_privilege: 1
[Log] callerData.caller (b58): 1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqe
[Log] lastIrreversibleBlock: 987654321
[Log] recoveredKey (b58): 1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqe
[Log] tx.id: TX_ID
[Log] tx.id: TX_ID
[Log] header.payer: 1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqe
[Log] signatures: 10,7,130,1,4,115,105,103,49,10,7,130,1,4,115,105,103,50
[Log] block.id: BLOCK_ID
[Log] block.id: BLOCK_ID
[Log] got: val2
[Log] got next:val3
[Log] got prev:val1
[Log] nothing prev test_key1
[Log] got test_key4
[Log] test_key4 was removed
[Log] nothing after test_key3
[Log] got next:val11
[Event] my_event_name / [ '1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqe' ] / bXlfZXZlbnRfZGF0YQ==
[Event] my_event_name2 / [ '1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqe' ] / bXlfZXZlbnRfZGF0YQ==
[Log] callRes1: 1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPq1
[Log] callRes2: 1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPq4
[Execution completed] in 165.232577ms contract.wasm
[Stopping VM] exit code 0
```