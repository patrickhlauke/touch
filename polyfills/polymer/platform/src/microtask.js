/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(scope) {

var iterations = 0;
var callbacks = [];
var twiddle = document.createTextNode('');
function eomt(callback) {
  twiddle.textContent = iterations++;
  callbacks.push(callback);
}
var MO = window.MutationObserver || window.JsMutationObserver;
new MO(function() {
  while (callbacks.length) {
    callbacks.shift()();
  }
}).observe(twiddle, {characterData: true});

// exports
scope.endOfMicrotask = eomt;

})(window.Platform);

