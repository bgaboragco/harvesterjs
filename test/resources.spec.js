'use strict';
let should = require('should');
let _ = require('lodash');
let Promise = require('bluebird');
let request = require('supertest');
let fixtures = require('./fixtures');

let seeder = require('./seeder.js');

describe('resources', function() {
  var config, ids;
  beforeEach(function() {
    config = this.config;
    return seeder(this.harvesterApp)
      .dropCollectionsAndSeed('people', 'pets')
      .then(function(_ids) {
        ids = _ids;
      });
  });

  describe('getting a list of resources', function() {
    _.each(ids, function(resources, key) {
      it('in collection "' + key + '"', function(done) {
        request(config.baseUrl)
          .get('/' + key)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(error, response) {
            should.not.exist(error);
            var body = JSON.parse(response.text);
            ids[key].forEach(function(id) {
              _.includes(_.map(body[key], 'id'), id).should.equal(true);
            });
            done();
          });
      });
    });
  });

  describe('getting each individual resource', function() {
    _.each(ids, function(resources, key) {
      it('in collection "' + key + '"', function(done) {
        Promise.all(
          ids[key].map(function(id) {
            return new Promise(function(resolve) {
              request(config.baseUrl)
                .get('/' + key + '/' + id)
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(error, response) {
                  should.not.exist(error);
                  var body = JSON.parse(response.text);
                  body[key].forEach(function(resource) {
                    resource.id.should.equal(id);
                  });
                  resolve();
                });
            });
          })
        ).then(function() {
          done();
        });
      });
    });
  });

  describe('posting a duplicate resource', function() {
    it("in collection 'people'", function(done) {
      var body = { people: [] };
      body.people.push(_.cloneDeep(fixtures().people[0]));
      body.people[0].id = ids.people[0];
      Promise.all(
        [ids.people[0]].map(function() {
          return new Promise(function(resolve) {
            request(config.baseUrl)
              .post('/people/')
              .send(body)
              .expect('Content-Type', /json/)
              .expect(409)
              .end(function(error, response) {
                should.not.exist(error);
                should.exist(response.error);
                resolve();
              });
          });
        })
      ).then(function() {
        done();
      });
    });
  });

  describe('posting a resource with a namespace', function() {
    it('should post without a special key', function(done) {
      var cat = {
          name: 'Spot',
          hasToy: true,
          numToys: 0,
        },
        body = { cats: [] };
      body.cats.push(cat);
      request(config.baseUrl)
        .post('/animals/cats')
        .send(body)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(done);
    });
  });
});
