'use strict';

const EventEmitter = require('events').EventEmitter;
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const tap = require('tap');

const AmqpStub = sinon.stub();
const SqsStub = sinon.stub();
const ZmqStub = sinon.stub();

const Queue = proxyquire('../../lib/queue', {
  './providers/amqp': AmqpStub,
  './providers/sqs': SqsStub,
  './providers/zmq': ZmqStub
});

tap.beforeEach((done) => {
  AmqpStub.reset();
  SqsStub.reset();
  ZmqStub.reset();
  done();
});

tap.test('Instantiates a new AMQP Provider', (t) => {
  const options = { provider: 'amqp' };
  const q = new Queue(options);

  t.ok(AmqpStub.calledWithNew(), 'AmqpProvider did not instantiate.')
  t.ok(AmqpStub.calledWith(q, options), 'AmqpProvider not called with proper args.');
  t.type(q._provider, AmqpStub);
  t.end();
});

tap.test('Instantiates a new SQS Provider', (t) => {
  const options = { provider: 'sqs' };
  const q = new Queue(options);

  t.ok(SqsStub.calledWithNew(), 'SqsProvider did not instantiate.')
  t.ok(SqsStub.calledWith(q, options), 'SqsProvider not called with proper args.');
  t.type(q._provider, SqsStub);
  t.end();
});

tap.test('Instantiates a new ZeroMQ Provider', (t) => {
  const options = { provider: 'zmq' };
  const q = new Queue(options);

  t.ok(ZmqStub.calledWithNew(), 'ZmqProvider did not instantiate.')
  t.ok(ZmqStub.calledWith(q, options), 'ZmqProvider not called with proper args.');
  t.type(q._provider, ZmqStub);
  t.end();
});

tap.test('Throws an error if provider not specified', (t) => {
  const expectedError = {
    message: /unable.+instantiate.+provider/i,
    provider: 'invalid',
    inner: {}
  };

  t.throws(() => new Queue({ provider: 'invalid' }), expectedError);
  t.end();
});

tap.test('Queue is an EventEmitter', (t) => {
  const q = new Queue({ provider: 'amqp' });
  t.type(q, EventEmitter);
  t.end();
});

tap.test('Queue is an EventEmitter', (t) => {
  const q = new Queue({ provider: 'amqp' });
  t.type(q, EventEmitter);
  t.end();
});

tap.test('Sets `isReady` property to `false`', (t) => {
  const q = new Queue({ provider: 'amqp' });
  t.equal(q.isReady, false);
  t.end();
});

tap.test('Calls provider `subscribe` method once when first listener is added', (t) => {
  const q = new Queue({ provider: 'amqp' });
  q._provider.subscribe = sinon.stub();
  q.on('message', noop => noop);
  q.on('message', noop => noop);

  // Defer this until next event loop, since `subscribe` should also be called on next tick
  setImmediate(() => {
    t.ok(q._provider.subscribe.called, 'Provider `subscribe` not called.');
    t.notOk(q._provider.subscribe.calledTwice, 'Provider `subscribe` called more than once.');
    t.end();
  });
});

tap.test('Calls provider `unsubscribe` method once when last listener is removed', (t) => {
  const q = new Queue({ provider: 'amqp' });
  q._provider.subscribe = sinon.stub();
  q._provider.unsubscribe = sinon.stub();
  q.on('message', noop => noop);
  q.on('message', noop => noop);

  // Defer this until next event loop, since `subscribe` should also be called on next tick
  setImmediate(() => {
    q.removeAllListeners('message');
    t.ok(q._provider.unsubscribe.called, 'Provider `unsubscribe` not called.');
    t.notOk(q._provider.unsubscribe.calledTwice, 'Provider `unsubscribe` called more than once.');
    t.end();
  });
});

tap.test('Does not unsubscribe from provider if "removeListener" event name is not "message"', (t) => {
  const q = new Queue({ provider: 'amqp' });
  q._provider.subscribe = sinon.stub();
  q._provider.unsubscribe = sinon.stub();
  q.on('message', noop => noop);
  q.on('foobar', noop => noop);

  // Defer this until next event loop, since `subscribe` should also be called on next tick
  setImmediate(() => {
    q.removeAllListeners('foobar');
    t.notOk(q._provider.unsubscribe.called, 'Provider `unsubscribe` should not have been called.');
    t.end();
  });
});

tap.test('Forwards message publishing to the provider', (t) => {
  const q = new Queue({ provider: 'amqp' });
  const expectedMessage = 'a value';
  q._provider.publish = sinon.stub();
  q.publish(expectedMessage);
  t.ok(q._provider.publish.called, 'Provider `publish` not called.');
  t.equal(q._provider.publish.getCall(0).args[0], expectedMessage);
  t.end();
});

tap.test('Forwards message ack to the provider', (t) => {
  const q = new Queue({ provider: 'amqp' });
  const expectedMessageId = 'message-id';
  q._provider.ack = sinon.stub();
  q.ack(expectedMessageId);
  t.ok(q._provider.ack.called, 'Provider `ack` not called.');
  t.equal(q._provider.ack.getCall(0).args[0], expectedMessageId);
  t.end();
});

tap.test('Forwards queue close to the provider', (t) => {
  const q = new Queue({ provider: 'amqp' });
  q._provider.close = sinon.stub();
  q.close();
  t.ok(q._provider.close.called, 'Provider `close` not called.');
  t.end();
});