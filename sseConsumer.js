let ess = require('agco-event-source-stream');
console.log('starting consumer');

var eventSource = ess('http://localhost:9000/people/changes/stream', {
  retry: false,
}).on('data', function(res) {
  // lastEventId = res.id;
  console.log('res', res);
  
  var data = JSON.parse(res.data);
  // console.log('data', data);
  
  // ignore ticker data
  
  // eventSource.destroy();
});