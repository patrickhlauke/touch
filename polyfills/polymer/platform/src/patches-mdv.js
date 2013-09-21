/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(scope) {

// inject style sheet
var style = document.createElement('style');
style.textContent = 'template {display: none !important;} /* injected by platform.js */';
var head = document.querySelector('head');
head.insertBefore(style, head.firstChild);

// flush (with logging)
function flush() {
  logFlags.data && console.group("Platform.flush()");
  scope.endOfMicrotask(Platform.performMicrotaskCheckpoint);
  logFlags.data && console.groupEnd();
};


// polling dirty checker
var FLUSH_POLL_INTERVAL = 125;
window.addEventListener('WebComponentsReady', function() {
  flush();
  // flush periodically if platform does not have object observe.
  if (!Observer.hasObjectObserve) {
    scope.flushPoll = setInterval(flush, FLUSH_POLL_INTERVAL);
  }
});

// exports
scope.flush = flush;

})(window.Platform);

