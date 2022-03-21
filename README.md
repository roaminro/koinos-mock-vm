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

## Usage as a cli
You can execute multiple smart contracts in one run, they will be executed in the order they appear in the command parameters. The koinos-mock-vm database will be shared between each execution allowing you to build complex executions cases that involve several contracts.

```sh
koinos-mock-vm <path to contract wasm 1> <path to contract wasm 2> ... <path to contract wasm n>
```

## Usage as a NodeJS package
See `index.js` file in the `bin` folder.