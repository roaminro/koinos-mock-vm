const METADATA_SPACE = {
  system: true,
  id: 0
}

const ENTRY_POINT_KEY = new TextEncoder('utf-8').encode('entry_point')
const CONTRACT_ARGUMENTS_KEY = new TextEncoder('utf-8').encode('contract_arguments')
const CONTRACT_RESULT_KEY = new TextEncoder('utf-8').encode('contract_result')
const CALL_CONTRACT_RESULTS_KEY = new TextEncoder('utf-8').encode('call_contract_results')
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
const ROLLBACK_TRANSACTION_KEY = new TextEncoder('utf-8').encode('rollback_transaction')
const COMMIT_TRANSACTION_KEY = new TextEncoder('utf-8').encode('commit_transaction')

module.exports = {
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
}
