'use strict';

const mq = require('../index.js');

const queue = mq.connect('sqs://hello', {

  // delete the message after emitting 'message' event
  deleteAfterReceive: true,

  // SQS queue specific attributes
  attributes: {
    VisibilityTimeout: '20',
    ReceiveMessageWaitTimeSeconds: '2',
  },

  // For mopre information on this configuration see:
  // http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/configuring-the-jssdk.html
  awsConfig: {
    region: 'us-east-1',
    maxRetries: 10,
  },

});

function startPublishing(done) {
  setTimeout(() => queue.publish(`hello world: ${new Date()}`), 1000);
  setTimeout(() => queue.publish(`hello world: ${new Date()}`), 2000);
  setTimeout(() => queue.publish(`hello world: ${new Date()}`), 3000);

  // This one will not be emitted since it occurs
  // after the listener is removed
  // It will however be received if you run the example again
  // It is included to demonstrate this behavior
  setTimeout(() => queue.publish(`hello world: ${new Date()}`), 9000);

  setTimeout(done, 8000);
}

queue.on('ready', () => {
  console.log('queue ready');
  startPublishing(() => {
    queue.removeAllListeners('message');
    console.log('unsubscribed');
  });

  setTimeout(() => console.log('SQS queues do not need to be closed'), 10000);
});

queue.on('message', message => console.log(message));
queue.on('error', (err) => {
  console.log(err);
  console.log('Do you need to setup your environment with your AWS credentials?');
  console.log('http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html');
});
