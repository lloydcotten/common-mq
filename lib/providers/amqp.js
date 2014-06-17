var async = require('async');
var amqp = require('amqp');

function AmqpProvider(emitter, options) {
  this.options = options;
  this.emitter = emitter;
  
  this._q = options.queueName;
  
  process.nextTick(this._initProvider.bind(this));
}

AmqpProvider.prototype.publish = function(message) {  
  var self = this;

  message = typeof message !== 'string' ? 
    message instanceof Buffer ?
    message.toString('base64') :
    JSON.stringify(message) :
    message;
  
  async.until(

    function() { return self.emitter.isReady; },

    function(cb) { setTimeout(cb, 500); },

    function(err) {
      if (err) {
        self.emitter.emit('error', err);
        return;
      }

      self._exchange.publish(self._q, message);
    }

  );
};

AmqpProvider.prototype.subscribe = function() {
  var self = this;

  async.until(
    
    function() { return self.emitter.isReady; },

    function(cb) { setTimeout(cb, 500); },

    function(err) {
      if (err) {
        self.emitter.emit('error', err);
        return;
      }

      self._queue.subscribe(function(message) {
        var isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;

        // first try to detect if it is a base64 string
        // if so convert to Buffer
        if (isBase64.test(message)) {
          message = new Buffer(message, 'base64');
        } else {
          // next try to decode as json
          // but if it fails just leave as original string
          try {
            message = JSON.parse(message);
          } catch (e) {}
        }

        self.emitter.emit('message', message);
      });
    }

  );

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
  var conn = this._connection = amqp.createConnection(this.options);
  conn.on('ready', this._initExchange.bind(this));
};

AmqpProvider.prototype._initExchange = function() {
  var conn = this._connection;
  conn.exchange(this.options.exchangeName, this._initQueue.bind(this));
};

AmqpProvider.prototype._initQueue = function(exchange) {
  this._exchange = exchange;
  this._connection.queue(this._q, this._bindQueue.bind(this));
};

AmqpProvider.prototype._bindQueue = function(q) {
  this._queue = q;
  q.bind(this.options.exchangeName, '#');

  this.emitter.isReady = true;
  this.emitter.emit('ready');
};

module.exports = exports = AmqpProvider;
