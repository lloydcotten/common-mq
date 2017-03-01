'use strict';

const assert = require('assert');
const async = require('async');
const AWS = require('aws-sdk');

class SqsProvider {

  constructor(emitter, options) {
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

    setImmediate(() => this._initProvider());
  }

  publish(message) {
    const messageStr = typeof message !== 'string' ?
                       message instanceof Buffer ?
                       message.toString('base64') :
                       JSON.stringify(message) :
                       message;

    if (this.emitter.isReady) {
      setImmediate(() => this._sendMessage(messageStr));
    } else {
      this.emitter.once('ready', () => this._sendMessage(messageStr));
    }
  }

  subscribe() {
    if (this.emitter.isReady) {
      setImmediate(() => this._startPolling());
    } else {
      this.emitter.once('ready', () => this._startPolling());
    }
  }

  ack(messageId) {
    if (!this.options.deleteAfterReceive) {
      setImmediate(() => this._deleteMessage(messageId));
    }
  }

  unsubscribe() {
    setImmediate(() => this._isClosed = true);
  }

  _deleteMessage(receiptHandle) {
    const param = {
      QueueUrl: this._queueUrl,
      ReceiptHandle: receiptHandle
    };

    this._sqs.deleteMessage(param, (err) => {
      if (err) {
        this.emitter.emit('error', err);
      }
    });
  }

  _initProvider() {
    const param = { QueueName: this._q };

    this._sqs.getQueueUrl(param, (err, data) => {
      if (err) {
        return this._createQueue(err);
      }

      this._setQueueReady(data.QueueUrl);
    });
  }

  _createQueue(getQueueUrlError) {
    const param = {
      QueueName: this._q,
      Attributes: this.options.attributes
    };

    this._sqs.createQueue(param, (err, data) => {
      if (err) {
        this.emitter.emit('error', getQueueUrlError);
        this.emitter.emit('error', err);
        return;
      }

      this._setQueueReady(data.QueueUrl);
    });
  }

  _setQueueReady(queueUrl) {
    this._queueUrl = queueUrl;

    this.emitter.isReady = true;
    this.emitter.emit('ready');
  }

  _poll(done) {
    const param = {
      QueueUrl: this._queueUrl,
      MaxNumberOfMessages: this.options.maxReceiveCount || 1
    };

    if (typeof this.options.visibilityTimeout !== 'undefined') {
      param.VisibilityTimeout = this.options.visibilityTimeout;
      param.WaitTimeSeconds = this.options.waitTimeSeconds;
    }

    if (typeof this.options.waitTimeSeconds !== 'undefined') {
      param.WaitTimeSeconds = this.options.waitTimeSeconds;
    }

    this._sqs.receiveMessage(param, (err, data) => {
      if (err) {
        this.emitter.emit('error', err);
        return void done();
      }

      (data.Messages || []).forEach((msg) => this._handleMessage(msg));
      done();
    });
  }

  _handleMessage(msg) {
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

    this.emitter.emit('message', decoded, msg.ReceiptHandle);
    if (!this._isClosed && this.options.deleteAfterReceive) {
      this._deleteMessage(msg.ReceiptHandle);
    }
  }

  _sendMessage(message) {
    const param = {
      QueueUrl: this._queueUrl,
      MessageBody: message
    };

    this._sqs.sendMessage(param, (err) => {
      if (err) {
        this.emitter.emit('error', err);
      }
    });
  }

  _startPolling() {
    this._isClosed = false;

    async.until(

      () => this._isClosed,

      (cb) => {
        this._poll(() => setTimeout(cb, (this.options.delayBetweenPolls || 0) * 1000));
      },

      noop => noop // noop - can be removed when async is upgraded

    );
  }

}

module.exports = SqsProvider;

function validateOptions(opts) {
  assert(opts.queueName, '`queueName` property is not set.');
}
