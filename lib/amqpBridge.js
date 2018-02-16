'use strict';

const _ = require('lodash');
const amqp = require('amqplib');
const Promise = require('bluebird');

let connection;
let channel;

function connect() {
  if (connection) {
    throw new Error('AmqpBridge already connected');
  }
  console.log('AMQP Bridge attempting to connect...');
  function reconnect() {
    console.info('AMQP Bridge reconnecting...');
    disconnect().catch(_.noop).delay(20000).then(doConnect).catch(reconnect);
  }

  function doConnect(connectionUrl) {
    return amqp.connect(connectionUrl).then(c => {
      console.info('AMQP Bridge connected to broker');
      connection = c;
      connection.on('close', err => {
        if (err) {
          console.error('AMQP Bridge connection got closed by server:', err);
          reconnect();
        }
      });
      return connection.createConfirmChannel().then(ch => {
        channel = ch;
        return [channel, connection];
      });
    });
  }

  return doConnect();
}

function publish(exchange, routingKey, payload, options) {
  if (!channel) {
    return Promise.reject(new Error('Not connected to message broker'));
  }
  const stringifiedPayload = _.isString(payload) ? payload : JSON.stringify(payload);
  channel.publish(exchange, routingKey, new Buffer(stringifiedPayload), options || {});
  return Promise.resolve();
}

function disconnect() {
  return Promise.resolve(connection && connection.close())
    .finally(() => {
      connection = null;
      channel = null;
    });
}

function getChannel() {
  return channel;
}

function getConnection() {
  return connection;
}

module.exports = {
  getChannel,
  getConnection,
  connect,
  disconnect,
  publish
};
