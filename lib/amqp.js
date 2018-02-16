const rabbit = require('rabbit.js');
const Promise = require('bluebird');

exports.connect = (context, mode, queue) => new Promise((resolve) => {
  const socket = context.socket(mode);
  socket.connect(queue, () => resolve(socket));
});

exports.createContext = url => new Promise((resolve, reject) => {
  const context = rabbit.createContext(url);
  context.on('error', err => reject(err));
  context.on('ready', () => resolve(context));
});

module.exports = exports;
