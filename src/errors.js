class KoinosError extends Error {
  constructor (message, code) {
    super(message)
    this.code = code
  }
}

class ExecutionError extends Error {

}

module.exports = {
  KoinosError,
  ExecutionError
}
