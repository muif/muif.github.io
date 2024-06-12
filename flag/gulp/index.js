import path                     from 'path';

import gulp                     from 'gulp';

import browser                  from 'browser-sync';
import rimraf                   from 'rimraf';

import file                     from 'gulp-file';
import flatten                  from 'gulp-flatten';
import gulpif                   from 'gulp-if';
import replace                  from 'gulp-replace';
import sourcemaps               from 'gulp-sourcemaps';

import autoprefixer             from 'gulp-autoprefixer';
import cleanCss                 from 'gulp-clean-css';
import gulpSass                 from 'gulp-sass';
import sassTildeImporter        from 'node-sass-tilde-importer';
import sass                     from 'sass';

import rollup                   from 'gulp-better-rollup';
import terser                   from 'gulp-terser';
import modernizr                from 'modernizr';

import { generateSW }           from 'workbox-build';

import packageJson              from '../package.json';
import config                   from './config';
import rollupConfig             from './rollup.config';

const PRODUCTION = config.env === 'production';

//
// Prepare destination directory
//

function clean() {
  return rimraf(config.paths.dest.root);
}

function copyGitIgnore() {
  /*
   * Adding a .gitignore file to the public directory will ensure
   * that unwanted files are not included during deployment.
   */
  return gulp.src('./.gitignore')
    .pipe(gulp.dest(config.paths.dest.root));
}

//
// Build HTML
//

function buildPages() {
  return gulp.src(config.paths.src.html)
    .pipe(replace('@VERSION', packageJson.version))
    .pipe(replace('@PUBLIC_URL', config.app.PUBLIC_URL))
    .pipe(replace('@ROOT_URL', config.app.ROOT_URL))
    .pipe(gulp.dest(config.paths.dest.html));
}

//
// Build CSS
//

const sassCompiler = gulpSass(sass);

function buildCSS() {
  return gulp.src(config.paths.src.sass)
    .pipe(sourcemaps.init())
    .pipe(sassCompiler({
      importer: sassTildeImporter,
      quietDeps: true
    })
      .on('error', sassCompiler.logError)
    )
    .pipe(autoprefixer(config.settings.autoprefixer))
    .pipe(gulpif(PRODUCTION, cleanCss(config.settings.cleanCss)))
    .pipe(gulpif(!PRODUCTION, sourcemaps.write('.')))
    .pipe(gulp.dest(config.paths.dest.css))
    .pipe(browser.reload({ stream: true }));
}

//
// Build JavaScript
//

function compileJS(rollupConfig) {
  return gulp.src(rollupConfig.input)
    .pipe(sourcemaps.init())
    .pipe(rollup(rollupConfig, rollupConfig.output))
    .pipe(gulpif(PRODUCTION, terser()
      .on('error', (e) => { console.log(e); })
    ))
    .pipe(gulpif(!PRODUCTION, sourcemaps.write('.')))
    .pipe(gulp.dest(config.paths.dest.js));
}

function buildAppJS() {
  return compileJS(rollupConfig[0]);
}

function buildAppES5JS(done) {
  if (PRODUCTION) {
    return compileJS(rollupConfig[1]);
  }

  done();
}

function buildModernizrJS(done) {
  modernizr.build(config.settings.modernizr, (code) => {
    file('modernizr-custom.js', code, { src: true })
      .pipe(gulpif(PRODUCTION, terser()
        .on('error', (e) => { console.log(e); })
      ))
      .pipe(gulp.dest(config.paths.dest.js))
      .on('finish', done);
  });
}

const buildJS = gulp.parallel(
  buildAppJS,
  buildAppES5JS,
  buildModernizrJS
);

//
// Build images
//

function buildImages() {
  return gulp.src(config.paths.src.img)
    .pipe(gulp.dest(config.paths.dest.img));
}

//
// Build fonts
//

function buildFonts() {
  return gulp.src(config.paths.src.fonts)
    .pipe(flatten())
    .pipe(gulp.dest(config.paths.dest.fonts));
}

//
// Build static assets
//

function buildStatic() {
  return gulp.src(config.paths.src.static)
    .pipe(replace('@VERSION', packageJson.version))
    .pipe(replace('@PUBLIC_URL', config.app.PUBLIC_URL))
    .pipe(replace('@ROOT_URL', config.app.ROOT_URL))
    .pipe(gulp.dest(config.paths.dest.static));
}

//
// Build service worker
//

function buildSW() {
  return generateSW(config.settings.workboxBuild)
    .then(({ count, size }) => {
      console.log(`Generated "${config.settings.workboxBuild.swDest}", which will precache ${count} files, totaling ${size} bytes.`);
    });
}

//
// Server
//

function server(done) {
  browser.init({
    server: config.server.root,
    port: config.server.port
  });

  done();
}

//
// Watch
//

function watch() {
  gulp.watch(config.paths.src.html)
    .on('all', gulp.series(buildPages, browser.reload));

  gulp.watch(config.paths.src.sass)
    .on('all', gulp.series(buildCSS));

  gulp.watch(path.join(config.paths.src.js, '/**/*.js'))
    .on('all', gulp.series(buildJS, browser.reload));

  gulp.watch(config.paths.src.img)
    .on('all', gulp.series(buildImages, browser.reload));
}

//
// Tasks
//

gulp.task(
  'clean',
  clean
);

gulp.task(
  'build',
  gulp.series(
    'clean',
    gulp.parallel(
      copyGitIgnore,
      buildPages,
      buildCSS,
      buildJS,
      buildImages,
      buildFonts,
      buildStatic
    ),
    buildSW
  )
);

gulp.task(
  'default',
  gulp.series(
    'build',
    server,
    watch
  )
);
