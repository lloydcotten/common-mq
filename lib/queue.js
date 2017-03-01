'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');

// load providers into an object for dynamic referencing
const Providers = {
  amqp: require('./providers/amqp'),
  sqs: require('./providers/sqs'),
  zmq: require('./providers/zmq')
};

function Queue(options) {
  this.isReady = false;

  try {
    this._provider = new Providers[options.provider](this, options);
  } catch (e) {
    const err = new Error('Unable to instantiate provider.');
    err.provider = options.provider;
    err.inner = e;

    throw err;
  }

  this.on('newListener', (event) => {
    if (event !== 'message') return;

    // Defer calling `subscribe` until next event loop so that messages
    // are not received before event handler is added.
    // `listeners(event).length will be 0 when the first listener is added
    // because 'newListener' event is called prior to the listener being added
    if (this.listeners(event).length === 0) {
      setImmediate(() => this._provider.subscribe());
    }
  });

  this.on('removeListener', (event) => {
    if (event !== 'message') return;

    if (this.listeners(event).length === 0) {
      this._provider.unsubscribe();
    }
  });
}

util.inherits(Queue, EventEmitter);

Queue.prototype.publish = function(message) {
  this._provider.publish(message);
};

Queue.prototype.ack = function(messageId) {
  this._provider.ack(messageId);
};

Queue.prototype.close = function() {
  this._provider.close();
};

module.exports = exports = Queue;
