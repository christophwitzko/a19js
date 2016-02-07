'use strict'
const crypto = require('crypto')
const fs = require('fs')

const Client = require('./Client')
const Server = require('./Server')

const server = new Server('./mydb', ['MYPASSWORD'], 8080)
const hash = crypto.createHash('md5').update('MYPASSWORD').digest('hex')

const client = new Client(`a19://${hash}@127.0.0.1:8080`)
client.list((err, files) => {
  if (err) return console.log(err)
  console.log('FILES', files.length)
})

fs.createReadStream('test.txt').pipe(client.uploadStream(444, (err) => {
  if (err) return console.log(err)
  client.download(444, (err, data) => {
    if (err) return console.log(err)
    console.log(err, data.toString())
  })
}))

client.download(444, (err, data) => {
  if (err) return console.log(err)
  console.log(err, data.toString())
})
