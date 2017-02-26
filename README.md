# common-mq

common-mq is an abstracted message queue client package for Node.js with a clean, common API for working with
various message queue providers.

## Provider Support

common-mq supports the following message queue providers.
* [AMQP](#amqp)
* [Amazon SQS](#amazon-sqs)
* [ZeroMQ](#zeromq)

If you want to see more queue providers supported, add a comment to the
[queue provider tracking issue](https://github.com/lloydcotten/common-mq/issues/16).
Pull requests are always welcome, also!

## Installation

```bash
npm install common-mq
```

## Usage Example

```javascript
var mq = require('common-mq');

var queue = mq.connect('sqs://todos', {

  // delete the message after emitting 'message' event
  deleteAfterReceive: true,

  // SQS queue specific attributes
  attributes: {
    VisibilityTimeout: '60',
    ReceiveMessageWaitTimeSeconds: '20'
  },

  // AWS config
  awsConfig: {
    accessKeyId: 'ACCESS_KEY_HERE',
    secretAccessKey: 'SECRET_KEY_HERE',
    region: 'us-east-1'
    maxRetries: 10
  }

});

queue.on('ready', function() {
  setTimeout(function() { queue.publish({ task: 'take out trash' }); }, 1000);
  setTimeout(function() { queue.publish({ task: 'wash dishes' }); }, 5000);
  setTimeout(function() { queue.publish({ task: 'sweep floor' }); }, 6000);
});

queue.on('error', function(err) {
  console.log(err);
});

queue.on('message', function(message) {
  console.log(message);
});
```

Other examples can be found in the `examples/` directory. Clone the repository, then run with:

```bash
npm run example
npm run example:zmq
npm run example:sqs # Edit examples/sqs.simple.js first to include your AWS config
npm run example:amqp # Assumes AMQP server (like RabbitMQ) is running on localhost port 5672
```

## Documentation

### Connecting to a Queue
#### .connect(url [, options])
Connects to a queue using a URL scheme (i.e, provider://hostname/queue).  The optional `options`
argument passes provider specific configuration (see [Providers](#providers) section below).

Returns a reference to a [queue](#class:-queue).

```javascript
// With simple url scheme
var queue = require('common-mq').connect('zmq://localhost:5555/todos');

// With additional options
var queue = require('common-mq').connect('sqs://todos', {
  deleteAfterReceive: true,
  attributes: { VisibilityTimeout: '120' }
});
```

#### .connect(options)
Connects to a queue using a detailed config.  See [Providers](#providers) section below for
required and optional properties for each provider.

Returns a reference to a [queue](#class:-queue).

```javascript
var queue = require('common-mq').connect({
  provider: 'amqp',
  hostname: 'localhost',
  port: 5672,
  queueName: 'todos',
  exchangeName: 'MyTodoExchange',
  ssl: { enabled: true }
});
```

### Class: Queue
#### Event: 'ready'
Emitted when the queue is ready to publish or start receiving messages.

```javascript
queue.on('ready', function() {
  console.log('Queue is ready to start publishing or receiving messages.');
});
```

#### Event: 'message'
Attaching the first listener to the `'message'` event will automatically subscribe to the queue.
When a message is received from the queue, the `'message'` event is emitted to all listeners.

Arguments:

* message `string|object|Buffer`
* messageId `string`

```javascript
queue.on('message', function(message) {
  console.log('Message received!', message);
});
```

#### Event: 'error'
Emitted if an error occurs while communicating with the queue or receiving messages.

Arguments:

* error `Error`

```javascript
queue.on('error', function(error) {
  console.log('Oops!', error.toString());
});
```

#### .publish(message)
Publishes a message to the queue. `message` can be a JavaScript object, a string, or a Buffer.

```javascript
queue.publish('This is a string message');
queue.publish({ foo: 'bar', baz: 3 });
queue.publish(new Buffer([1, 2, 3, 4, 5, 6, 7, 8]));
```

#### .ack(messageId)
If the queue does not support automatically removing messages (once received by a subscriber),
or this option is turned off in the options, you will need to call the the `.ack()` method once
you have successfully received the message. The underlying queue provider implementation will
handle deleting or acknowledging the message, depending how that particular queue provider handles
this concept.  Not all providers (e.g. ZeroMQ) support this and this will behave as a noop.

The `messageId` will be the same as passed by the `'message'` event callback.

```javascript
queue.on('message', function(message, messageId) {
  console.log('Message received!', message);
  queue.ack(messageId);
});
```

#### .close()
Some queues need to be explicitly closed to clean up the connections. Use this method to disconnect
from the queue.  If not needed by the queue provider, it will behave as a noop.

```javascript
queue.close();
```

### Providers

#### AMQP

Connection URL Syntax: `amqp://<hostname>:<port>/<queueName>`

Required options:

* provider `string` (when not using connection URL)
* hostname `string` (when not using connection URL)
* port `number` (when not using connection URL)
* queueName `string` (when not using connection URL)
* exchangeName `string`

The options object is passed on as options to the
[amqp-node `createConnection`](https://github.com/postwait/node-amqp#connection-options-and-url)
method.  Any of the connection options can be included in the common-mq options object.

#### Amazon SQS

Connection URL Syntax: `sqs://<queueName>`

Required options:

* provider `string` (when not using connection URL)
* queueName `string` (when not using connection URL)
* awsConfig `object|string` AWS config options to pass to the [`update` method](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#update-property), otherwise a path to AWS config file to pass to the [`loadFromPath` method](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#loadFromPath-property)

Other options:

* attributes `object` (default: not set) Corresponds to the `Attributes` object on the SQS [`createQeuue` method params](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#createQueue-property)
* deleteAfterReceive `boolean` (default: false) When `true`, deletes the message immediately after receiving
* maxReceiveCount `number` (default: 1) Max number of messages to receive at once
* visibilityTimeout `number` (default: set per queue attributes) Number of seconds to keep messages hidden after receive
* waitTimeSeconds `number` (default: set per queue attributes) Number of seconds to wait for new messages before ending each poll request

#### ZeroMQ

Connection URL Syntax: `zmq://<hostname>:<port>/<queueName>`

Required options:

* provider `string` (when not using connection URL)
* hostname `string` (when not using connection URL)
* port `number` (when not using connection URL)
* queueName `string` (when not using connection URL)

## License

[MIT](LICENSE.md)