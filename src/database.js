const { SoMap } = require('somap')
const { arraysAreEqual } = require('./util')

class Database {
  constructor (koinosProto) {
    this.db = new SoMap([], (a, b) => {
      if (a > b) {
        return 1
      } else if (a < b) {
        return -1
      } else {
        return 0
      }
    })

    this.database_key = koinosProto.lookupType('koinos.chain.database_key')
    this.database_object = koinosProto.lookupType('koinos.chain.database_object')
  }

  putObject (space, key, obj) {
    const dbKey = this.database_key.encode({ space, key }).finish()
    let bytesUsed = 0

    const currentObj = this.db.has(dbKey)

    if (currentObj) {
      bytesUsed -= currentObj.byteLength
    }

    this.db.set(dbKey, obj)

    bytesUsed += obj.byteLength

    return bytesUsed
  }

  removeObject (space, key) {
    const dbKey = this.database_key.encode({ space, key }).finish()

    this.db.delete(dbKey)
  }

  getObject (space, key) {
    const dbKey = this.database_key.encode({ space, key }).finish()
    const value = this.db.get(dbKey)

    if (value) {
      return this.database_object.create({ exists: true, value })
    }

    return null
  }

  getNextObject (space, key) {
    const dbKey = this.database_key.encode({ space, key }).finish()
    if (!this.db.get(dbKey)) {
      return null
    }

    const keys = [...this.db.keys()]

    for (let i = 0; i < keys.length; i++) {
      const currKey = keys[i]

      if (arraysAreEqual(currKey, dbKey)) {
        if ((i + 1) < keys.length) {
          const nextKey = keys[i + 1]
          const nextVal = this.db.get(nextKey)

          const decodedNextKey = this.database_key.decode(nextKey)

          if (decodedNextKey.space.system === space.system &&
              decodedNextKey.space.id === space.id &&
              arraysAreEqual(decodedNextKey.space.zone, space.zone)) {
            return this.database_object.create({ exists: true, value: nextVal, key: nextKey })
          }
        }
      }
    }

    return null
  }

  getPrevObject (space, key) {
    const dbKey = this.database_key.encode({ space, key }).finish()
    if (!this.db.get(dbKey)) {
      return null
    }

    const keys = [...this.db.keys()]

    for (let i = keys.length - 1; i >= 0; i--) {
      const currKey = keys[i]

      if (arraysAreEqual(currKey, dbKey)) {
        if ((i - 1) >= 0) {
          const nextKey = keys[i - 1]
          const nextVal = this.db.get(nextKey)

          const decNextKey = this.database_key.decode(nextKey)

          if (decNextKey.space.system === space.system &&
              decNextKey.space.id === space.id &&
              arraysAreEqual(decNextKey.space.zone, space.zone)) {
            return this.database_object.create({ exists: true, value: nextVal, key: nextKey })
          }
        }
      }
    }

    return null
  }
}

module.exports = {
  Database
}
