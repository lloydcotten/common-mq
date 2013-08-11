var events = require('events');
var fs = require('fs');
var path = require('path');
var util = require('util');

// load providers into a hash for dynamic referencing
var ProviderHash = {};
var files = fs.readdirSync(__dirname + '/providers');
files.forEach(function(file) {

  if (path.extname(file) === '.js') {
    ProviderHash[path.basename(file, '.js')] = require('./providers/' + file);
  }
  
});

function Queue(options) {
  this.isReady = false;

  try {
    this._provider = new ProviderHash[options.provider](this, options);
  } catch (e) {
    var err = new Error('Unable to instantiate provider.');
    err.provider = options.provider;
    err.inner = e;
    
    throw err;
  }
  
  this._listenerCount = 0;
  
  this.on('newListener', function(event) {
    if (event !== 'message') return;
    
    if (++this._listenerCount === 1) {
      this._provider.subscribe();
    }
    
  });
  
  this.on('removeListener', function(event) {
    if (event !== 'message') return;
    
    if (--this._listenerCount === 0) {
      this._provider.unsubscribe();
    }
    
  });
}

util.inherits(Queue, events.EventEmitter);

Queue.prototype.publish = function(message) {
  this._provider.publish(message);
};

Queue.prototype.ack = function(messageId) {
  this._provider.ack(messageId);
};

module.exports = exports = Queue;