'use strict';

const assert = require('assert');
const async = require('async');
const zmq = require('zeromq');

function ZeroMqProvider(emitter, options) {
  assert(emitter, '`emitter` argument is not set.');
  assert(options, '`options` argument is not set.')
  validateOptions(options);

  this.options = options;
  this.emitter = emitter;

  this._q = options.queueName;
  this._url = 'tcp://' + options.hostname + ':' + options.port;
  this._pubSock = zmq.socket('pub');
  this._subSock = zmq.socket('sub');

  setImmediate(() => this._initProvider());
}

ZeroMqProvider.prototype.publish = function(message) {
  const messageStr = typeof message !== 'string' ?
                     message instanceof Buffer ?
                     message.toString('base64') :
                     JSON.stringify(message) :
                     message;

  if (this.emitter.isReady) {
    setImmediate(() => this._sendMessage(messageStr));
  } else {
    this.emitter.once('ready', () => {
      setImmediate(() => this._sendMessage(messageStr));
    });
  }
};

ZeroMqProvider.prototype.subscribe = function() {
  if (this.emitter.isReady) {
    setImmediate(() => this._connectSubscriber());
  } else {
    this.emitter.once('ready', () => {
      setImmediate(() => this._connectSubscriber());
    });
  }
};

ZeroMqProvider.prototype.unsubscribe = function() {
  setImmediate(() => {
    if (!this._isClosed) {
      this._isClosed = true;
      this._subSock.disconnect(this._url);
    }
  });
};

ZeroMqProvider.prototype.close = function() {
  this._pubSock.unbind(this._url);
}

ZeroMqProvider.prototype._initProvider = function() {
  this._pubSock.bind(this._url, (err) => {
    if (err) {
      this.emitter.emit('error', err);
      return;
    }

    this.emitter.isReady = true;
    this.emitter.emit('ready');
  });
};

ZeroMqProvider.prototype._connectSubscriber = function() {
  this._subSock.connect(this._url);
  this._subSock.subscribe(this._q);

  this._subSock.on('message', (topic, messageStr) => {
    const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;
    let message = messageStr;

    // first try to detect if it is a base64 string
    // if so convert to Buffer
    if (isBase64.test(messageStr)) {
      message = new Buffer(messageStr, 'base64');
    } else {
      // next try to decode as json
      // but if it fails just leave as original string
      try {
        message = JSON.parse(messageStr);
      } catch (e) {}
    }

    this.emitter.emit('message', message);
  });
};

ZeroMqProvider.prototype._sendMessage = function(message) {
  try {
    this._pubSock.send([this._q, message]);
  } catch (err) {
    this.emitter.emit('error', err);
  }
};

module.exports = exports = ZeroMqProvider;

function validateOptions(opts) {
  assert(opts.queueName, '`queueName` property is not set.');
  assert(opts.hostname, '`hostname` property is not set.');
  assert(opts.port, '`port` property is not set.');
}