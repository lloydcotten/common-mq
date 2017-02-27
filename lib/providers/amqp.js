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

  process.nextTick(this._initProvider.bind(this));
}

AmqpProvider.prototype.publish = function(message) {
  const self = this;
  const publishFunc = function() {
    const messageStr = typeof message !== 'string' ?
                     message instanceof Buffer ?
                     message.toString('base64') :
                     JSON.stringify(message) :
                     message;

    self._exchange.publish(self._q, messageStr);
  };

  if (self.emitter.isReady) {
    process.nextTick(publishFunc);
  } else {
    self.emitter.once('ready', publishFunc);
  }
};

AmqpProvider.prototype.subscribe = function() {
  const self = this;
  const subscribeFunc = function() {
    self._queue.subscribe(function(msg) {
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

      self.emitter.emit('message', message);
    }).addCallback(function(ok) {
      self._ctag = ok.consumerTag;
    });
  };

  if (self.emitter.isReady) {
    process.nextTick(subscribeFunc);
  } else {
    self.emitter.once('ready', subscribeFunc);
  }
};

AmqpProvider.prototype.unsubscribe = function() {
  const self = this;
  process.nextTick(function() {
    self._isClosed = true;
    self._queue.unsubscribe(self._ctag);
  });
};

AmqpProvider.prototype.close = function() {
  this._queue.unbind(this._exchange, '#');
  this._queue.destroy();
  this._exchange.destroy();
  this._connection.disconnect();
};

AmqpProvider.prototype._initProvider = function() {
  const self = this;
  async.series([

    function(cb) {
      const conn = self._connection = amqp.createConnection(self.options);
      conn.on('ready', cb);
    },

    function(cb) {
      self._connection.exchange(self.options.exchangeName, { type: 'topic' }, function(exchange) {
        self._exchange = exchange;
        cb();
      });
    },

    function(cb) {
      self._connection.queue(self._q, { closeChannelOnUnsubscribe: true }, function(queue) {
        self._queue = queue;
        cb();
      });
    },

    function(cb) {
      self._queue.bind(self.options.exchangeName, '#', cb);
    }

  ], function(err) {
    self.emitter.isReady = true;
    self.emitter.emit('ready');
  });
};

module.exports = exports = AmqpProvider;

function validateOptions(opts) {
  assert(opts.queueName, '`queueName` property is not set.');
  assert(opts.exchangeName, '`exchangeName` property is not set.');
}