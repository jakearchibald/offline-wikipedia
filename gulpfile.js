var fs = require('fs');
var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var runSequence = require('run-sequence');
var through = require('through2');
var watchify = require('watchify');
var browserify = require('browserify');
var uglifyify = require('uglifyify');
var mergeStream = require('merge-stream');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var babelify = require('babelify');
var hbsfy = require("hbsfy");
var spawn = require('child_process').spawn;
var Promise = require('rsvp').Promise;

gulp.task('clean', function (done) {
  require('del')(['dist/*', '!dist/node_modules', '!dist/.git'], done);
});

gulp.task('html', function () {
  return gulp.src([
    'public/*.html'
  ]).pipe(gulp.dest('dist/public'));
});

gulp.task('css', function () {
  return gulp.src('public/css/*.scss', {base: './'})
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.sass({ outputStyle: 'compressed' }))
    .pipe(plugins.sourcemaps.write('./'))
    .pipe(gulp.dest('dist'));
});

gulp.task('misc', function () {
  return gulp.src([
    // Copy all files
    'public/**',
    // Exclude the following files
    // (other tasks will handle the copying of these files)
    '!public/*.html',
    '!public/{css,css/**}',
    '!public/{js,js/**}'
  ]).pipe(gulp.dest('dist/public'));
});

function createBundler(src) {
  var b;

  if (plugins.util.env.production) {
    b = browserify();
  }
  else {
    b = browserify({
      cache: {}, packageCache: {}, fullPaths: true,
      debug: true
    });
  }

  b.transform(babelify.configure({
    stage: 1
  }));

  b.transform(hbsfy);

  if (plugins.util.env.production) {
    b.transform({
      global: true
    }, 'uglifyify');
  }

  b.add(src);
  return b;
}

var bundlers = {
  'js/page.js': createBundler('./public/js/page/index.js'),
  'js/fetch.js': createBundler('./public/js/fetch/index.js'),
  'js/promise-polyfill.js': createBundler('./public/js/promise-polyfill/index.js'),
  'js/fastclick.js': createBundler('./public/js/fastclick/index.js'),
  'sw.js': plugins.util.env['disable-sw'] ? createBundler('./public/js/sw-null/index.js') : createBundler('./public/js/sw/index.js')
};

function bundle(bundler, outputPath) {
  var splitPath = outputPath.split('/');
  var outputFile = splitPath[splitPath.length - 1];
  var outputDir = splitPath.slice(0, -1).join('/');

  return bundler.bundle()
    // log errors if they happen
    .on('error', plugins.util.log.bind(plugins.util, 'Browserify Error'))
    .pipe(source(outputFile))
    .pipe(buffer())
    .pipe(plugins.sourcemaps.init({ loadMaps: true })) // loads map from browserify file
    .pipe(plugins.sourcemaps.write('./')) // writes .map file
    .pipe(plugins.size({ gzip: true, title: outputFile }))
    .pipe(gulp.dest('dist/public/' + outputDir));
}

gulp.task('js', function () {
  return mergeStream.apply(null,
    Object.keys(bundlers).map(function(key) {
      return bundle(bundlers[key], key);
    })
  );
});

var rmOrig = function() {
  return through.obj(function(file, enc, cb) {

    if (file.revOrigPath) {
      fs.unlink(file.revOrigPath);
    }

    this.push(file); // Pass file when you're done
    return cb(); // notify through2 you're done
  });
};

gulp.task('rev', function () {
  return gulp.src([
    'dist/public/{css,js,imgs}/**'
  ])
    .pipe(plugins.rev())
    .pipe(gulp.dest('dist/public'))
    .pipe(rmOrig())
    .pipe(plugins.rev.manifest())
    .pipe(gulp.dest('dist/'));
});

gulp.task('updaterefs', function () {
  var manifest = gulp.src("dist/rev-manifest.json");

  return gulp.src([
    'dist/index.js',
    'dist/public/**',
    'dist/shared-templates/**'
  ], {base: 'dist'})
    .pipe(plugins.revReplace({
      manifest: manifest,
      replaceInExtensions: ['.js', '.css', '.html', '.hbs', '.json']
    }))
    .pipe(gulp.dest('dist'));
});

gulp.task('compress', function () {
  return gulp.src([
    'dist/public/**/*.{js,css}',
    'dist/public/sw.js',
    'dist/public/manifest.json'
  ], {base: 'dist'})
    .pipe(plugins.gzip({append: true}))
    .pipe(gulp.dest('dist'));
});

gulp.task('server:package', function () {
  return gulp.src('server-package.json')
  .pipe(plugins.rename(function(path) {
    path.basename = 'package';
  })).pipe(gulp.dest('dist'));
});

gulp.task('server:misc', function () {
  return gulp.src([
    '.gitignore',
    'Procfile',
    'wikipedia/**/*.{html,json}'
  ], {base: './'})
  .pipe(gulp.dest('dist'));
});

gulp.task('server:js', function () {
  return gulp.src([
    'index.js',
    'wikipedia/**/*.js',
    'isojs/**/*.js'
  ], {base: './'})
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.babel({stage: 1}))
    .pipe(plugins.sourcemaps.write('.'))
    .pipe(gulp.dest('dist'));
});

gulp.task('server:sharedtemplates', function () {
  return gulp.src('shared-templates/*.hbs')
    .pipe(plugins.handlebars())
    .pipe(through.obj(function(file, enc, callback) {
      // Don't want the whole lib
      file.defineModuleOptions.require = {Handlebars: 'handlebars/runtime'};
      callback(null, file);
    }))
    .pipe(plugins.defineModule('commonjs'))
    .pipe(plugins.rename(function(path) {
      path.extname = '.js';
    }))
    .pipe(gulp.dest('dist/shared-templates'));
});

gulp.task('server:templates', function () {
  return gulp.src('server-templates/*.dust')
    .pipe(plugins.dust({
      name: function(file) {
        return file.relative.replace(/\.dust$/, '');
      }
    }))
    .pipe(gulp.dest('dist/server-templates'));
});

gulp.task('watch', function () {
  gulp.watch(['public/*.html'], ['html']);
  gulp.watch(['public/**/*.scss'], ['css']);
  gulp.watch(['index.js', 'wikipedia/**'], ['server:js']);
  gulp.watch(['shared-templates/*.hbs'], ['server:sharedtemplates']);
  gulp.watch(['server-templates/*.dust'], ['server:templates']);

  Object.keys(bundlers).forEach(function(key) {
    var watchifyBundler = watchify(bundlers[key]);
    watchifyBundler.on('update', function() {
      return bundle(watchifyBundler, key);
    });
    bundle(watchifyBundler, key);
  });
});

var buildSequence = ['clean', ['css', 'misc', 'html', 'js', 'server:package', 'server:misc', 'server:js', 'server:sharedtemplates', 'server:templates']];
var productionBuildSequence = buildSequence.concat(['rev', 'updaterefs', 'compress']);

gulp.task('build', function() {
  return runSequence.apply(null, buildSequence);
});

gulp.task('productionbuild', function() {
  return runSequence.apply(null, productionBuildSequence);
});

gulp.task('server:serve', function() {
  plugins.developServer.listen({
    path: './index.js',
    cwd: './dist'
  });
  gulp.watch([
    'dist/index.js',
    'dist/shared-templates/flags.js',
    'dist/public/index-end.html',
    'dist/public/css/all.css',
    'dist/server-templates/base.js'
  ], plugins.developServer.restart);
});

gulp.task('serve', function() {
  return runSequence.apply(null, buildSequence.concat([['server:serve', 'watch']]));
});

gulp.task('productionserve', function() {
  return runSequence.apply(null, productionBuildSequence.concat([['server:serve']]));
});

gulp.task('deploy', function() {
  return runSequence.apply(null, productionBuildSequence.concat([plugins.shell.task([
    'git init',
    'heroku git:remote -a wiki-offline',
    'git add -A',
    'git commit --message "Build"',
    'git push heroku'
  ], {cwd: __dirname + '/dist'})]));
});

gulp.task('default', ['build']);
