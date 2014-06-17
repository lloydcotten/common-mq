var mq = require('../');

var queue = mq.connect('zmq://127.0.0.1:5555/todods');
queue.on('ready', function() {
  console.log('queue ready');
  startPublishing(function() {
    queue.removeAllListeners();
    queue.close();

    delete queue;
  });
});

queue.on('message', printMessage);

queue.on('error', function(err) {
  console.log(err);
});

function printMessage(message) {
  console.log(message);
}

function startPublishing(done) {
  setTimeout(publishOne, 1000);
  setTimeout(publishOne, 2000);
  setTimeout(publishOne, 3000);

  setTimeout(done, 10000);
}

function publishOne() {
  queue.publish('hello world: ' + new Date());
}

