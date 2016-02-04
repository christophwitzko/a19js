'use strict'
const net = require('net')
const url = require('url')

const BufferList = require('bl')
const split = require('split-buffer')

const util = require('./util')

class Client {
  constructor (surl) {
    const purl = url.parse(surl)
    this._server = purl.hostname
    this._port = purl.port
    this._hash = new Buffer(purl.auth, 'hex').slice(0, 16)
    this._ops = {
      UPLOAD: new Buffer([0]),
      DOWNLOAD: new Buffer([1]),
      LIST: new Buffer([2])
    }
  }
  _send (op, data, cb) {
    if (typeof data === 'function' && !cb) {
      cb = data
      data = null
    }
    if (!this._ops[op]) return cb(new Error('unknown operation'))
    const sendData = new BufferList()
    sendData.append(this._hash)
    sendData.append(this._ops[op])
    if (data) sendData.append(data)
    const socket = net.createConnection(this._port, this._server)
    socket.on('connect', () => {
      socket.write(sendData.slice(0))
    })
    socket.pipe(BufferList(cb))
  }
  list (cb) {
    this._send('LIST', (err, data) => {
      if (err) return cb(err)
      const chunks = split(data, 8)
      const size = util.bufferToLong(chunks.shift())
      if (chunks.pop()[0] !== 0) return cb(new Error('invalid status'))
      if (chunks.length !== size) return cb(new Error('size mismatch'))
      cb(null, chunks.map(util.bufferToLong.bind(this)))
    })
  }
  upload (id, data, cb) {
    const payload = Buffer.concat([
      util.longToBuffer(id),
      util.longToBuffer(data.length),
      data
    ])
    this._send('UPLOAD', payload, (err, data) => {
      if (err) return cb(err)
      if (data[0] !== 0) return cb(new Error('invalid status'))
      cb()
    })
  }
  download (id, cb) {
    this._send('DOWNLOAD', util.longToBuffer(id), (err, data) => {
      if (err) return cb(err)
      const size = util.bufferToLong(data.slice(0, 8))
      if (data.slice(8 + size)[0] !== 0) return cb(new Error('invalid status'))
      cb(null, data.slice(8, 8 + size))
    })
  }
  uploadStream (id, cb) {
    if (!cb) cb = () => {}
    return BufferList((err, data) => {
      if (err) return cb(err)
      this.upload(id, data, cb)
    })
  }
}

module.exports = Client
