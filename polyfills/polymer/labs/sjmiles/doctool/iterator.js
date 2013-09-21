(function(scope){

var Iterator = function(stream) {
  // Assign a unique ID to each Iterator
  this.ID = Iterator._objectCount++;
  this.stream = stream;
};

Iterator._objectCount = 0;

Iterator.prototype = {
  i: -1,
  nodes: null,
  next: function() {
    this.i++;
    return this._read();
  },
  prev: function() {
    this.i--;
    return this._read();
  },
  _read: function(inIt) {
    this.past = this.stream[this.i - 1];
    this.value = this.stream[this.i];
    this.future = this.stream[this.i + 1];
    return this.value;
  }
};

// exports

scope.Iterator = Iterator;

})(window);