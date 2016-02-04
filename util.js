const Long = require('long')

function numberToBuffer (val) {
  return new Buffer(('00000000' + val.toString(16)).substr(-8), 'hex')
}

function bufferToLong (buf) {
  if (buf.length !== 8) return 0
  return Long.fromBits(
    parseInt(buf.slice(4, 8).toString('hex'), 16),
    parseInt(buf.slice(0, 4).toString('hex'), 16)
  ).toNumber()
}

function longToBuffer (long) {
  const val = Long.fromNumber(long)
  return Buffer.concat([
    numberToBuffer(val.getHighBitsUnsigned()),
    numberToBuffer(val.getLowBitsUnsigned())]
  )
}

module.exports.numberToBuffer = numberToBuffer
module.exports.bufferToLong = bufferToLong
module.exports.longToBuffer = longToBuffer
