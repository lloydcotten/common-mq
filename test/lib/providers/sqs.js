'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const tap = require('tap');

let skip = false;

const AWSStub = {
  config: {},
  SQS: sinon.stub()
};

const SqsProvider = proxyquire('../../../lib/providers/sqs', {
  'aws-sdk': AWSStub
});

const fakeQueueUrl = 'https://fake.sqs.url/test';

tap.beforeEach((done) => {
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

tap.test('Throws an error if `emitter` arg is not set', (t) => {
  t.throws(() => new SqsProvider(), { message: /emitter.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is not set', (t) => {
  t.throws(() => new SqsProvider({}), { message: /options.+not.+set/i });
  t.end();
});

tap.test('Throws an error if `options` args is missing `queueName` property', (t) => {
  const providerOptions = {};

  t.throws(() => new SqsProvider({}, providerOptions), { message: /queueName.+not.+set/i });
  t.end();
});

tap.test('Does not throw an error if args are valid', (t) => {
  const providerOptions = { queueName: 'queue' };

  sinon.stub(SqsProvider.prototype, '_initProvider', noop => noop);
  t.doesNotThrow(() => new SqsProvider({}, providerOptions));
  setImmediate(() => {
    SqsProvider.prototype._initProvider.restore();
    t.end();
  });
});

tap.test('Loads AWS config from a file if `awsConfig` is a string', (t) => {
  const providerOptions =
  {
    queueName: 'queue',
    awsConfig: '/a/fake/aws/config'
  };

  sinon.stub(SqsProvider.prototype, '_initProvider', noop => noop);
  new SqsProvider({}, providerOptions);
  t.ok(AWSStub.config.loadFromPath.called, '`loadFromPath` method not called.');
  t.equal(AWSStub.config.loadFromPath.getCall(0).args[0], providerOptions.awsConfig);
  setImmediate(() => {
    SqsProvider.prototype._initProvider.restore();
    t.end();
  });
});

tap.test('Update AWS config from `awsConfig` object when set', (t) => {
  const providerOptions =
  {
    queueName: 'queue',
    awsConfig: { some: 'aws', config: true }
  };

  sinon.stub(SqsProvider.prototype, '_initProvider', noop => noop);
  new SqsProvider({}, providerOptions);
  t.ok(AWSStub.config.update.called, '`update` method not called.');
  t.equal(AWSStub.config.update.getCall(0).args[0], providerOptions.awsConfig);
  setImmediate(() => {
    SqsProvider.prototype._initProvider.restore();
    t.end();
  });
});

tap.test('Instantiates a new `AWS.SQS` object', (t) => {
  const providerOptions = { queueName: 'queue' };

  sinon.stub(SqsProvider.prototype, '_initProvider', noop => noop);
  const provider = new SqsProvider({}, providerOptions);
  t.ok(AWSStub.SQS.calledWithNew(), '`AWS.SQS` object was not instantiated.');
  t.type(provider._sqs, AWSStub.SQS);
  setImmediate(() => {
    SqsProvider.prototype._initProvider.restore();
    t.end();
  });
});

tap.test('Gets the QueueUrl on provider init', (t) => {
  const providerOptions = { queueName: 'queue' };
  const provider = new SqsProvider(new EventEmitter(), providerOptions);

  // Defer these tests since provider is initialized on next event loop
  setImmediate(() => {
    const expectedParams = { QueueName: providerOptions.queueName };
    t.ok(provider._sqs.getQueueUrl.called);
    t.same(provider._sqs.getQueueUrl.getCall(0).args[0], expectedParams);
    t.equal(typeof provider._sqs.getQueueUrl.getCall(0).args[1], 'function');
    t.end();
  });
});

tap.test('Creates the queue on provider init if error callback from SQS `getQueueUrl`', (t) => {
  const providerOptions = { queueName: 'queue' };
  const provider = new SqsProvider(new EventEmitter(), providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, new Error('getQueueUrl error'));

  // Defer these tests since provider is initialized on next event loop
  setImmediate(() => {
    const expectedParams = { QueueName: providerOptions.queueName };
    t.ok(provider._sqs.createQueue.called);
    t.match(provider._sqs.createQueue.getCall(0).args[0], expectedParams);
    t.equal(typeof provider._sqs.createQueue.getCall(0).args[1], 'function');
    t.end();
  });
});

tap.test('Creates or retrieves a QueueUrl on provider init (with attributes)', (t) => {
  const providerOptions = {
    queueName: 'queue',
    attributes: { custom: 'attributes' }
  };
  const provider = new SqsProvider(new EventEmitter(), providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, new Error('getQueueUrl error'));

  // Defer these tests since provider is initialized on next event loop
  setImmediate(() => {
    const expectedParams = {
      QueueName: providerOptions.queueName,
      Attributes: providerOptions.attributes
    };
    t.match(provider._sqs.createQueue.getCall(0).args[0], expectedParams);
    t.end();
  });
});

tap.test('Emits "ready" event on call back from `getQueueUrl`', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  emitter.on('ready', () => {
    t.ok(emitter.isReady);
    t.end();
  });
});

tap.test('Emits "ready" event on call back from `createQueue`', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, new Error('getQueueUrl error'));

  emitter.on('ready', () => {
    t.ok(emitter.isReady);
    t.end();
  });
});

tap.test('Sets `_queueUrl` property with value called back from `getQueueUrl`', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const queueData = { QueueUrl: 'https://fake.sqs.url/test' };
  const provider = new SqsProvider(emitter, providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, null, queueData);

  emitter.on('ready', () => {
    t.equal(provider._queueUrl, queueData.QueueUrl);
    t.end();
  });
});

tap.test('Sets `_queueUrl` property with value called back from `createQueue`', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const queueData = { QueueUrl: 'https://fake.sqs.url/test' };
  const provider = new SqsProvider(emitter, providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, new Error('getQueueUrl error'));
  provider._sqs.createQueue.callsArgWith(1, null, queueData);

  emitter.on('ready', () => {
    t.equal(provider._queueUrl, queueData.QueueUrl);
    t.end();
  });
});

tap.test('Emits "error" event twice if error called back from `createQueue`', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const getQueueUrlError = new Error('getQueueUrl error');
  const createError = new Error('createQueue error');
  const provider = new SqsProvider(emitter, providerOptions);
  provider._sqs.getQueueUrl.callsArgWith(1, getQueueUrlError);
  provider._sqs.createQueue.callsArgWith(1, createError);

  emitter.once('error', (err1) => {
    emitter.once('error', (err2) => {
      t.equal(err1, getQueueUrlError);
      t.equal(err2, createError);
      t.end();
    });
  });
});

tap.test('Calls publish function with string message', (t) => {
  const providerOptions = { queueName: 'queue' };
  const message = 'test message';
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  provider.publish(message);

  emitter.once('ready', () => {
    // Defer this test to wait for all deferred methods in provider to run
    setImmediate(() => {
      const expectedParams = {
        QueueUrl: provider._queueUrl,
        MessageBody: message
      };

      t.ok(provider._sqs.sendMessage.called);
      t.same(provider._sqs.sendMessage.getCall(0).args[0], expectedParams);
      t.equal(typeof provider._sqs.sendMessage.getCall(0).args[1], 'function');
      t.end();
    });
  });
});

tap.test('Calls publish function with JSON string', (t) => {
  const providerOptions = { queueName: 'queue' };
  const message = { test: 'obj', foo: 'bar' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  provider.publish(message);

  emitter.once('ready', () => {
    // Defer this test to wait for all deferred methods in provider to run
    setImmediate(() => {
      const expectedParams = {
        QueueUrl: provider._queueUrl,
        MessageBody: JSON.stringify(message)
      };

      t.ok(provider._sqs.sendMessage.called);
      t.same(provider._sqs.sendMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('Calls publish function with Buffer', (t) => {
  const providerOptions = { queueName: 'queue' };
  const message = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  provider.publish(message);

  emitter.once('ready', () => {
    // Defer this test to wait for all deferred methods in provider to run
    setImmediate(() => {
      const expectedParams = {
        QueueUrl: provider._queueUrl,
        MessageBody: message.toString('base64')
      };

      t.ok(provider._sqs.sendMessage.called);
      t.same(provider._sqs.sendMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('Calls publish function when already... "ready"', (t) => {
  const providerOptions = { queueName: 'queue' };
  const message = 'test message';
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', () => {
    provider.publish(message);
    setImmediate(() => {
      const expectedParams = {
        QueueUrl: provider._queueUrl,
        MessageBody: message
      };

      t.ok(provider._sqs.sendMessage.called);
      t.same(provider._sqs.sendMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('Emits "error" event if error called back from `sendMessage`', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const expectedError = new Error('Test error');
  const provider = new SqsProvider(emitter, providerOptions);
  AWSStub.SQS.prototype.sendMessage = sinon.stub().callsArgWith(1, expectedError);

  provider.publish('test message');

  emitter.on('error', (err) => {
    t.equal(err, expectedError);
    t.end();
  });
});

tap.test('Starts polling if subscribing before ready event', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  provider._startPolling = sinon.stub();

  provider.subscribe();

  emitter.once('ready', (err) => {
    setImmediate(() => {
      t.ok(provider._startPolling.called, '`_startPolling` was not called');
      t.end();
    });
  });
});

tap.test('Starts polling if subscribing after ready event', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  provider._startPolling = sinon.stub();

  emitter.once('ready', (err) => {
    provider.subscribe();
    setImmediate(() => {
      t.ok(provider._startPolling.called, '`_startPolling` was not called');
      t.end();
    });
  });
});

tap.test('Sets `_isClosed` property to true on unsubscribe', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  t.notOk(provider._isClosed);
  provider.unsubscribe();

  setImmediate(() => {
    t.ok(provider._isClosed);
    t.end();
  });
});

if (process.platform === 'win32') {
  skip = 'since timing this test uses is not reliable on windows';
}

tap.test('`_poll` method is called repeatedly until unsubscribed', { skip: skip }, (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  sinon.stub(provider, '_poll', (cb) => setTimeout(cb, 10));

  provider._startPolling();
  setTimeout(() => {
    provider.unsubscribe();

    // Expect based on the timeouts given, we expect `_poll` to be called at least 3 times.
    t.ok(provider._poll.getCall(2), '`_poll` was not called the expected number of times');
    t.end();

  }, 200);
});

tap.test('`_poll` method is called with delay as set in options', { skip: skip }, (t) => {
  const providerOptions = {
    queueName: 'queue',
    delayBetweenPolls: 0.01 // 10 milliseconds
  };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  sinon.stub(provider, '_poll', (cb) => setTimeout(cb, 10));

  provider._startPolling();
  setTimeout(() => {
    provider.unsubscribe();

    // Expect based on the timeouts and `delayBetweenPolls` given,
    // we expect `_poll` to be called two or three times.
    t.ok(provider._poll.getCall(1), '`_poll` was not called the expected number of times');
    t.notOk(provider._poll.getCall(3), '`_poll` was called more than expected');
    t.end();
  }, 30);
});

tap.test('`_poll` calls the SQS `_receiveMessage` with default params', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', () => {
    provider._poll(() => {
      const expectedParams = {
        QueueUrl: fakeQueueUrl,
        MaxNumberOfMessages: 1
      };
      t.ok(provider._sqs.receiveMessage.called, 'SQS `receiveMessage` not called');
      t.same(provider._sqs.receiveMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('`_poll` calls the SQS `_receiveMessage` with max number of messages set', (t) => {
  const providerOptions = {
    queueName: 'queue',
    maxReceiveCount: 10
  };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', () => {
    provider._poll(() => {
      const expectedParams = {
        QueueUrl: fakeQueueUrl,
        MaxNumberOfMessages: 10
      };
      t.same(provider._sqs.receiveMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('`_poll` calls the SQS `_receiveMessage` with custom visibility timeout set', (t) => {
  const providerOptions = {
    queueName: 'queue',
    visibilityTimeout: 10
  };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', () => {
    provider._poll(() => {
      const expectedParams = {
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

tap.test('`_poll` calls the SQS `_receiveMessage` with custom wait time seconds set', (t) => {
  const providerOptions = {
    queueName: 'queue',
    waitTimeSeconds: 10
  };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  emitter.once('ready', () => {
    provider._poll(() => {
      const expectedParams = {
        QueueUrl: fakeQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 10
      };
      t.same(provider._sqs.receiveMessage.getCall(0).args[0], expectedParams);
      t.end();
    });
  });
});

tap.test('`_poll` does not emit a "message" event if no messages returned from SQS `_receiveMessage`', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);

  emitter.once('message', () => t.fail('"message" event should not be called'));

  emitter.once('ready', () => {
    provider._poll(() => t.end());
  });
});

tap.test('`_poll` emits error on SQS `_receiveMessage` callback error', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  const testError = new Error('Test error');
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, testError);

  setTimeout(() => provider._poll(Function.prototype), 10);

  emitter.once('error', (err) => {
    t.equal(err, testError);
    t.end();
  });
});

tap.test('`_poll` emits a string message event', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  const data = {
    Messages: [{ Body: 'Test Message 1', ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);

  emitter.once('message', (msg, handle) => {
    t.equal(msg, data.Messages[0].Body);
    t.equal(handle, data.Messages[0].ReceiptHandle);
    t.end();
  });

  emitter.once('ready', () => provider._poll(noop => noop));
});

tap.test('`_poll` emits an object message event', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  const message = { test: 'message', foo: 'bar' };
  const data = {
    Messages: [{ Body: JSON.stringify(message), ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);

  emitter.once('message', (msg, handle) => {
    t.same(msg, message);
    t.equal(handle, data.Messages[0].ReceiptHandle);
    t.end();
  });

  emitter.once('ready', () => provider._poll(noop => noop));
});

tap.test('`_poll` emits a Buffer message event', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  const message = new Buffer([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const data = {
    Messages: [{ Body: message.toString('base64'), ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);

  emitter.once('message', (msg, handle) => {
    t.same(msg, message);
    t.equal(handle, data.Messages[0].ReceiptHandle);
    t.end();
  });

  emitter.once('ready', () => provider._poll(noop => noop));
});

tap.test('Calls `_deleteMessage` if `deleteAfterReceive` is true', (t) => {
  const providerOptions = {
    queueName: 'queue',
    deleteAfterReceive: true
  };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  const message = 'test';
  const data = {
    Messages: [{ Body: message.toString('base64'), ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);
  provider._deleteMessage = sinon.stub();

  emitter.once('ready', () => {
    provider._poll(() => {
      t.ok(provider._deleteMessage.called, '`_deleteMessage` method not called');
      t.equal(provider._deleteMessage.getCall(0).args[0], data.Messages[0].ReceiptHandle);
      t.end();
    });
  });
});

tap.test('Does not call `_deleteMessage` if already unsubscribed', (t) => {
  const providerOptions = {
    queueName: 'queue',
    deleteAfterReceive: true
  };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  const message = 'test';
  const data = {
    Messages: [{ Body: message.toString('base64'), ReceiptHandle: 'abc' }]
  };
  provider._sqs.receiveMessage = sinon.stub().callsArgWith(1, null, data);
  provider._deleteMessage = sinon.stub();

  emitter.once('ready', () => {
    provider.unsubscribe();
    setImmediate(() => {
      provider._poll(() => {
        t.notOk(provider._deleteMessage.called, '`_deleteMessage` method should not have been called');
        t.end();
      });
    });
  });
});

tap.test('`ack` calls `_deleteMessage`', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  const messageId = 'test';
  provider._deleteMessage = sinon.stub();

  emitter.once('ready', () => {
    provider.ack(messageId);
    setImmediate(() => {
      t.ok(provider._deleteMessage.called, '`_deleteMessage` method should have been called');
      t.equal(provider._deleteMessage.getCall(0).args[0], messageId);
      t.end();
    });
  });
});

tap.test('Ignores `ack` if `deleteAfterReceive` is set to true', (t) => {
  const providerOptions = {
    queueName: 'queue',
    deleteAfterReceive: true
  };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  provider._deleteMessage = sinon.stub();

  emitter.once('ready', () => {
    provider.ack('test');
    setImmediate(() => {
      t.notOk(provider._deleteMessage.called, '`_deleteMessage` method should not have been called');
      t.end();
    });
  });
});

tap.test('`_deleteMessage` calls the SQS `deleteMessage` method', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  const expectedParams = {
    QueueUrl: fakeQueueUrl,
    ReceiptHandle: 'test'
  };

  emitter.once('ready', () => {
    provider._deleteMessage(expectedParams.ReceiptHandle);

    t.ok(provider._sqs.deleteMessage.called, 'SQS `deleteMessage` method should have been called');
    t.same(provider._sqs.deleteMessage.getCall(0).args[0], expectedParams);
    t.end();
  });
});

tap.test('Emits "error" event if SQS `deleteMessage` calls back an error', (t) => {
  const providerOptions = { queueName: 'queue' };
  const emitter = new EventEmitter();
  const provider = new SqsProvider(emitter, providerOptions);
  const testError = new Error('test error');
  provider._sqs.deleteMessage = sinon.stub().callsArgWith(1, testError);

  emitter.once('error', (err) => {
    t.equal(err, testError);
    t.end();
  });

  emitter.once('ready', () => provider._deleteMessage('test'));
});
