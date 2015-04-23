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

gulp.task('clean', function (done) {
  require('del')(['dist'], done);
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
  })).pipe(gulp.dest('dist/src'));
});

gulp.task('css', function () {
  return gulp.src('src/css/*.scss')
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.sass({ outputStyle: 'compressed' }))
    .pipe(plugins.sourcemaps.write('./'))
    .pipe(gulp.dest('dist/src/css'))
    .pipe(plugins.filter('**/*.css'));
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
  ]).pipe(gulp.dest('dist/src'));
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
  'js/fetch.js': createBundler('./src/js/fetch/index.js'),
  'js/promise-polyfill.js': createBundler('./src/js/promise-polyfill/index.js'),
  'js/fastclick.js': createBundler('./src/js/fastclick/index.js'),
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
    .pipe(gulp.dest('dist/src/' + outputDir));
}

gulp.task('js', function () {
  return mergeStream.apply(null,
    Object.keys(bundlers).map(function(key) {
      return bundle(bundlers[key], key);
    })
  );
});

gulp.task('server:misc', function () {
  return gulp.src([
    // Copy all files
    'server/**',
    // Exclude the following files
    // (other tasks will handle the copying of these files)
    '!server/{node_modules,node_modules/**}',
    '!server/**/*.js'
  ]).pipe(gulp.dest('dist'));
});

gulp.task('server:js', function () {
  return gulp.src([
    'server/**/*.js',
    '!server/{node_modules,node_modules/**}'
  ]).pipe(plugins.sourcemaps.init())
    .pipe(plugins.babel({stage: 1}))
    .pipe(plugins.sourcemaps.write('.'))
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', function () {
  gulp.watch(['src/*.html'], ['html']);
  gulp.watch(['src/**/*.scss'], ['css']);
  gulp.watch(['server/**/*', '!server/*.js'], ['server:misc']);
  gulp.watch(['server/**/*.js'], ['server:js']);

  Object.keys(bundlers).forEach(function(key) {
    var watchifyBundler = watchify(bundlers[key]);
    watchifyBundler.on('update', function() {
      return bundle(watchifyBundler, key);
    });
    bundle(watchifyBundler, key);
  });
});

var buildSequence = ['clean', ['css', 'misc', 'html', 'js', 'server:misc', 'server:js']];

gulp.task('build', function() {
  return runSequence.apply(null, buildSequence);
});

gulp.task('server:serve', plugins.shell.task([
  'boot2docker init',
  'boot2docker up',
  '$(boot2docker shellinit)',
  'gcloud preview app run app.yaml'
], {
  cwd: __dirname + '/dist'
}));

gulp.task('serve', function() {
  return runSequence.apply(null, buildSequence.concat([['server:serve', 'watch']]));
});

gulp.task('local-serve', function() {
  return runSequence.apply(null, buildSequence.concat([['server:local', 'watch']]));
});

gulp.task('default', ['build']);
