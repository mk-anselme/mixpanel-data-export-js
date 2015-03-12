var MixpanelExport = require('../../src/mixpanel_data_export');
var assert = require('assert');
var Q = require("q");

var test_start_date = "2015-03-09";
var test_end_date = "2015-03-10";

describe('ExportStream', function() {

  var panel;

  beforeEach(function() {
    panel = new MixpanelExport({
      api_key: "api_key",
      api_secret: "api_secret",
      streaming_mode: true      
    });
  });

  describe('the method', function() {

    it('should return the same results using streaming or full pull', function(done) {
      this.timeout(30000);
      var fetch_by_streaming = function() {
        var deferred = Q.defer();
        var mp_export = panel.exportStream({
            from_date: test_start_date,
            to_date: test_end_date
        });
        var data_from_streaming = [];
        mp_export.on('data', function(data) {
          data_from_streaming.push(data);
        });
        mp_export.on('error', function(err) {
          return deferred.reject(err);
        });
        mp_export.on('end', function() {
          return deferred.resolve(data_from_streaming);
        });
        mp_export.run();   
        return deferred.promise;     
      };
      fetch_by_streaming().
        then(function(data_from_streaming) {
          console.log('data from streaming have been fetched: ' + data_from_streaming.length + ' records');
          panel.export({
              from_date: test_start_date,
              to_date: test_end_date
            })
            .then(function(data_from_full_batch) {
              console.log('data from full pull have been fetched: ' + data_from_full_batch.length + ' records');
              assert(data_from_streaming.length === data_from_full_batch.length);
              done();
            });
        })
        .catch(function(err){
          console.error(err);
          done(err);
        });
      
    });

    it('should stream objects and make pauses/resumes', function(done) {
      this.timeout(30000);
      // create a export object
      var mp_export = panel.exportStream({
          from_date: test_start_date,
          to_date: test_end_date
      });
      var small_batch_length = 5;
      var process_a_batch = function(small_batch, callback) {
            // console.log(small_batch);
            // console.log('small batch size: ' + small_batch.length);
            setTimeout(callback, 5);
      };
      var buffer = [];
      // listen on data. Each data is a event json object from mixpanel
      mp_export.on('data', function(data) {
        buffer.push(data);
        if (buffer.length > small_batch_length) {
          // pause downloading of records while we process a batch
          mp_export.pause();
          // extract a small batch for the buffer
          var small_batch = buffer.splice(0,small_batch_length-1);
          process_a_batch(small_batch, function(){
            // resume download after small batch has been processed
            mp_export.resume();
          });
        }
      });
      // listen for error
      mp_export.on('error', function(err) {
        done(err);
      });
      // listen for the end of the stream
      mp_export.on('end', function() {
        // process the last batch
        process_a_batch(buffer, done);
      });
      // start the export
      mp_export.run();
    });

  });

});