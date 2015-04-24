var RSVP = require('rsvp');
global.Promise = RSVP.Promise;
require('regenerator/runtime');
var fs = require('fs');
var express = require('express');
var readFile = RSVP.denodeify(fs.readFile);

var wikipedia = require('./wikipedia');

var app = express();
var indexTop = readFile(__dirname + '/src/index-top.html', {encoding: 'utf8'});
var indexMiddle = readFile(__dirname + '/src/index-middle.html', {encoding: 'utf8'});
var indexBottom = readFile(__dirname + '/src/index-end.html', {encoding: 'utf8'});

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

app.get('/', async (req, res) => {
  // push header
  // push home body
  // push footer
  res.status(200);
  res.type('html');
  indexTop.then(val => console.log(val));
  res.write(await indexTop);
  res.write(await indexMiddle);
  await new Promise(r => setTimeout(r, 4000));
  res.write(await indexBottom);
  res.end();
});

app.get('/wiki/:name.json', async (req, res) => {
  var name = req.params.name;

  var metaContent = wikipedia.getMetaData(name);
  var articleContent = wikipedia.getArticle(name);

  try {
    var metaContent = await metaContent;

    if (metaContent.err == "Not found") {
      res.json(404, {
        err: metaContent.err
      });
      return;
    }

    res.json({
      meta: metaContent,
      article: await articleContent
    });
  }
  catch (err) {
    console.log(err, err.stack);
    res.json(500, {
      err: err.message
    });
  }
});

app.get('/search.json', async (req, res) => {
  var term = (req.query.s || '').trim();

  if (!term) {
    res.json([]);
    return;
  }

  try {
    res.json(await wikipedia.search(req.query.s));
  }
  catch (err) {
    console.log(err, err.stack);
    res.json(500, {
      err: err.message
    });
  }
});

app.get('/wiki/:name', async (req, res) => {
  var name = req.params.name;
  //var meta = wikipedia.getMetaData(name);
  //var article = wikipedia.getArticle(name);

  // push header
  // await title & push
  // await body & push
  // push footer
  res.sendFile(__dirname + '/src/index.html');
});

app.listen(8080, '0.0.0.0');
console.log('Listening on port 8080');
