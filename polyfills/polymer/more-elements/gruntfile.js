/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
module.exports = function(grunt) {
  grunt.initConfig({
    yuidoc: {
      compile: {
        name: '<%= pkg.name %>',
        description: '<%= pkg.description %>',
        version: '<%= pkg.version %>',
        url: '<%= pkg.homepage %>',
        options: {
          exclude: 'third_party',
          extension: '.js,.html',
          paths: '.',
          outdir: 'docs',
          linkNatives: 'true',
          tabtospace: 2,
          themedir: 'tools/docs/doc_themes/footstrap'
        }
      }
    },
    pkg: grunt.file.readJSON('package.json')
  });

  // plugins
  grunt.loadNpmTasks('grunt-contrib-yuidoc');
  
  // tasks
  grunt.registerTask('default', ['yuidoc']);
  grunt.registerTask('docs', ['yuidoc']);
};

