var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var runSequence = require('run-sequence');
var through = require('through2');
var browserSync = require('browser-sync');
var watchify = require('watchify');
var browserify = require('browserify');
var uglifyify = require('uglifyify');
var mergeStream = require('merge-stream');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var babelify = require('babelify');
var hbsfy = require("hbsfy");

var reload = browserSync.reload;

gulp.task('clean', function (done) {
  require('del')(['dist'], done);
});

gulp.task('browser-sync', function() {
  browserSync({
    notify: false,
    port: 8000,
    server: "dist",
    open: false
  });
});

gulp.task('html', function () {
  return gulp.src([
    'src/index.html',
  ])
  .pipe(plugins.swig({
    defaults: { cache: false }
  }))
  .pipe(plugins.htmlmin({
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    minifyJS: true,
    removeAttributeQuotes: true,
    removeComments: true,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    removeRedundantAttributes: true,
  })).pipe(gulp.dest('dist'))
    .pipe(reload({stream: true}));
});

gulp.task('css', function () {
  return gulp.src('src/css/*.scss')
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.sass({ outputStyle: 'compressed' }))
    .pipe(plugins.sourcemaps.write('./'))
    .pipe(gulp.dest('dist/css'))
    .pipe(plugins.filter('**/*.css'))
    .pipe(reload({stream: true}));
});

gulp.task('misc', function () {
  return gulp.src([
    // Copy all files
    'src/**',
    // Exclude the following files
    // (other tasks will handle the copying of these files)
    '!src/*.html',
    '!src/{css,css/**}',
    '!src/{js,js/**}'
  ]).pipe(gulp.dest('dist'));
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
  'js/page.js': createBundler('./src/js/page/index.js'),
  'sw.js': plugins.util.env['disable-sw'] ? createBundler('./src/js/sw-null/index.js') : createBundler('./src/js/sw/index.js')
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
    .pipe(gulp.dest('dist/' + outputDir))
    .pipe(reload({ stream: true }));
}

gulp.task('js', function () {
  return mergeStream.apply(null,
    Object.keys(bundlers).map(function(key) {
      return bundle(bundlers[key], key);
    })
  );
});

gulp.task('watch', ['build'], function () {
  gulp.watch(['src/*.html'], ['html']);
  gulp.watch(['src/**/*.scss'], ['css']);

  Object.keys(bundlers).forEach(function(key) {
    var watchifyBundler = watchify(bundlers[key]);
    watchifyBundler.on('update', function() {
      return bundle(watchifyBundler, key);
    });
    bundle(watchifyBundler, key);
  });
});

gulp.task('build', function() {
  return runSequence('clean', ['css', 'misc', 'html', 'js']);
});

gulp.task('serve', ['browser-sync', 'watch']);
gulp.task('default', ['build']);
