docker run -it --link examples_db_1:db --rm mongo:4.0 mongo db/admin --eval "rs.initiate({_id: 'test', members: [{_id: 0, host: '127.0.0.1:27017'}]})"
