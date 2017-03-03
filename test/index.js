'use strict';

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const tap = require('tap');

const QueueStub = sinon.stub();

const mq = proxyquire('../', {
  './lib/queue': QueueStub,
});

tap.beforeEach((done) => {
  QueueStub.reset();
  done();
});

tap.test('Main export has function called `connect`', (t) => {
  t.type(mq.connect, 'function');
  t.end();
});

tap.test('Throw an error if no args used', (t) => {
  t.throws(() => mq.connect(), { message: /url.+not.+set/i });
  t.end();
});

tap.test('Throw an error if url not a string or object', (t) => {
  t.throws(() => mq.connect(1), { message: /url.+must.+string.+options.+object/i });
  t.end();
});

tap.test('Throw an error if url string is not in expected format', (t) => {
  t.throws(() => mq.connect('invalid url string'), { message: /invalid.+url/i });
  t.end();
});

tap.test('Throw an error if options object does not contain a `provider` property', (t) => {
  t.throws(() => mq.connect({}), { message: /provider.+missing/i });
  t.end();
});

tap.test('Throw an error if options object does not contain a `queueName` property', (t) => {
  t.throws(() => mq.connect({ provider: 'test' }), { message: /queueName.+missing/i });
  t.end();
});

tap.test('Instantiates a new queue', (t) => {
  mq.connect('test://queue');
  const expectedOptions = {
    provider: 'test',
    queueName: 'queue',
  };

  t.ok(QueueStub.calledWithNew(), 'Queue did not instantiate.');
  t.match(QueueStub.getCall(0).args[0], expectedOptions);

  QueueStub.reset();
  t.end();
});

tap.test('Instantiates a new queue when using options object', (t) => {
  const options = {
    provider: 'test',
    queueName: 'queue',
  };
  mq.connect(options);

  t.ok(QueueStub.calledWithNew(), 'Queue did not instantiate.');
  t.equal(QueueStub.getCall(0).args[0], options);
  t.end();
});

tap.test('Instantiates a new queue when string URL and options object', (t) => {
  mq.connect('test://queue', { customProperty: 'test' });
  const expectedOptions = {
    provider: 'test',
    queueName: 'queue',
    customProperty: 'test',
  };

  t.ok(QueueStub.calledWithNew(), 'Queue did not instantiate.');
  t.match(QueueStub.getCall(0).args[0], expectedOptions);
  t.end();
});
