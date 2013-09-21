(function() {

  var proto = Object.create(HTMLElement.prototype);
  proto.createdCallback = function() {
    console.log(this.localName, 'created');
  }

  document.register('x-test', {prototype: proto});

})();