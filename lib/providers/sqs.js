'use strict';

const assert = require('assert');
const async = require('async');
const AWS = require('aws-sdk');

function SqsProvider(emitter, options) {
  assert(emitter, '`emitter` argument is not set.');
  assert(options, '`options` argument is not set.')
  validateOptions(options);

  this.options = options;
  this.emitter = emitter;

  if (typeof options.awsConfig === 'string') {
    AWS.config.loadFromPath(options.awsConfig);
  } else if (options.awsConfig) {
    AWS.config.update(options.awsConfig);
  }

  this._q = options.queueName;
  this._sqs = new AWS.SQS();

  process.nextTick(this._initProvider.bind(this));
}

SqsProvider.prototype.publish = function(message) {
  const self = this;
  const publishFunc = function() {
    const messageStr = typeof message !== 'string' ?
                     message instanceof Buffer ?
                     message.toString('base64') :
                     JSON.stringify(message) :
                     message;
    self._sendMessage(messageStr);
  };

  if (self.emitter.isReady) {
    process.nextTick(publishFunc);
  } else {
    self.emitter.once('ready', publishFunc);
  }
};

SqsProvider.prototype.subscribe = function() {
  if (this.emitter.isReady) {
    process.nextTick(this._startPolling.bind(this));
  } else {
    this.emitter.once('ready', this._startPolling.bind(this));
  }
};

SqsProvider.prototype.ack = function(messageId) {
  if (!this.options.deleteAfterReceive) {
    process.nextTick(this._deleteMessage.bind(this, messageId));
  }
};

SqsProvider.prototype.unsubscribe = function() {
  const self = this;
  process.nextTick(function() {
    self._isClosed = true;
  });
};

SqsProvider.prototype._deleteMessage = function(receiptHandle) {
  const self = this;

  const param = {
    QueueUrl: self._queueUrl,
    ReceiptHandle: receiptHandle
  };

  self._sqs.deleteMessage(param, function(err) {
    if (err) {
      self.emitter.emit('error', err);
    }
  });
};

SqsProvider.prototype._initProvider = function() {
  const self = this;
  const param = { QueueName: self._q };

  self._sqs.getQueueUrl(param, function(err, data) {
    if (err) {
      return self._createQueue(err);
    }

    self._setQueueReady(data.QueueUrl);
  });
};

SqsProvider.prototype._createQueue = function(getQueueUrlError) {
  const self = this;

  const param = {
    QueueName: self._q,
    Attributes: self.options.attributes
  };

  self._sqs.createQueue(param, function(err, data) {
    if (err) {
      self.emitter.emit('error', getQueueUrlError);
      self.emitter.emit('error', err);
      return;
    }

    self._setQueueReady(data.QueueUrl);
  });
};

SqsProvider.prototype._setQueueReady = function(queueUrl) {
  this._queueUrl = queueUrl;

  this.emitter.isReady = true;
  this.emitter.emit('ready');
};

SqsProvider.prototype._poll = function(done) {
  const self = this;

  const param = {
    QueueUrl: self._queueUrl,
    MaxNumberOfMessages: self.options.maxReceiveCount || 1
  };

  if (typeof self.options.visibilityTimeout !== 'undefined') {
    param.VisibilityTimeout = self.options.visibilityTimeout;
    param.WaitTimeSeconds = self.options.waitTimeSeconds;
  }

  if (typeof self.options.waitTimeSeconds !== 'undefined') {
    param.WaitTimeSeconds = self.options.waitTimeSeconds;
  }

  self._sqs.receiveMessage(param, function(err, data) {
    if (err) {
      self.emitter.emit('error', err);
      return void done();
    }

    (data.Messages || []).forEach(function(msg) {
      const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;
      let decoded = msg.Body;

      // first try to detect if it is a base64 string
      // if so convert to Buffer
      if (isBase64.test(msg.Body)) {
        decoded = new Buffer(msg.Body, 'base64');
      } else {
        // next try to decode as json
        // but if it fails just leave as original string
        try {
          decoded = JSON.parse(msg.Body);
        } catch (e) {}
      }

      self.emitter.emit('message', decoded, msg.ReceiptHandle);
      if (!self._isClosed && self.options.deleteAfterReceive) {
        self._deleteMessage(msg.ReceiptHandle);
      }
    });

    done();

  });
};

SqsProvider.prototype._sendMessage = function(message) {
  const self = this;

  const param = {
    QueueUrl: self._queueUrl,
    MessageBody: message
  };

  self._sqs.sendMessage(param, function(err) {
    if (err) {
      self.emitter.emit('error', err);
    }
  });
};

SqsProvider.prototype._startPolling = function() {
  const self = this;
  self._isClosed = false;

  async.until(

    function() { return self._isClosed; },

    function(cb) {
      self._poll(function() {
        setTimeout(cb, (self.options.delayBetweenPolls || 0) * 1000);
      });
    },

    Function.prototype // noop - can be removed when async is upgraded

  );

};

module.exports = exports = SqsProvider;

function validateOptions(opts) {
  assert(opts.queueName, '`queueName` property is not set.');
}
