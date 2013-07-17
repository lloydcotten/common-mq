var parseUrl = require('url').parse;
var Queue = require('./lib/queue');

module.exports = exports = {
  connect: function(url, options) {
    if (typeof url === 'string') {
      url = parseUrl(url);
      options = options || {};
      options.hostname = url.hostname;
      options.port = url.port;
      options.provider = url.protocol.substring(0, url.protocol.length - 1);
    } else {
      // assume only options where passed (no url)
      options = url;
    }
    
    return new Queue(options);
  }
};