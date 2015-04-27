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
var Readable = require('stream').Readable;
global.dust = require('dustjs-linkedin');

// dust templates
require('./server-templates/base');
require('./server-templates/index');
require('./server-templates/flags');
require('./server-templates/article-shell');
require('./server-templates/article');

var Flags = require('./isojs/flags');
var wikipedia = require('./wikipedia');
var wikiDisplayDate = require('./isojs/wiki-display-date');
var articleHeader = require('./shared-templates/article-header');

var app = express();

var inlineCss = readFile(__dirname + '/public/css/all.css', {encoding: 'utf8'});

var env = process.env.NODE_ENV;
var staticOptions = {
  maxAge: env === 'production' ? '500 days' : 0
};

app.set('port', (process.env.PORT || 8000));

app.use('/js', gzipStatic('public/js', staticOptions));
app.use('/css', gzipStatic('public/css', staticOptions));
app.use('/imgs', gzipStatic('public/imgs', staticOptions));
app.use('/sw.js', gzipStatic('public/sw.js'));
app.use('/manifest.json', gzipStatic('public/manifest.json'));

app.use(cookieParser(), (req, res, next) => {
  req.flags = new Flags(
    req.cookies.flags || '',
    url.parse(req.url).query || ''
  );

  next();
});

app.get('/', compression(), (req, res) => {
  res.status(200);
  res.type('html');
  var stream = dust.stream('index', {
    inlineCss: inlineCss,
    flags: req.flags.getAll()
  });
  stream.pipe(res);
});

app.get('/flags', compression(), (req, res) => {
  res.status(200);
  res.type('html');

  var stream = dust.stream('flags', {
    title: "Flags",
    inlineCss: inlineCss,
    flags: req.flags.getAll()
  });
  stream.pipe(res);
});

async function handlePageShellRequest(req, res) {
  res.status(200);
  res.type('html');
  var stream = dust.stream('article-shell', {
    inlineCss: inlineCss,
    flags: req.flags.getAll()
  });
  stream.pipe(res);
}

app.get('/shell.html', compression(), handlePageShellRequest);

app.get('/wiki/:name.json', compression(), async (req, res) => {
  var name = req.params.name;

  if (req.flags.get('avoid-wikipedia')) {
    var metaContent = readFile(__dirname + '/wikipedia/hogan.json').then(JSON.parse);
    var articleContent = readFile(__dirname + '/wikipedia/hogan.html', {
      encoding: 'utf8'
    });
  }
  else {
    var metaContent = wikipedia.getMetaData(name);
    var articleContent = wikipedia.getArticle(name);
  }

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

// A simple stream that calls a callback once read
// Bit of a hack, allows me to call flush() at particular
// bits of template action
class OnReader extends Readable {
  constructor(func) {
    super();
    this._func = func;
  }

  _read() {
    this._func();
    this.push(null);
  }
}

app.get('/wiki/:name', compression(), (req, res) => {
  try {
    if (req.flags.get('client-render')) {
      handlePageShellRequest(req, res);
      return;
    }
    
    var name = req.params.name;

    if (req.flags.get('avoid-wikipedia')) {
      var meta = readFile(__dirname + '/wikipedia/hogan.json').then(JSON.parse);
      /*var articleStream = fs.createReadStream(__dirname + '/wikipedia/hogan.html', {
        encoding: 'utf8'
      });*/
      var articleStream = new Promise(r => setTimeout(r, 5000)).then(_ => readFile(__dirname + '/wikipedia/hogan.html', {
        encoding: 'utf8'
      }));
    }
    else {
      var meta = wikipedia.getMetaData(name);
      var articleStream = wikipedia.getArticleStream(name);
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

    var stream = dust.stream('article', {
      title: name.replace(/_/g, ' '),
      inlineCss: inlineCss,
      flags: req.flags.getAll(),
      beforeContent: new OnReader(_ => res.flush()),
      content: articleStream,
      headerContent: meta.then(meta => articleHeader(meta))
    });

    stream.pipe(res);
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
