'use strict';

const assert = require('assert');
const async = require('async');
const amqp = require('amqp');

function AmqpProvider(emitter, options) {
  assert(emitter, '`emitter` argument is not set.');
  assert(options, '`options` argument is not set.')
  validateOptions(options);

  this.options = options;
  this.emitter = emitter;

  this._q = options.queueName;

  setImmediate(() => this._initProvider());
}

AmqpProvider.prototype.publish = function(message) {
  const messageStr = typeof message !== 'string' ?
                    message instanceof Buffer ?
                    message.toString('base64') :
                    JSON.stringify(message) :
                    message;

  if (this.emitter.isReady) {
    setImmediate(() => this._exchange.publish(this._q, messageStr));
  } else {
    this.emitter.once('ready', () => this._exchange.publish(this._q, messageStr));
  }
};

AmqpProvider.prototype.subscribe = function() {
  const subscribeFunc = function() {
    this._queue.subscribe((msg) => {
      const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;
      let message = msg.data.toString();

      // first try to detect if it is a base64 string
      // if so convert to Buffer
      if (isBase64.test(message)) {
        message = new Buffer(message, 'base64');
      } else {
        // next try to decode as json
        // but if it fails just leave as original string
        try {
          message = JSON.parse(message);
        } catch (e) { }
      }

      this.emitter.emit('message', message);
    }).addCallback((ok) => this._ctag = ok.consumerTag);
  };

  if (this.emitter.isReady) {
    setImmediate(subscribeFunc.bind(this));
  } else {
    this.emitter.once('ready', subscribeFunc.bind(this));
  }
};

AmqpProvider.prototype.unsubscribe = function() {
  setImmediate(() => {
    this._isClosed = true;
    this._queue.unsubscribe(this._ctag);
  });
};

AmqpProvider.prototype.close = function() {
  this._queue.unbind(this._exchange, '#');
  this._queue.destroy();
  this._exchange.destroy();
  this._connection.disconnect();
};

AmqpProvider.prototype._initProvider = function() {
  async.series([

    (cb) => {
      this._connection = amqp.createConnection(this.options);
      this._connection.on('ready', cb);
    },

    (cb) => {
      this._connection.exchange(this.options.exchangeName, { type: 'topic' }, (exchange) => {
        this._exchange = exchange;
        cb();
      });
    },

    (cb) => {
      this._connection.queue(this._q, { closeChannelOnUnsubscribe: true }, (queue) => {
        this._queue = queue;
        cb();
      });
    },

    (cb) => {
      this._queue.bind(this.options.exchangeName, '#', cb);
    }

  ], (err) => {
    this.emitter.isReady = true;
    this.emitter.emit('ready');
  });
};

module.exports = exports = AmqpProvider;

function validateOptions(opts) {
  assert(opts.queueName, '`queueName` property is not set.');
  assert(opts.exchangeName, '`exchangeName` property is not set.');
}