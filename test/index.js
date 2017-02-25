'use strict';

var proxyquire = require('proxyquire');
var sinon = require('sinon');
var tap = require('tap');

var QueueStub = sinon.stub();

var mq = proxyquire('../', {
  './lib/queue': QueueStub
});

tap.beforeEach(function(done) {
  QueueStub.reset();
  done();
});

tap.test('Main export has function called `connect`', function(t) {
  t.type(mq.connect, 'function');
  t.end();
});

tap.test('Throw an error if no args used', function(t) {
  t.throws(function() { mq.connect(); }, { message: /url.+not.+set/i });
  t.end();
});

tap.test('Throw an error if url not a string or object', function(t) {
  t.throws(function() { mq.connect(1); }, { message: /url.+must.+string.+options.+object/i });
  t.end();
});

tap.test('Throw an error if url string is not in expected format', function(t) {
  t.throws(function() { mq.connect('invalid url string'); }, { message: /invalid.+url/i });
  t.end();
});

tap.test('Throw an error if options object does not contain a `provider` property', function(t) {
  t.throws(function() { mq.connect({}); }, { message: /provider.+missing/i });
  t.end();
});

tap.test('Throw an error if options object does not contain a `queueName` property', function(t) {
  t.throws(function() { mq.connect({ provider: 'test' }); }, { message: /queueName.+missing/i });
  t.end();
});

tap.test('Instantiates a new queue', function(t) {
  var queue = mq.connect('test://queue');
  var expectedOptions = {
    provider: 'test',
    queueName: 'queue'
  };

  t.ok(QueueStub.calledWithNew(), 'Queue did not instantiate.');
  t.match(QueueStub.getCall(0).args[0], expectedOptions);

  QueueStub.reset();
  t.end();
});

tap.test('Instantiates a new queue when using options object', function(t) {
  var options = {
    provider: 'test',
    queueName: 'queue'
  };
  var queue = mq.connect(options);

  t.ok(QueueStub.calledWithNew(), 'Queue did not instantiate.');
  t.equal(QueueStub.getCall(0).args[0], options);
  t.end();
});

tap.test('Instantiates a new queue when string URL and options object', function(t) {
  var queue = mq.connect('test://queue', { customProperty: 'test' });
  var expectedOptions = {
    provider: 'test',
    queueName: 'queue',
    customProperty: 'test'
  };

  t.ok(QueueStub.calledWithNew(), 'Queue did not instantiate.');
  t.match(QueueStub.getCall(0).args[0], expectedOptions);
  t.end();
});