'use strict';

const mq = require('../');

const queue = mq.connect('amqp://127.0.0.1:5672/hello', {
  exchangeName: 'helloExchange'
});
queue.on('ready', () => {
  console.log('queue ready');
  startPublishing(() => {
    queue.removeAllListeners('message');
    console.log('unsubscribed');
  });

  setTimeout(close, 10000)
});

queue.on('message', (message) => console.log(message));
queue.on('error', (err) => console.log(err));

function startPublishing(done) {
  setTimeout(() => queue.publish('hello world: ' + new Date()), 1000);
  setTimeout(() => queue.publish('hello world: ' + new Date()), 2000);
  setTimeout(() => queue.publish('hello world: ' + new Date()), 3000);

  // This one will not be emitted since it occurs
  // after the listener is removed
  // It is included to demonstrate this behavior
  setTimeout(() => queue.publish('hello world: ' + new Date()), 6000);

  setTimeout(done, 5000);
}

function close() {
  queue.close();
  console.log('queue closed');
}