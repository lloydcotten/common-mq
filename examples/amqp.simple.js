'use strict';

var mq = require('../');

var queue = mq.connect('amqp://127.0.0.1:5672/hello', {
  exchangeName: 'helloExchange'
});
queue.on('ready', function() {
  console.log('queue ready');
  startPublishing(function() {
    queue.removeAllListeners('message');
    console.log('unsubscribed');
  });

  setTimeout(close, 10000)
});

queue.on('message', printMessage);

queue.on('error', function(err) {
  console.log(err);
});

function printMessage(message) {
  console.log(message);
}

function close() {
  queue.close();
  console.log('queue closed');
}

function startPublishing(done) {
  setTimeout(publishOne, 1000);
  setTimeout(publishOne, 2000);
  setTimeout(publishOne, 3000);

  // This one will not be emitted since it occurs
  // after the listener is removed
  // It is included to demonstrate this behavior
  setTimeout(publishOne, 6000);

  setTimeout(done, 5000);
}

function publishOne() {
  queue.publish('hello world: ' + new Date());
}

