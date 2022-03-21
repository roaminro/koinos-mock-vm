const fs = require('fs')
const { WASI } = require('wasi')
const chalk = require('chalk')
const { MockVM } = require('../src')
const { ExitSuccess, ExitFailure, ExecutionError } = require('../src/errors')

const wasmFilePaths = process.argv.slice(2)

if (!wasmFilePaths.length) {
  throw new Error('you must provide the path of one or more wasm files to execute')
}

const main = async () => {
  console.log(chalk.green('[Starting VM]', `${wasmFilePaths.length} contracts to execute`))
  const mockVM = new MockVM()

  let globalExitCode = 0

  for (let index = 0; index < wasmFilePaths.length; index++) {
    const wasmFilePath = wasmFilePaths[index]

    const wasi = new WASI()

    const importObject = {
      wasi_snapshot_preview1: wasi.wasiImport,
      env: {
        ...mockVM.getImports()
      }
    }

    // eslint-disable-next-line no-undef
    const wasm = await WebAssembly.compile(
      fs.readFileSync(wasmFilePath)
    )
    // eslint-disable-next-line no-undef
    const instance = await WebAssembly.instantiate(wasm, importObject)
    instance.exports.memory.grow(512)

    mockVM.setInstance(instance)

    console.log(chalk.green('[Execution started]', wasmFilePath))

    const hrStart = process.hrtime()

    try {
      wasi.start(instance)
    } catch (error) {
      if (!(error instanceof ExitSuccess) &&
        !(error instanceof ExitFailure) &&
        !(error instanceof ExecutionError)) {
        console.error(error)
      }

      if (globalExitCode === 0 && !(error instanceof ExitSuccess)) {
        globalExitCode = 1
      }
    }

    const hrEnd = process.hrtime(hrStart)

    const executionTime = hrEnd[0] ? `in ${hrEnd[0]}s ${hrEnd[1] / 1000000}ms` : `in ${hrEnd[1] / 1000000}ms`
    console.log(chalk.green('[Execution completed]', executionTime, wasmFilePath))
  }

  const exitMessage = `[Stopping VM] exit code ${globalExitCode}`
  if (globalExitCode === 0) {
    console.log(chalk.green(exitMessage))
  } else {
    console.log(chalk.red(exitMessage))
  }
  process.exit(globalExitCode)
}

main()
