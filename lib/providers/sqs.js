'use strict';

const assert = require('assert');
const until = require('async/until');
const AWS = require('aws-sdk');

function validateOptions(opts) {
  assert(opts.queueName, '`queueName` property is not set.');
}

class SqsProvider {

  constructor(emitter, options) {
    assert(emitter, '`emitter` argument is not set.');
    assert(options, '`options` argument is not set.');
    validateOptions(options);

    this.options = options;
    this.emitter = emitter;

    if (typeof options.awsConfig === 'string') {
      AWS.config.loadFromPath(options.awsConfig);
    } else if (options.awsConfig) {
      AWS.config.update(options.awsConfig);
    }

    this.sqs = new AWS.SQS();

    setImmediate(() => this.initProvider());
  }

  publish(message, paramArg) {
    let messageStr = message;
    if (message instanceof Buffer) {
      messageStr = message.toString('base64');
    } else if (typeof message !== 'string') {
      messageStr = JSON.stringify(message);
    }

    if (this.emitter.isReady) {
      setImmediate(() => this.sendMessage(messageStr, paramArg));
    } else {
      this.emitter.once('ready', () => this.sendMessage(messageStr, paramArg));
    }
  }

  subscribe() {
    if (this.emitter.isReady) {
      setImmediate(() => this.startPolling());
    } else {
      this.emitter.once('ready', () => this.startPolling());
    }
  }

  ack(messageId) {
    if (!this.options.deleteAfterReceive) {
      setImmediate(() => this.deleteMessage(messageId));
    }
  }

  unsubscribe() {
    setImmediate(() => {
      this.isClosed = true;
    });
  }

  deleteMessage(receiptHandle) {
    const param = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    };

    this.sqs.deleteMessage(param, (err) => {
      if (err) {
        this.emitter.emit('error', err);
      }
    });
  }

  initProvider() {
    const param = { QueueName: this.options.queueName };

    this.sqs.getQueueUrl(param, (err, data) => {
      if (err) {
        this.createQueue(err);
        return;
      }

      this.setQueueReady(data.QueueUrl);
    });
  }

  createQueue(getQueueUrlError) {
    const param = {
      QueueName: this.options.queueName,
      Attributes: this.options.attributes,
    };

    this.sqs.createQueue(param, (err, data) => {
      if (err) {
        this.emitter.emit('error', getQueueUrlError);
        this.emitter.emit('error', err);
        return;
      }

      this.setQueueReady(data.QueueUrl);
    });
  }

  setQueueReady(queueUrl) {
    this.queueUrl = queueUrl;

    this.emitter.isReady = true;
    this.emitter.emit('ready');
  }

  poll(done) {
    const param = {
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: this.options.maxReceiveCount || 1,
    };

    if (typeof this.options.visibilityTimeout !== 'undefined') {
      param.VisibilityTimeout = this.options.visibilityTimeout;
      param.WaitTimeSeconds = this.options.waitTimeSeconds;
    }

    if (typeof this.options.waitTimeSeconds !== 'undefined') {
      param.WaitTimeSeconds = this.options.waitTimeSeconds;
    }

    this.sqs.receiveMessage(param, (err, data) => {
      if (err) {
        this.emitter.emit('error', err);
        done();
        return;
      }

      (data.Messages || []).forEach(msg => this.handleMessage(msg));
      done();
    });
  }

  handleMessage(msg) {
    const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;
    let decoded = msg.Body;

    // first try to detect if it is a base64 string
    // if so convert to Buffer
    if (isBase64.test(msg.Body)) {
      decoded = new Buffer(msg.Body, 'base64');
    } else {
      // next try to decode as json
      try {
        decoded = JSON.parse(msg.Body);
      } catch (e) {
        // if it fails just leave as original string
      }
    }

    this.emitter.emit('message', decoded, msg.ReceiptHandle);
    if (!this.isClosed && this.options.deleteAfterReceive) {
      this.deleteMessage(msg.ReceiptHandle);
    }
  }

  sendMessage(message, paramArg) {
    let param = {
      QueueUrl: this.queueUrl,
      MessageBody: message,
    };

    if (paramArg) {
      param = Object.assign({}, param, paramArg);
      // merge the argument list given to AWS if any is provided as an argument
    }

    this.sqs.sendMessage(param, (err) => {
      if (err) {
        this.emitter.emit('error', err);
      }
    });
  }

  startPolling() {
    this.isClosed = false;

    until(() => this.isClosed, (cb) => {
      this.poll(() => setTimeout(cb, (this.options.delayBetweenPolls || 0) * 1000));
    });
  }

}

module.exports = SqsProvider;
