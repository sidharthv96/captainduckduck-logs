var Docker = require('dockerode');
var fs     = require('fs');
var stream = require('stream');
const dgram = require('dgram')
const split = require('split')
const chrono = require('chrono-node')
const JSON5 = require('json5')
const yargs = require('yargs')
const map = require('through2-map')

var docker = new Docker({
  socketPath: '/var/hrun/docker.sock'
});

let isClosed = false
let isSending = 0
let socket = dgram.createSocket('udp4')


socket.bind(function () {
  socket.setBroadcast(true)
})


/**
 * Get logs from running container
 */
function containerLogs(container, image) {

  // create a single stream for stdin and stdout
  var logStream = new stream.PassThrough();
  let baseMessage = { id: image };
  logStream.on('data', function (line) {
    let timestamp = null;
    console.log(line);

    // try {
    //   // try to JSON parse
    //   line = JSON5.parse(line);
    // } catch (err) {
    //   // look for timestamps if not an object
    //   timestamp = chrono.parse(line)[0];
    // }

    // if (timestamp) {
    //   // escape for regexp and remove from line
    //   timestamp.text = timestamp.text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    //   line = line.replace(new RegExp(' *[^ ]?' + timestamp.text + '[^ ]? *'), '');
    //   // use timestamp as line timestamp
    //   baseMessage.timestamp = Date.parse(timestamp.start.date());
    // } else {
      baseMessage.timestamp = Date.now();
    // }

    // update default message
    baseMessage.content = line;

    // prepare binary message
    let buffer = new Buffer(JSON.stringify(baseMessage));

    // set semaphore
    isSending ++;

    socket.send(buffer, 0, buffer.length, "9091", "localhost", function () {
      isSending --;
      if (isClosed && !isSending) socket.close();
    })
  });

  container.logs({
    follow: true,
    stdout: true,
    stderr: true
  }, function(err, stream){
    if(err) {
        console.log(err.message);
      return;
    }
    container.modem.demuxStream(stream, logStream, logStream);
    stream.on('end', function(){
      logStream.end('!stop!');
    });

  });
}

var opts = {
    "all": false,    
  };

docker.listContainers(opts, function(err, containers) {
    containers.forEach(function(data){
      console.log('====================================');
      console.log(data);
      console.log(data.Id);
      console.log(data.Image);
      console.log('====================================');
        containerLogs(docker.getContainer(data.Id),data.Image);
    });
});