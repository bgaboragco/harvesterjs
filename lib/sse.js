// import { connect } from '../../../Library/Caches/typescript/2.6/node_modules/@types/amqplib';

'use strict';
let _ = require('lodash');
const Timestamp = require('mongodb').Timestamp;
let mongoose = require('mongoose');
let inflect = require('i')();
let tinySSE = require('tiny-sse');
let Promise = require('bluebird');
let hl = require('highland');
let JSONAPI_Error = require('./jsonapi-error');

const amqpBridge = require('./amqpBridge');

// const amqp = require('./amqp');
// const rabbit = require('rabbit.js');
// const JSONStream = require('JSONStream');
// let sub;

/*
Usage:
======================================
When setting up Multi SSE (ie: SSE for multiple resources), you just need to pass in Harvester context as such:

this.multiSSE = new SSE();
this.multiSSE.init({
    context: harvesterApp
});

You can then point an EventReader to listen from "{base_url}/changes/stream?resouces=foo,bar,baz".

When setting up SSE for a single route, you will need to pass the resource name:

this.singleSSE = new SSE();
this.singleSSE.init({
    context: harvesterApp,
    singleResourceName: 'foo'
});

You can then point an EventReader to listen from "{base_url}/foo/changes/stream".

Verbs:
======================================
You can also pass a "verbs" option to this module. If none is passed, SSE will only listen to "insert" events from uplog.
Values you can pass are "post", "put" and "delete" which in turn currespond to oplog ops "i", "u" and "d".

this.singleSSE = new SSE();
this.singleSSE.init({
    context: harvesterApp,
    singleResourceName: 'foo',
    verbs: ['post', 'put', 'delete']
});
*/

let SSE = function() {};

SSE.prototype.init = function(config) {
  this.config = config;
  this.options = config.context.options;
  this.harvesterApp = config.context;

  // only listen to post events if the verb is not specified
  this.verbs = config.verbs || ['post'];

  // wraps it up in an array of single item, so that it fits the current logic without too many conditions
  this.singleResourceName = config.singleResourceName && [
    config.singleResourceName,
  ];

  this.db = this.harvesterApp.adapter.oplogDB;

  var routePrefix = '';

  amqpBridge.connect('amqp://guest:guest@localhost:5672');

  if (config.singleResourceName) {
    var pluralName = this.options.inflect
      ? inflect.pluralize(config.singleResourceName)
      : config.singleResourceName;

    routePrefix = '/' + pluralName;
  }

  console.log('sse routePrefix', routePrefix);
  

  this.harvesterApp.router.get(
    this.options.baseUrl + routePrefix + '/changes/stream',
    this.requestValidationMiddleware.bind(this),
    tinySSE.head(),
    tinySSE.ticker({ seconds: 3 }),
    this.handler.bind(this)
  );
};

SSE.prototype.requestValidationMiddleware = function(req, res, next) {
  this.routeNames = req.query.resources ? req.query.resources.split(',') : [];

  if (this.singleResourceName) {
    this.routeNames = this.singleResourceName;
  }

  if (this.routeNames.length === 0) {
    throw new JSONAPI_Error({
      status: 400,
      title: 'Requested changes on missing resource',
      detail: 'You have not specified any resources, please do so by providing "resource?foo,bar" as query',
    });
  }

  if (!this.allResourcesExist(this.routeNames)) {
    throw new JSONAPI_Error({
      status: 400,
      title: 'Requested changes on missing resource',
      detail: "The follow resources don't exist " +
        this.getMissingResources(this.routeNames).join(','),
    });
  }

  if (req.headers['last-event-id']) {
    var tsSplit = _.map(req.headers['last-event-id'].split('_'), function(
      item
    ) {
      return parseInt(item, 10);
    });

    var isValidTS = _.all(tsSplit, function(ts) {
      return !isNaN(ts);
    });

    if (!isValidTS) {
      throw new JSONAPI_Error({
        status: 400,
        title: 'Invalid Timestamp',
        detail: 'Could not parse the time stamp provided',
      });
    }
  }

  next();
};


// let connection;

SSE.prototype.handler = function(req, res) {
  this.routeNames = req.query.resources ? req.query.resources.split(',') : [];

  if (this.singleResourceName) {
    this.routeNames = this.singleResourceName;
  }

  // var pluralRouteNames = this.routeNames.map(function(routeName) {
  //   return inflect.pluralize(routeName);
  // });

  // var regex = new RegExp('.*\\.(' + pluralRouteNames.join('|') + ')', 'i');
  // var docStream = hl();

  console.log('Going to open connection', this.routeNames);

  req.on('close', function() {
    console.log('going to close connect');
    // db.close();
  });

  // const amqpOpts = 'amqp://guest:guest@localhost:5672';
  const sourceQueue = 'ssequeue';
  
  console.log('Starting Device Consumer Component worker...');
  console.log('Getting adapter...');

  function messageHandler(channel, message) {
    const data = JSON.parse(message.content.toString());
    console.log('yol', data);
    tinySSE.send({ id: '1', event: 'go', data: data })(req, res);
    channel.ack(message);
    // next();
  }

  amqpBridge.getConnection().createChannel().then((channel) => {
    channel.assertQueue(sourceQueue); //{durable: true,autoDelete: false}
    console.log(`${sourceQueue} listening for new messages on ${sourceQueue}`);
    channel.consume(sourceQueue, (msg) => {
      messageHandler(channel, msg);
    });
  });
};

SSE.prototype.handleError = function(err, res, docStream) {
  res.end();
  if (docStream) {
    docStream.destroy();
  }
};

SSE.prototype.allResourcesExist = function(resourceNames) {
  return this.getMissingResources(resourceNames).length === 0;
};

SSE.prototype.getMissingResources = function(resourceNames) {
  var harvesterResourceNames =
    this.resourceName || _.keys(this.harvesterApp.createdResources);

  return _.difference(resourceNames, harvesterResourceNames);
};

SSE.prototype.getQuery = function(req, ns) {
  var lastEventId = req.headers['last-event-id'];
  var coll = this.db.collection('oplog.rs');

  var verbs = this.verbs.map(function(verb) {
    return {
      post: 'i',
      put: 'u',
      delete: 'd',
    }[verb];
  });

  var query = {
    ns: ns,
    op: new RegExp('(' + verbs.join('|') + ')', 'i'),
  };
  return new Promise(function(resolve, reject) {
    if (req.headers['last-event-id']) {
      var tsSplit = _.map(lastEventId.split('_'), function(item) {
        return parseInt(item, 10);
      });

      query.ts = {
        $gt: Timestamp(tsSplit[1], tsSplit[0]),
      };

      return resolve(query);
    }

    coll
      .find({ op: query.op }, { sort: { $natural: -1 }, limit: 1 })
      .toArray(function(err, items) {
        if (err || !items) {
          return reject(err);
        }
        query.ts = {
          $gt: items[0].ts,
        };

        return resolve(query);
      });
  });
};

SSE.prototype.getFilters = function(req) {
  var filters = _.chain(req.query)
    .map(function(item, key) {
      if (!_.contains(['limit', 'sort', 'offset', 'resources'], key)) {
        var filter = {};
        filter[key] = item;
        return filter;
      }
    })
    .filter(function(item) {
      return !!item;
    })
    // converts {'foo.bar' : 'foobar'} to {foo : { bar : 'foobar' }}
    .map(function(item) {
      var keys = _.keys(item)[0].split('.');
      return _.reduce(
        keys,
        function(obj, key, index) {
          var value = index === keys.length - 1 || keys.length === 1
            ? _.values(item)[0]
            : {};

          if (index === 0) {
            obj[key] = keys.length > 1 ? {} : value;
          } else {
            obj[keys[index - 1]][key] = value;
          }
          return obj;
        },
        {}
      );
    })
    .value();

  return filters;
};

SSE.prototype.getData = function(routeName, chunk) {
  var data;
  var model = this.harvesterApp.adapter.model(routeName);

  switch(chunk.op) {
  case 'i':
    data = this.harvesterApp.adapter._deserialize(model, chunk.o);
    break;
  case 'u':
    data = chunk.o.$set || chunk.o;
    data._id = chunk.o2._id;
    break;
  default:
    data = {};
  }

  return data;
};

SSE.prototype.getEventName = function(routeName, chunk) {
  return inflect.pluralize(routeName) + '_' + chunk.op;
};

module.exports = SSE;
