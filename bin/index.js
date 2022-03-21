const fs = require('fs')
const { WASI } = require('wasi')
const { MockVM } = require('../src')
const { ExitSuccess, ExitFailure, ExecutionError } = require('../src/errors')

const wasmFilePaths = process.argv.slice(2)

if (!wasmFilePaths.length) {
  throw new Error('you must provide the path of one or more wasm files to execute')
}

const main = async () => {
  const mockVM = new MockVM()

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

    try {
      wasi.start(instance)
    } catch (error) {
      if (!(error instanceof ExitSuccess) &&
        !(error instanceof ExitFailure) &&
        !(error instanceof ExecutionError)) {
        console.error(error)
      }
    }
  }
}

main()
