/*
 * The MIT License
 *
 * Copyright (c) 2015, Sebastian Sdorra
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


var gulp = require('gulp');
var connect = require('gulp-connect');
var modRewrite = require('connect-modrewrite');
var $ = require('gulp-load-plugins')();
var imagemin = require('gulp-imagemin');
var imageminPngcrush = require('imagemin-pngcrush');
var del = require('del');
var jsReporter = require('jshint-stylish');
var pkg = require('./package.json');
var name = pkg.name;

var templateOptions = {
  root: '../src/templates',
  module: 'adf'
};

var annotateOptions = {
  enable: [
    'angular-dashboard-framework'
  ]
};

var minifyHtmlOptions = {
  empty: true,
  loose: true
};

var paths = {
 images: ['release/widgets/**/dist/img/*.*'],
 extras: ['crossdomain.xml', 'humans.txt', 'manifest.appcache', 'robots.txt', 'favicon.ico'],
};

/** lint **/
gulp.task('csslint', function(){
  gulp.src('src/styles/*.css')
      .pipe($.csslint())
      .pipe($.csslint.reporter());
});

gulp.task('jslint', function(){
  gulp.src('src/scripts/*.js')
      .pipe($.jshint())
      .pipe($.jshint.reporter(jsReporter));
});

gulp.task('lint', ['csslint', 'jslint']);

/** clean **/

gulp.task('clean', function(cb){
  del(['dist', '.tmp'], cb);
});

/** build **/

gulp.task('styles', function(){
  gulp.src(['src/styles/**/*.scss'])
      .pipe($.sass({
        precision: 10,
        outputStyle: 'expanded'
      }).on('error', $.sass.logError))
      .pipe($.concat(name + '.css'))
      .pipe(gulp.dest('dist/'))
      .pipe($.rename(name + '.min.css'))
      .pipe($.minifyCss())
      .pipe(gulp.dest('src/styles'))
      .pipe(gulp.dest('dist/'));
});

gulp.task('js', function(){
  gulp.src(['src/scripts/*.js', 'src/templates/*.html'])
      .pipe($.if('*.html', $.minifyHtml(minifyHtmlOptions)))
      .pipe($.if('*.html', $.angularTemplatecache(name + '.tpl.js', templateOptions)))
      .pipe($.sourcemaps.init())
      .pipe($.if('*.js', $.replace('<<adfVersion>>', pkg.version)))
      .pipe($.if('*.js', $.replace(/'use strict';/g, '')))
      .pipe($.concat(name + '.js'))
      .pipe($.headerfooter('(function(window, undefined) {\'use strict\';\n', '})(window);'))
      .pipe($.ngAnnotate(annotateOptions))
      .pipe(gulp.dest('dist/'))
      .pipe($.rename(name + '.min.js'))
      .pipe($.uglify())
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('dist/'));
});


gulp.task('images', function() {
  return gulp.src(paths.images)
    .pipe(imageminPngcrush({reduce: true})())
    .pipe(gulp.dest('dist/release/images'))
})

gulp.task('build', ['styles', 'js']);

/** build release **/
gulp.task('install-widgets', function(){
  return gulp.src('release/widgets/*/bower.json')
             .pipe($.install());
});

gulp.task('widget-templates', ['install-widgets'], function(){
  var opts = {
    root: '{widgetsPath}',
    module: 'release'
  };
  return gulp.src('release/widgets/*/src/*.html')
             .pipe($.minifyHtml(minifyHtmlOptions))
             .pipe($.angularTemplatecache('widgets.js', opts))
             .pipe(gulp.dest('.tmp'));
});

gulp.task('sample-templates', function(){
  var opts = {
    root: 'partials',
    module: 'release'
  };
  return gulp.src('release/partials/*.html')
             .pipe($.minifyHtml(minifyHtmlOptions))
             .pipe($.angularTemplatecache('release.js', opts))
             .pipe(gulp.dest('.tmp'));
});

gulp.task('dashboard-templates', function(){
  var opts = {
    root: '../src/templates',
    module: 'adf'
  };
  return gulp.src('src/templates/*.html')
             .pipe($.minifyHtml(minifyHtmlOptions))
             .pipe($.angularTemplatecache('adf.js', opts))
             .pipe(gulp.dest('.tmp'));
});

gulp.task('copy-font', function(){
  gulp.src('release/components/bootstrap/dist/fonts/*')
      .pipe(gulp.dest('dist/release/fonts'));
});

gulp.task('release', ['widget-templates', 'sample-templates', 'dashboard-templates', 'copy-font'], function(){
  var templates = gulp.src('.tmp/*.js', {read: false});
  var assets = $.useref.assets();
  gulp.src('release/index.html')
      // inject templates
      .pipe($.inject(templates, {relative: true}))
      .pipe(assets)
      .pipe($.if('*.js', $.replace('<<adfVersion>>', pkg.version)))
      .pipe($.if('*.js', $.ngAnnotate(annotateOptions)))
      .pipe($.if('*.js', $.uglify()))
      .pipe($.if('*.css', $.minifyCss()))
      .pipe($.rev())
      .pipe(assets.restore())
      .pipe($.useref())
      .pipe($.revReplace())
      .pipe(gulp.dest('dist/release'));
});

/** livereload **/

gulp.task('reload', function(){
  gulp.src('release/*.html')
      .pipe(connect.reload());
})

gulp.task('watch-styles', function(){
  gulp.watch('src/styles/*.scss', ['styles', 'reload']);
})

gulp.task('watch', ['watch-styles'], function(){
  var paths = [
    'src/scripts/*.js',
    'src/styles/*.css',
    'src/templates/*.html',
    'release/*.html',
    'release/scripts/*.js',
    'release/partials/*.html',
    'release/widgets/*/*.js',
    'release/widgets/*/*.css',
    'release/widgets/*/*.html',
    'release/widgets/*/src/*.js',
    'release/widgets/*/src/*.css',
    'release/widgets/*/src/*.html'
  ];
  gulp.watch(paths, ['reload']);
});

gulp.task('webserver', ['install-widgets'], function(){
  connect.server({
    port: 9001,
    livereload: true,
    // redirect / to /sample
    middleware: function() {
      return [
        modRewrite([
          '^/$ /release/ [R]'
        ])
      ];
    }
  });
});

gulp.task('serve', ['webserver', 'styles', 'watch']);



/** travis ci **/

gulp.task('travis', ['jslint', 'coverall', 'build']);

/** shorthand methods **/
gulp.task('all', ['build','release','images']);

gulp.task('default', ['jslint', 'build']);
