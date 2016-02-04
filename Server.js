'use strict'
const level = require('level')
const net = require('net')

const util = require('./util')

const validHash = new Buffer('193ec1104141b3e9cf9c3ffd18225ef0', 'hex')
const db = level('./mydb')

function handleUpload (socket, data) {
  const size = util.bufferToLong(data.slice(8, 16))
  const blob = data.slice(16)
  if (size !== blob.length) return socket.end(new Buffer([1]))
  db.put(data.slice(0, 8), blob, (err) => {
    if (err) {
      console.log(err)
      return socket.end(new Buffer([1]))
    }
    socket.end(new Buffer([0]))
  })
}

function handleDownload (socket, data) {
  if (data.length !== 8) return socket.end(new Buffer([1]))
  db.get(data, {
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

function handleList (socket) {
  const list = []
  db.createKeyStream({
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

const server = net.createServer((socket) => {
  socket.setTimeout(10000, () => {
    socket.end()
  })
  const data = []
  const timeout = () => {
    return setTimeout(() => {
      const all = Buffer.concat(data)
      if (validHash.compare(all.slice(0, 16)) !== 0) {
        return socket.end()
      }
      const op = all.slice(16, 17)[0]
      if (op === 0) return handleUpload(socket, all.slice(17))
      if (op === 1) return handleDownload(socket, all.slice(17))
      if (op === 2) return handleList(socket)
      socket.end(new Buffer([2]))
    }, 100)
  }
  let next = timeout()
  socket.on('data', (chunk) => {
    clearTimeout(next)
    data.push(chunk)
    next = timeout()
  })
})

server.listen(8080)

process.on('beforeExit', () => {
  console.log('close')
  db.close()
})
