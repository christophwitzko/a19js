'use strict'
const crypto = require('crypto')
const net = require('net')

const level = require('level')
const BufferList = require('bl')

const util = require('./util')

class Server {
  constructor (dbname, users, port) {
    this._db = level('./mydb')
    this._server = net.createServer({
      allowHalfOpen: true
    }, this.handler.bind(this))
    this._users = users.map(u => crypto.createHash('md5').update(u).digest())
    this._server.listen(port)
  }
  _hasUser (buf) {
    return this._users.some(u => {
      return u.compare(buf) === 0
    })
  }
  handler (socket) {
    console.log('connection', socket.remoteAddress, socket.remotePort)
    socket.setTimeout(10000, () => {
      socket.destroy()
    })
    socket.pipe(BufferList((err, data) => {
      if (err) socket.end(new Buffer([1]))
      if (!this._hasUser(data.slice(0, 16))) {
        return socket.end(new Buffer([3]))
      }
      const op = data.slice(16, 17)[0]
      if (op === 0) return this._handleUpload(socket, data.slice(17))
      if (op === 1) return this._handleDownload(socket, data.slice(17))
      if (op === 2) return this._handleList(socket)
      socket.end(new Buffer([2]))
    }))
  }
  _handleUpload (socket, data) {
    const size = util.bufferToLong(data.slice(8, 16))
    const blob = data.slice(16)
    if (size !== blob.length) return socket.end(new Buffer([1]))
    this._db.put(data.slice(0, 8), blob, (err) => {
      if (err) {
        console.log(err)
        return socket.end(new Buffer([1]))
      }
      socket.end(new Buffer([0]))
    })
  }
  _handleDownload (socket, data) {
    if (data.length !== 8) return socket.end(new Buffer([1]))
    this._db.get(data, {
      keyEncoding: 'binary',
      valueEncoding: 'binary'
    }, (err, value) => {
      if (err) {
        console.log(err)
        return socket.end(new Buffer([1]))
      }
      socket.end(Buffer.concat([
        util.longToBuffer(value.length),
        value,
        new Buffer([0])
      ]))
    })
  }
  _handleList (socket) {
    const list = []
    this._db.createKeyStream({
      keyEncoding: 'binary'
    }).on('data', (data) => {
      list.push(data)
    })
    .on('end', () => {
      list.unshift(util.longToBuffer(list.length))
      list.push(new Buffer([0]))
      socket.end(Buffer.concat(list))
    })
  }
}

module.exports = Server
