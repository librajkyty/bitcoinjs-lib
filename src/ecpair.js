let ecc = require('tiny-secp256k1')
let randomBytes = require('randombytes')
let typeforce = require('typeforce')
let types = require('./types')
let wif = require('wif')

let NETWORKS = require('./networks')

// TODO: why is the function name toJSON weird?
function isPoint (x) { return ecc.isPoint(x) }
let isOptions = typeforce.maybe(typeforce.compile({
  compressed: types.maybe(types.Boolean),
  network: types.maybe(types.Network)
}))

function ECPair (d, Q, options) {
  options = options || {}

  this.compressed = options.compressed === undefined ? true : options.compressed
  this.network = options.network || NETWORKS.bitcoin

  this.__d = d || null
  this.__Q = null
  if (Q) this.__Q = ecc.pointCompress(Q, this.compressed)
}

ECPair.prototype.getNetwork = function () {
  return this.network
}

ECPair.prototype.getPrivateKey = function () {
  return this.__d
}

ECPair.prototype.getPublicKey = function () {
  if (!this.__Q) this.__Q = ecc.pointFromScalar(this.__d, this.compressed)
  return this.__Q
}

ECPair.prototype.toWIF = function () {
  if (!this.__d) throw new Error('Missing private key')
  return wif.encode(this.network.wif, this.__d, this.compressed)
}

ECPair.prototype.sign = function (hash) {
  if (!this.__d) throw new Error('Missing private key')
  return ecc.sign(hash, this.__d)
}

ECPair.prototype.verify = function (hash, signature) {
  return ecc.verify(hash, this.getPublicKey(), signature)
}

function fromPrivateKey (buffer, options) {
  typeforce(types.Buffer256bit, buffer)
  if (!ecc.isPrivate(buffer)) throw new TypeError('Private key not in range [1, n)')
  typeforce(isOptions, options)

  return new ECPair(buffer, null, options)
}

function fromPublicKey (buffer, options) {
  typeforce(isPoint, buffer)
  typeforce(isOptions, options)
  return new ECPair(null, buffer, options)
}

function fromWIF (string, network) {
  let decoded = wif.decode(string)
  let version = decoded.version

  // list of networks?
  if (types.Array(network)) {
    network = network.filter(function (x) {
      return version === x.wif
    }).pop()

    if (!network) throw new Error('Unknown network version')

  // otherwise, assume a network object (or default to bitcoin)
  } else {
    network = network || NETWORKS.bitcoin

    if (version !== network.wif) throw new Error('Invalid network version')
  }

  return fromPrivateKey(decoded.privateKey, {
    compressed: decoded.compressed,
    network: network
  })
}

function makeRandom (options) {
  typeforce(isOptions, options)
  options = options || {}
  let rng = options.rng || randomBytes

  let d
  do {
    d = rng(32)
    typeforce(types.Buffer256bit, d)
  } while (!ecc.isPrivate(d))

  return fromPrivateKey(d, options)
}

module.exports = {
  makeRandom,
  fromPrivateKey,
  fromPublicKey,
  fromWIF
}
