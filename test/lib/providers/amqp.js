'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var proxyquire = require('proxyquire').noCallThru();
var sinon = require('sinon');
var tap = require('tap');

var AmqpQueueStub = function() { };
var AmqpExchangeStub = function() { };
var AmqpConnectionStub = function() { };
util.inherits(AmqpConnectionStub, EventEmitter);

var amqpStub = {
  createConnection: sinon.stub()
};

var AmqpProvider = proxyquire('../../../lib/providers/amqp', {
  'amqp': amqpStub
});

var SubscribePromise = function() { };
var fakeConsumerTag = 'test123';


tap.beforeEach(function(done) {
  amqpStub.createConnection = sinon.stub().returns(new AmqpConnectionStub());

  SubscribePromise.prototype.addCallback = sinon.stub().callsArgWith(0, {
    consumerTag: fakeConsumerTag
  });

  AmqpConnectionStub.prototype.disconnect = sinon.stub();
  AmqpConnectionStub.prototype.exchange = sinon.stub().callsArgWith(2, new AmqpExchangeStub());
  AmqpConnectionStub.prototype.queue = sinon.stub().callsArgWith(2, new AmqpQueueStub());

  AmqpExchangeStub.prototype.destroy = sinon.stub();
  AmqpExchangeStub.prototype.publish = sinon.stub();

  AmqpQueueStub.prototype.bind = sinon.stub().callsArg(2);
  AmqpQueueStub.prototype.destroy = sinon.stub();
  AmqpQueueStub.prototype.subscribe = sinon.stub().returns(new SubscribePromise());
  AmqpQueueStub.prototype.unbind = sinon.stub();
  AmqpQueueStub.prototype.unsubscribe = sinon.stub();

  done();
});

tap.test('Throws an error if `emitter` arg is not set', function(t) {
  t.throws(function() { new AmqpProvider(); }, { message: /emitter.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is not set', function(t) {
  t.throws(function() { new AmqpProvider({}); }, { message: /options.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `queueName` property', function(t) {
  var providerOptions = {};

  t.throws(function() { new AmqpProvider({}, providerOptions); }, { message: /queueName.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `exchangeName` property', function(t) {
  var providerOptions = {
    queueName: 'queue'
  };

  t.throws(function() { new AmqpProvider({}, providerOptions); }, { message: /exchangeName.+not.+set/i });
  t.end();
});

tap.test('Does not throw an error if args are valid', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };

  sinon.stub(AmqpProvider.prototype, '_initProvider', function() { });
  t.doesNotThrow(function() { new AmqpProvider({}, providerOptions); });
  AmqpProvider.prototype._initProvider.restore();
  t.end();
});

tap.test('Creates a connection with provider options', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var provider = new AmqpProvider(new EventEmitter(), providerOptions);

  // Defer these tests since provider is initialized on next event loop
  setTimeout(function() {
    t.ok(amqpStub.createConnection.called);
    t.equal(amqpStub.createConnection.getCall(0).args[0], providerOptions);
    t.end();
  }, 10);
});

tap.test('Creates an exchange using specified name', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var provider = new AmqpProvider(new EventEmitter(), providerOptions);

  // Defer these tests since provider is initialized on next event loop
  setTimeout(function() {
    t.ok(provider._connection);
    provider._connection.emit('ready');
    setTimeout(function() {
      t.ok(provider._connection.exchange.called);
      t.equal(provider._connection.exchange.getCall(0).args[0], providerOptions.exchangeName);
      t.equal(typeof provider._connection.exchange.getCall(0).args[2], 'function');
      t.end();
    }, 10);
  }, 10);
});

tap.test('Creates a queue using specified name', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var provider = new AmqpProvider(new EventEmitter(), providerOptions);

  // Defer these tests since provider is initialized on next event loop
  setTimeout(function() {
    provider._connection.emit('ready');
    setTimeout(function() {
      t.equal(provider._connection.queue.getCall(0).args[0], providerOptions.queueName);
      t.equal(typeof provider._connection.queue.getCall(0).args[2], 'function');
      t.end();
    }, 10);
  }, 10);
});

tap.test('Binds the queue to the exchange', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var provider = new AmqpProvider(new EventEmitter(), providerOptions);

  // Defer these tests since provider is initialized on next event loop
  setTimeout(function() {
    provider._connection.emit('ready');
    setTimeout(function() {
      t.ok(provider._queue);
      t.equal(provider._queue.bind.getCall(0).args[0], providerOptions.exchangeName);
      t.equal(provider._queue.bind.getCall(0).args[1], '#');
      t.end();
    }, 10);
  }, 10);
});

tap.test('Sets emmitter to ready', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    t.equal(emitter.isReady, true);
    t.end();
  });
});

tap.test('Calls publish function with string message', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var message = 'test message';
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);

  provider.publish(message);

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      t.ok(provider._exchange.publish.called);
      t.equal(provider._exchange.publish.getCall(0).args[0], providerOptions.queueName);
      t.equal(provider._exchange.publish.getCall(0).args[1], message);
      t.end();
    }, 20);
  });
});

tap.test('Calls publish function with JSON string', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var message = { test: 'obj', foo: 'bar' };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);

  provider.publish(message);

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      t.ok(provider._exchange.publish.called);
      t.equal(provider._exchange.publish.getCall(0).args[0], providerOptions.queueName);
      t.equal(provider._exchange.publish.getCall(0).args[1], JSON.stringify(message));
      t.end();
    }, 20);
  });
});

tap.test('Calls publish function with Buffer', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var message = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);

  provider.publish(message);

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      t.ok(provider._exchange.publish.called);
      t.equal(provider._exchange.publish.getCall(0).args[0], providerOptions.queueName);
      t.equal(provider._exchange.publish.getCall(0).args[1], message.toString('base64'));
      t.end();
    }, 20);
  });
});

tap.test('Calls publish function when already... "ready"', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var message = 'test message';
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    provider.publish(message);
    setTimeout(function() {
      t.ok(provider._exchange.publish.called);
      t.equal(provider._exchange.publish.getCall(0).args[0], providerOptions.queueName);
      t.equal(provider._exchange.publish.getCall(0).args[1], message);
      t.end();
    }, 10);
  });
});

tap.test('Subscribes to the queue with a listener', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);
  provider.subscribe();

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      t.ok(provider._queue.subscribe.called);
      t.equal(provider._ctag, fakeConsumerTag);
      t.equal(typeof provider._queue.subscribe.getCall(0).args[0], 'function');
      t.end();
    }, 20);
  });
});

tap.test('Emits a string message event after subscribing', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);
  provider.subscribe();

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      var handler = provider._queue.subscribe.getCall(0).args[0];
      var originalMessage = 'test message';
      emitter.on('message', function(message) {
        t.equal(message, originalMessage);
        t.end();
      });

      handler({ data: originalMessage });
    }, 20);
  });
});

tap.test('Emits an object message event after subscribing', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);
  provider.subscribe();

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      var handler = provider._queue.subscribe.getCall(0).args[0];
      var originalMessage = { test: 'test', foo: 'bar' };
      emitter.on('message', function(message) {
        t.same(message, originalMessage);
        t.end();
      });

      handler({ data: JSON.stringify(originalMessage) });
    }, 20);
  });
});

tap.test('Emits a Buffer message event after subscribing', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);
  provider.subscribe();

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      var handler = provider._queue.subscribe.getCall(0).args[0];
      var originalMessage = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      emitter.on('message', function(message) {
        t.same(message, originalMessage);
        t.end();
      });

      handler({ data: originalMessage.toString('base64') });
    }, 20);
  });
});

tap.test('Subcribes to the queue with a listener when already... "ready"', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    provider.subscribe();
    setTimeout(function() {
      t.ok(provider._queue.subscribe.called);
      t.equal(typeof provider._queue.subscribe.getCall(0).args[0], 'function');
      t.end();
    }, 20);
  });
});

tap.test('Unsubscribes from the queue the queue', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);
  provider.subscribe();

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      provider.unsubscribe();
      setTimeout(function() {
        t.ok(provider._queue.unsubscribe.called);
        t.equal(provider._queue.unsubscribe.firstCall.args[0], fakeConsumerTag);
        t.end();
      }, 10);
    }, 10);
  });
});

tap.test('Unbinds from the queue on close', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      provider.close();
      t.ok(provider._queue.unbind.called);
      t.equal(provider._queue.unbind.firstCall.args[0], provider._exchange);
      t.equal(provider._queue.unbind.firstCall.args[1], '#');
      t.end();
    }, 10);
  });
});

tap.test('Destroys the exchange and queue on close', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      provider.close();
      t.ok(provider._queue.destroy.called);
      t.ok(provider._exchange.destroy.called);
      t.end();
    }, 10);
  });
});

tap.test('Disconnects the connection on close', function(t) {
  var providerOptions = {
    queueName: 'queue',
    exchangeName: 'exchange'
  };
  var emitter = new EventEmitter();
  var provider = new AmqpProvider(emitter, providerOptions);

  // Defer this emit since provider is initialized on next event loop
  setTimeout(function() { provider._connection.emit('ready'); }, 10);

  emitter.once('ready', function() {
    setTimeout(function() {
      provider.close();
      t.ok(provider._connection.disconnect.called);
      t.end();
    }, 10);
  });
});