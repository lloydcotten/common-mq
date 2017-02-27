'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var proxyquire = require('proxyquire').noCallThru();
var sinon = require('sinon');
var tap = require('tap');

var skip = false;

var AWSStub = {
  config: {},
  SQS: sinon.stub()
};

var SqsProvider = proxyquire('../../../lib/providers/sqs', {
  'aws-sdk': AWSStub
});

var fakeQueueUrl = 'https://fake.sqs.url/test';

tap.beforeEach(function(done) {
  AWSStub.SQS = sinon.stub();
  AWSStub.config = {
    loadFromPath: sinon.stub(),
    update: sinon.stub()
  };

  AWSStub.SQS.prototype.deleteMessage = sinon.stub().callsArgWith(1, null);
  AWSStub.SQS.prototype.receiveMessage = sinon.stub().callsArgWith(1, null, {});
  AWSStub.SQS.prototype.sendMessage = sinon.stub().callsArgWith(1, null);
  AWSStub.SQS.prototype.createQueue = sinon.stub().callsArgWith(1, null, {
    QueueUrl: fakeQueueUrl
  });
  AWSStub.SQS.prototype.getQueueUrl = sinon.stub().callsArgWith(1, null, {
    QueueUrl: fakeQueueUrl
  });

  done();
});

tap.test('Throws an error if `emitter` arg is not set', function(t) {
  t.throws(function() { new SqsProvider(); }, { message: /emitter.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is not set', function(t) {
  t.throws(function() { new SqsProvider({}); }, { message: /options.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `queueName` property', function(t) {
  var providerOptions = {};

  t.throws(function() { new SqsProvider({}, providerOptions); }, { message: /queueName.+not.+set/i });
  t.end();
});

tap.test('Does not throw an error if args are valid', function(t) {
  var providerOptions = { queueName: 'queue' };

  sinon.stub(SqsProvider.prototype, '_initProvider', function() { });
  t.doesNotThrow(function() { new SqsProvider({}, providerOptions); });
  SqsProvider.prototype._initProvider.restore();
  t.end();
});

tap.test('Loads AWS config from a file if `awsConfig` is a string', function(t) {
  var providerOptions =
  {
    queueName: 'queue',
    awsConfig: '/a/fake/aws/config'
  };

  sinon.stub(SqsProvider.prototype, '_initProvider', function() { });
  new SqsProvider({}, providerOptions);
  t.ok(AWSStub.config.loadFromPath.called, '`loadFromPath` method not called.');
  t.equal(AWSStub.config.loadFromPath.getCall(0).args[0], providerOptions.awsConfig);
  SqsProvider.prototype._initProvider.restore();
  t.end();
});

tap.test('Update AWS config from `awsConfig` object when set', function(t) {
  var providerOptions =
  {
    queueName: 'queue',
    awsConfig: { some: 'aws', config: true }
  };

  sinon.stub(SqsProvider.prototype, '_initProvider', function() { });
  new SqsProvider({}, providerOptions);
  t.ok(AWSStub.config.update.called, '`update` method not called.');
  t.equal(AWSStub.config.update.getCall(0).args[0], providerOptions.awsConfig);
  SqsProvider.prototype._initProvider.restore();
  t.end();
});

tap.test('Instantiates a new `AWS.SQS` object', function(t) {
  var providerOptions = { queueName: 'queue' };

  sinon.stub(SqsProvider.prototype, '_initProvider', function() { });
  var provider = new SqsProvider({}, providerOptions);
  t.ok(AWSStub.SQS.calledWithNew(), '`AWS.SQS` object was not instantiated.');
  t.type(provider._sqs, AWSStub.SQS);
  SqsProvider.prototype._initProvider.restore();
  t.end();
});

tap.test('Gets the QueueUrl on provider init', function(t) {
  var providerOptions = { queueName: 'queue' };
  var provider = new SqsProvider(new EventEmitter(), providerOptions);

  // Defer these tests since provider is initialized on next event loop
  setTimeout(function() {
    var expectedParams = { QueueName: providerOptions.queueName };
    t.ok(provider._sqs.getQueueUrl.called);
    t.same(provider._sqs.getQueueUrl.getCall(0).args[0], expectedParams);
    t.equal(typeof provider._sqs.getQueueUrl.getCall(0).args[1], 'function');
    t.end();
  }, 10);
});

tap.test('Creates the queue on provider init if error callback from SQS `getQueueUrl`', function(t) {
  var providerOptions = { queueName: 'queue' };
  var provider = new SqsProvider(new EventEmitter(), providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, new Error('getQueueUrl error'));

  // Defer these tests since provider is initialized on next event loop
  setTimeout(function() {
    var expectedParams = { QueueName: providerOptions.queueName };
    t.ok(provider._sqs.createQueue.called);
    t.match(provider._sqs.createQueue.getCall(0).args[0], expectedParams);
    t.equal(typeof provider._sqs.createQueue.getCall(0).args[1], 'function');
    t.end();
  }, 10);
});

tap.test('Creates or retrieves a QueueUrl on provider init (with attributes)', function(t) {
  var providerOptions = {
    queueName: 'queue',
    attributes: { custom: 'attributes' }
  };
  var provider = new SqsProvider(new EventEmitter(), providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, new Error('getQueueUrl error'));

  // Defer these tests since provider is initialized on next event loop
  setTimeout(function() {
    var expectedParams = {
      QueueName: providerOptions.queueName,
      Attributes: providerOptions.attributes
    };
    t.match(provider._sqs.createQueue.getCall(0).args[0], expectedParams);
    t.end();
  }, 10);
});

tap.test('Emits "ready" event on call back from `getQueueUrl`', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  emitter.on('ready', function() {
    t.ok(emitter.isReady);
    t.end();
  });
});

tap.test('Emits "ready" event on call back from `createQueue`', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, new Error('getQueueUrl error'));

  emitter.on('ready', function() {
    t.ok(emitter.isReady);
    t.end();
  });
});

tap.test('Sets `_queueUrl` property with value called back from `getQueueUrl`', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var queueData = { QueueUrl: 'https://fake.sqs.url/test' };
  var provider = new SqsProvider(emitter, providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, null, queueData);

  emitter.on('ready', function() {
    t.equal(provider._queueUrl, queueData.QueueUrl);
    t.end();
  });
});

tap.test('Sets `_queueUrl` property with value called back from `createQueue`', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var queueData = { QueueUrl: 'https://fake.sqs.url/test' };
  var provider = new SqsProvider(emitter, providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, new Error('getQueueUrl error'));
  provider._sqs.createQueue.callsArgWith(1, null, queueData);

  emitter.on('ready', function() {
    t.equal(provider._queueUrl, queueData.QueueUrl);
    t.end();
  });
});

tap.test('Emits "error" event twice if error called back from `createQueue`', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var getQueueUrlError = new Error('getQueueUrl error');
  var createError = new Error('createQueue error');
  var provider = new SqsProvider(emitter, providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, getQueueUrlError);
  provider._sqs.createQueue.callsArgWith(1, createError);

  emitter.once('error', function(err1) {
    emitter.once('error', function(err2) {
      t.equal(err1, getQueueUrlError);
      t.equal(err2, createError);
      t.end();
    });
  });
});

tap.test('Calls publish function with string message', function(t) {
  var providerOptions = { queueName: 'queue' };
  var message = 'test message';
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  provider.publish(message);

  emitter.once('ready', function() {
    // Defer this test to wait for all deferred methods in provider to run
    setTimeout(function() {
      var expectedParams = {
        QueueUrl: provider._queueUrl,
        MessageBody: message
      };

      t.ok(provider._sqs.sendMessage.called);
      t.same(provider._sqs.sendMessage.getCall(0).args[0], expectedParams);
      t.equal(typeof provider._sqs.sendMessage.getCall(0).args[1], 'function');
      t.end();
    }, 20);
  });
});

tap.test('Calls publish function with JSON string', function(t) {
  var providerOptions = { queueName: 'queue' };
  var message = { test: 'obj', foo: 'bar' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  provider.publish(message);

  emitter.once('ready', function() {
    // Defer this test to wait for all deferred methods in provider to run
    setTimeout(function() {
      var expectedParams = {
        QueueUrl: provider._queueUrl,
        MessageBody: JSON.stringify(message)
      };

      t.ok(provider._sqs.sendMessage.called);
      t.same(provider._sqs.sendMessage.getCall(0).args[0], expectedParams);
      t.end();
    }, 20);
  });
});

tap.test('Calls publish function with Buffer', function(t) {
  var providerOptions = { queueName: 'queue' };
  var message = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  provider.publish(message);

  emitter.once('ready', function() {
    // Defer this test to wait for all deferred methods in provider to run
    setTimeout(function() {
      var expectedParams = {
        QueueUrl: provider._queueUrl,
        MessageBody: message.toString('base64')
      };

      t.ok(provider._sqs.sendMessage.called);
      t.same(provider._sqs.sendMessage.getCall(0).args[0], expectedParams);
      t.end();
    }, 20);
  });
});

tap.test('Calls publish function when already... "ready"', function(t) {
  var providerOptions = { queueName: 'queue' };
  var message = 'test message';
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', function() {
    provider.publish(message);
    setTimeout(function() {
      var expectedParams = {
        QueueUrl: provider._queueUrl,
        MessageBody: message
      };

      t.ok(provider._sqs.sendMessage.called);
      t.same(provider._sqs.sendMessage.getCall(0).args[0], expectedParams);
      t.end();
    }, 10);
  });
});

tap.test('Emits "error" event if error called back from `sendMessage`', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var expectedError = new Error('Test error');
  var provider = new SqsProvider(emitter, providerOptions);
  AWSStub.SQS.prototype.sendMessage = sinon.stub().callsArgWith(1, expectedError);

  provider.publish('test message');

  emitter.on('error', function(err) {
    t.equal(err, expectedError);
    t.end();
  });
});

tap.test('Starts polling if subscribing before ready event', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  provider._startPolling = sinon.stub();

  provider.subscribe();

  emitter.once('ready', function(err) {
    setTimeout(function() {
      t.ok(provider._startPolling.called, '`_startPolling` was not called');
      t.end();
    }, 10);
  });
});

tap.test('Starts polling if subscribing after ready event', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  provider._startPolling = sinon.stub();

  emitter.once('ready', function(err) {
    provider.subscribe();
    setTimeout(function() {
      t.ok(provider._startPolling.called, '`_startPolling` was not called');
      t.end();
    }, 10);
  });
});

tap.test('Sets `_isClosed` property to true on unsubscribe', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  t.notOk(provider._isClosed);
  provider.unsubscribe();

  setTimeout(function() {
    t.ok(provider._isClosed);
    t.end();
  }, 10);
});

if (process.platform === 'win32') {
  skip = 'since timing this test uses is not reliable on windows';
}

tap.test('`_poll` method is called repeatedly until unsubscribed', { skip: skip }, function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  sinon.stub(provider, '_poll', function(cb) {
    setTimeout(cb, 10);
  });

  provider._startPolling();
  setTimeout(function() {
    provider.unsubscribe();

    // Expect based on the timeouts given, we expect `_poll` to be called at least 3 times.
    t.ok(provider._poll.getCall(2), '`_poll` was not called the expected number of times');
    t.end();

  }, 50);
});

tap.test('`_poll` method is called with delay as set in options', { skip: skip }, function(t) {
  var providerOptions = {
    queueName: 'queue',
    delayBetweenPolls: 0.01 // 10 milliseconds
  };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  sinon.stub(provider, '_poll', function(cb) {
    setTimeout(cb, 10);
  });

  provider._startPolling();
  setTimeout(function() {
    provider.unsubscribe();

    // Expect based on the timeouts and `delayBetweenPolls` given,
    // we expect `_poll` to be called two or three times.
    t.ok(provider._poll.getCall(1), '`_poll` was not called the expected number of times');
    t.notOk(provider._poll.getCall(3), '`_poll` was called more than expected');
    t.end();
  }, 30);
});

tap.test('`_poll` calls the SQS `_receiveMessage` with default params', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', function() {
    provider._poll(function() {
      var expectedParams = {
        QueueUrl: fakeQueueUrl,
        MaxNumberOfMessages: 1
      };
      t.ok(provider._sqs.receiveMessage.called, 'SQS `receiveMessage` not called');
      t.same(provider._sqs.receiveMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('`_poll` calls the SQS `_receiveMessage` with max number of messages set', function(t) {
  var providerOptions = {
    queueName: 'queue',
    maxReceiveCount: 10
  };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', function() {
    provider._poll(function() {
      var expectedParams = {
        QueueUrl: fakeQueueUrl,
        MaxNumberOfMessages: 10
      };
      t.same(provider._sqs.receiveMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('`_poll` calls the SQS `_receiveMessage` with custom visibility timeout set', function(t) {
  var providerOptions = {
    queueName: 'queue',
    visibilityTimeout: 10
  };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', function() {
    provider._poll(function() {
      var expectedParams = {
        QueueUrl: fakeQueueUrl,
        MaxNumberOfMessages: 1,
        VisibilityTimeout: 10,
        WaitTimeSeconds: undefined
      };
      t.same(provider._sqs.receiveMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('`_poll` calls the SQS `_receiveMessage` with custom wait time seconds set', function(t) {
  var providerOptions = {
    queueName: 'queue',
    waitTimeSeconds: 10
  };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', function() {
    provider._poll(function() {
      var expectedParams = {
        QueueUrl: fakeQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 10
      };
      t.same(provider._sqs.receiveMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('`_poll` does not emit a "message" event if no messages returned from SQS `_receiveMessage`', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);

  emitter.once('message', function() {
    t.fail('"message" event should not be called');
  });

  emitter.once('ready', function() {
    provider._poll(function() {
      t.end();
    });
  });
});

tap.test('`_poll` emits error on SQS `_receiveMessage` callback error', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  var testError = new Error('Test error');
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, testError);

  setTimeout(function() {
    provider._poll(Function.prototype);
  }, 10);

  emitter.once('error', function(err) {
    t.equal(err, testError);
    t.end();
  });
});

tap.test('`_poll` emits a string message event', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  var data = {
    Messages: [{ Body: 'Test Message 1', ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);

  emitter.once('message', function(msg, handle) {
    t.equal(msg, data.Messages[0].Body);
    t.equal(handle, data.Messages[0].ReceiptHandle);
    t.end();
  });

  emitter.once('ready', function() {
    provider._poll(Function.prototype);
  });
});

tap.test('`_poll` emits an object message event', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  var message = { test: 'message', foo: 'bar' };
  var data = {
    Messages: [{ Body: JSON.stringify(message), ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);

  emitter.once('message', function(msg, handle) {
    t.same(msg, message);
    t.equal(handle, data.Messages[0].ReceiptHandle);
    t.end();
  });

  emitter.once('ready', function() {
    provider._poll(Function.prototype);
  });
});

tap.test('`_poll` emits a Buffer message event', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  var message = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  var data = {
    Messages: [{ Body: message.toString('base64'), ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);

  emitter.once('message', function(msg, handle) {
    t.same(msg, message);
    t.equal(handle, data.Messages[0].ReceiptHandle);
    t.end();
  });

  emitter.once('ready', function() {
    provider._poll(Function.prototype);
  });
});

tap.test('Calls `_deleteMessage` if `deleteAfterReceive` is true', function(t) {
  var providerOptions = {
    queueName: 'queue',
    deleteAfterReceive: true
  };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  var message = 'test';
  var data = {
    Messages: [{ Body: message.toString('base64'), ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);
  provider._deleteMessage = sinon.stub();

  emitter.once('ready', function() {
    provider._poll(function() {
      t.ok(provider._deleteMessage.called, '`_deleteMessage` method not called');
      t.equal(provider._deleteMessage.getCall(0).args[0], data.Messages[0].ReceiptHandle);
      t.end();
    });
  });
});

tap.test('Does not call `_deleteMessage` if already unsubscribed', function(t) {
  var providerOptions = {
    queueName: 'queue',
    deleteAfterReceive: true
  };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  var message = 'test';
  var data = {
    Messages: [{ Body: message.toString('base64'), ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);
  provider._deleteMessage = sinon.stub();

  emitter.once('ready', function() {
    provider.unsubscribe();
    setTimeout(function() {
      provider._poll(function() {
        t.notOk(provider._deleteMessage.called, '`_deleteMessage` method should not have been called');
        t.end();
      });
    }, 10);
  });
});

tap.test('`ack` calls `_deleteMessage`', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  var messageId = 'test';
  provider._deleteMessage = sinon.stub();

  emitter.once('ready', function() {
    provider.ack(messageId);
    setTimeout(function() {
      t.ok(provider._deleteMessage.called, '`_deleteMessage` method should have been called');
      t.equal(provider._deleteMessage.getCall(0).args[0], messageId);
      t.end();
    }, 10);
  });
});

tap.test('Ignores `ack` if `deleteAfterReceive` is set to true', function(t) {
  var providerOptions = {
    queueName: 'queue',
    deleteAfterReceive: true
  };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  provider._deleteMessage = sinon.stub();

  emitter.once('ready', function() {
    provider.ack('test');
    setTimeout(function() {
      t.notOk(provider._deleteMessage.called, '`_deleteMessage` method should not have been called');
      t.end();
    }, 10);
  });
});

tap.test('`_deleteMessage` calls the SQS `deleteMessage` method', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  var expectedParams = {
    QueueUrl: fakeQueueUrl,
    ReceiptHandle: 'test'
  };

  emitter.once('ready', function() {
    provider._deleteMessage(expectedParams.ReceiptHandle);

    t.ok(provider._sqs.deleteMessage.called, 'SQS `deleteMessage` method should have been called');
    t.same(provider._sqs.deleteMessage.getCall(0).args[0], expectedParams);
    t.end();
  });
});

tap.test('Emits "error" event if SQS `deleteMessage` calls back an error', function(t) {
  var providerOptions = { queueName: 'queue' };
  var emitter = new EventEmitter();
  var provider = new SqsProvider(emitter, providerOptions);
  var testError = new Error('test error');
  provider._sqs.deleteMessage = sinon.stub().callsArgWith(1, testError);

  emitter.once('error', function(err) {
    t.equal(err, testError);
    t.end();
  });

  emitter.once('ready', function() {
    provider._deleteMessage('test');
  });
});
