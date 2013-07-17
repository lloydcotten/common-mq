var async = require('async');
var AWS = require('aws-sdk');

function SqsProvider(emitter, options) {
  this.options = options;
  this.emitter = emitter;
  
  if (typeof options.awsConfig === 'string') {
    AWS.config.loadFromPath(options.awsConfig);
  } else { 
    AWS.config.update(options.awsConfig);
  }
  
  this._q = options.hostname;
  this._sqs = new AWS.SQS();
  
  process.nextTick(this._initProvider.bind(this));
}

SqsProvider.prototype.publish = function(message) {
  var self = this;
  
  if (self._isReady) {
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

SqsProvider.prototype.subscribe = function() {
  var self = this;
  
  if (self._isReady) {
    process.nextTick(self._startPolling.bind(self));
  } else {
    self.emitter.once('ready', function() {
      process.nextTick(self._startPolling.bind(self));
    });
  }
};

SqsProvider.prototype.unsubscribe = function() {
  var self = this;
  process.nextTick(function() {
    self._isClosed = true;
  });
};

SqsProvider.prototype._deleteMessage = function(message) { 
  var self = this;
  
  var param = {
    QueueUrl: self._queueUrl,
    ReceiptHandle: message.ReceiptHandle
  };
  
  self._sqs.deleteMessage(param, function(err) {
    if (err) {
      self.emitter.emit('error', err);
    }
  });
};

SqsProvider.prototype._initProvider = function() {
  var self = this;
  
  var param = {
    QueueName: self._q, 
    Attributes: self.options.attributes
  };
  
  self._sqs.createQueue(param, function(err, data) {
    if (err) {
      self.emitter.emit('error', err);
      return;
    }
    
    self._queueUrl = data.QueueUrl;
    self._isReady = true;
    
    self.emitter.emit('ready');
    
  });
};

SqsProvider.prototype._poll = function(done) {
  var self = this;
  
  var param = { QueueUrl: self._queueUrl };
  if (typeof self.options.visibilityTimeout !== 'undefined') {
    param.VisibilityTimeout = self.options.visibilityTimeout;
    WaitTimeSeconds: self.options.waitTimeSeconds
  }
  
  if (typeof self.options.waitTimeSeconds !== 'undefined') {
    param.WaitTimeSeconds = self.options.waitTimeSeconds;
  }
  
  self._sqs.receiveMessage(param, function(err, data) {
    if (err) {
      self.emitter.emit('error', err);
      return;
    }
  
    data.Messages.forEach(function(msg) {
      self.emitter.emit('message', msg.Body);
      if (!self._isClosed) {
        self._deleteMessage(msg);
      }
      
    });
    
    done();
      
  });
};

SqsProvider.prototype._sendMessage = function(message) {  
  var self = this;
  
  var param = { 
    QueueUrl: self._queueUrl,
    MessageBody: message
  };
  
  self._sqs.sendMessage(param, function(err, data) {
    if (err) {
      self.emitter.emit('error', err);
    }      
  });
};

SqsProvider.prototype._startPolling = function() {
  var self = this;
  self._isClosed = false;
  
  async.until(
  
    function() { return self._isClosed; },
    
    function(cb) {
      self._poll(function() {
        setTimeout(cb, (self.options.delayBetweenPolls || 0) * 1000);
      });
    },
    
    function(err) {
      if (err) {
        self.emitter.emit('error', err);
      }
    }
  
  );
  
};

module.exports = exports = SqsProvider;