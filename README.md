
Mixpanel Data Export with some streaming capabilities for Event Export
========================================================================

This is a fork of Michael's [Mixpanel Data Export](https://github.com/michaelcarter/mixpanel-data-export-js). 

WHAT
-----
It implements a stream(ish) interface to export events from Mixpanel.

WHY
-----
The mixpanel data exporter was consuming too much memory when pulling large data sets. Streaming allows for pulling some data, process it and releasing it.

HOW TO INSTALL
---------------

No npm repo. Clone and then ```npm install``` to install the dependencies.


HOW TO USE
---------------

Simple example:

```
// create a export object
var mp_export = panel.exportStream({
    from_date: "2015-03-01",
    to_date: "2015-03-02"
});
// listen on data. Each data is a event json object from mixpanel
mp_export.on('data', function(data) {
  // do something with it
});
// listen for error
mp_export.on('error', function(err) {
  // handle error
});
// listen for the end of the stream
mp_export.on('end', function() {
  // move on to do other stuff
});
// start the export
mp_export.run();
```

Example with doing **pause** and **resume** while processing the data as it comes.

```
// create a export object
var mp_export = panel.exportStream({
    from_date: "2015-03-01",
    to_date: "2015-03-02"
});
var small_batch_length = 100;
var process_a_batch = function(small_batch, callback) {
      // do something with the batch
      setTimeout(callback, 1000);
};
var buffer = [];
// listen on data. Each data is a event json object from mixpanel
mp_export.on('data', function(data) {
  // add data to buffer array
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
```
