class ExitSuccess extends Error {
  constructor (message, exitArgs) {
    super(message)
    this.exitArgs = exitArgs
  }
}

class ExitFailure extends Error {
  constructor (message, exitArgs) {
    super(message)
    this.exitArgs = exitArgs
  }
}

class ExitUnknown extends Error {
  constructor (message, exitArgs) {
    super(message)
    this.exitArgs = exitArgs
  }
}

class ExecutionError extends Error {

}

module.exports = {
  ExitSuccess,
  ExitFailure,
  ExitUnknown,
  ExecutionError
}
