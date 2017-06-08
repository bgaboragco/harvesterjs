const Kafka = require('no-kafka');
const mongoose = require('mongoose');

const brokers = "localhost:9092";

const producer = new Kafka.Producer({
  connectionString: brokers,
});

const tailOplog = (db) => {
  const options = {
    tailable: true,
    awaitdata: true
  };

  // This is incomplete because we need to query the oplog for the last events
  const stream = db.collection('oplog.rs').find({}, options);

  stream.on('data', onData)
    .on('error', () => {
      console.log('Error oplog stream');
    })
    .on('close', () => {
      console.log('Closing oplog stream')
    });
};

const KafkaProducer = (options) => {
  const db = mongoose.createConnection(options.oplogConnectionString, {
    poolSize: 10,
    socketOptions: { keepAlive: 250  },
  })

  db.on('open', (err) => {
    tailOplog(db);
  });
};

const onData = (doc) => {
  if (!doc.ns.includes('author')) {
    return;
  }

  return producer.init().then(function(){
    return producer.send({
      topic: 'authors',
      partition: 0,
      message: {
        value: JSON.stringify(doc)
      }
    });
  })
  .then(() =>  console.log('>>> producer sent message'));
};


module.exports = KafkaProducer;
