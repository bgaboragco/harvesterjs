##4.0.0

### Connection string  
Following changes to the [MongoDB connection string specification](https://github.com/mongodb/specifications/commit/4631ccd4f825fb1a3aba204510023f9b4d193a05), connection string related configuration must now be URL-encoded.  
  
For example, whereas before `mongodb://u$ername:pa$$w{}rd@/tmp/mongodb-27017.sock/test` would have been a valid connection string (with username `u$ername`, password `pa$$w{}rd`, host `/tmp/mongodb-27017.sock` and auth database `test`), the connection string for those details would now have to be provided to harvesterJS as `mongodb://u%24ername:pa%24%24w%7B%7Drd@%2Ftmp%2Fmongodb-27017.sock/test`.

The easiest fix is to use the `mongodb-uri` module:
```javascript
const mongodbUri = require('mongodb-uri');
const harvester = require('harvesterjs');

// works with already encoded connection strings as well
const encodeMongoURI = (connectionString) => {
    if (connectionString) {
      return mongodbUri.format(mongodbUri.parse(connectionString));
    }
    return connectionString;
}

const options = {
  adapter: 'mongodb',
  connectionString: encodeMongoURI(connectionString),
  oplogConnectionString: encodeMongoURI(oplogConnectionString)
}

const harvesterApp = harvester(options);
```

### Options flags
The Mongoose options structure changed in the new version [Option Changes in Mongoose v5.x](https://mongoosejs.com/docs/connections.html#v5-changes).
If the flags field is provided in the HarvesterJS options it has value has to follow the new Mongoose v5.x structure.

##### Old Mongoose v4.x format
```javascript
const options = {
  adapter: 'mongodb',
  flags:  {
    server: {
      socketOptions: {
        socketTimeoutMS: 360000,
    },
    reconnectTries: 30,
  },
};

const harvesterApp = harvester(options);
```

##### New Mongoose v5.x format
```javascript
const options = {
  adapter: 'mongodb',
  flags:  {
    socketTimeoutMS: 360000,
    reconnectTries: 30,
  },
};

const harvesterApp = harvester(options);
```

##3.3.0
