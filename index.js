var RSVP = require('rsvp');
global.Promise = RSVP.Promise;
require('regenerator/runtime');
var fs = require('fs');
var express = require('express');
var compression = require('compression');
var readFile = RSVP.denodeify(fs.readFile);
var gzipStatic = require('connect-gzip-static');
var cookieParser = require('cookie-parser');
var url = require('url');
var zlib = require('zlib');
global.dust = require('dustjs-linkedin');

// dust templates
require('./server-templates/base');
require('./server-templates/index');
require('./server-templates/flags');
require('./server-templates/article-shell');
require('./server-templates/article');
require('./server-templates/article-stream');

var Flags = require('./isojs/flags');
var wikipedia = require('./wikipedia');
var wikiDisplayDate = require('./isojs/wiki-display-date');
var articleHeader = require('./shared-templates/article-header');

var app = express();

var inlineCss = readFile(__dirname + '/public/css/head.css', {encoding: 'utf8'});

var env = process.env.NODE_ENV;
var staticOptions = {
  maxAge: env === 'production' ? '500 days' : 0
};

app.set('port', (process.env.PORT || 8000));

app.use('/js', gzipStatic('public/js', staticOptions));
app.use('/css', gzipStatic('public/css', staticOptions));
app.use('/imgs', gzipStatic('public/imgs', staticOptions));
app.use('/sw.js', gzipStatic('public/sw.js', {
  maxAge: 0
}));
app.use('/manifest.json', gzipStatic('public/manifest.json'));

app.use(cookieParser(), (req, res, next) => {
  req.flags = new Flags(
    req.cookies.flags || '',
    url.parse(req.url).query || ''
  );

  next();
});

function sendDustTemplateOutput(req, res, name, data) {
  if (req.flags.get('disable-chunking')) {
    dust.render(name, data, (err, str) => res.send(str));
  }
  else {
    dust.stream(name, data).pipe(res);
  }
}

app.get('/', compression({
  flush: zlib.Z_PARTIAL_FLUSH
}), (req, res) => {
  res.status(200);
  res.type('html');
  sendDustTemplateOutput(req, res, 'index', {
    inlineCss: inlineCss,
    flags: req.flags.getAll()
  });
});

app.get('/flags', compression({
  flush: zlib.Z_PARTIAL_FLUSH
}), (req, res) => {
  res.status(200);
  res.type('html');
  sendDustTemplateOutput(req, res, 'flags', {
    title: "Flags",
    inlineCss: inlineCss,
    flags: req.flags.getAll()
  });
});

async function handlePageShellRequest(req, res) {
  res.status(200);
  res.type('html');
  sendDustTemplateOutput(req, res, 'article-shell', {
    inlineCss: inlineCss,
    flags: req.flags.getAll()
  });
}

app.get('/shell.html', compression({
  flush: zlib.Z_PARTIAL_FLUSH
}), handlePageShellRequest);

app.get(/\/wiki\/(.+)\.json/, compression(), async (req, res) => {
  var name = req.params[0];

  if (req.flags.get('avoid-wikipedia')) {
    var metaContent = new Promise(r => setTimeout(r, 900)).then(_ => {
      return readFile(__dirname + '/wikipedia/hogan.json').then(JSON.parse);
    });
  }
  else {
    var metaContent = wikipedia.getMetaData(name);
  }

  try {
    var metaContent = await metaContent;

    if (metaContent.err == "Not found") {
      res.status(404).json({
        err: metaContent.err
      });
      return;
    }

    res.json(metaContent);
  }
  catch (err) {
    console.log(err, err.stack);
    res.status(500).json({
      err: err.message
    });
  }
});

// TODO: this is a horrible copy & paste job from the main server-render route. Should be refactored.
app.get(/\/wiki\/(.+)\.middle\.inc/, compression({
  flush: zlib.Z_PARTIAL_FLUSH
}), async (req, res) => {
  try {
    var name = req.params[0];

    if (req.flags.get('avoid-wikipedia')) {
      var meta = readFile(__dirname + '/wikipedia/hogan.json').then(JSON.parse);
      var articleStream = new Promise(r => setTimeout(r, 900)).then(_ => {
        return fs.createReadStream(__dirname + '/wikipedia/hogan.html', {
          encoding: 'utf8'
        });
      });
    }
    else {
      var meta = wikipedia.getMetaData(name);
      if (req.flags.get('no-wiki-piping')) {
        var articleStream = wikipedia.getArticle(name);
      }
      else {
        var articleStream = wikipedia.getArticleStream(name);
      }
    }

    meta = meta.then(data => {
      data.updated = wikiDisplayDate(new Date(data.updated));
      data.server = true;
      data.safeTitle = JSON.stringify(data.title);
      data.safeUrlId = JSON.stringify(data.urlId);
      return data;
    });

    res.status(200);
    res.type('html');

    sendDustTemplateOutput(req, res, 'article-stream', {
      title: name.replace(/_/g, ' '),
      flags: req.flags.getAll(),
      content: articleStream,
      headerContent: meta.then(meta => articleHeader(meta))
    });
  }
  catch (err) {
    console.log(err, err.stack);
    res.write("ERRORD")
    res.end();
  }
});

app.get(/\/wiki\/(.+)\.inc/, compression({
  flush: zlib.Z_PARTIAL_FLUSH
}), async (req, res) => {
  var name = req.params[0];

  if (req.flags.get('avoid-wikipedia')) {
    await new Promise(r => setTimeout(r, 900));
    var articleStream = fs.createReadStream(__dirname + '/wikipedia/hogan.html', {
      encoding: 'utf8'
    });
  }
  else {
    var articleStream = wikipedia.getArticleStream(name);
  }

  try {
    res.status(200);
    res.type('html');
    articleStream.pipe(res);
  }
  catch (err) {
    console.log(err, err.stack);
    res.send(500, "Failed");
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

app.get(/\/wiki\/(.*)/, compression({
  flush: zlib.Z_PARTIAL_FLUSH
}), (req, res) => {
  try {
    if (req.flags.get('client-render')) {
      handlePageShellRequest(req, res);
      return;
    }

    var name = req.params[0];

    if (req.flags.get('avoid-wikipedia')) {
      var meta = readFile(__dirname + '/wikipedia/hogan.json').then(JSON.parse);
      var articleStream = new Promise(r => setTimeout(r, 900)).then(_ => {
        return fs.createReadStream(__dirname + '/wikipedia/hogan.html', {
          encoding: 'utf8'
        });
      });
    }
    else {
      var meta = wikipedia.getMetaData(name);
      if (req.flags.get('no-wiki-piping')) {
        var articleStream = wikipedia.getArticle(name);
      }
      else {
        var articleStream = wikipedia.getArticleStream(name);
      }
    }

    meta = meta.then(data => {
      data.updated = wikiDisplayDate(new Date(data.updated));
      data.server = true;
      data.safeTitle = JSON.stringify(data.title);
      data.safeUrlId = JSON.stringify(data.urlId);
      return data;
    });

    res.status(200);
    res.type('html');

    sendDustTemplateOutput(req, res, 'article', {
      title: name.replace(/_/g, ' '),
      inlineCss: inlineCss,
      flags: req.flags.getAll(),
      content: articleStream,
      headerContent: meta.then(meta => articleHeader(meta))
    });
  }
  catch (err) {
    console.log(err, err.stack);
    res.write("ERRORD")
    res.end();
  }
});

app.listen(app.get('port'), function() {
  console.log("Server listening at localhost:" + app.get('port'));
});
