const fs = require('fs')
const { WASI } = require('wasi')
const { MockVM } = require('../src')

let wasmFilePath = process.argv.slice(2)

if (!wasmFilePath.length) {
  throw new Error('you must provide the path of the wasm file to execute')
}

wasmFilePath = wasmFilePath[0]

const main = async () => {
  const mockVM = new MockVM()
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

  wasi.start(instance)
}

main()
