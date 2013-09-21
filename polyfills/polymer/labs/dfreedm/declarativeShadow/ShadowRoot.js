(function() {
  function replace() {
    var p = this.parentNode;
    var s = p.webkitCreateShadowRoot();
    s.innerHTML = this.innerHTML;
    this.remove();
  }
  var SRP = Object.create(HTMLElement.prototype, {
    readyCallback: {
      value: replace,
      enumerable: true
    }
  });
  document.register('shadow-root', {prototype: SRP});
})();
