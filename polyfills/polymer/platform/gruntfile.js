/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
module.exports = function(grunt) {

  // recursive module builder
  var path = require('path');
  function readManifest(filename, modules) {
    modules = modules || [];
    var lines = grunt.file.readJSON(filename);
    var dir = path.dirname(filename);
    lines.forEach(function(line) {
      var fullpath = path.join(dir, line);
      if (line.slice(-5) == '.json') {
        // recurse
        readManifest(fullpath, modules);
      } else {
        modules.push(fullpath);
      }
    });
    return modules;
  }

  grunt.initConfig({
    karma: {
      options: {
        configFile: 'conf/karma.conf.js',
        keepalive: true,
      },
      buildbot: {
        reporters: ['crbot'],
        logLevel: 'OFF'
      },
      platform: {
      }
    },
    concat_sourcemap: {
      Platform: {
        options: {
          sourcesContent: true
        },
        files: {
          'platform.concat.js': readManifest('build.json')
        }
      }
    },
    uglify: {
      options: {
        banner: grunt.file.read('LICENSE'),
        nonull: true,
        compress: {
          unsafe: false
        }
      },
      Platform: {
        options: {
          sourceMap: 'platform.min.js.map',
          sourceMapIn: 'platform.concat.js.map'
        },
        files: {
          'platform.min.js': 'platform.concat.js'
        }
      }
    },

    yuidoc: {
      compile: {
        name: '<%= pkg.name %>',
        description: '<%= pkg.description %>',
        version: '<%= pkg.version %>',
        url: '<%= pkg.homepage %>',
        options: {
          exclude: 'third_party',
          paths: '.',
          outdir: 'docs',
          linkNatives: 'true',
          tabtospace: 2,
          themedir: 'tools/doc/themes/bootstrap'
        }
      }
    },
    pkg: grunt.file.readJSON('package.json')
  });

  // plugins
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-yuidoc');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-concat-sourcemap');

  // tasks
  grunt.registerTask('sourcemap_copy', 'Copy sourcesContent between sourcemaps', function(source, dest) {
    var sourceMap = grunt.file.readJSON(source);
    var destMap = grunt.file.readJSON(dest);
    destMap.sourcesContent = sourceMap.sourcesContent;
    grunt.file.write(dest, JSON.stringify(destMap));
  });

  grunt.registerTask('default', ['concat_sourcemap', 'uglify', 'sourcemap_copy:platform.concat.js.map:platform.min.js.map']);
  grunt.registerTask('docs', ['yuidoc']);
  grunt.registerTask('test', ['karma:platform']);
  grunt.registerTask('test-buildbot', ['karma:buildbot']);
};

