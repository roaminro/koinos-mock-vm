const { SoMap } = require('somap')
const { koinos } = require('@koinos/proto-js')
const { arraysAreEqual } = require('./util')

function canonicalizeSpace (space) {
  return {
    id: space.id !== 0 ? space.id : null,
    system: space.system ? space.system : null,
    zone: space.zone && space.zone.length !== 0 ? space.zone : null
  }
}

class Database {
  constructor () {
    this.initDb()
  }

  initDb (arr = []) {
    this.db = new SoMap(arr, this.comparator)
    this.commitTransaction()
  }

  comparator (a, b) {
    if (a > b) {
      return 1
    } else if (a < b) {
      return -1
    } else {
      return 0
    }
  }

  commitTransaction () {
    this.backupDb = new SoMap(this.db)
  }

  rollbackTransaction () {
    this.initDb(this.backupDb)
    this.commitTransaction()
  }

  putObject (space, key, obj) {
    const dbKey = koinos.chain.database_key.encode({ space: canonicalizeSpace(space), key }).finish()
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
    const dbKey = koinos.chain.database_key.encode({ space: canonicalizeSpace(space), key }).finish()

    this.db.delete(dbKey)
  }

  getObject (space, key) {
    const dbKey = koinos.chain.database_key.encode({ space: canonicalizeSpace(space), key }).finish()
    const value = this.db.get(dbKey)

    if (value) {
      return koinos.chain.database_object.create({ exists: true, value })
    }

    return null
  }

  getNextObject (space, key) {
    const dbKey = koinos.chain.database_key.encode({ space: canonicalizeSpace(space), key }).finish()

    const keys = [...this.db.keys()]

    for (let i = 0; i < keys.length; i++) {
      const currKey = keys[i]
      const decodedCurrKey = koinos.chain.database_key.decode(currKey)

      // if the current key belongs to the space
      if (decodedCurrKey.space.system === space.system &&
        decodedCurrKey.space.id === space.id &&
        arraysAreEqual(decodedCurrKey.space.zone, space.zone)) {
        // if it's the key we are looking for, get the next objec if exists
        if (arraysAreEqual(currKey, dbKey) && (i + 1) < keys.length) {
          const nextKey = keys[i + 1]
          const nextVal = this.db.get(nextKey)

          const decodedNextKey = koinos.chain.database_key.decode(nextKey)

          if (decodedNextKey.space.system === space.system &&
            decodedNextKey.space.id === space.id &&
            arraysAreEqual(decodedNextKey.space.zone, space.zone)) {
            return koinos.chain.database_object.create({ exists: true, value: nextVal, key: decodedNextKey.key })
          }
        } else if (currKey > dbKey) {
          // if the current key is greater than the one we're looking for
          // then, the current key is considered the next key
          const nextVal = this.db.get(currKey)
          return koinos.chain.database_object.create({ exists: true, value: nextVal, key: decodedCurrKey.key })
        }
      }
    }

    return null
  }

  getPrevObject (space, key) {
    const dbKey = koinos.chain.database_key.encode({ space: canonicalizeSpace(space), key }).finish()

    const keys = [...this.db.keys()]

    for (let i = keys.length - 1; i >= 0; i--) {
      const currKey = keys[i]
      const decodedCurrKey = koinos.chain.database_key.decode(currKey)

      // if the current key belongs to the space
      if (decodedCurrKey.space.system === space.system &&
        decodedCurrKey.space.id === space.id &&
        arraysAreEqual(decodedCurrKey.space.zone, space.zone)) {
        // if it's the key we are looking for, get the next objec if exists
        if (arraysAreEqual(currKey, dbKey) && (i - 1) >= 0) {
          const prevKey = keys[i - 1]
          const prevVal = this.db.get(prevKey)

          const decodedPrevKey = koinos.chain.database_key.decode(prevKey)

          if (decodedPrevKey.space.system === space.system &&
            decodedPrevKey.space.id === space.id &&
            arraysAreEqual(decodedPrevKey.space.zone, space.zone)) {
            return koinos.chain.database_object.create({ exists: true, value: prevVal, key: decodedPrevKey.key })
          }
        } else if (currKey < dbKey) {
          // if the current key is lower than the one we're looking for
          // then, the current key is considered the prev key
          const prevVal = this.db.get(currKey)
          return koinos.chain.database_object.create({ exists: true, value: prevVal, key: decodedCurrKey.key })
        }
      }
    }

    return null
  }
}

module.exports = {
  Database
}
