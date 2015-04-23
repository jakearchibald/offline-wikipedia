
var RSVP = require('rsvp');
global.Promise = RSVP.Promise;
require('regenerator/runtime');
var express = require('express');
var appengine = require('appengine');
var memcacheGet = RSVP.denodeify(appengine.memcache.get);
var memcacheSet = RSVP.denodeify(appengine.memcache.set);

var wikipedia = require('./wikipedia');

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

app.get('/wiki/:name.json', async (req, res) => {
  var name = req.params.name;

  // waiting on https://github.com/GoogleCloudPlatform/appengine-nodejs/issues/45
  /*var metaContent = memcacheGet(req, `meta-${name}`).then(data => {
    if (data) return JSON.parse(data);

    return wikipedia.getMetaData(name).then(data => {
      memcacheSet(req, `meta-${name}`, JSON.stringify(data));
      return data;
    });
  });

  var articleContent = memcacheGet(req, `article-${name}`).then(html => {
    if (html) return html;

    return wikipedia.getArticle(name).then(html => {
      memcacheSet(req, `article-${name}`, html);
      return html;
    })
  })*/

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

app.get('/search', async (req, res) => {
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

app.get('/wiki/*', function(req, res) {
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
