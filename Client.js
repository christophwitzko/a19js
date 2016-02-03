'use strict'
const net = require('net')
const url = require('url')

const BufferList = require('bl')
const Long = require('long')
const split = require('split-buffer')

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
  _bufferToLong (buf) {
    if (buf.length !== 8) return 0
    return Long.fromBits(
      parseInt(buf.slice(4, 8).toString('hex'), 16),
      parseInt(buf.slice(0, 4).toString('hex'), 16)
    ).toNumber()
  }
  _intToBuffer (str) {
    return new Buffer(('00000000' + str.toString(16)).substr(-8), 'hex')
  }
  _longToBuffer (long) {
    const val = Long.fromNumber(long)
    return Buffer.concat([
      this._intToBuffer(val.getHighBitsUnsigned()),
      this._intToBuffer(val.getLowBitsUnsigned())]
    )
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
      const size = this._bufferToLong(chunks.shift())
      if (chunks.pop()[0] !== 0) return cb(new Error('invalid status'))
      if (chunks.length !== size) return cb(new Error('size mismatch'))
      cb(null, chunks.map(this._bufferToLong.bind(this)))
    })
  }
  upload (id, data, cb) {
    const payload = Buffer.concat([
      this._longToBuffer(id),
      this._longToBuffer(data.length),
      data
    ])
    this._send('UPLOAD', payload, (err, data) => {
      if (err) return cb(err)
      if (data[0] !== 0) return cb(new Error('invalid status'))
      cb()
    })
  }
  download (id, cb) {
    this._send('DOWNLOAD', this._longToBuffer(id), (err, data) => {
      if (err) return cb(err)
      const size = this._bufferToLong(data.slice(0, 8))
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
