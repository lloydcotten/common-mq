var async = require('async');
var zmq = require('zmq');

function ZeroMqProvider(emitter, options) {
  this.options = options;
  this.emitter = emitter;
  
  this._q = options.queueName;
  this._url = 'tcp://' + options.hostname + ':' + options.port;
  
  process.nextTick(this._initProvider.bind(this));
}

ZeroMqProvider.prototype.publish = function(message) {
  var self = this;
  
  message = typeof message !== 'string' ? 
    message instanceof Buffer ?
    message.toString('base64') :
    JSON.stringify(message) :
    message;
  
  if (self.emitter.isReady) {
    process.nextTick(function() {
      self._sendMessage(message);
    });
  } else {
    self.emitter.once('ready', function() {
      process.nextTick(function() {
        self._sendMessage(message)
      });
    });
  }
};

ZeroMqProvider.prototype.subscribe = function() {
  var self = this;
  
  if (self.emitter.isReady) {
    process.nextTick(self._connectSubscriber.bind(self));
  } else {
    self.emitter.once('ready', function() {
      process.nextTick(self._connectSubscriber.bind(self));
    });
  }
};

ZeroMqProvider.prototype.unsubscribe = function() {
  var self = this;
  process.nextTick(function() {
    if (!self._isClosed) {
      self._subSock.removeAllListeners('message');
      self._isClosed = true;
    }
  });
};

ZeroMqProvider.prototype.close = function() {
  var self = this;
  process.nextTick(function() {
    self.unsubscribe();
    self._pubSock.removeAllListeners();
  });
};

ZeroMqProvider.prototype._initProvider = function() {
  var self = this;
  self._pubSock = zmq.socket('pub');
  self._subSock = zmq.socket('sub');
  
  self._pubSock.bind(self._url, function(err) {
    if (err) {
      self.emitter.emit('error', err);
      return;
    }

    self.emitter.isReady = true;
    self.emitter.emit('ready');
  });

};

ZeroMqProvider.prototype._connectSubscriber = function() {
  var self = this;

  self._subSock.connect(self._url);
  self._subSock.subscribe(self._q);

  self._subSock.on('message', function(data) {
    data = data.toString('ascii').replace(new RegExp('^'+self._q+' '), '');
    var isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;

    // first try to detect if it is a base64 string
    // if so convert to Buffer
    if (isBase64.test(data)) {
      data = new Buffer(data, 'base64');
    } else {
      // next try to decode as json
      // but if it fails just leave as original string
      try {
        data = JSON.parse(data);
      } catch (e) {}
    }

    self.emitter.emit('message', data);           

  });
};

ZeroMqProvider.prototype._sendMessage = function(message) {  
  var self = this;

  try {
    self._pubSock.send(self._q + ' ' + message);
  } catch (err) {
    self.emitter.emit('error', err);
  }
};

module.exports = exports = ZeroMqProvider;
