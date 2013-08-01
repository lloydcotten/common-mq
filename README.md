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
