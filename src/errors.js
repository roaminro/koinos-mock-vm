class ExitSuccess extends Error {
  constructor (message) {
    super(message)
    this.code = 0
  }
}

class ExitFailure extends Error {
  constructor (message, code = -1) {
    super(message)
    this.code = code
  }
}

class ExitReversion extends Error {
  constructor (message, code = 1) {
    super(message)
    this.code = code
  }
}

class ExecutionError extends Error {

}

module.exports = {
  ExitSuccess,
  ExitFailure,
  ExitReversion,
  ExecutionError
}
