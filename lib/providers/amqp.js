'use strict';

const assert = require('assert');
const series = require('async/series');
const amqp = require('amqp');

function validateOptions(opts) {
  assert(opts.queueName, '`queueName` property is not set.');
  assert(opts.exchangeName, '`exchangeName` property is not set.');
}

class AmqpProvider {

  constructor(emitter, options) {
    assert(emitter, '`emitter` argument is not set.');
    assert(options, '`options` argument is not set.');
    validateOptions(options);

    this.options = options;
    this.emitter = emitter;

    setImmediate(() => this.initProvider());
  }

  publish(message) {
    let messageStr = message;
    if (message instanceof Buffer) {
      messageStr = message.toString('base64');
    } else if (typeof message !== 'string') {
      messageStr = JSON.stringify(message);
    }

    if (this.emitter.isReady) {
      setImmediate(() => this.exchange.publish(this.options.queueName, messageStr));
    } else {
      this.emitter.once('ready', () => this.exchange.publish(this.options.queueName, messageStr));
    }
  }

  subscribe() {
    if (this.emitter.isReady) {
      setImmediate(() => this.subscribeInternal());
    } else {
      this.emitter.once('ready', () => this.subscribeInternal());
    }
  }

  unsubscribe() {
    setImmediate(() => {
      this.isClosed = true;
      this.queue.unsubscribe(this.ctag);
    });
  }

  close() {
    this.queue.unbind(this.exchange, '#');
    this.queue.destroy();
    this.exchange.destroy();
    this.connection.disconnect();
  }

  initProvider() {
    series([

      (cb) => {
        this.connection = amqp.createConnection(this.options);
        this.connection.once('ready', cb);
      },

      (cb) => {
        this.connection.exchange(this.options.exchangeName, { type: 'topic' }, (exchange) => {
          this.exchange = exchange;
          cb();
        });
      },

      (cb) => {
        const connectOptions = { closeChannelOnUnsubscribe: true };
        this.connection.queue(this.options.queueName, connectOptions, (queue) => {
          this.queue = queue;
          cb();
        });
      },

      (cb) => {
        this.queue.bind(this.options.exchangeName, '#', cb);
      },

    ], () => {
      this.emitter.isReady = true;
      this.emitter.emit('ready');
    });
  }

  subscribeInternal() {
    this.queue.subscribe(msg => this.handleMessage(msg)).addCallback((ok) => {
      this.ctag = ok.consumerTag;
    });
  }

  handleMessage(msg) {
    const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;
    let message = msg.data.toString();

    // first try to detect if it is a base64 string
    // if so convert to Buffer
    if (isBase64.test(message)) {
      message = new Buffer(message, 'base64');
    } else {
      // next try to decode as json
      try {
        message = JSON.parse(message);
      } catch (e) {
        // if it fails just leave as original string
      }
    }

    this.emitter.emit('message', message);
  }

}

module.exports = AmqpProvider;
