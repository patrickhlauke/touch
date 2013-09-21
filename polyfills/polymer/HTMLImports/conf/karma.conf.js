module.exports = function(karma) {
  var common = require('../tools/test/karma-common.conf.js');
  karma.configure(common.mixin_common_opts(karma, {
    // base path, that will be used to resolve files and exclude
    basePath: '../',

    // list of files / patterns to load in the browser
    files: [
      'tools/test/mocha-htmltest.js',
      'conf/mocha.conf.js',
      'node_modules/chai/chai.js',
      'test/js/*.js',
      'html-imports.js',
      {pattern: 'tools/**/*.js', included: false},
      {pattern: 'src/*', included: false},
      {pattern: 'test/**/*', included: false}
    ],
  }));
};
