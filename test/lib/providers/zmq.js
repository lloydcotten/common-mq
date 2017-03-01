'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const tap = require('tap');

const ZmqSocket = function() { };
util.inherits(ZmqSocket, EventEmitter);

const zmqStub = { socket: sinon.stub() };

const ZmqProvider = proxyquire('../../../lib/providers/zmq', {
  'zeromq': zmqStub
});

const validOptions = {
  queueName: 'queue',
  hostname: 'test',
  port: 1234
};

tap.beforeEach(function(done) {
  zmqStub.socket = sinon.stub().returns(new ZmqSocket());

  ZmqSocket.prototype.bind = sinon.stub().callsArgWith(1, null);
  ZmqSocket.prototype.send = sinon.stub();
  ZmqSocket.prototype.connect = sinon.stub();
  ZmqSocket.prototype.disconnect = sinon.stub();
  ZmqSocket.prototype.subscribe = sinon.stub();
  ZmqSocket.prototype.unbind = sinon.stub();

  done();
});

tap.test('Throws an error if `emitter` arg is not set', function(t) {
  t.throws(function() { new ZmqProvider(); }, { message: /emitter.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is not set', function(t) {
  t.throws(function() { new ZmqProvider({}); }, { message: /options.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `queueName` property', function(t) {
  const providerOptions = {};

  t.throws(function() { new ZmqProvider({}, providerOptions); }, { message: /queueName.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `hostname` property', function(t) {
  const providerOptions = {
    queueName: 'queue'
  };

  t.throws(function() { new ZmqProvider({}, providerOptions); }, { message: /hostname.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `port` property', function(t) {
  const providerOptions = {
    queueName: 'queue',
    hostname: 'test'
  };

  t.throws(function() { new ZmqProvider({}, providerOptions); }, { message: /port.+not.+set/i });
  t.end();
});

tap.test('Does not throw an error if args are valid', function(t) {
  sinon.stub(ZmqProvider.prototype, '_initProvider', function() { });
  t.doesNotThrow(function() { new ZmqProvider({}, validOptions); });
  setImmediate(() => {
    ZmqProvider.prototype._initProvider.restore();
    t.end();
  });
});

tap.test('Creates a sub socket', function(t) {
  const provider = new ZmqProvider(new EventEmitter(), validOptions);

  t.ok(zmqStub.socket.calledWith('sub'));
  t.ok(provider._subSock);
  t.end();
});

tap.test('Creates a pub socket', function(t) {
  const provider = new ZmqProvider(new EventEmitter(), validOptions);

  t.ok(zmqStub.socket.calledWith('pub'));
  t.ok(provider._pubSock);
  t.end();
});

tap.test('Binds to the pub socket', function(t) {
  const provider = new ZmqProvider(new EventEmitter(), validOptions);
  const expectedUrl = 'tcp://' + validOptions.hostname + ':' + validOptions.port;

  // Defer these tests since provider is initialized on next event loop
  setImmediate(function() {
    t.ok(provider._pubSock.bind.called);
    t.equal(provider._pubSock.bind.getCall(0).args[0], expectedUrl);
    t.equal(typeof provider._pubSock.bind.getCall(0).args[1], 'function');
    t.end();
  });
});

tap.test('Sets emmitter to ready once bound to pub socket', function(t) {
  const emitter = new EventEmitter();
  new ZmqProvider(emitter, validOptions);

  emitter.once('ready', function() {
    t.equal(emitter.isReady, true);
    t.end();
  });
});

tap.test('Emits an error on when error called back from pub socket bind', function(t) {
  const testError = new Error('test error');
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);
  provider._pubSock.bind = sinon.stub().callsArgWith(1, testError);

  emitter.once('error', function(err) {
    t.equal(err, testError);
    t.end();
  });
});

tap.test('Calls socket `send` function with string message', function(t) {
  const message = 'test message';
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);

  provider.publish(message);

  emitter.once('ready', function() {
    setImmediate(function() {
      const expectedMessage = [validOptions.queueName, message];
      t.ok(provider._pubSock.send.called);
      t.same(provider._pubSock.send.getCall(0).args[0], expectedMessage);
      t.end();
    });
  });
});

tap.test('Calls socket `send` function with JSON string', function(t) {
  const message = { test: 'obj', foo: 'bar' };
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);

  provider.publish(message);

  emitter.once('ready', function() {
    setImmediate(function() {
      const expectedMessage = [validOptions.queueName, JSON.stringify(message)];
      t.ok(provider._pubSock.send.called);
      t.same(provider._pubSock.send.getCall(0).args[0], expectedMessage);
      t.end();
    });
  });
});

tap.test('Calls socket `send` function with Buffer', function(t) {
  const message = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);

  provider.publish(message);

  emitter.once('ready', function() {
    setImmediate(function() {
      const expectedMessage = [validOptions.queueName, message.toString('base64')];
      t.ok(provider._pubSock.send.called);
      t.same(provider._pubSock.send.getCall(0).args[0], expectedMessage);
      t.end();
    });
  });
});

tap.test('Calls publish function when already... "ready"', function(t) {
  const message = 'test message';
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);

  emitter.once('ready', function() {
    provider.publish(message);
    setImmediate(function() {
      const expectedMessage = [validOptions.queueName, message];
      t.ok(provider._pubSock.send.called);
      t.same(provider._pubSock.send.getCall(0).args[0], expectedMessage);
      t.end();
    });
  });
});

tap.test('Emits an error when socket `send` throws an error', function(t) {
  const message = 'test message';
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);
  const testError = new Error('test error');
  provider._pubSock.send = sinon.stub().throws(testError)
  provider.publish(message);

  emitter.once('error', function(err) {
    t.equal(err, testError);
    t.end();
  });
});

tap.test('Subcribes to the queue', function(t) {
  const expectedUrl = 'tcp://' + validOptions.hostname + ':' + validOptions.port;
  const expectedTopic = validOptions.queueName;
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);
  provider.subscribe();

  emitter.once('ready', function() {
    setImmediate(function() {
      t.ok(provider._subSock.connect.calledWith(expectedUrl));
      t.ok(provider._subSock.subscribe.calledWith(expectedTopic));
      t.end();
    });
  });
});

tap.test('Emits a string message event after subscribing', function(t) {
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);
  const originalMessage = 'test message';
  provider.subscribe();

  emitter.on('message', function(message) {
    t.equal(message, originalMessage);
    t.end();
  });

  emitter.once('ready', function() {
    setImmediate(function() {
      provider._subSock.emit('message', validOptions.queueName, originalMessage);
    });
  });
});

tap.test('Emits an object message event after subscribing', function(t) {
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);
  const originalMessage = { test: 'test', foo: 'bar' };
  provider.subscribe();

  emitter.on('message', function(message) {
    t.same(message, originalMessage);
    t.end();
  });

  emitter.once('ready', function() {
    setImmediate(function() {
      provider._subSock.emit('message', validOptions.queueName, JSON.stringify(originalMessage));
    });
  });
});

tap.test('Emits a Buffer message event after subscribing', function(t) {
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);
  const originalMessage = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  provider.subscribe();

  emitter.on('message', function(message) {
    t.same(message, originalMessage);
    t.end();
  });

  emitter.once('ready', function() {
    setImmediate(function() {
      provider._subSock.emit('message', validOptions.queueName, originalMessage.toString('base64'));
    });
  });
});

tap.test('Subcribes to the queue when already... "ready"', function(t) {
  const expectedUrl = 'tcp://' + validOptions.hostname + ':' + validOptions.port;
  const expectedTopic = validOptions.queueName;
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);

  emitter.once('ready', function() {
    provider.subscribe();
    setImmediate(function() {
      t.ok(provider._subSock.connect.calledWith(expectedUrl));
      t.ok(provider._subSock.subscribe.calledWith(expectedTopic));
      t.end();
    });
  });
});

tap.test('Unsubscribing disconnects the sub socket', function(t) {
  const expectedUrl = 'tcp://' + validOptions.hostname + ':' + validOptions.port;
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);

  emitter.once('ready', function() {
    provider.subscribe();
    setImmediate(function() {
      provider.unsubscribe();
      setImmediate(function() {
        t.ok(provider._subSock.disconnect.called);
        t.equal(provider._subSock.disconnect.getCall(0).args[0], expectedUrl);
        t.ok(provider._isClosed);
        t.end();
      });
    });
  });
});

tap.test('Unsubscribing when queue provider is "closed" is ignored', function(t) {
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);
  const removeCount = 0;

  emitter.once('ready', function() {
    provider.subscribe();
    setImmediate(function() {
      provider.unsubscribe();
      provider.unsubscribe();
      setImmediate(function() {
        t.ok(provider._subSock.disconnect.calledOnce);
        t.end();
      });
    });
  });
});

tap.test('The `close` method unbinds the pub socket', function(t) {
  const expectedUrl = 'tcp://' + validOptions.hostname + ':' + validOptions.port;
  const emitter = new EventEmitter();
  const provider = new ZmqProvider(emitter, validOptions);

  emitter.once('ready', function() {
    provider.close();
    t.ok(provider._pubSock.unbind.called);
    t.equal(provider._pubSock.unbind.getCall(0).args[0], expectedUrl);
    t.end();
  });
});