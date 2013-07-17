var assert = require('assert');
var mq = require('../index.js');

try {

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
      accessKeyId: 'ACCESS_KEY',
      secretAccessKey: 'SECRET_ACCESS_KEY',
      region: 'us-east-1',
      maxRetries: 10
    }

  });
  
  assert(queue);
  
  queue.on('error', function(err) {
    console.log(err);
  });

  queue.on('ready', function() {
    console.log('ready');
    
    for (var i=0; i<20; i++) {
      setTimeout(function() {
        queue.publish('hi ! ' + new Date().toString());
      }, Math.floor(Math.random()*30001));
    }
  });
  
  var r = 0;
  queue.on('message', function(message) {
    console.log(message);
    if (r++ === 20) queue.off('message');
  });
  
} catch (e) {
  console.log(e);
}