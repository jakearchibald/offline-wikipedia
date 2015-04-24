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
  require('del')(['dist'], done);
});

gulp.task('html', function () {
  return gulp.src([
    'public/*.html'
  ]).pipe(gulp.dest('dist/public'));
});

gulp.task('css', function () {
  return gulp.src('public/css/*.scss')
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.sass({ outputStyle: 'compressed' }))
    .pipe(plugins.sourcemaps.write('./'))
    .pipe(gulp.dest('dist/public/css'))
    .pipe(plugins.filter('**/*.css'));
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

gulp.task('server:package', function () {
  return gulp.src('server-package.json')
  .pipe(plugins.rename(function(path) {
    path.basename = 'package';
  })).pipe(gulp.dest('dist'));
});

gulp.task('server:js', function () {
  return gulp.src([
    'index.js',
    'server/wikipedia/*.js'
  ]).pipe(plugins.sourcemaps.init())
    .pipe(plugins.babel({stage: 1}))
    .pipe(plugins.sourcemaps.write('.'))
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', function () {
  gulp.watch(['public/*.html'], ['html']);
  gulp.watch(['public/**/*.scss'], ['css']);
  gulp.watch(['server/**/*', '!server/**/*.js'], ['server:package']);
  gulp.watch(['server/**/*.js'], ['server:js']);

  Object.keys(bundlers).forEach(function(key) {
    var watchifyBundler = watchify(bundlers[key]);
    watchifyBundler.on('update', function() {
      return bundle(watchifyBundler, key);
    });
    bundle(watchifyBundler, key);
  });
});

var buildSequence = ['clean', ['css', 'misc', 'html', 'js', 'server:package', 'server:js']];

gulp.task('build', function() {
  return runSequence.apply(null, buildSequence);
});

gulp.task('server:serve', function() {
  require('./dist');
});

gulp.task('serve', function() {
  return runSequence.apply(null, buildSequence.concat([['server:serve', 'watch']]));
});

gulp.task('default', ['build']);
