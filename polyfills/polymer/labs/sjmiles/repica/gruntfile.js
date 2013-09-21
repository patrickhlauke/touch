/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
module.exports = function(grunt) {
  Polymer = [
    '../../toolkit-ui/elements/g-jsonp.html',  
    '../../toolkit-ui/elements/g-menu.html',  
    '../../toolkit-ui/elements/g-menu-button.html',  
    '../../toolkit-ui/elements/g-toolbar.html',  
    '../../toolkit-ui/elements/g-selection.html',  
    '../../toolkit-ui/elements/g-icon-button.html',  
    '../../toolkit-ui/elements/g-selector.html',  
    '../../toolkit-ui/elements/g-icon.html',  
    '../../toolkit-ui/elements/g-ribbon.html',  
    '../../toolkit-ui/elements/g-menu-item.html',  
    '../../toolkit-ui/elements/g-app.html'
  ];
  PicaElements = [
    'elements/pi-toobar-buttons.html',
    'elements/pi-toolbar.html',
    'elements/pica-loading.html',
    'elements/pica-story.html',
    'elements/pica-stories-view.html',
    'elements/pica-topic.html',
    'elements/pica-topics-view.html',
    'elements/pica-topics.html',
    'elements/pica-home.html',
    'elements/pica-main.html',
    'elements/pica-view.html'
  ];
  PicaCSS = [
    'elements/css/pica-story.css',
    'elements/css/pica-main.css',
    'elements/css/pica-view.css'
  ];

  Pica = [].concat(
    ['build/pre.html'],
    Polymer,
    PicaElements, 
    ['data.html'],
    ['build/post.html']
  );

  grunt.initConfig({
    concat: {
      PicaElements: {
        files: {
          'repica.html': Pica
        }
      },
      PicaCSS: {
        files: {
          'build/pica.css': PicaCSS
        }
      }
    }
  });

  // plugins
  grunt.loadNpmTasks('grunt-contrib-concat');

  // tasks
  grunt.registerTask('default', ['concat']);
};

