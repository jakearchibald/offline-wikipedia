var RSVP = require('rsvp');
global.Promise = RSVP.Promise;
require('regenerator/runtime');
var fs = require('fs');
var express = require('express');
var compression = require('compression');
var readFile = RSVP.denodeify(fs.readFile);

var wikipedia = require('./wikipedia');
var articleContent = require('./shared-templates/article-content');
var articleHeader = require('./shared-templates/article-header');

var app = express();
var indexTop = readFile(__dirname + '/public/index-top.html', {encoding: 'utf8'});
var indexMiddle = readFile(__dirname + '/public/index-middle.html', {encoding: 'utf8'});
var indexBottom = readFile(__dirname + '/public/index-end.html', {encoding: 'utf8'});

app.set('port', (process.env.PORT || 8000));

app.use('/js', express.static('public/js'));
app.use('/css', express.static('public/css'));
app.use('/imgs', express.static('public/imgs'));
app.use('/sw.js', express.static('public/sw.js'));
app.use('/manifest.json', express.static('public/manifest.json'));

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

app.get('/', compression(), async (req, res) => {
  // push header
  // push home body
  // push footer
  res.status(200);
  res.type('html');
  res.write(await indexTop);
  res.write(await indexMiddle);
  res.write(await indexBottom);
  res.end();
});

app.get('/wiki/:name.json', compression(), async (req, res) => {
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

app.get('/search.json', compression(), async (req, res) => {
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

app.get('/wiki/:name', compression(), async (req, res) => {
  try {
    var name = req.params.name;
    var meta = wikipedia.getMetaData(name);
    var articleStream = wikipedia.getArticleStream(name);

    res.status(200);
    res.type('html');
    res.write(await indexTop);
    res.flush();
    res.write(articleHeader(await meta));
    res.write(await indexMiddle);
    res.flush();
    res.write('<div id="content_wrapper" class="content card-content server-rendered">');
    articleStream.pipe(res, {end: false});
    await new Promise(r => articleStream.on('end', r));
    res.write('</div>');
    res.write(await indexBottom);
    res.end();
  }
  catch (err) {
    console.log(err, err.stack);
    res.write("ERRORD")
    res.end();
  }
});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});
