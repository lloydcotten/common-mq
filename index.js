'use strict';

const assert = require('assert');
const parseUrl = require('url').parse;
const Queue = require('./lib/queue');

function validateArgs(urlOrOptions) {
  assert(urlOrOptions, 'Queue URL or options not set.');
  assert((typeof urlOrOptions === 'string') || (typeof urlOrOptions === 'object'),
         'Queue URL must be string or options object set.');
  if (typeof urlOrOptions === 'string') {
    assert(/[a-z0-9]+:\/\/[a-z\-0-9./]+/i.test(urlOrOptions),
           'Invalid queue URL.');
  } else {
    assert(urlOrOptions.provider, '`provider` property is missing.');
    assert(urlOrOptions.queueName, '`queueName` property is missing.');
  }
}

module.exports.connect = function connect(url, options) {
  validateArgs(url);

  let queueOptions = options || {};
  if (typeof url === 'string') {
    const urlObj = parseUrl(url);
    queueOptions.hostname = urlObj.hostname;
    queueOptions.queueName = urlObj.pathname || urlObj.hostname;
    queueOptions.queueName = queueOptions.queueName.replace(/^\/|\/$/g, '');
    queueOptions.port = urlObj.port;
    queueOptions.provider = urlObj.protocol.substring(0, urlObj.protocol.length - 1);
  } else {
    // assume only options where passed (no url)
    queueOptions = url;
  }

  return new Queue(queueOptions);
};
