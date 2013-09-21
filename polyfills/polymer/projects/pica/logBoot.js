/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function() {

  var timer = {
    timers: {},
    time: function(name) {
      var timer = this.timers[name] || (this.timers[name] = 
          {time: 0, iterations: 0});
      if (!timer.timing) {
        timer.start = performance.now();
      }
      timer.timing = true;
    },
    timeEnd: function(name) {
      var timer = this.timers[name];
      if (timer) {
        timer.time += performance.now() - timer.start;
        timer.iterations++;
        timer.timing = false;
      }
    },
    dump: function() {
      Object.keys(this.timers).forEach(function(k) {
        var timer = this.timers[k];
        console.log(k, timer.time, timer.iterations);
      }, this);
    }
  }
  function startLogging() {
    //console.profile('boot');
    console.time('boot');
    console.time('scripts');
    //console.time('scripts/dom');
  }
  
  function scriptsDone() {
    console.timeEnd('scripts');
    console.time('polymer');
    //console.time('load event');
  }
  
  function domDone() {
    //console.timeEnd('load event');
    //console.profile('wc');
    //console.timeEnd('scripts/dom');
    //console.timeEnd('dom');
    //console.time('polymer');
    listenForWebComponentsReady();
    console.time('process imports');
  }
  
  function importsDone() {
    //console.timeEnd('process imports');
    //console.time('process elements');
    //console.profile('process elements');
  }
  
  function elementsDone() {
    //console.timeEnd('process elements');
    //console.profileEnd('wc');
  }

  function bootDone() {
    console.timeEnd('polymer');
    console.timeEnd('boot');
    //console.profileEnd('boot');
    timer.dump();
  }

  function listenForWebComponentsReady() {
    window.addEventListener('WebComponentsReady', function() {
      elementsDone();
      Platform.endOfMicrotask(bootDone);
    });
  }
  
  var logBoot = window.location.search.indexOf('logBoot') >= 0;
  if (logBoot) {
    startLogging();
    document.addEventListener('DOMContentLoaded', domDone);
    document.addEventListener('HTMLImportsLoaded', importsDone);
  }

  function queryAll(selector, root) {
    root = root || document;
    var nodes = root.querySelectorAll(selector).array();
    var scopeNodes = root.querySelectorAll('*');
    for (var i=0, l = scopeNodes.length, shadowRoot; i < l; i++) {
      shadowRoot = scopeNodes[i].shadowRoot;
      if (shadowRoot) {
        nodes = nodes.concat(queryAll(selector, shadowRoot));
      }
    }
    return nodes;
  }

  // exports
  window.logBoot = {
    scriptsDone: scriptsDone
  }

  window.queryAll = queryAll;
  window.timer = timer;
})();
