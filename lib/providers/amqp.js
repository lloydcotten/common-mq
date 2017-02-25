'use strict';

var assert = require('assert');
var async = require('async');
var amqp = require('amqp');

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
  var self = this;
  var publishFunc = function() {
    var messageStr = typeof message !== 'string' ?
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
  var self = this;
  var subscribeFunc = function() {
    self._queue.subscribe(function(messageStr) {
      var isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;
      var message;

      // first try to detect if it is a base64 string
      // if so convert to Buffer
      if (isBase64.test(messageStr)) {
        message = new Buffer(messageStr, 'base64');
      } else {
        // next try to decode as json
        // but if it fails just leave as original string
        try {
          message = JSON.parse(messageStr);
        } catch (e) {
          message = messageStr;
        }
      }

      self.emitter.emit('message', message);
    });
  };

  if (self.emitter.isReady) {
    process.nextTick(subscribeFunc);
  } else {
    self.emitter.once('ready', subscribeFunc);
  }
};

AmqpProvider.prototype.unsubscribe = function() {
  var self = this;
  process.nextTick(function() {
    self._isClosed = true;
    self._queue.destroy();
    self._exchange.destroy();
    self._connection.end();
  });
};

AmqpProvider.prototype._initProvider = function() {
  var self = this;
  async.series([

    function(cb) {
      var conn = self._connection = amqp.createConnection(self.options);
      conn.on('ready', cb);
    },

    function(cb) {
      self._connection.exchange(self.options.exchangeName, function(exchange) {
        self._exchange = exchange;
        cb();
      });
    },

    function(cb) {
      self._connection.queue(self._q, function(queue) {
        self._queue = queue;
        cb();
      });
    },

    function(cb) {
      self._queue.bind(self.options.exchangeName, '#');
      cb();
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