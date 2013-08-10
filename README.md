# common-mq

common-mq is an abstracted message queue client module with a clean, common API for working with various message queue providers.

## Provider Support

common-mq supports the following message queue providers 
* AMQP [TODO]
* STOMP [TODO]
* RabbitMQ [TODO]
* �MQ [TODO]
* Amazon AWS SQS
    
## Installation

    % npm install common-mq

## Usage Example

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
    
## Documentation

### Connecting to a Queue
#### .connect(url [, options])
Connects to a queue using a URL scheme (i.e, provider://hostname/queue).  The optional `options` argument passes provider specific configuration (see [Providers](#providers) section below).  

Returns a reference to a queue.

    var queue = require('common-mq').connect('amqp://localhost/todos');

#### .connect(options)
Connects to a queue using a config/options.  Provider, hostname, and queue name are all passed as properties of the `options` object (see [Providers](#providers) section below).  

Returns a reference to a queue.

    var queue = require('common-mq').connect('amqp://localhost/todos', { 
      implOptions: { defaultExchangeName: '' } 
    });

### Class: Queue
#### Event: 'ready'
Emitted when the queue is ready to publish or start start receiving messages.

#### Event: 'message'
Attaching the first listener to the `'message'` event will automatically subscribe to the queue.  When a message is received from the queue, the `'message'` event is emitted to all listeners.

Arguments:

    * message `string|object|Buffer`
    * messageId `string`

#### Event: 'error'
Emitted if an error occurs while communicating with the queue or receiving messages.

Arguments:

    * error `Error`

#### .publish(message)
Publishes a message to the queue.  The message can be a JavaScript object, a string, or a Buffer.

#### .ack(messageId)
If the queue does not support automatically handle the removing of messages (once received by a subscriber), or this option is turned off in the options, you will need to call the the `.ack()` method once you have successfully received the message.  The underlying queue provider implementation will handle deleting or acknowledging the message, depending how that particular queue provider handles this concept.

The messageId will be the same as passed by the `'message'` event callback.

### Providers

#### AMQP

#### Amazon SQS

    
## License

    The MIT License (MIT)

    Copyright (c) 2013 Lloyd Cotten.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
