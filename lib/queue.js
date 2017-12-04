'use strict';

const EventEmitter = require('events').EventEmitter;
const amqp = require('./providers/amqp');
const sqs = require('./providers/sqs');
const zmq = require('./providers/zmq');

// assign providers into an object for dynamic referencing
const Providers = { amqp, sqs, zmq };

class Queue extends EventEmitter {

  constructor(options) {
    super();

    this.isReady = false;

    try {
      this.provider = new Providers[options.provider](this, options);
    } catch (e) {
      const err = new Error('Unable to instantiate provider.');
      err.provider = options.provider;
      err.inner = e;

      throw err;
    }

    this.setupSubscriptionHandling();
  }

  publish(message, options) {
    this.provider.publish(message, options);
  }

  ack(messageId) {
    this.provider.ack(messageId);
  }

  close() {
    this.provider.close();
  }

  setupSubscriptionHandling() {
    this.on('newListener', (event) => {
      if (event !== 'message') return;

      // Defer calling `subscribe` until next event loop so that messages
      // are not received before event handler is added.
      // `listeners(event).length will be 0 when the first listener is added
      // because 'newListener' event is called prior to the listener being added
      if (this.listeners(event).length === 0) {
        setImmediate(() => this.provider.subscribe());
      }
    });

    this.on('removeListener', (event) => {
      if (event !== 'message') return;

      if (this.listeners(event).length === 0) {
        this.provider.unsubscribe();
      }
    });
  }

}

module.exports = Queue;
