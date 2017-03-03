'use strict';

const assert = require('assert');
const zmq = require('zeromq');

function validateOptions(opts) {
  assert(opts.queueName, '`queueName` property is not set.');
  assert(opts.hostname, '`hostname` property is not set.');
  assert(opts.port, '`port` property is not set.');
}

class ZeroMqProvider {

  constructor(emitter, options) {
    assert(emitter, '`emitter` argument is not set.');
    assert(options, '`options` argument is not set.');
    validateOptions(options);

    this.options = options;
    this.emitter = emitter;

    this.url = `tcp://${options.hostname}:${options.port}`;
    this.pubSock = zmq.socket('pub');
    this.subSock = zmq.socket('sub');

    setImmediate(() => this.initProvider());
  }

  publish(message) {
    let messageStr = message;
    if (message instanceof Buffer) {
      messageStr = message.toString('base64');
    } else if (typeof message !== 'string') {
      messageStr = JSON.stringify(message);
    }

    if (this.emitter.isReady) {
      setImmediate(() => this.sendMessage(messageStr));
    } else {
      this.emitter.once('ready', () => {
        setImmediate(() => this.sendMessage(messageStr));
      });
    }
  }

  subscribe() {
    if (this.emitter.isReady) {
      setImmediate(() => this.connectSubscriber());
    } else {
      this.emitter.once('ready', () => {
        setImmediate(() => this.connectSubscriber());
      });
    }
  }

  unsubscribe() {
    setImmediate(() => {
      if (!this.isClosed) {
        this.isClosed = true;
        this.subSock.disconnect(this.url);
      }
    });
  }

  close() {
    this.pubSock.unbind(this.url);
  }

  initProvider() {
    this.pubSock.bind(this.url, (err) => {
      if (err) {
        this.emitter.emit('error', err);
        return;
      }

      this.emitter.isReady = true;
      this.emitter.emit('ready');
    });
  }

  connectSubscriber() {
    this.subSock.connect(this.url);
    this.subSock.subscribe(this.options.queueName);

    this.subSock.on('message', (topic, messageStr) => {
      const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;
      let message = messageStr.toString();

      // first try to detect if it is a base64 string
      // if so convert to Buffer
      if (isBase64.test(messageStr)) {
        message = new Buffer(messageStr, 'base64');
      } else {
        // next try to decode as json
        try {
          message = JSON.parse(messageStr);
        } catch (e) {
          // if it fails just leave as original string
        }
      }

      this.emitter.emit('message', message);
    });
  }

  sendMessage(message) {
    try {
      this.pubSock.send([this.options.queueName, message]);
    } catch (err) {
      this.emitter.emit('error', err);
    }
  }

}

module.exports = ZeroMqProvider;
