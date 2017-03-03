'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const tap = require('tap');

function ZmqSocket() { }
util.inherits(ZmqSocket, EventEmitter);

const zmqStub = { socket: sinon.stub() };

const ZmqProvider = proxyquire('../../../lib/providers/zmq', {
  zeromq: zmqStub,
});

const validOptions = {
  queueName: 'queue',
  hostname: 'test',
  port: 1234,
};

function createProvider(emitter, options) {
  return new ZmqProvider(emitter, options);
}

tap.beforeEach((done) => {
  zmqStub.socket = sinon.stub().returns(new ZmqSocket());

  ZmqSocket.prototype.bind = sinon.stub().callsArgWith(1, null);
  ZmqSocket.prototype.send = sinon.stub();
  ZmqSocket.prototype.connect = sinon.stub();
  ZmqSocket.prototype.disconnect = sinon.stub();
  ZmqSocket.prototype.subscribe = sinon.stub();
  ZmqSocket.prototype.unbind = sinon.stub();

  done();
});

tap.test('Throws an error if `emitter` arg is not set', (t) => {
  t.throws(() => createProvider(), { message: /emitter.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is not set', (t) => {
  t.throws(() => createProvider({}), { message: /options.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `queueName` property', (t) => {
  const providerOptions = {};

  t.throws(() => createProvider({}, providerOptions), { message: /queueName.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `hostname` property', (t) => {
  const providerOptions = { queueName: 'queue' };

  t.throws(() => createProvider({}, providerOptions), { message: /hostname.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `port` property', (t) => {
  const providerOptions = {
    queueName: 'queue',
    hostname: 'test',
  };

  t.throws(() => createProvider({}, providerOptions), { message: /port.+not.+set/i });
  t.end();
});

tap.test('Does not throw an error if args are valid', (t) => {
  sinon.stub(ZmqProvider.prototype, 'initProvider', noop => noop);
  t.doesNotThrow(() => createProvider({}, validOptions));
  setImmediate(() => {
    ZmqProvider.prototype.initProvider.restore();
    t.end();
  });
});

tap.test('Creates a sub socket', (t) => {
  const provider = createProvider(new EventEmitter(), validOptions);

  t.ok(zmqStub.socket.calledWith('sub'));
  t.ok(provider.subSock);
  t.end();
});

tap.test('Creates a pub socket', (t) => {
  const provider = createProvider(new EventEmitter(), validOptions);

  t.ok(zmqStub.socket.calledWith('pub'));
  t.ok(provider.pubSock);
  t.end();
});

tap.test('Binds to the pub socket', (t) => {
  const provider = createProvider(new EventEmitter(), validOptions);
  const expectedUrl = `tcp://${validOptions.hostname}:${validOptions.port}`;

  // Defer these tests since provider is initialized on next event loop
  setImmediate(() => {
    t.ok(provider.pubSock.bind.called);
    t.equal(provider.pubSock.bind.getCall(0).args[0], expectedUrl);
    t.equal(typeof provider.pubSock.bind.getCall(0).args[1], 'function');
    t.end();
  });
});

tap.test('Sets emmitter to ready once bound to pub socket', (t) => {
  const emitter = new EventEmitter();
  createProvider(emitter, validOptions);

  emitter.once('ready', () => {
    t.equal(emitter.isReady, true);
    t.end();
  });
});

tap.test('Emits an error on when error called back from pub socket bind', (t) => {
  const testError = new Error('test error');
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);
  provider.pubSock.bind = sinon.stub().callsArgWith(1, testError);

  emitter.once('error', (err) => {
    t.equal(err, testError);
    t.end();
  });
});

tap.test('Calls socket `send` function with string message', (t) => {
  const message = 'test message';
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);

  provider.publish(message);

  emitter.once('ready', () => {
    setImmediate(() => {
      const expectedMessage = [validOptions.queueName, message];
      t.ok(provider.pubSock.send.called);
      t.same(provider.pubSock.send.getCall(0).args[0], expectedMessage);
      t.end();
    });
  });
});

tap.test('Calls socket `send` function with JSON string', (t) => {
  const message = { test: 'obj', foo: 'bar' };
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);

  provider.publish(message);

  emitter.once('ready', () => {
    setImmediate(() => {
      const expectedMessage = [validOptions.queueName, JSON.stringify(message)];
      t.ok(provider.pubSock.send.called);
      t.same(provider.pubSock.send.getCall(0).args[0], expectedMessage);
      t.end();
    });
  });
});

tap.test('Calls socket `send` function with Buffer', (t) => {
  const message = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);

  provider.publish(message);

  emitter.once('ready', () => {
    setImmediate(() => {
      const expectedMessage = [validOptions.queueName, message.toString('base64')];
      t.ok(provider.pubSock.send.called);
      t.same(provider.pubSock.send.getCall(0).args[0], expectedMessage);
      t.end();
    });
  });
});

tap.test('Calls publish function when already... "ready"', (t) => {
  const message = 'test message';
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);

  emitter.once('ready', () => {
    provider.publish(message);
    setImmediate(() => {
      const expectedMessage = [validOptions.queueName, message];
      t.ok(provider.pubSock.send.called);
      t.same(provider.pubSock.send.getCall(0).args[0], expectedMessage);
      t.end();
    });
  });
});

tap.test('Emits an error when socket `send` throws an error', (t) => {
  const message = 'test message';
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);
  const testError = new Error('test error');
  provider.pubSock.send = sinon.stub().throws(testError);
  provider.publish(message);

  emitter.once('error', (err) => {
    t.equal(err, testError);
    t.end();
  });
});

tap.test('Subcribes to the queue', (t) => {
  const expectedUrl = `tcp://${validOptions.hostname}:${validOptions.port}`;
  const expectedTopic = validOptions.queueName;
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);
  provider.subscribe();

  emitter.once('ready', () => {
    setImmediate(() => {
      t.ok(provider.subSock.connect.calledWith(expectedUrl));
      t.ok(provider.subSock.subscribe.calledWith(expectedTopic));
      t.end();
    });
  });
});

tap.test('Emits a string message event after subscribing', (t) => {
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);
  const originalMessage = 'test message';
  provider.subscribe();

  emitter.on('message', (message) => {
    t.equal(message, originalMessage);
    t.end();
  });

  emitter.once('ready', () => {
    setImmediate(() => {
      provider.subSock.emit('message', validOptions.queueName, originalMessage);
    });
  });
});

tap.test('Emits an object message event after subscribing', (t) => {
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);
  const originalMessage = { test: 'test', foo: 'bar' };
  provider.subscribe();

  emitter.on('message', (message) => {
    t.same(message, originalMessage);
    t.end();
  });

  emitter.once('ready', () => {
    setImmediate(() => {
      provider.subSock.emit('message', validOptions.queueName, JSON.stringify(originalMessage));
    });
  });
});

tap.test('Emits a Buffer message event after subscribing', (t) => {
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);
  const originalMessage = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  provider.subscribe();

  emitter.on('message', (message) => {
    t.same(message, originalMessage);
    t.end();
  });

  emitter.once('ready', () => {
    setImmediate(() => {
      provider.subSock.emit('message', validOptions.queueName, originalMessage.toString('base64'));
    });
  });
});

tap.test('Subcribes to the queue when already... "ready"', (t) => {
  const expectedUrl = `tcp://${validOptions.hostname}:${validOptions.port}`;
  const expectedTopic = validOptions.queueName;
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);

  emitter.once('ready', () => {
    provider.subscribe();
    setImmediate(() => {
      t.ok(provider.subSock.connect.calledWith(expectedUrl));
      t.ok(provider.subSock.subscribe.calledWith(expectedTopic));
      t.end();
    });
  });
});

tap.test('Unsubscribing disconnects the sub socket', (t) => {
  const expectedUrl = `tcp://${validOptions.hostname}:${validOptions.port}`;
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);

  emitter.once('ready', () => {
    provider.subscribe();
    setImmediate(() => {
      provider.unsubscribe();
      setImmediate(() => {
        t.ok(provider.subSock.disconnect.called);
        t.equal(provider.subSock.disconnect.getCall(0).args[0], expectedUrl);
        t.ok(provider.isClosed);
        t.end();
      });
    });
  });
});

tap.test('Unsubscribing when queue provider is "closed" is ignored', (t) => {
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);

  emitter.once('ready', () => {
    provider.subscribe();
    setImmediate(() => {
      provider.unsubscribe();
      provider.unsubscribe();
      setImmediate(() => {
        t.ok(provider.subSock.disconnect.calledOnce);
        t.end();
      });
    });
  });
});

tap.test('The `close` method unbinds the pub socket', (t) => {
  const expectedUrl = `tcp://${validOptions.hostname}:${validOptions.port}`;
  const emitter = new EventEmitter();
  const provider = createProvider(emitter, validOptions);

  emitter.once('ready', () => {
    provider.close();
    t.ok(provider.pubSock.unbind.called);
    t.equal(provider.pubSock.unbind.getCall(0).args[0], expectedUrl);
    t.end();
  });
});
