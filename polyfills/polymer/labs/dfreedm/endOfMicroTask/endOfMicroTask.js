(function(scope) {
  'use strict';
  var n = document.createTextNode('');
  var mo = window.MutationObserver || window.WebKitMutationObserver;
  var iteration = 0;
  var fns = [];

  function callbackHandler() {
    var l = fns.length, fn;
    for (var i = 0; i < l; i++) {
      fn = fns.shift();
      fn.call(window);
    }
  }

  var o = new mo(callbackHandler);
  o.observe(n, {characterData: true});

  function EOMT(f) {
    n.textContent = iteration++;
    fns.push(f);
  }

  scope.endOfMicroTask = EOMT.bind();
  scope.eomtNode = n;
})(window);
