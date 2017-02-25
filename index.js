'use strict';

var assert = require('assert');
var parseUrl = require('url').parse;
var Queue = require('./lib/queue');

module.exports = exports = {
  connect: function(url, options) {
    validateArgs(url, options);

    if (typeof url === 'string') {
      url = parseUrl(url);
      options = options || {};
      options.hostname = url.hostname;
      options.queueName = url.pathname || url.hostname;
      options.queueName = options.queueName.replace(/^\/|\/$/g, '');
      options.port = url.port;
      options.provider = url.protocol.substring(0, url.protocol.length - 1);
    } else {
      // assume only options where passed (no url)
      options = url;
    }

    return new Queue(options);
  }
};

function validateArgs(url, options) {
  assert(url, 'Queue URL or options not set.');
  assert((typeof url === 'string') || (typeof url === 'object'),
         'Queue URL must be string or options object set.');
  if (typeof url === 'string') {
    assert(/[a-z0-9]+:\/\/[a-z\-0-9.\/]+/i.test(url),
           'Invalid queue URL.')
  } else {
    assert(url.provider, '`provider` property is missing.');
    assert(url.queueName, '`queueName` property is missing.');
  }
}