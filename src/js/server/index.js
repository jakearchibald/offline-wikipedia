var appengine = require('appengine');
var express = require('express');
var rsvp = require('rsvp');

var app = express();

app.use(appengine.middleware.base);

app.get('/_ah/health', function(req, res) {
  res.set('Content-Type', 'text/plain');
  res.send(200, 'ok');
});

app.get('/_ah/start', function(req, res) {
  res.set('Content-Type', 'text/plain');
  res.send(200, 'ok');
});

app.get('/_ah/stop', function(req, res) {
  res.set('Content-Type', 'text/plain');
  res.send(200, 'ok');
  process.exit();
});

app.get('/', function(req, res) {
  // push header
  // push home body
  // push footer
  res.sendFile(__dirname + '/src/index.html');
});

app.get('/wiki/.*', function(req, res) {
  // api request title
  // api request body

  // push header
  // await title & push
  // await body & push
  // push footer
  res.sendFile(__dirname + '/src/index.html');
});

app.listen(8080, '0.0.0.0');
console.log('Listening on port 8080');
