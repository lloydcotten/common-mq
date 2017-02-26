var mq = require('../index.js');

var queue = mq.connect('sqs://hello', {

  // delete the message after emitting 'message' event
  deleteAfterReceive: true,

  // SQS queue specific attributes
  attributes: {
    VisibilityTimeout: '20',
    ReceiveMessageWaitTimeSeconds: '2'
  },

  // AWS config
  // Replace with your AWS access id and secrety access key
  awsConfig: {
    accessKeyId: 'AWS_ACCESS_KEY_ID',
    secretAccessKey: 'AWS_SECRET_ACCESS_KEY',
    region: 'us-east-1',
    maxRetries: 10
  }

});

queue.on('ready', function() {
  console.log('queue ready');
  startPublishing(function() {
    queue.removeAllListeners('message');
    console.log('unsubscribed');
  });

  setTimeout(close, 10000);
});

queue.on('message', printMessage);

queue.on('error', function(err) {
  console.log(err);
});

function printMessage(message) {
  console.log(message);
}

function close() {
  console.log('SQS queues do not need to be closed');
}

function startPublishing(done) {
  setTimeout(publishOne, 1000);
  setTimeout(publishOne, 2000);
  setTimeout(publishOne, 3000);

  // This one will not be emitted since it occurs
  // after the listener is removed
  // It will however be received if you run the example again
  // It is included to demonstrate this behavior
  setTimeout(publishOne, 9000);

  setTimeout(done, 8000);
}

function publishOne() {
  queue.publish('hello world: ' + new Date());
}
