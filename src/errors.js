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

module.exports = {
  ExitSuccess,
  ExitFailure,
  ExitUnknown
}
