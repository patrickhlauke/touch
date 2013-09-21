/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

// SideTable is a weak map where possible. If WeakMap is not available the
// association is stored as an expando property.
var SideTable;
// TODO(arv): WeakMap does not allow for Node etc to be keys in Firefox
if (typeof WeakMap !== 'undefined' && navigator.userAgent.indexOf('Firefox/') < 0) {
  SideTable = WeakMap;
} else {
  (function() {
    var defineProperty = Object.defineProperty;
    var counter = Date.now() % 1e9;

    SideTable = function() {
      this.name = '__st' + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
    };

    SideTable.prototype = {
      set: function(key, value) {
        var entry = key[this.name];
        if (entry && entry[0] === key)
          entry[1] = value;
        else
          defineProperty(key, this.name, {value: [key, value], writable: true});
      },
      get: function(key) {
        var entry;
        return (entry = key[this.name]) && entry[0] === key ?
            entry[1] : undefined;
      },
      delete: function(key) {
        this.set(key, undefined);
      }
    }
  })();
}

// Copyright 2012 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(global) {
  'use strict';

  function detectObjectObserve() {
    if (typeof Object.observe !== 'function' ||
        typeof Array.observe !== 'function') {
      return false;
    }

    var gotSplice = false;
    function callback(records) {
      if (records[0].type === 'splice' && records[1].type === 'splice')
        gotSplice = true;
    }

    var test = [0];
    Array.observe(test, callback);
    test[1] = 1;
    test.length = 0;
    Object.deliverChangeRecords(callback);
    return gotSplice;
  }

  var hasObserve = detectObjectObserve();

  function detectEval() {
    // don't test for eval if document has CSP securityPolicy object and we can see that
    // eval is not supported. This avoids an error message in console even when the exception
    // is caught
    if (global.document &&
        'securityPolicy' in global.document &&
        !global.document.securityPolicy.allowsEval) {
      return false;
    }

    try {
      var f = new Function('', 'return true;');
      return f();
    } catch (ex) {
      return false;
    }
  }

  var hasEval = detectEval();

  function isIndex(s) {
    return +s === s >>> 0;
  }

  function toNumber(s) {
    return +s;
  }

  function isObject(obj) {
    return obj === Object(obj);
  }

  var numberIsNaN = global.Number.isNaN || function isNaN(value) {
    return typeof value === 'number' && global.isNaN(value);
  }

  function areSameValue(left, right) {
    if (left === right)
      return left !== 0 || 1 / left === 1 / right;
    if (numberIsNaN(left) && numberIsNaN(right))
      return true;

    return left !== left && right !== right;
  }

  var createObject = ('__proto__' in {}) ?
    function(obj) { return obj; } :
    function(obj) {
      var proto = obj.__proto__;
      if (!proto)
        return obj;
      var newObject = Object.create(proto);
      Object.getOwnPropertyNames(obj).forEach(function(name) {
        Object.defineProperty(newObject, name,
                             Object.getOwnPropertyDescriptor(obj, name));
      });
      return newObject;
    };

  var identStart = '[\$_a-zA-Z]';
  var identPart = '[\$_a-zA-Z0-9]';
  var ident = identStart + '+' + identPart + '*';
  var elementIndex = '(?:[0-9]|[1-9]+[0-9]+)';
  var identOrElementIndex = '(?:' + ident + '|' + elementIndex + ')';
  var path = '(?:' + identOrElementIndex + ')(?:\\s*\\.\\s*' + identOrElementIndex + ')*';
  var pathRegExp = new RegExp('^' + path + '$');

  function isPathValid(s) {
    if (typeof s != 'string')
      return false;
    s = s.trim();

    if (s == '')
      return true;

    if (s[0] == '.')
      return false;

    return pathRegExp.test(s);
  }

  var constructorIsPrivate = {};

  function Path(s, privateToken) {
    if (privateToken !== constructorIsPrivate)
      throw Error('Use Path.get to retrieve path objects');

    if (s.trim() == '')
      return this;

    if (isIndex(s)) {
      this.push(s);
      return this;
    }

    s.split(/\s*\.\s*/).filter(function(part) {
      return part;
    }).forEach(function(part) {
      this.push(part);
    }, this);

    if (hasEval && !hasObserve && this.length) {
      this.getValueFrom = this.compiledGetValueFromFn();
    }
  }

  // TODO(rafaelw): Make simple LRU cache
  var pathCache = {};

  function getPath(pathString) {
    if (pathString instanceof Path)
      return pathString;

    if (pathString == null)
      pathString = '';

    if (typeof pathString !== 'string')
      pathString = String(pathString);

    var path = pathCache[pathString];
    if (path)
      return path;
    if (!isPathValid(pathString))
      return invalidPath;
    var path = new Path(pathString, constructorIsPrivate);
    pathCache[pathString] = path;
    return path;
  }

  Path.get = getPath;

  Path.prototype = createObject({
    __proto__: [],
    valid: true,

    toString: function() {
      return this.join('.');
    },

    getValueFrom: function(obj, observedSet) {
      for (var i = 0; i < this.length; i++) {
        if (obj == null)
          return;
        if (observedSet)
          observedSet.observe(obj);
        obj = obj[this[i]];
      }
      return obj;
    },

    compiledGetValueFromFn: function() {
      var accessors = this.map(function(ident) {
        return isIndex(ident) ? '["' + ident + '"]' : '.' + ident;
      });

      var str = '';
      var pathString = 'obj';
      str += 'if (obj != null';
      var i = 0;
      for (; i < (this.length - 1); i++) {
        var ident = this[i];
        pathString += accessors[i];
        str += ' &&\n     ' + pathString + ' != null';
      }
      str += ')\n';

      pathString += accessors[i];

      str += '  return ' + pathString + ';\nelse\n  return undefined;';
      return new Function('obj', str);
    },

    setValueFrom: function(obj, value) {
      if (!this.length)
        return false;

      for (var i = 0; i < this.length - 1; i++) {
        if (!isObject(obj))
          return false;
        obj = obj[this[i]];
      }

      if (!isObject(obj))
        return false;

      obj[this[i]] = value;
      return true;
    }
  });

  var invalidPath = new Path('', constructorIsPrivate);
  invalidPath.valid = false;
  invalidPath.getValueFrom = invalidPath.setValueFrom = function() {};

  var MAX_DIRTY_CHECK_CYCLES = 1000;

  function dirtyCheck(observer) {
    var cycles = 0;
    while (cycles < MAX_DIRTY_CHECK_CYCLES && observer.check()) {
      observer.report();
      cycles++;
    }
    if (global.testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;
  }

  function objectIsEmpty(object) {
    for (var prop in object)
      return false;
    return true;
  }

  function diffIsEmpty(diff) {
    return objectIsEmpty(diff.added) &&
           objectIsEmpty(diff.removed) &&
           objectIsEmpty(diff.changed);
  }

  function diffObjectFromOldObject(object, oldObject) {
    var added = {};
    var removed = {};
    var changed = {};
    var oldObjectHas = {};

    for (var prop in oldObject) {
      var newValue = object[prop];

      if (newValue !== undefined && newValue === oldObject[prop])
        continue;

      if (!(prop in object)) {
        removed[prop] = undefined;
        continue;
      }

      if (newValue !== oldObject[prop])
        changed[prop] = newValue;
    }

    for (var prop in object) {
      if (prop in oldObject)
        continue;

      added[prop] = object[prop];
    }

    if (Array.isArray(object) && object.length !== oldObject.length)
      changed.length = object.length;

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  function copyObject(object, opt_copy) {
    var copy = opt_copy || (Array.isArray(object) ? [] : {});
    for (var prop in object) {
      copy[prop] = object[prop];
    };
    if (Array.isArray(object))
      copy.length = object.length;
    return copy;
  }

  function Observer(object, callback, target, token) {
    this.closed = false;
    this.object = object;
    this.callback = callback;
    // TODO(rafaelw): Hold this.target weakly when WeakRef is available.
    this.target = target;
    this.token = token;
    this.reporting = true;
    if (hasObserve) {
      var self = this;
      this.boundInternalCallback = function(records) {
        self.internalCallback(records);
      };
    }

    addToAll(this);
  }

  Observer.prototype = {
    internalCallback: function(records) {
      if (this.closed)
        return;
      if (this.reporting && this.check(records)) {
        this.report();
        if (this.testingResults)
          this.testingResults.anyChanged = true;
      }
    },

    close: function() {
      if (this.closed)
        return;
      if (this.object && typeof this.object.close === 'function')
        this.object.close();

      this.disconnect();
      this.object = undefined;
      this.closed = true;
    },

    deliver: function(testingResults) {
      if (this.closed)
        return;
      if (hasObserve) {
        this.testingResults = testingResults;
        Object.deliverChangeRecords(this.boundInternalCallback);
        this.testingResults = undefined;
      } else {
        dirtyCheck(this);
      }
    },

    report: function() {
      if (!this.reporting)
        return;

      this.sync(false);
      if (this.callback) {
        this.reportArgs.push(this.token);
        this.invokeCallback(this.reportArgs);
      }
      this.reportArgs = undefined;
    },

    invokeCallback: function(args) {
      try {
        this.callback.apply(this.target, args);
      } catch (ex) {
        Observer._errorThrownDuringCallback = true;
        console.error('Exception caught during observer callback: ' + (ex.stack || ex));
      }
    },

    reset: function() {
      if (this.closed)
        return;

      if (hasObserve) {
        this.reporting = false;
        Object.deliverChangeRecords(this.boundInternalCallback);
        this.reporting = true;
      }

      this.sync(true);
    }
  }

  var collectObservers = !hasObserve || global.forceCollectObservers;
  var allObservers;
  Observer._allObserversCount = 0;

  if (collectObservers) {
    allObservers = [];
  }

  function addToAll(observer) {
    if (!collectObservers)
      return;

    allObservers.push(observer);
    Observer._allObserversCount++;
  }

  var runningMicrotaskCheckpoint = false;

  var hasDebugForceFullDelivery = typeof Object.deliverAllChangeRecords == 'function';

  global.Platform = global.Platform || {};

  global.Platform.performMicrotaskCheckpoint = function() {
    if (runningMicrotaskCheckpoint)
      return;

    if (hasDebugForceFullDelivery) {
      Object.deliverAllChangeRecords();
      return;
    }

    if (!collectObservers)
      return;

    runningMicrotaskCheckpoint = true;

    var cycles = 0;
    var results = {};

    do {
      cycles++;
      var toCheck = allObservers;
      allObservers = [];
      results.anyChanged = false;

      for (var i = 0; i < toCheck.length; i++) {
        var observer = toCheck[i];
        if (observer.closed)
          continue;

        if (hasObserve) {
          observer.deliver(results);
        } else if (observer.check()) {
          results.anyChanged = true;
          observer.report();
        }

        allObservers.push(observer);
      }
    } while (cycles < MAX_DIRTY_CHECK_CYCLES && results.anyChanged);

    if (global.testingExposeCycleCount)
      global.dirtyCheckCycleCount = cycles;

    Observer._allObserversCount = allObservers.length;
    runningMicrotaskCheckpoint = false;
  };

  if (collectObservers) {
    global.Platform.clearObservers = function() {
      allObservers = [];
    };
  }

  function ObjectObserver(object, callback, target, token) {
    Observer.call(this, object, callback, target, token);
    this.connect();
    this.sync(true);
  }

  ObjectObserver.prototype = createObject({
    __proto__: Observer.prototype,

    connect: function() {
      if (hasObserve)
        Object.observe(this.object, this.boundInternalCallback);
    },

    sync: function(hard) {
      if (!hasObserve)
        this.oldObject = copyObject(this.object);
    },

    check: function(changeRecords) {
      var diff;
      var oldValues;
      if (hasObserve) {
        if (!changeRecords)
          return false;

        oldValues = {};
        diff = diffObjectFromChangeRecords(this.object, changeRecords,
                                           oldValues);
      } else {
        oldValues = this.oldObject;
        diff = diffObjectFromOldObject(this.object, this.oldObject);
      }

      if (diffIsEmpty(diff))
        return false;

      this.reportArgs =
          [diff.added || {}, diff.removed || {}, diff.changed || {}];
      this.reportArgs.push(function(property) {
        return oldValues[property];
      });

      return true;
    },

    disconnect: function() {
      if (!hasObserve)
        this.oldObject = undefined;
      else if (this.object)
        Object.unobserve(this.object, this.boundInternalCallback);
    }
  });

  function ArrayObserver(array, callback, target, token) {
    if (!Array.isArray(array))
      throw Error('Provided object is not an Array');
    ObjectObserver.call(this, array, callback, target, token);
  }

  ArrayObserver.prototype = createObject({
    __proto__: ObjectObserver.prototype,

    connect: function() {
      if (hasObserve)
        Array.observe(this.object, this.boundInternalCallback);
    },

    sync: function() {
      if (!hasObserve)
        this.oldObject = this.object.slice();
    },

    check: function(changeRecords) {
      var splices;
      if (hasObserve) {
        if (!changeRecords)
          return false;
        splices = projectArraySplices(this.object, changeRecords);
      } else {
        splices = calcSplices(this.object, 0, this.object.length,
                              this.oldObject, 0, this.oldObject.length);
      }

      if (!splices || !splices.length)
        return false;

      this.reportArgs = [splices];
      return true;
    }
  });

  ArrayObserver.applySplices = function(previous, current, splices) {
    splices.forEach(function(splice) {
      var spliceArgs = [splice.index, splice.removed.length];
      var addIndex = splice.index;
      while (addIndex < splice.index + splice.addedCount) {
        spliceArgs.push(current[addIndex]);
        addIndex++;
      }

      Array.prototype.splice.apply(previous, spliceArgs);
    });
  };

  function ObservedSet(callback) {
    this.arr = [];
    this.callback = callback;
    this.isObserved = true;
  }

  var objProto = Object.getPrototypeOf({});
  var arrayProto = Object.getPrototypeOf([]);
  ObservedSet.prototype = {
    reset: function() {
      this.isObserved = !this.isObserved;
    },

    observe: function(obj) {
      if (!isObject(obj) || obj === objProto || obj === arrayProto)
        return;
      var i = this.arr.indexOf(obj);
      if (i >= 0 && this.arr[i+1] === this.isObserved)
        return;

      if (i < 0) {
        i = this.arr.length;
        this.arr[i] = obj;
        Object.observe(obj, this.callback);
      }

      this.arr[i+1] = this.isObserved;
      this.observe(Object.getPrototypeOf(obj));
    },

    cleanup: function() {
      var i = 0, j = 0;
      var isObserved = this.isObserved;
      while(j < this.arr.length) {
        var obj = this.arr[j];
        if (this.arr[j + 1] == isObserved) {
          if (i < j) {
            this.arr[i] = obj;
            this.arr[i + 1] = isObserved;
          }
          i += 2;
        } else {
          Object.unobserve(obj, this.callback);
        }
        j += 2;
      }

      this.arr.length = i;
    }
  };

  function PathObserver(object, path, callback, target, token, valueFn,
                        setValueFn) {
    var path = path instanceof Path ? path : getPath(path);
    if (!path || !path.length || !isObject(object)) {
      this.value_ = path ? path.getValueFrom(object) : undefined;
      this.value = valueFn ? valueFn(this.value_) : this.value_;
      this.closed = true;
      return;
    }

    Observer.call(this, object, callback, target, token);
    this.valueFn = valueFn;
    this.setValueFn = setValueFn;
    this.path = path;

    this.connect();
    this.sync(true);
  }

  PathObserver.prototype = createObject({
    __proto__: Observer.prototype,

    connect: function() {
      if (hasObserve)
        this.observedSet = new ObservedSet(this.boundInternalCallback);
    },

    disconnect: function() {
      this.value = undefined;
      this.value_ = undefined;
      if (this.observedSet) {
        this.observedSet.reset();
        this.observedSet.cleanup();
        this.observedSet = undefined;
      }
    },

    check: function() {
      // Note: Extracting this to a member function for use here and below
      // regresses dirty-checking path perf by about 25% =-(.
      if (this.observedSet)
        this.observedSet.reset();

      this.value_ = this.path.getValueFrom(this.object, this.observedSet);

      if (this.observedSet)
        this.observedSet.cleanup();

      if (areSameValue(this.value_, this.oldValue_))
        return false;

      this.value = this.valueFn ? this.valueFn(this.value_) : this.value_;
      this.reportArgs = [this.value, this.oldValue];
      return true;
    },

    sync: function(hard) {
      if (hard) {
        if (this.observedSet)
          this.observedSet.reset();

        this.value_ = this.path.getValueFrom(this.object, this.observedSet);
        this.value = this.valueFn ? this.valueFn(this.value_) : this.value_;

        if (this.observedSet)
          this.observedSet.cleanup();
      }

      this.oldValue_ = this.value_;
      this.oldValue = this.value;
    },

    setValue: function(newValue) {
      if (!this.path)
        return;
      if (typeof this.setValueFn === 'function')
        newValue = this.setValueFn(newValue);
      this.path.setValueFrom(this.object, newValue);
    }
  });

  function CompoundPathObserver(callback, target, token, valueFn) {
    Observer.call(this, undefined, callback, target, token);
    this.valueFn = valueFn;

    this.observed = [];
    this.values = [];
    this.value = undefined;
    this.oldValue = undefined;
    this.oldValues = undefined;
    this.started = false;
  }

  CompoundPathObserver.prototype = createObject({
    __proto__: PathObserver.prototype,

    addPath: function(object, path) {
      if (this.started)
        throw Error('Cannot add more paths once started.');

      var path = path instanceof Path ? path : getPath(path);
      var value = path ? path.getValueFrom(object) : undefined;

      this.observed.push(object, path);
      this.values.push(value);
    },

    start: function() {
      this.connect();
      this.sync(true);
    },

    getValues: function() {
      if (this.observedSet)
        this.observedSet.reset();

      var anyChanged = false;
      for (var i = 0; i < this.observed.length; i = i+2) {
        var path = this.observed[i+1];
        if (!path)
          continue;
        var object = this.observed[i];
        var value = path.getValueFrom(object, this.observedSet);
        var oldValue = this.values[i/2];
        if (!areSameValue(value, oldValue)) {
          if (!anyChanged && !this.valueFn) {
            this.oldValues = this.oldValues || [];
            for (var j = 0; j < this.values.length; j++) {
              this.oldValues[j] = this.values[j];
            }
          }

          this.values[i/2] = value;
          anyChanged = true;
        }
      }

      if (this.observedSet)
        this.observedSet.cleanup();

      return anyChanged;
    },

    check: function() {
      if (!this.getValues())
        return;

      if (this.valueFn) {
        this.value = this.valueFn(this.values);

        if (areSameValue(this.value, this.oldValue))
          return false;

        this.reportArgs = [this.value, this.oldValue];
      } else {
        this.reportArgs = [this.values, this.oldValues];
      }

      return true;
    },

    sync: function(hard) {
      if (hard) {
        this.getValues();
        if (this.valueFn)
          this.value = this.valueFn(this.values);
      }

      if (this.valueFn)
        this.oldValue = this.value;
    },

    close: function() {
      if (this.observed) {
        for (var i = 0; i < this.observed.length; i = i + 2) {
          var object = this.observed[i];
          if (object && typeof object.close === 'function')
            object.close();
        }
        this.observed = undefined;
        this.values = undefined;
      }

      Observer.prototype.close.call(this);
    }
  });

  var knownRecordTypes = {
    'new': true,
    'updated': true,
    'deleted': true
  };

  function notifyFunction(object, name) {
    if (typeof Object.observe !== 'function')
      return;

    var notifier = Object.getNotifier(object);
    return function(type, oldValue) {
      var changeRecord = {
        object: object,
        type: type,
        name: name
      };
      if (arguments.length === 2)
        changeRecord.oldValue = oldValue;
      notifier.notify(changeRecord);
    }
  }

  // TODO(rafaelw): It should be possible for the Object.observe case to have
  // every PathObserver used by defineProperty share a single Object.observe
  // callback, and thus get() can simply call observer.deliver() and any changes
  // to any dependent value will be observed.
  PathObserver.defineProperty = function(object, name, descriptor) {
    // TODO(rafaelw): Validate errors
    var obj = descriptor.object;
    var path = getPath(descriptor.path);
    var notify = notifyFunction(object, name);

    var observer = new PathObserver(obj, descriptor.path,
        function(newValue, oldValue) {
          if (notify)
            notify('updated', oldValue);
        }
    );

    Object.defineProperty(object, name, {
      get: function() {
        return path.getValueFrom(obj);
      },
      set: function(newValue) {
        path.setValueFrom(obj, newValue);
      },
      configurable: true
    });

    return {
      close: function() {
        var oldValue = path.getValueFrom(obj);
        if (notify)
          observer.deliver();
        observer.close();
        Object.defineProperty(object, name, {
          value: oldValue,
          writable: true,
          configurable: true
        });
      }
    };
  }

  function diffObjectFromChangeRecords(object, changeRecords, oldValues) {
    var added = {};
    var removed = {};

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      if (!knownRecordTypes[record.type]) {
        console.error('Unknown changeRecord type: ' + record.type);
        console.error(record);
        continue;
      }

      if (!(record.name in oldValues))
        oldValues[record.name] = record.oldValue;

      if (record.type == 'updated')
        continue;

      if (record.type == 'new') {
        if (record.name in removed)
          delete removed[record.name];
        else
          added[record.name] = true;

        continue;
      }

      // type = 'deleted'
      if (record.name in added) {
        delete added[record.name];
        delete oldValues[record.name];
      } else {
        removed[record.name] = true;
      }
    }

    for (var prop in added)
      added[prop] = object[prop];

    for (var prop in removed)
      removed[prop] = undefined;

    var changed = {};
    for (var prop in oldValues) {
      if (prop in added || prop in removed)
        continue;

      var newValue = object[prop];
      if (oldValues[prop] !== newValue)
        changed[prop] = newValue;
    }

    return {
      added: added,
      removed: removed,
      changed: changed
    };
  }

  function newSplice(index, removed, addedCount) {
    return {
      index: index,
      removed: removed,
      addedCount: addedCount
    };
  }

  var EDIT_LEAVE = 0;
  var EDIT_UPDATE = 1;
  var EDIT_ADD = 2;
  var EDIT_DELETE = 3;

  function ArraySplice() {}

  ArraySplice.prototype = {

    // Note: This function is *based* on the computation of the Levenshtein
    // "edit" distance. The one change is that "updates" are treated as two
    // edits - not one. With Array splices, an update is really a delete
    // followed by an add. By retaining this, we optimize for "keeping" the
    // maximum array items in the original array. For example:
    //
    //   'xxxx123' -> '123yyyy'
    //
    // With 1-edit updates, the shortest path would be just to update all seven
    // characters. With 2-edit updates, we delete 4, leave 3, and add 4. This
    // leaves the substring '123' intact.
    calcEditDistances: function(current, currentStart, currentEnd,
                                old, oldStart, oldEnd) {
      // "Deletion" columns
      var rowCount = oldEnd - oldStart + 1;
      var columnCount = currentEnd - currentStart + 1;
      var distances = new Array(rowCount);

      // "Addition" rows. Initialize null column.
      for (var i = 0; i < rowCount; i++) {
        distances[i] = new Array(columnCount);
        distances[i][0] = i;
      }

      // Initialize null row
      for (var j = 0; j < columnCount; j++)
        distances[0][j] = j;

      for (var i = 1; i < rowCount; i++) {
        for (var j = 1; j < columnCount; j++) {
          if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1]))
            distances[i][j] = distances[i - 1][j - 1];
          else {
            var north = distances[i - 1][j] + 1;
            var west = distances[i][j - 1] + 1;
            distances[i][j] = north < west ? north : west;
          }
        }
      }

      return distances;
    },

    // This starts at the final weight, and walks "backward" by finding
    // the minimum previous weight recursively until the origin of the weight
    // matrix.
    spliceOperationsFromEditDistances: function(distances) {
      var i = distances.length - 1;
      var j = distances[0].length - 1;
      var current = distances[i][j];
      var edits = [];
      while (i > 0 || j > 0) {
        if (i == 0) {
          edits.push(EDIT_ADD);
          j--;
          continue;
        }
        if (j == 0) {
          edits.push(EDIT_DELETE);
          i--;
          continue;
        }
        var northWest = distances[i - 1][j - 1];
        var west = distances[i - 1][j];
        var north = distances[i][j - 1];

        var min;
        if (west < north)
          min = west < northWest ? west : northWest;
        else
          min = north < northWest ? north : northWest;

        if (min == northWest) {
          if (northWest == current) {
            edits.push(EDIT_LEAVE);
          } else {
            edits.push(EDIT_UPDATE);
            current = northWest;
          }
          i--;
          j--;
        } else if (min == west) {
          edits.push(EDIT_DELETE);
          i--;
          current = west;
        } else {
          edits.push(EDIT_ADD);
          j--;
          current = north;
        }
      }

      edits.reverse();
      return edits;
    },

    /**
     * Splice Projection functions:
     *
     * A splice map is a representation of how a previous array of items
     * was transformed into a new array of items. Conceptually it is a list of
     * tuples of
     *
     *   <index, removed, addedCount>
     *
     * which are kept in ascending index order of. The tuple represents that at
     * the |index|, |removed| sequence of items were removed, and counting forward
     * from |index|, |addedCount| items were added.
     */

    /**
     * Lacking individual splice mutation information, the minimal set of
     * splices can be synthesized given the previous state and final state of an
     * array. The basic approach is to calculate the edit distance matrix and
     * choose the shortest path through it.
     *
     * Complexity: O(l * p)
     *   l: The length of the current array
     *   p: The length of the old array
     */
    calcSplices: function(current, currentStart, currentEnd,
                          old, oldStart, oldEnd) {
      var prefixCount = 0;
      var suffixCount = 0;

      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
      if (currentStart == 0 && oldStart == 0)
        prefixCount = this.sharedPrefix(current, old, minLength);

      if (currentEnd == current.length && oldEnd == old.length)
        suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);

      currentStart += prefixCount;
      oldStart += prefixCount;
      currentEnd -= suffixCount;
      oldEnd -= suffixCount;

      if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0)
        return [];

      if (currentStart == currentEnd) {
        var splice = newSplice(currentStart, [], 0);
        while (oldStart < oldEnd)
          splice.removed.push(old[oldStart++]);

        return [ splice ];
      } else if (oldStart == oldEnd)
        return [ newSplice(currentStart, [], currentEnd - currentStart) ];

      var ops = this.spliceOperationsFromEditDistances(
          this.calcEditDistances(current, currentStart, currentEnd,
                                 old, oldStart, oldEnd));

      var splice = undefined;
      var splices = [];
      var index = currentStart;
      var oldIndex = oldStart;
      for (var i = 0; i < ops.length; i++) {
        switch(ops[i]) {
          case EDIT_LEAVE:
            if (splice) {
              splices.push(splice);
              splice = undefined;
            }

            index++;
            oldIndex++;
            break;
          case EDIT_UPDATE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
          case EDIT_ADD:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.addedCount++;
            index++;
            break;
          case EDIT_DELETE:
            if (!splice)
              splice = newSplice(index, [], 0);

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
        }
      }

      if (splice) {
        splices.push(splice);
      }
      return splices;
    },

    sharedPrefix: function(current, old, searchLength) {
      for (var i = 0; i < searchLength; i++)
        if (!this.equals(current[i], old[i]))
          return i;
      return searchLength;
    },

    sharedSuffix: function(current, old, searchLength) {
      var index1 = current.length;
      var index2 = old.length;
      var count = 0;
      while (count < searchLength && this.equals(current[--index1], old[--index2]))
        count++;

      return count;
    },

    calculateSplices: function(current, previous) {
      return this.calcSplices(current, 0, current.length, previous, 0,
                              previous.length);
    },

    equals: function(currentValue, previousValue) {
      return currentValue === previousValue;
    }
  };

  var arraySplice = new ArraySplice();

  function calcSplices(current, currentStart, currentEnd,
                       old, oldStart, oldEnd) {
    return arraySplice.calcSplices(current, currentStart, currentEnd,
                                   old, oldStart, oldEnd);
  }

  function intersect(start1, end1, start2, end2) {
    // Disjoint
    if (end1 < start2 || end2 < start1)
      return -1;

    // Adjacent
    if (end1 == start2 || end2 == start1)
      return 0;

    // Non-zero intersect, span1 first
    if (start1 < start2) {
      if (end1 < end2)
        return end1 - start2; // Overlap
      else
        return end2 - start2; // Contained
    } else {
      // Non-zero intersect, span2 first
      if (end2 < end1)
        return end2 - start1; // Overlap
      else
        return end1 - start1; // Contained
    }
  }

  function mergeSplice(splices, index, removed, addedCount) {

    var splice = newSplice(index, removed, addedCount);

    var inserted = false;
    var insertionOffset = 0;

    for (var i = 0; i < splices.length; i++) {
      var current = splices[i];
      current.index += insertionOffset;

      if (inserted)
        continue;

      var intersectCount = intersect(splice.index,
                                     splice.index + splice.removed.length,
                                     current.index,
                                     current.index + current.addedCount);

      if (intersectCount >= 0) {
        // Merge the two splices

        splices.splice(i, 1);
        i--;

        insertionOffset -= current.addedCount - current.removed.length;

        splice.addedCount += current.addedCount - intersectCount;
        var deleteCount = splice.removed.length +
                          current.removed.length - intersectCount;

        if (!splice.addedCount && !deleteCount) {
          // merged splice is a noop. discard.
          inserted = true;
        } else {
          var removed = current.removed;

          if (splice.index < current.index) {
            // some prefix of splice.removed is prepended to current.removed.
            var prepend = splice.removed.slice(0, current.index - splice.index);
            Array.prototype.push.apply(prepend, removed);
            removed = prepend;
          }

          if (splice.index + splice.removed.length > current.index + current.addedCount) {
            // some suffix of splice.removed is appended to current.removed.
            var append = splice.removed.slice(current.index + current.addedCount - splice.index);
            Array.prototype.push.apply(removed, append);
          }

          splice.removed = removed;
          if (current.index < splice.index) {
            splice.index = current.index;
          }
        }
      } else if (splice.index < current.index) {
        // Insert splice here.

        inserted = true;

        splices.splice(i, 0, splice);
        i++;

        var offset = splice.addedCount - splice.removed.length
        current.index += offset;
        insertionOffset += offset;
      }
    }

    if (!inserted)
      splices.push(splice);
  }

  function createInitialSplices(array, changeRecords) {
    var splices = [];

    for (var i = 0; i < changeRecords.length; i++) {
      var record = changeRecords[i];
      switch(record.type) {
        case 'splice':
          mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
          break;
        case 'new':
        case 'updated':
        case 'deleted':
          if (!isIndex(record.name))
            continue;
          var index = toNumber(record.name);
          if (index < 0)
            continue;
          mergeSplice(splices, index, [record.oldValue], 1);
          break;
        default:
          console.error('Unexpected record type: ' + JSON.stringify(record));
          break;
      }
    }

    return splices;
  }

  function projectArraySplices(array, changeRecords) {
    var splices = [];

    createInitialSplices(array, changeRecords).forEach(function(splice) {
      if (splice.addedCount == 1 && splice.removed.length == 1) {
        if (splice.removed[0] !== array[splice.index])
          splices.push(splice);

        return
      };

      splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount,
                                           splice.removed, 0, splice.removed.length));
    });

    return splices;
  }

  global.Observer = Observer;
  global.Observer.hasObjectObserve = hasObserve;
  global.ArrayObserver = ArrayObserver;
  global.ArrayObserver.calculateSplices = function(current, previous) {
    return arraySplice.calculateSplices(current, previous);
  };

  global.ArraySplice = ArraySplice;
  global.ObjectObserver = ObjectObserver;
  global.PathObserver = PathObserver;
  global.CompoundPathObserver = CompoundPathObserver;
  global.Path = Path;
})(typeof global !== 'undefined' && global ? global : this);

// prepoulate window.Platform.flags for default controls
window.Platform = window.Platform || {};
// prepopulate window.logFlags if necessary
window.logFlags = window.logFlags || {};
// process flags
(function(scope){
  // import
  var flags = scope.flags || {};
  // populate flags from location
  location.search.slice(1).split('&').forEach(function(o) {
    o = o.split('=');
    o[0] && (flags[o[0]] = o[1] || true);
  });
  // If any of these flags match 'native', then force native ShadowDOM; any
  // other truthy value, or failure to detect native
  // ShadowDOM, results in polyfill 
  flags.shadow = (flags.shadow || flags.shadowdom || flags.polyfill);
  if (flags.shadow === 'native') {
    flags.shadow = false;
  } else {
    flags.shadow = flags.shadow || !HTMLElement.prototype.createShadowRoot
        && 'polyfill';
  }



  // export
  scope.flags = flags;
})(Platform);
// select ShadowDOM impl
if (Platform.flags.shadow === 'polyfill') {
/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

// If WeakMap is not available, the association is stored as an expando property on the "key".
// TODO(arv): WeakMap does not allow for Node etc to be keys in Firefox
if (typeof WeakMap === 'undefined' || navigator.userAgent.indexOf('Firefox/') > -1) {
  (function() {
    var defineProperty = Object.defineProperty;
    var counter = Date.now() % 1e9;

    var WeakMap = function() {
      this.name = '__st' + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
    };

    WeakMap.prototype = {
      set: function(key, value) {
        var entry = key[this.name];
        if (entry && entry[0] === key)
          entry[1] = value;
        else
          defineProperty(key, this.name, {value: [key, value], writable: true});
      },
      get: function(key) {
        var entry;
        return (entry = key[this.name]) && entry[0] === key ?
            entry[1] : undefined;
      },
      delete: function(key) {
        this.set(key, undefined);
      }
    };

    window.WeakMap = WeakMap;
  })();
}

// Copyright 2012 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

var ShadowDOMPolyfill = {};

(function(scope) {
  'use strict';

  var constructorTable = new WeakMap();
  var nativePrototypeTable = new WeakMap();
  var wrappers = Object.create(null);

  // Don't test for eval if document has CSP securityPolicy object and we can
  // see that eval is not supported. This avoids an error message in console
  // even when the exception is caught
  var hasEval = !('securityPolicy' in document) ||
      document.securityPolicy.allowsEval;
  if (hasEval) {
    try {
      var f = new Function('', 'return true;');
      hasEval = f();
    } catch (ex) {
    }
  }

  function assert(b) {
    if (!b)
      throw new Error('Assertion failed');
  };

  function mixin(to, from) {
    Object.getOwnPropertyNames(from).forEach(function(name) {
      Object.defineProperty(to, name,
                            Object.getOwnPropertyDescriptor(from, name));
    });
    return to;
  };

  function mixinStatics(to, from) {
    Object.getOwnPropertyNames(from).forEach(function(name) {
      switch (name) {
        case 'arguments':
        case 'caller':
        case 'length':
        case 'name':
        case 'prototype':
        case 'toString':
          return;
      }
      Object.defineProperty(to, name,
                            Object.getOwnPropertyDescriptor(from, name));
    });
    return to;
  };

  function oneOf(object, propertyNames) {
    for (var i = 0; i < propertyNames.length; i++) {
      if (propertyNames[i] in object)
        return propertyNames[i];
    }
  }

  // Mozilla's old DOM bindings are bretty busted:
  // https://bugzilla.mozilla.org/show_bug.cgi?id=855844
  // Make sure they are create before we start modifying things.
  Object.getOwnPropertyNames(window);

  function getWrapperConstructor(node) {
    var nativePrototype = node.__proto__ || Object.getPrototypeOf(node);
    var wrapperConstructor = constructorTable.get(nativePrototype);
    if (wrapperConstructor)
      return wrapperConstructor;

    var parentWrapperConstructor = getWrapperConstructor(nativePrototype);

    var GeneratedWrapper = createWrapperConstructor(parentWrapperConstructor);
    registerInternal(nativePrototype, GeneratedWrapper, node);

    return GeneratedWrapper;
  }

  function addForwardingProperties(nativePrototype, wrapperPrototype) {
    installProperty(nativePrototype, wrapperPrototype, true);
  }

  function registerInstanceProperties(wrapperPrototype, instanceObject) {
    installProperty(instanceObject, wrapperPrototype, false);
  }

  var isFirefox = /Firefox/.test(navigator.userAgent);

  // This is used as a fallback when getting the descriptor fails in
  // installProperty.
  var dummyDescriptor = {
    get: function() {},
    set: function(v) {},
    configurable: true,
    enumerable: true
  };

  function isEventHandlerName(name) {
    return /^on[a-z]+$/.test(name);
  }

  function getGetter(name) {
    return hasEval ?
        new Function('return this.impl.' + name) :
        function() { return this.impl[name]; };
  }

  function getSetter(name) {
    return hasEval ?
        new Function('v', 'this.impl.' + name + ' = v') :
        function(v) { this.impl[name] = v; };
  }

  function getMethod(name) {
    return hasEval ?
        new Function('return this.impl.' + name +
                     '.apply(this.impl, arguments)') :
        function() { return this.impl[name].apply(this.impl, arguments); };
  }

  function installProperty(source, target, allowMethod) {
    Object.getOwnPropertyNames(source).forEach(function(name) {
      if (name in target)
        return;

      if (isFirefox) {
        // Tickle Firefox's old bindings.
        source.__lookupGetter__(name);
      }
      var descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(source, name);
      } catch (ex) {
        // JSC and V8 both use data properties instead of accessors which can
        // cause getting the property desciptor to throw an exception.
        // https://bugs.webkit.org/show_bug.cgi?id=49739
        descriptor = dummyDescriptor;
      }
      var getter, setter;
      if (allowMethod && typeof descriptor.value === 'function') {
        target[name] = getMethod(name);
        return;
      }

      var isEvent = isEventHandlerName(name);
      if (isEvent)
        getter = scope.getEventHandlerGetter(name);
      else
        getter = getGetter(name);

      if (descriptor.writable || descriptor.set) {
        if (isEvent)
          setter = scope.getEventHandlerSetter(name);
        else
          setter = getSetter(name);
      }

      Object.defineProperty(target, name, {
        get: getter,
        set: setter,
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable
      });
    });
  }

  /**
   * @param {Function} nativeConstructor
   * @param {Function} wrapperConstructor
   * @param {Object=} opt_instance If present, this is used to extract
   *     properties from an instance object.
   */
  function register(nativeConstructor, wrapperConstructor, opt_instance) {
    var nativePrototype = nativeConstructor.prototype;
    registerInternal(nativePrototype, wrapperConstructor, opt_instance);
    mixinStatics(wrapperConstructor, nativeConstructor);
  }

  function registerInternal(nativePrototype, wrapperConstructor, opt_instance) {
    var wrapperPrototype = wrapperConstructor.prototype;
    assert(constructorTable.get(nativePrototype) === undefined);

    constructorTable.set(nativePrototype, wrapperConstructor);
    nativePrototypeTable.set(wrapperPrototype, nativePrototype);

    addForwardingProperties(nativePrototype, wrapperPrototype);
    if (opt_instance)
      registerInstanceProperties(wrapperPrototype, opt_instance);
  }

  function isWrapperFor(wrapperConstructor, nativeConstructor) {
    return constructorTable.get(nativeConstructor.prototype) ===
        wrapperConstructor;
  }

  /**
   * Creates a generic wrapper constructor based on |object| and its
   * constructor.
   * Sometimes the constructor does not have an associated instance
   * (CharacterData for example). In that case you can pass the constructor that
   * you want to map the object to using |opt_nativeConstructor|.
   * @param {Node} object
   * @param {Function=} opt_nativeConstructor
   * @return {Function} The generated constructor.
   */
  function registerObject(object) {
    var nativePrototype = Object.getPrototypeOf(object);

    var superWrapperConstructor = getWrapperConstructor(nativePrototype);
    var GeneratedWrapper = createWrapperConstructor(superWrapperConstructor);
    registerInternal(nativePrototype, GeneratedWrapper, object);

    return GeneratedWrapper;
  }

  function createWrapperConstructor(superWrapperConstructor) {
    function GeneratedWrapper(node) {
      superWrapperConstructor.call(this, node);
    }
    GeneratedWrapper.prototype =
        Object.create(superWrapperConstructor.prototype);
    GeneratedWrapper.prototype.constructor = GeneratedWrapper;

    return GeneratedWrapper;
  }

  var OriginalDOMImplementation = DOMImplementation;
  var OriginalEvent = Event;
  var OriginalNode = Node;
  var OriginalWindow = Window;
  var OriginalRange = Range;

  function isWrapper(object) {
    return object instanceof wrappers.EventTarget ||
           object instanceof wrappers.Event ||
           object instanceof wrappers.Range ||
           object instanceof wrappers.DOMImplementation;
  }

  function isNative(object) {
    return object instanceof OriginalNode ||
           object instanceof OriginalEvent ||
           object instanceof OriginalWindow ||
           object instanceof OriginalRange ||
           object instanceof OriginalDOMImplementation;
  }

  /**
   * Wraps a node in a WrapperNode. If there already exists a wrapper for the
   * |node| that wrapper is returned instead.
   * @param {Node} node
   * @return {WrapperNode}
   */
  function wrap(impl) {
    if (impl === null)
      return null;

    assert(isNative(impl));
    return impl.polymerWrapper_ ||
        (impl.polymerWrapper_ = new (getWrapperConstructor(impl))(impl));
  }

  /**
   * Unwraps a wrapper and returns the node it is wrapping.
   * @param {WrapperNode} wrapper
   * @return {Node}
   */
  function unwrap(wrapper) {
    if (wrapper === null)
      return null;
    assert(isWrapper(wrapper));
    return wrapper.impl;
  }

  /**
   * Unwraps object if it is a wrapper.
   * @param {Object} object
   * @return {Object} The native implementation object.
   */
  function unwrapIfNeeded(object) {
    return object && isWrapper(object) ? unwrap(object) : object;
  }

  /**
   * Wraps object if it is not a wrapper.
   * @param {Object} object
   * @return {Object} The wrapper for object.
   */
  function wrapIfNeeded(object) {
    return object && !isWrapper(object) ? wrap(object) : object;
  }

  /**
   * Overrides the current wrapper (if any) for node.
   * @param {Node} node
   * @param {WrapperNode=} wrapper If left out the wrapper will be created as
   *     needed next time someone wraps the node.
   */
  function rewrap(node, wrapper) {
    if (wrapper === null)
      return;
    assert(isNative(node));
    assert(wrapper === undefined || isWrapper(wrapper));
    node.polymerWrapper_ = wrapper;
  }

  function defineGetter(constructor, name, getter) {
    Object.defineProperty(constructor.prototype, name, {
      get: getter,
      configurable: true,
      enumerable: true
    });
  }

  function defineWrapGetter(constructor, name) {
    defineGetter(constructor, name, function() {
      return wrap(this.impl[name]);
    });
  }

  /**
   * Forwards existing methods on the native object to the wrapper methods.
   * This does not wrap any of the arguments or the return value since the
   * wrapper implementation already takes care of that.
   * @param {Array.<Function>} constructors
   * @parem {Array.<string>} names
   */
  function forwardMethodsToWrapper(constructors, names) {
    constructors.forEach(function(constructor) {
      names.forEach(function(name) {
        constructor.prototype[name] = function() {
          var w = wrapIfNeeded(this);
          return w[name].apply(w, arguments);
        };
      });
    });
  }

  scope.assert = assert;
  scope.constructorTable = constructorTable;
  scope.defineGetter = defineGetter;
  scope.defineWrapGetter = defineWrapGetter;
  scope.forwardMethodsToWrapper = forwardMethodsToWrapper;
  scope.isWrapperFor = isWrapperFor;
  scope.mixin = mixin;
  scope.nativePrototypeTable = nativePrototypeTable;
  scope.oneOf = oneOf;
  scope.registerObject = registerObject;
  scope.registerWrapper = register;
  scope.rewrap = rewrap;
  scope.unwrap = unwrap;
  scope.unwrapIfNeeded = unwrapIfNeeded;
  scope.wrap = wrap;
  scope.wrapIfNeeded = wrapIfNeeded;
  scope.wrappers = wrappers;

})(this.ShadowDOMPolyfill);
// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var forwardMethodsToWrapper = scope.forwardMethodsToWrapper;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;
  var unwrap = scope.unwrap;
  var wrap = scope.wrap;
  var wrappers = scope.wrappers;

  var wrappedFuns = new WeakMap();
  var listenersTable = new WeakMap();
  var handledEventsTable = new WeakMap();
  var targetTable = new WeakMap();
  var currentTargetTable = new WeakMap();
  var relatedTargetTable = new WeakMap();
  var eventPhaseTable = new WeakMap();
  var stopPropagationTable = new WeakMap();
  var stopImmediatePropagationTable = new WeakMap();
  var eventHandlersTable = new WeakMap();
  var eventPathTable = new WeakMap();

  function isShadowRoot(node) {
    return node instanceof wrappers.ShadowRoot;
  }

  function isInsertionPoint(node) {
    var localName = node.localName;
    return localName === 'content' || localName === 'shadow';
  }

  function isShadowHost(node) {
    return !!node.shadowRoot;
  }

  function getEventParent(node) {
    var dv;
    return node.parentNode || (dv = node.defaultView) && wrap(dv) || null;
  }

  // https://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#dfn-adjusted-parent
  function calculateParents(node, context, ancestors) {
    if (ancestors.length)
      return ancestors.shift();

    // 1.
    if (isShadowRoot(node))
      return getInsertionParent(node) || scope.getHostForShadowRoot(node);

    // 2.
    var eventParents = scope.eventParentsTable.get(node);
    if (eventParents) {
      // Copy over the remaining event parents for next iteration.
      for (var i = 1; i < eventParents.length; i++) {
        ancestors[i - 1] = eventParents[i];
      }
      return eventParents[0];
    }

    // 3.
    if (context && isInsertionPoint(node)) {
      var parentNode = node.parentNode;
      if (parentNode && isShadowHost(parentNode)) {
        var trees = scope.getShadowTrees(parentNode);
        var p = getInsertionParent(context);
        for (var i = 0; i < trees.length; i++) {
          if (trees[i].contains(p))
            return p;
        }
      }
    }

    return getEventParent(node);
  }

  // https://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#event-retargeting
  function retarget(node) {
    var stack = [];  // 1.
    var ancestor = node;  // 2.
    var targets = [];
    var ancestors = [];
    while (ancestor) {  // 3.
      var context = null;  // 3.2.
      // TODO(arv): Change order of these. If the stack is empty we always end
      // up pushing ancestor, no matter what.
      if (isInsertionPoint(ancestor)) {  // 3.1.
        context = topMostNotInsertionPoint(stack);  // 3.1.1.
        var top = stack[stack.length - 1] || ancestor;  // 3.1.2.
        stack.push(top);
      } else if (!stack.length) {
        stack.push(ancestor);  // 3.3.
      }
      var target = stack[stack.length - 1];  // 3.4.
      targets.push({target: target, currentTarget: ancestor});  // 3.5.
      if (isShadowRoot(ancestor))  // 3.6.
        stack.pop();  // 3.6.1.

      ancestor = calculateParents(ancestor, context, ancestors);  // 3.7.
    }
    return targets;
  }

  function topMostNotInsertionPoint(stack) {
    for (var i = stack.length - 1; i >= 0; i--) {
      if (!isInsertionPoint(stack[i]))
        return stack[i];
    }
    return null;
  }

  // https://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#dfn-adjusted-related-target
  function adjustRelatedTarget(target, related) {
    var ancestors = [];
    while (target) {  // 3.
      var stack = [];  // 3.1.
      var ancestor = related;  // 3.2.
      var last = undefined;  // 3.3. Needs to be reset every iteration.
      while (ancestor) {
        var context = null;
        if (!stack.length) {
          stack.push(ancestor);
        } else {
          if (isInsertionPoint(ancestor)) {  // 3.4.3.
            context = topMostNotInsertionPoint(stack);
            // isDistributed is more general than checking whether last is
            // assigned into ancestor.
            if (isDistributed(last)) {  // 3.4.3.2.
              var head = stack[stack.length - 1];
              stack.push(head);
            }
          }
        }

        if (inSameTree(ancestor, target))  // 3.4.4.
          return stack[stack.length - 1];

        if (isShadowRoot(ancestor))  // 3.4.5.
          stack.pop();

        last = ancestor;  // 3.4.6.
        ancestor = calculateParents(ancestor, context, ancestors);  // 3.4.7.
      }
      if (isShadowRoot(target))  // 3.5.
        target = scope.getHostForShadowRoot(target);
      else
        target = target.parentNode;  // 3.6.
    }
  }

  function getInsertionParent(node) {
    return scope.insertionParentTable.get(node);
  }

  function isDistributed(node) {
    return getInsertionParent(node);
  }

  function rootOfNode(node) {
    var p;
    while (p = node.parentNode) {
      node = p;
    }
    return node;
  }

  function inSameTree(a, b) {
    return rootOfNode(a) === rootOfNode(b);
  }

  function enclosedBy(a, b) {
    if (a === b)
      return true;
    if (a instanceof wrappers.ShadowRoot) {
      var host = scope.getHostForShadowRoot(a);
      return enclosedBy(rootOfNode(host), b);
    }
    return false;
  }

  function isMutationEvent(type) {
    switch (type) {
      case 'DOMAttrModified':
      case 'DOMAttributeNameChanged':
      case 'DOMCharacterDataModified':
      case 'DOMElementNameChanged':
      case 'DOMNodeInserted':
      case 'DOMNodeInsertedIntoDocument':
      case 'DOMNodeRemoved':
      case 'DOMNodeRemovedFromDocument':
      case 'DOMSubtreeModified':
        return true;
    }
    return false;
  }

  function dispatchOriginalEvent(originalEvent) {
    // Make sure this event is only dispatched once.
    if (handledEventsTable.get(originalEvent))
      return;
    handledEventsTable.set(originalEvent, true);

    // Don't do rendering if this is a mutation event since rendering might
    // mutate the DOM which would fire more events and we would most likely
    // just iloop.
    if (!isMutationEvent(originalEvent.type))
      scope.renderAllPending();

    var target = wrap(originalEvent.target);
    var event = wrap(originalEvent);
    return dispatchEvent(event, target);
  }

  function dispatchEvent(event, originalWrapperTarget) {
    var eventPath = retarget(originalWrapperTarget);

    // For window load events the load event is dispatched at the window but
    // the target is set to the document.
    //
    // http://www.whatwg.org/specs/web-apps/current-work/multipage/the-end.html#the-end
    //
    // TODO(arv): Find a less hacky way to do this.
    if (event.type === 'load' &&
        eventPath.length === 2 &&
        eventPath[0].target instanceof wrappers.Document) {
      eventPath.shift();
    }

    eventPathTable.set(event, eventPath);

    if (dispatchCapturing(event, eventPath)) {
      if (dispatchAtTarget(event, eventPath)) {
        dispatchBubbling(event, eventPath);
      }
    }

    eventPhaseTable.set(event, Event.NONE);
    currentTargetTable.set(event, null);

    return event.defaultPrevented;
  }

  function dispatchCapturing(event, eventPath) {
    var phase;

    for (var i = eventPath.length - 1; i > 0; i--) {
      var target = eventPath[i].target;
      var currentTarget = eventPath[i].currentTarget;
      if (target === currentTarget)
        continue;

      phase = Event.CAPTURING_PHASE;
      if (!invoke(eventPath[i], event, phase))
        return false;
    }

    return true;
  }

  function dispatchAtTarget(event, eventPath) {
    var phase = Event.AT_TARGET;
    return invoke(eventPath[0], event, phase);
  }

  function dispatchBubbling(event, eventPath) {
    var bubbles = event.bubbles;
    var phase;

    for (var i = 1; i < eventPath.length; i++) {
      var target = eventPath[i].target;
      var currentTarget = eventPath[i].currentTarget;
      if (target === currentTarget)
        phase = Event.AT_TARGET;
      else if (bubbles && !stopImmediatePropagationTable.get(event))
        phase = Event.BUBBLING_PHASE;
      else
        continue;

      if (!invoke(eventPath[i], event, phase))
        return;
    }
  }

  function invoke(tuple, event, phase) {
    var target = tuple.target;
    var currentTarget = tuple.currentTarget;

    var listeners = listenersTable.get(currentTarget);
    if (!listeners)
      return true;

    if ('relatedTarget' in event) {
      var originalEvent = unwrap(event);
      var relatedTarget = wrap(originalEvent.relatedTarget);

      var adjusted = adjustRelatedTarget(currentTarget, relatedTarget);
      if (adjusted === target)
        return true;

      relatedTargetTable.set(event, adjusted);
    }

    eventPhaseTable.set(event, phase);
    var type = event.type;

    var anyRemoved = false;
    targetTable.set(event, target);
    currentTargetTable.set(event, currentTarget);

    for (var i = 0; i < listeners.length; i++) {
      var listener = listeners[i];
      if (listener.removed) {
        anyRemoved = true;
        continue;
      }

      if (listener.type !== type ||
          !listener.capture && phase === Event.CAPTURING_PHASE ||
          listener.capture && phase === Event.BUBBLING_PHASE) {
        continue;
      }

      try {
        if (typeof listener.handler === 'function')
          listener.handler.call(currentTarget, event);
        else
          listener.handler.handleEvent(event);

        if (stopImmediatePropagationTable.get(event))
          return false;

      } catch (ex) {
        if (window.onerror)
          window.onerror(ex.message);
        else
          console.error(ex);
      }
    }

    if (anyRemoved) {
      var copy = listeners.slice();
      listeners.length = 0;
      for (var i = 0; i < copy.length; i++) {
        if (!copy[i].removed)
          listeners.push(copy[i]);
      }
    }

    return !stopPropagationTable.get(event);
  }

  function Listener(type, handler, capture) {
    this.type = type;
    this.handler = handler;
    this.capture = Boolean(capture);
  }
  Listener.prototype = {
    equals: function(that) {
      return this.handler === that.handler && this.type === that.type &&
          this.capture === that.capture;
    },
    get removed() {
      return this.handler === null;
    },
    remove: function() {
      this.handler = null;
    }
  };

  var OriginalEvent = window.Event;

  /**
   * Creates a new Event wrapper or wraps an existin native Event object.
   * @param {string|Event} type
   * @param {Object=} options
   * @constructor
   */
  function Event(type, options) {
    if (type instanceof OriginalEvent)
      this.impl = type;
    else
      return wrap(constructEvent(OriginalEvent, 'Event', type, options));
  }
  Event.prototype = {
    get target() {
      return targetTable.get(this);
    },
    get currentTarget() {
      return currentTargetTable.get(this);
    },
    get eventPhase() {
      return eventPhaseTable.get(this);
    },
    get path() {
      var nodeList = new wrappers.NodeList();
      var eventPath = eventPathTable.get(this);
      if (eventPath) {
        var index = 0;
        var lastIndex = eventPath.length - 1;
        var baseRoot = rootOfNode(currentTargetTable.get(this));

        for (var i = 0; i <= lastIndex; i++) {
          var currentTarget = eventPath[i].currentTarget;
          var currentRoot = rootOfNode(currentTarget);
          if (enclosedBy(baseRoot, currentRoot) &&
              // Make sure we do not add Window to the path.
              (i !== lastIndex || currentTarget instanceof wrappers.Node)) {
            nodeList[index++] = currentTarget;
          }
        }
        nodeList.length = index;
      }
      return nodeList;
    },
    stopPropagation: function() {
      stopPropagationTable.set(this, true);
    },
    stopImmediatePropagation: function() {
      stopPropagationTable.set(this, true);
      stopImmediatePropagationTable.set(this, true);
    }
  };
  registerWrapper(OriginalEvent, Event, document.createEvent('Event'));

  function unwrapOptions(options) {
    if (!options || !options.relatedTarget)
      return options;
    return Object.create(options, {
      relatedTarget: {value: unwrap(options.relatedTarget)}
    });
  }

  function registerGenericEvent(name, SuperEvent, prototype) {
    var OriginalEvent = window[name];
    var GenericEvent = function(type, options) {
      if (type instanceof OriginalEvent)
        this.impl = type;
      else
        return wrap(constructEvent(OriginalEvent, name, type, options));
    };
    GenericEvent.prototype = Object.create(SuperEvent.prototype);
    if (prototype)
      mixin(GenericEvent.prototype, prototype);
    if (OriginalEvent) {
      // IE does not support event constructors but FocusEvent can only be
      // created using new FocusEvent in Firefox.
      // https://bugzilla.mozilla.org/show_bug.cgi?id=882165
      if (OriginalEvent.prototype['init' + name]) {
        registerWrapper(OriginalEvent, GenericEvent,
                        document.createEvent(name));
      } else {
        registerWrapper(OriginalEvent, GenericEvent, new OriginalEvent('temp'));
      }
    }
    return GenericEvent;
  }

  var UIEvent = registerGenericEvent('UIEvent', Event);
  var CustomEvent = registerGenericEvent('CustomEvent', Event);

  var relatedTargetProto = {
    get relatedTarget() {
      return relatedTargetTable.get(this) || wrap(unwrap(this).relatedTarget);
    }
  };

  function getInitFunction(name, relatedTargetIndex) {
    return function() {
      arguments[relatedTargetIndex] = unwrap(arguments[relatedTargetIndex]);
      var impl = unwrap(this);
      impl[name].apply(impl, arguments);
    };
  }

  var mouseEventProto = mixin({
    initMouseEvent: getInitFunction('initMouseEvent', 14)
  }, relatedTargetProto);

  var focusEventProto = mixin({
    initFocusEvent: getInitFunction('initFocusEvent', 5)
  }, relatedTargetProto);

  var MouseEvent = registerGenericEvent('MouseEvent', UIEvent, mouseEventProto);
  var FocusEvent = registerGenericEvent('FocusEvent', UIEvent, focusEventProto);

  var MutationEvent = registerGenericEvent('MutationEvent', Event, {
    initMutationEvent: getInitFunction('initMutationEvent', 3),
    get relatedNode() {
      return wrap(this.impl.relatedNode);
    },
  });

  // In case the browser does not support event constructors we polyfill that
  // by calling `createEvent('Foo')` and `initFooEvent` where the arguments to
  // `initFooEvent` are derived from the registered default event init dict.
  var defaultInitDicts = Object.create(null);

  var supportsEventConstructors = (function() {
    try {
      new window.MouseEvent('click');
    } catch (ex) {
      return false;
    }
    return true;
  })();

  /**
   * Constructs a new native event.
   */
  function constructEvent(OriginalEvent, name, type, options) {
    if (supportsEventConstructors)
      return new OriginalEvent(type, unwrapOptions(options));

    // Create the arguments from the default dictionary.
    var event = unwrap(document.createEvent(name));
    var defaultDict = defaultInitDicts[name];
    var args = [type];
    Object.keys(defaultDict).forEach(function(key) {
      var v = options != null && key in options ?
          options[key] : defaultDict[key];
      if (key === 'relatedTarget')
        v = unwrap(v);
      args.push(v);
    });
    event['init' + name].apply(event, args);
    return event;
  }

  if (!supportsEventConstructors) {
    var configureEventConstructor = function(name, initDict, superName) {
      if (superName) {
        var superDict = defaultInitDicts[superName];
        initDict = mixin(mixin({}, superDict), initDict);
      }

      defaultInitDicts[name] = initDict;
    };

    // The order of the default event init dictionary keys is important, the
    // arguments to initFooEvent is derived from that.
    configureEventConstructor('Event', {bubbles: false, cancelable: false});
    configureEventConstructor('CustomEvent', {detail: null}, 'Event');
    configureEventConstructor('UIEvent', {view: null, detail: 0}, 'Event');
    configureEventConstructor('MouseEvent', {
      screenX: 0,
      screenY: 0,
      clientX: 0,
      clientY: 0,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      button: 0,
      relatedTarget: null
    }, 'UIEvent');
    configureEventConstructor('FocusEvent', {relatedTarget: null}, 'UIEvent');
  }

  function isValidListener(fun) {
    if (typeof fun === 'function')
      return true;
    return fun && fun.handleEvent;
  }

  var OriginalEventTarget = window.EventTarget;

  /**
   * This represents a wrapper for an EventTarget.
   * @param {!EventTarget} impl The original event target.
   * @constructor
   */
  function EventTarget(impl) {
    this.impl = impl;
  }

  // Node and Window have different internal type checks in WebKit so we cannot
  // use the same method as the original function.
  var methodNames = [
    'addEventListener',
    'removeEventListener',
    'dispatchEvent'
  ];

  [Node, Window].forEach(function(constructor) {
    var p = constructor.prototype;
    methodNames.forEach(function(name) {
      Object.defineProperty(p, name + '_', {value: p[name]});
    });
  });

  function getTargetToListenAt(wrapper) {
    if (wrapper instanceof wrappers.ShadowRoot)
      wrapper = scope.getHostForShadowRoot(wrapper);
    return unwrap(wrapper);
  }

  EventTarget.prototype = {
    addEventListener: function(type, fun, capture) {
      if (!isValidListener(fun))
        return;

      var listener = new Listener(type, fun, capture);
      var listeners = listenersTable.get(this);
      if (!listeners) {
        listeners = [];
        listenersTable.set(this, listeners);
      } else {
        // Might have a duplicate.
        for (var i = 0; i < listeners.length; i++) {
          if (listener.equals(listeners[i]))
            return;
        }
      }

      listeners.push(listener);

      var target = getTargetToListenAt(this);
      target.addEventListener_(type, dispatchOriginalEvent, true);
    },
    removeEventListener: function(type, fun, capture) {
      capture = Boolean(capture);
      var listeners = listenersTable.get(this);
      if (!listeners)
        return;
      var count = 0, found = false;
      for (var i = 0; i < listeners.length; i++) {
        if (listeners[i].type === type && listeners[i].capture === capture) {
          count++;
          if (listeners[i].handler === fun) {
            found = true;
            listeners[i].remove();
          }
        }
      }

      if (found && count === 1) {
        var target = getTargetToListenAt(this);
        target.removeEventListener_(type, dispatchOriginalEvent, true);
      }
    },
    dispatchEvent: function(event) {
      var target = getTargetToListenAt(this);
      return target.dispatchEvent_(unwrap(event));
    }
  };

  if (OriginalEventTarget)
    registerWrapper(OriginalEventTarget, EventTarget);

  function wrapEventTargetMethods(constructors) {
    forwardMethodsToWrapper(constructors, methodNames);
  }


  var originalElementFromPoint = document.elementFromPoint;

  function elementFromPoint(self, document, x, y) {
    scope.renderAllPending();

    var element = wrap(originalElementFromPoint.call(document.impl, x, y));
    var targets = retarget(element, this)
    for (var i = 0; i < targets.length; i++) {
      var target = targets[i];
      if (target.currentTarget === self)
        return target.target;
    }
    return null;
  }

  /**
   * Returns a function that is to be used as a getter for `onfoo` properties.
   * @param {string} name
   * @return {Function}
   */
  function getEventHandlerGetter(name) {
    return function() {
      var inlineEventHandlers = eventHandlersTable.get(this);
      return inlineEventHandlers && inlineEventHandlers[name] &&
          inlineEventHandlers[name].value || null;
     };
  }

  /**
   * Returns a function that is to be used as a setter for `onfoo` properties.
   * @param {string} name
   * @return {Function}
   */
  function getEventHandlerSetter(name) {
    var eventType = name.slice(2);
    return function(value) {
      var inlineEventHandlers = eventHandlersTable.get(this);
      if (!inlineEventHandlers) {
        inlineEventHandlers = Object.create(null);
        eventHandlersTable.set(this, inlineEventHandlers);
      }

      var old = inlineEventHandlers[name];
      if (old)
        this.removeEventListener(eventType, old.wrapped, false);

      if (typeof value === 'function') {
        var wrapped = function(e) {
          var rv = value.call(this, e);
          if (rv === false)
            e.preventDefault();
          else if (name === 'onbeforeunload' && typeof rv === 'string')
            e.returnValue = rv;
          // mouseover uses true for preventDefault but preventDefault for
          // mouseover is ignored by browsers these day.
        };

        this.addEventListener(eventType, wrapped, false);
        inlineEventHandlers[name] = {
          value: value,
          wrapped: wrapped
        };
      }
    };
  }

  scope.adjustRelatedTarget = adjustRelatedTarget;
  scope.elementFromPoint = elementFromPoint;
  scope.getEventHandlerGetter = getEventHandlerGetter;
  scope.getEventHandlerSetter = getEventHandlerSetter;
  scope.wrapEventTargetMethods = wrapEventTargetMethods;
  scope.wrappers.CustomEvent = CustomEvent;
  scope.wrappers.Event = Event;
  scope.wrappers.EventTarget = EventTarget;
  scope.wrappers.FocusEvent = FocusEvent;
  scope.wrappers.MouseEvent = MouseEvent;
  scope.wrappers.MutationEvent = MutationEvent;
  scope.wrappers.UIEvent = UIEvent;

})(this.ShadowDOMPolyfill);

// Copyright 2012 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var wrap = scope.wrap;

  function nonEnum(obj, prop) {
    Object.defineProperty(obj, prop, {enumerable: false});
  }

  function NodeList() {
    this.length = 0;
    nonEnum(this, 'length');
  }
  NodeList.prototype = {
    item: function(index) {
      return this[index];
    }
  };
  nonEnum(NodeList.prototype, 'item');

  function wrapNodeList(list) {
    if (list == null)
      return list;
    var wrapperList = new NodeList();
    for (var i = 0, length = list.length; i < length; i++) {
      wrapperList[i] = wrap(list[i]);
    }
    wrapperList.length = length;
    return wrapperList;
  }

  function addWrapNodeListMethod(wrapperConstructor, name) {
    wrapperConstructor.prototype[name] = function() {
      return wrapNodeList(this.impl[name].apply(this.impl, arguments));
    };
  }

  scope.wrappers.NodeList = NodeList;
  scope.addWrapNodeListMethod = addWrapNodeListMethod;
  scope.wrapNodeList = wrapNodeList;

})(this.ShadowDOMPolyfill);
// Copyright 2012 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var EventTarget = scope.wrappers.EventTarget;
  var NodeList = scope.wrappers.NodeList;
  var defineWrapGetter = scope.defineWrapGetter;
  var assert = scope.assert;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;
  var unwrap = scope.unwrap;
  var wrap = scope.wrap;
  var wrapIfNeeded = scope.wrapIfNeeded;

  function assertIsNodeWrapper(node) {
    assert(node instanceof Node);
  }

  /**
   * Collects nodes from a DocumentFragment or a Node for removal followed
   * by an insertion.
   *
   * This updates the internal pointers for node, previousNode and nextNode.
   */
  function collectNodes(node, parentNode, previousNode, nextNode) {
    if (!(node instanceof DocumentFragment)) {
      if (node.parentNode)
        node.parentNode.removeChild(node);
      node.parentNode_ = parentNode;
      node.previousSibling_ = previousNode;
      node.nextSibling_ = nextNode;
      if (previousNode)
        previousNode.nextSibling_ = node;
      if (nextNode)
        nextNode.previousSibling_ = node;
      return [node];
    }

    var nodes = [];
    var firstChild;
    while (firstChild = node.firstChild) {
      node.removeChild(firstChild);
      nodes.push(firstChild);
      firstChild.parentNode_ = parentNode;
    }

    for (var i = 0; i < nodes.length; i++) {
      nodes[i].previousSibling_ = nodes[i - 1] || previousNode;
      nodes[i].nextSibling_ = nodes[i + 1] || nextNode;
    }

    if (previousNode)
      previousNode.nextSibling_ = nodes[0];
    if (nextNode)
      nextNode.previousSibling_ = nodes[nodes.length - 1];

    return nodes;
  }

  function collectNodesNoNeedToUpdatePointers(node) {
    if (node instanceof DocumentFragment) {
      var nodes = [];
      var i = 0;
      for (var child = node.firstChild; child; child = child.nextSibling) {
        nodes[i++] = child;
      }
      return nodes;
    }
    return [node];
  }

  function nodesWereAdded(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].nodeWasAdded_();
    }
  }

  function ensureSameOwnerDocument(parent, child) {
    var ownerDoc = parent.nodeType === Node.DOCUMENT_NODE ?
        parent : parent.ownerDocument;
    if (ownerDoc !== child.ownerDocument)
      ownerDoc.adoptNode(child);
  }

  function adoptNodesIfNeeded(owner, nodes) {
    if (!nodes.length)
      return;

    var ownerDoc = owner.ownerDocument;

    // All nodes have the same ownerDocument when we get here.
    if (ownerDoc === nodes[0].ownerDocument)
      return;

    for (var i = 0; i < nodes.length; i++) {
      scope.adoptNodeNoRemove(nodes[i], ownerDoc);
    }
  }

  function unwrapNodesForInsertion(owner, nodes) {
    adoptNodesIfNeeded(owner, nodes);
    var length = nodes.length;

    if (length === 1)
      return unwrap(nodes[0]);

    var df = unwrap(owner.ownerDocument.createDocumentFragment());
    for (var i = 0; i < length; i++) {
      df.appendChild(unwrap(nodes[i]));
    }
    return df;
  }

  function removeAllChildNodes(wrapper) {
    if (wrapper.invalidateShadowRenderer()) {
      var childWrapper = wrapper.firstChild;
      while (childWrapper) {
        assert(childWrapper.parentNode === wrapper);
        var nextSibling = childWrapper.nextSibling;
        var childNode = unwrap(childWrapper);
        var parentNode = childNode.parentNode;
        if (parentNode)
          originalRemoveChild.call(parentNode, childNode);
        childWrapper.previousSibling_ = childWrapper.nextSibling_ =
            childWrapper.parentNode_ = null;
        childWrapper = nextSibling;
      }
      wrapper.firstChild_ = wrapper.lastChild_ = null;
    } else {
      var node = unwrap(wrapper);
      var child = node.firstChild;
      var nextSibling;
      while (child) {
        nextSibling = child.nextSibling;
        originalRemoveChild.call(node, child);
        child = nextSibling;
      }
    }
  }

  function invalidateParent(node) {
    var p = node.parentNode;
    return p && p.invalidateShadowRenderer();
  }

  var OriginalNode = window.Node;

  /**
   * This represents a wrapper of a native DOM node.
   * @param {!Node} original The original DOM node, aka, the visual DOM node.
   * @constructor
   * @extends {EventTarget}
   */
  function Node(original) {
    assert(original instanceof OriginalNode);

    EventTarget.call(this, original);

    // These properties are used to override the visual references with the
    // logical ones. If the value is undefined it means that the logical is the
    // same as the visual.

    /**
     * @type {Node|undefined}
     * @private
     */
    this.parentNode_ = undefined;

    /**
     * @type {Node|undefined}
     * @private
     */
    this.firstChild_ = undefined;

    /**
     * @type {Node|undefined}
     * @private
     */
    this.lastChild_ = undefined;

    /**
     * @type {Node|undefined}
     * @private
     */
    this.nextSibling_ = undefined;

    /**
     * @type {Node|undefined}
     * @private
     */
    this.previousSibling_ = undefined;
  };

  var originalAppendChild = OriginalNode.prototype.appendChild;
  var originalInsertBefore = OriginalNode.prototype.insertBefore;
  var originalReplaceChild = OriginalNode.prototype.replaceChild;
  var originalRemoveChild = OriginalNode.prototype.removeChild;
  var originalCompareDocumentPosition =
      OriginalNode.prototype.compareDocumentPosition;

  Node.prototype = Object.create(EventTarget.prototype);
  mixin(Node.prototype, {
    appendChild: function(childWrapper) {
      assertIsNodeWrapper(childWrapper);

      var nodes;

      if (this.invalidateShadowRenderer() || invalidateParent(childWrapper)) {
        var previousNode = this.lastChild;
        var nextNode = null;
        nodes = collectNodes(childWrapper, this, previousNode, nextNode);

        this.lastChild_ = nodes[nodes.length - 1];
        if (!previousNode)
          this.firstChild_ = nodes[0];

        originalAppendChild.call(this.impl, unwrapNodesForInsertion(this, nodes));
      } else {
        nodes = collectNodesNoNeedToUpdatePointers(childWrapper)
        ensureSameOwnerDocument(this, childWrapper);
        originalAppendChild.call(this.impl, unwrap(childWrapper));
      }

      nodesWereAdded(nodes);

      return childWrapper;
    },

    insertBefore: function(childWrapper, refWrapper) {
      // TODO(arv): Unify with appendChild
      if (!refWrapper)
        return this.appendChild(childWrapper);

      assertIsNodeWrapper(childWrapper);
      assertIsNodeWrapper(refWrapper);
      assert(refWrapper.parentNode === this);

      var nodes;

      if (this.invalidateShadowRenderer() || invalidateParent(childWrapper)) {
        var previousNode = refWrapper.previousSibling;
        var nextNode = refWrapper;
        nodes = collectNodes(childWrapper, this, previousNode, nextNode);

        if (this.firstChild === refWrapper)
          this.firstChild_ = nodes[0];

        // insertBefore refWrapper no matter what the parent is?
        var refNode = unwrap(refWrapper);
        var parentNode = refNode.parentNode;

        if (parentNode) {
          originalInsertBefore.call(
              parentNode,
              unwrapNodesForInsertion(this, nodes),
              refNode);
        } else {
          adoptNodesIfNeeded(this, nodes);
        }
      } else {
        nodes = collectNodesNoNeedToUpdatePointers(childWrapper);
        ensureSameOwnerDocument(this, childWrapper);
        originalInsertBefore.call(this.impl, unwrap(childWrapper),
                                  unwrap(refWrapper));
      }

      nodesWereAdded(nodes);

      return childWrapper;
    },

    removeChild: function(childWrapper) {
      assertIsNodeWrapper(childWrapper);
      if (childWrapper.parentNode !== this) {
        // TODO(arv): DOMException
        throw new Error('NotFoundError');
      }

      var childNode = unwrap(childWrapper);
      if (this.invalidateShadowRenderer()) {

        // We need to remove the real node from the DOM before updating the
        // pointers. This is so that that mutation event is dispatched before
        // the pointers have changed.
        var thisFirstChild = this.firstChild;
        var thisLastChild = this.lastChild;
        var childWrapperNextSibling = childWrapper.nextSibling;
        var childWrapperPreviousSibling = childWrapper.previousSibling;

        var parentNode = childNode.parentNode;
        if (parentNode)
          originalRemoveChild.call(parentNode, childNode);

        if (thisFirstChild === childWrapper)
          this.firstChild_ = childWrapperNextSibling;
        if (thisLastChild === childWrapper)
          this.lastChild_ = childWrapperPreviousSibling;
        if (childWrapperPreviousSibling)
          childWrapperPreviousSibling.nextSibling_ = childWrapperNextSibling;
        if (childWrapperNextSibling) {
          childWrapperNextSibling.previousSibling_ =
              childWrapperPreviousSibling;
        }

        childWrapper.previousSibling_ = childWrapper.nextSibling_ =
            childWrapper.parentNode_ = undefined;
      } else {
        originalRemoveChild.call(this.impl, childNode);
      }

      return childWrapper;
    },

    replaceChild: function(newChildWrapper, oldChildWrapper) {
      assertIsNodeWrapper(newChildWrapper);
      assertIsNodeWrapper(oldChildWrapper);

      if (oldChildWrapper.parentNode !== this) {
        // TODO(arv): DOMException
        throw new Error('NotFoundError');
      }

      var oldChildNode = unwrap(oldChildWrapper);
      var nodes;

      if (this.invalidateShadowRenderer() ||
          invalidateParent(newChildWrapper)) {
        var previousNode = oldChildWrapper.previousSibling;
        var nextNode = oldChildWrapper.nextSibling;
        if (nextNode === newChildWrapper)
          nextNode = newChildWrapper.nextSibling;
        nodes = collectNodes(newChildWrapper, this, previousNode, nextNode);

        if (this.firstChild === oldChildWrapper)
          this.firstChild_ = nodes[0];
        if (this.lastChild === oldChildWrapper)
          this.lastChild_ = nodes[nodes.length - 1];

        oldChildWrapper.previousSibling_ = oldChildWrapper.nextSibling_ =
            oldChildWrapper.parentNode_ = undefined;

        // replaceChild no matter what the parent is?
        if (oldChildNode.parentNode) {
          originalReplaceChild.call(
              oldChildNode.parentNode,
              unwrapNodesForInsertion(this, nodes),
              oldChildNode);
        }
      } else {
        nodes = collectNodesNoNeedToUpdatePointers(newChildWrapper);
        ensureSameOwnerDocument(this, newChildWrapper);
        originalReplaceChild.call(this.impl, unwrap(newChildWrapper),
                                  oldChildNode);
      }

      nodesWereAdded(nodes);

      return oldChildWrapper;
    },

    /**
     * Called after a node was added. Subclasses override this to invalidate
     * the renderer as needed.
     * @private
     */
    nodeWasAdded_: function() {},

    hasChildNodes: function() {
      return this.firstChild === null;
    },

    /** @type {Node} */
    get parentNode() {
      // If the parentNode has not been overridden, use the original parentNode.
      return this.parentNode_ !== undefined ?
          this.parentNode_ : wrap(this.impl.parentNode);
    },

    /** @type {Node} */
    get firstChild() {
      return this.firstChild_ !== undefined ?
          this.firstChild_ : wrap(this.impl.firstChild);
    },

    /** @type {Node} */
    get lastChild() {
      return this.lastChild_ !== undefined ?
          this.lastChild_ : wrap(this.impl.lastChild);
    },

    /** @type {Node} */
    get nextSibling() {
      return this.nextSibling_ !== undefined ?
          this.nextSibling_ : wrap(this.impl.nextSibling);
    },

    /** @type {Node} */
    get previousSibling() {
      return this.previousSibling_ !== undefined ?
          this.previousSibling_ : wrap(this.impl.previousSibling);
    },

    get parentElement() {
      var p = this.parentNode;
      while (p && p.nodeType !== Node.ELEMENT_NODE) {
        p = p.parentNode;
      }
      return p;
    },

    get textContent() {
      // TODO(arv): This should fallback to this.impl.textContent if there
      // are no shadow trees below or above the context node.
      var s = '';
      for (var child = this.firstChild; child; child = child.nextSibling) {
        s += child.textContent;
      }
      return s;
    },
    set textContent(textContent) {
      if (this.invalidateShadowRenderer()) {
        removeAllChildNodes(this);
        if (textContent !== '') {
          var textNode = this.impl.ownerDocument.createTextNode(textContent);
          this.appendChild(textNode);
        }
      } else {
        this.impl.textContent = textContent;
      }
    },

    get childNodes() {
      var wrapperList = new NodeList();
      var i = 0;
      for (var child = this.firstChild; child; child = child.nextSibling) {
        wrapperList[i++] = child;
      }
      wrapperList.length = i;
      return wrapperList;
    },

    cloneNode: function(deep) {
      if (!this.invalidateShadowRenderer())
        return wrap(this.impl.cloneNode(deep));

      var clone = wrap(this.impl.cloneNode(false));
      if (deep) {
        for (var child = this.firstChild; child; child = child.nextSibling) {
          clone.appendChild(child.cloneNode(true));
        }
      }
      // TODO(arv): Some HTML elements also clone other data like value.
      return clone;
    },

    contains: function(child) {
      if (!child)
        return false;

      child = wrapIfNeeded(child);

      // TODO(arv): Optimize using ownerDocument etc.
      if (child === this)
        return true;
      var parentNode = child.parentNode;
      if (!parentNode)
        return false;
      return this.contains(parentNode);
    },

    compareDocumentPosition: function(otherNode) {
      // This only wraps, it therefore only operates on the composed DOM and not
      // the logical DOM.
      return originalCompareDocumentPosition.call(this.impl, unwrap(otherNode));
    }
  });

  defineWrapGetter(Node, 'ownerDocument');

  // We use a DocumentFragment as a base and then delete the properties of
  // DocumentFragment.prototype from the wrapper Node. Since delete makes
  // objects slow in some JS engines we recreate the prototype object.
  registerWrapper(OriginalNode, Node, document.createDocumentFragment());
  delete Node.prototype.querySelector;
  delete Node.prototype.querySelectorAll;
  Node.prototype = mixin(Object.create(EventTarget.prototype), Node.prototype);

  scope.wrappers.Node = Node;

})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  function findOne(node, selector) {
    var m, el = node.firstElementChild;
    while (el) {
      if (el.matches(selector))
        return el;
      m = findOne(el, selector);
      if (m)
        return m;
      el = el.nextElementSibling;
    }
    return null;
  }

  function findAll(node, selector, results) {
    var el = node.firstElementChild;
    while (el) {
      if (el.matches(selector))
        results[results.length++] = el;
      findAll(el, selector, results);
      el = el.nextElementSibling;
    }
    return results;
  }

  // find and findAll will only match Simple Selectors,
  // Structural Pseudo Classes are not guarenteed to be correct
  // http://www.w3.org/TR/css3-selectors/#simple-selectors

  var SelectorsInterface = {
    querySelector: function(selector) {
      return findOne(this, selector);
    },
    querySelectorAll: function(selector) {
      return findAll(this, selector, new NodeList())
    }
  };

  var GetElementsByInterface = {
    getElementsByTagName: function(tagName) {
      // TODO(arv): Check tagName?
      return this.querySelectorAll(tagName);
    },
    getElementsByClassName: function(className) {
      // TODO(arv): Check className?
      return this.querySelectorAll('.' + className);
    },
    getElementsByTagNameNS: function(ns, tagName) {
      if (ns === '*')
        return this.getElementsByTagName(tagName);

      // TODO(arv): Check tagName?
      var result = new NodeList;
      var els = this.getElementsByTagName(tagName);
      for (var i = 0, j = 0; i < els.length; i++) {
        if (els[i].namespaceURI === ns)
          result[j++] = els[i];
      }
      result.length = j;
      return result;
    }
  };

  scope.GetElementsByInterface = GetElementsByInterface;
  scope.SelectorsInterface = SelectorsInterface;

})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var NodeList = scope.wrappers.NodeList;

  function forwardElement(node) {
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
      node = node.nextSibling;
    }
    return node;
  }

  function backwardsElement(node) {
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
      node = node.previousSibling;
    }
    return node;
  }

  var ParentNodeInterface = {
    get firstElementChild() {
      return forwardElement(this.firstChild);
    },

    get lastElementChild() {
      return backwardsElement(this.lastChild);
    },

    get childElementCount() {
      var count = 0;
      for (var child = this.firstElementChild;
           child;
           child = child.nextElementSibling) {
        count++;
      }
      return count;
    },

    get children() {
      var wrapperList = new NodeList();
      var i = 0;
      for (var child = this.firstElementChild;
           child;
           child = child.nextElementSibling) {
        wrapperList[i++] = child;
      }
      wrapperList.length = i;
      return wrapperList;
    }
  };

  var ChildNodeInterface = {
    get nextElementSibling() {
      return forwardElement(this.nextSibling);
    },

    get previousElementSibling() {
      return backwardsElement(this.previousSibling);
    }
  };

  scope.ChildNodeInterface = ChildNodeInterface;
  scope.ParentNodeInterface = ParentNodeInterface;

})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var ChildNodeInterface = scope.ChildNodeInterface;
  var Node = scope.wrappers.Node;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;

  var OriginalCharacterData = window.CharacterData;

  function CharacterData(node) {
    Node.call(this, node);
  }
  CharacterData.prototype = Object.create(Node.prototype);
  mixin(CharacterData.prototype, {
    get textContent() {
      return this.data;
    },
    set textContent(value) {
      this.data = value;
    }
  });

  mixin(CharacterData.prototype, ChildNodeInterface);

  registerWrapper(OriginalCharacterData, CharacterData,
                  document.createTextNode(''));

  scope.wrappers.CharacterData = CharacterData;
})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var ChildNodeInterface = scope.ChildNodeInterface;
  var GetElementsByInterface = scope.GetElementsByInterface;
  var Node = scope.wrappers.Node;
  var ParentNodeInterface = scope.ParentNodeInterface;
  var SelectorsInterface = scope.SelectorsInterface;
  var addWrapNodeListMethod = scope.addWrapNodeListMethod;
  var mixin = scope.mixin;
  var oneOf = scope.oneOf;
  var registerWrapper = scope.registerWrapper;
  var wrappers = scope.wrappers;

  var shadowRootTable = new WeakMap();
  var OriginalElement = window.Element;


  var matchesName = oneOf(OriginalElement.prototype, [
    'matches',
    'mozMatchesSelector',
    'msMatchesSelector',
    'webkitMatchesSelector',
  ]);

  var originalMatches = OriginalElement.prototype[matchesName];

  function invalidateRendererBasedOnAttribute(element, name) {
    // Only invalidate if parent node is a shadow host.
    var p = element.parentNode;
    if (!p || !p.shadowRoot)
      return;

    var renderer = scope.getRendererForHost(p);
    if (renderer.dependsOnAttribute(name))
      renderer.invalidate();
  }

  function Element(node) {
    Node.call(this, node);
  }
  Element.prototype = Object.create(Node.prototype);
  mixin(Element.prototype, {
    createShadowRoot: function() {
      var newShadowRoot = new wrappers.ShadowRoot(this);
      shadowRootTable.set(this, newShadowRoot);

      var renderer = scope.getRendererForHost(this);
      renderer.invalidate();

      return newShadowRoot;
    },

    get shadowRoot() {
      return shadowRootTable.get(this) || null;
    },

    setAttribute: function(name, value) {
      this.impl.setAttribute(name, value);
      invalidateRendererBasedOnAttribute(this, name);
    },

    removeAttribute: function(name) {
      this.impl.removeAttribute(name);
      invalidateRendererBasedOnAttribute(this, name);
    },

    matches: function(selector) {
      return originalMatches.call(this.impl, selector);
    }
  });

  Element.prototype[matchesName] = function(selector) {
    return this.matches(selector);
  };

  if (OriginalElement.prototype.webkitCreateShadowRoot) {
    Element.prototype.webkitCreateShadowRoot =
        Element.prototype.createShadowRoot;
  }

  /**
   * Useful for generating the accessor pair for a property that reflects an
   * attribute.
   */
  function setterDirtiesAttribute(prototype, propertyName, opt_attrName) {
    var attrName = opt_attrName || propertyName;
    Object.defineProperty(prototype, propertyName, {
      get: function() {
        return this.impl[propertyName];
      },
      set: function(v) {
        this.impl[propertyName] = v;
        invalidateRendererBasedOnAttribute(this, attrName);
      },
      configurable: true,
      enumerable: true
    });
  }

  setterDirtiesAttribute(Element.prototype, 'id');
  setterDirtiesAttribute(Element.prototype, 'className', 'class');

  mixin(Element.prototype, ChildNodeInterface);
  mixin(Element.prototype, GetElementsByInterface);
  mixin(Element.prototype, ParentNodeInterface);
  mixin(Element.prototype, SelectorsInterface);

  registerWrapper(OriginalElement, Element);

  // TODO(arv): Export setterDirtiesAttribute and apply it to more bindings
  // that reflect attributes.
  scope.matchesName = matchesName;
  scope.wrappers.Element = Element;
})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var Element = scope.wrappers.Element;
  var defineGetter = scope.defineGetter;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;
  var unwrap = scope.unwrap;
  var wrap = scope.wrap;

  /////////////////////////////////////////////////////////////////////////////
  // innerHTML and outerHTML

  var escapeRegExp = /&|<|"/g;

  function escapeReplace(c) {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '"':
        return '&quot;'
    }
  }

  function escape(s) {
    return s.replace(escapeRegExp, escapeReplace);
  }

  // http://www.whatwg.org/specs/web-apps/current-work/#void-elements
  var voidElements = {
    'area': true,
    'base': true,
    'br': true,
    'col': true,
    'command': true,
    'embed': true,
    'hr': true,
    'img': true,
    'input': true,
    'keygen': true,
    'link': true,
    'meta': true,
    'param': true,
    'source': true,
    'track': true,
    'wbr': true
  };

  function getOuterHTML(node) {
    switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        var tagName = node.tagName.toLowerCase();
        var s = '<' + tagName;
        var attrs = node.attributes;
        for (var i = 0, attr; attr = attrs[i]; i++) {
          s += ' ' + attr.name + '="' + escape(attr.value) + '"';
        }
        s += '>';
        if (voidElements[tagName])
          return s;

        return s + getInnerHTML(node) + '</' + tagName + '>';

      case Node.TEXT_NODE:
        return escape(node.nodeValue);

      case Node.COMMENT_NODE:
        return '<!--' + escape(node.nodeValue) + '-->';
      default:
        console.error(node);
        throw new Error('not implemented');
    }
  }

  function getInnerHTML(node) {
    var s = '';
    for (var child = node.firstChild; child; child = child.nextSibling) {
      s += getOuterHTML(child);
    }
    return s;
  }

  function setInnerHTML(node, value, opt_tagName) {
    var tagName = opt_tagName || 'div';
    node.textContent = '';
    var tempElement = unwrap(node.ownerDocument.createElement(tagName));
    tempElement.innerHTML = value;
    var firstChild;
    while (firstChild = tempElement.firstChild) {
      node.appendChild(wrap(firstChild));
    }
  }

  var OriginalHTMLElement = window.HTMLElement;

  function HTMLElement(node) {
    Element.call(this, node);
  }
  HTMLElement.prototype = Object.create(Element.prototype);
  mixin(HTMLElement.prototype, {
    get innerHTML() {
      // TODO(arv): This should fallback to this.impl.innerHTML if there
      // are no shadow trees below or above the context node.
      return getInnerHTML(this);
    },
    set innerHTML(value) {
      if (this.invalidateShadowRenderer())
        setInnerHTML(this, value, this.tagName);
      else
        this.impl.innerHTML = value;
    },

    get outerHTML() {
      // TODO(arv): This should fallback to HTMLElement_prototype.outerHTML if there
      // are no shadow trees below or above the context node.
      return getOuterHTML(this);
    },
    set outerHTML(value) {
      var p = this.parentNode;
      if (p) {
        p.invalidateShadowRenderer();
        this.impl.outerHTML = value;
      }
    }
  });

  function getterRequiresRendering(name) {
    defineGetter(HTMLElement, name, function() {
      scope.renderAllPending();
      return this.impl[name];
     });
  }

  [
    'clientHeight',
    'clientLeft',
    'clientTop',
    'clientWidth',
    'offsetHeight',
    'offsetLeft',
    'offsetTop',
    'offsetWidth',
    'scrollHeight',
    'scrollLeft',
    'scrollTop',
    'scrollWidth',
  ].forEach(getterRequiresRendering);

  function methodRequiresRendering(name) {
    Object.defineProperty(HTMLElement.prototype, name, {
      value: function() {
        scope.renderAllPending();
        return this.impl[name].apply(this.impl, arguments);
      },
      configurable: true,
      enumerable: true
    });
  }

  [
    'getBoundingClientRect',
    'getClientRects',
    'scrollIntoView'
  ].forEach(methodRequiresRendering);

  // HTMLElement is abstract so we use a subclass that has no members.
  registerWrapper(OriginalHTMLElement, HTMLElement,
                  document.createElement('b'));

  scope.wrappers.HTMLElement = HTMLElement;

  // TODO: Find a better way to share these two with WrapperShadowRoot.
  scope.getInnerHTML = getInnerHTML;
  scope.setInnerHTML = setInnerHTML
})(this.ShadowDOMPolyfill);
// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var HTMLElement = scope.wrappers.HTMLElement;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;

  var OriginalHTMLContentElement = window.HTMLContentElement;

  function HTMLContentElement(node) {
    HTMLElement.call(this, node);
  }
  HTMLContentElement.prototype = Object.create(HTMLElement.prototype);
  mixin(HTMLContentElement.prototype, {
    get select() {
      return this.getAttribute('select');
    },
    set select(value) {
      this.setAttribute('select', value);
    },

    setAttribute: function(n, v) {
      HTMLElement.prototype.setAttribute.call(this, n, v);
      if (String(n).toLowerCase() === 'select')
        this.invalidateShadowRenderer(true);
    }

    // getDistributedNodes is added in ShadowRenderer

    // TODO: attribute boolean resetStyleInheritance;
  });

  if (OriginalHTMLContentElement)
    registerWrapper(OriginalHTMLContentElement, HTMLContentElement);

  scope.wrappers.HTMLContentElement = HTMLContentElement;
})(this.ShadowDOMPolyfill);
// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var HTMLElement = scope.wrappers.HTMLElement;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;

  var OriginalHTMLShadowElement = window.HTMLShadowElement;

  function HTMLShadowElement(node) {
    HTMLElement.call(this, node);
  }
  HTMLShadowElement.prototype = Object.create(HTMLElement.prototype);
  mixin(HTMLShadowElement.prototype, {
    // TODO: attribute boolean resetStyleInheritance;
  });

  if (OriginalHTMLShadowElement)
    registerWrapper(OriginalHTMLShadowElement, HTMLShadowElement);

  scope.wrappers.HTMLShadowElement = HTMLShadowElement;
})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var HTMLElement = scope.wrappers.HTMLElement;
  var getInnerHTML = scope.getInnerHTML;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;
  var setInnerHTML = scope.setInnerHTML;
  var unwrap = scope.unwrap;
  var wrap = scope.wrap;

  var contentTable = new WeakMap();
  var templateContentsOwnerTable = new WeakMap();

  // http://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/templates/index.html#dfn-template-contents-owner
  function getTemplateContentsOwner(doc) {
    if (!doc.defaultView)
      return doc;
    var d = templateContentsOwnerTable.get(doc);
    if (!d) {
      // TODO(arv): This should either be a Document or HTMLDocument depending
      // on doc.
      d = doc.implementation.createHTMLDocument('');
      while (d.lastChild) {
        d.removeChild(d.lastChild);
      }
      templateContentsOwnerTable.set(doc, d);
    }
    return d;
  }

  function extractContent(templateElement) {
    // templateElement is not a wrapper here.
    var doc = getTemplateContentsOwner(templateElement.ownerDocument);
    var df = unwrap(doc.createDocumentFragment());
    var child;
    while (child = templateElement.firstChild) {
      df.appendChild(child);
    }
    return df;
  }

  var OriginalHTMLTemplateElement = window.HTMLTemplateElement;

  function HTMLTemplateElement(node) {
    HTMLElement.call(this, node);
    if (!OriginalHTMLTemplateElement) {
      var content = extractContent(node);
      contentTable.set(this, wrap(content));
    }
  }
  HTMLTemplateElement.prototype = Object.create(HTMLElement.prototype);

  mixin(HTMLTemplateElement.prototype, {
    get content() {
      if (OriginalHTMLTemplateElement)
        return wrap(this.impl.content);
      return contentTable.get(this);
    },

    get innerHTML() {
      return getInnerHTML(this.content);
    },
    set innerHTML(value) {
      setInnerHTML(this.content, value);
    }

    // TODO(arv): cloneNode needs to clone content.

  });

  if (OriginalHTMLTemplateElement)
    registerWrapper(OriginalHTMLTemplateElement, HTMLTemplateElement);

  scope.wrappers.HTMLTemplateElement = HTMLTemplateElement;
})(this.ShadowDOMPolyfill);
// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var HTMLContentElement = scope.wrappers.HTMLContentElement;
  var HTMLElement = scope.wrappers.HTMLElement;
  var HTMLShadowElement = scope.wrappers.HTMLShadowElement;
  var HTMLTemplateElement = scope.wrappers.HTMLTemplateElement;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;

  var OriginalHTMLUnknownElement = window.HTMLUnknownElement;

  function HTMLUnknownElement(node) {
    switch (node.localName) {
      case 'content':
        return new HTMLContentElement(node);
      case 'shadow':
        return new HTMLShadowElement(node);
      case 'template':
        return new HTMLTemplateElement(node);
    }
    HTMLElement.call(this, node);
  }
  HTMLUnknownElement.prototype = Object.create(HTMLElement.prototype);
  registerWrapper(OriginalHTMLUnknownElement, HTMLUnknownElement);
  scope.wrappers.HTMLUnknownElement = HTMLUnknownElement;
})(this.ShadowDOMPolyfill);
// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var GetElementsByInterface = scope.GetElementsByInterface;
  var ParentNodeInterface = scope.ParentNodeInterface;
  var SelectorsInterface = scope.SelectorsInterface;
  var mixin = scope.mixin;
  var registerObject = scope.registerObject;

  var DocumentFragment = registerObject(document.createDocumentFragment());
  mixin(DocumentFragment.prototype, ParentNodeInterface);
  mixin(DocumentFragment.prototype, SelectorsInterface);
  mixin(DocumentFragment.prototype, GetElementsByInterface);

  var Text = registerObject(document.createTextNode(''));
  var Comment = registerObject(document.createComment(''));

  scope.wrappers.Comment = Comment;
  scope.wrappers.DocumentFragment = DocumentFragment;
  scope.wrappers.Text = Text;

})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var DocumentFragment = scope.wrappers.DocumentFragment;
  var elementFromPoint = scope.elementFromPoint;
  var getInnerHTML = scope.getInnerHTML;
  var mixin = scope.mixin;
  var rewrap = scope.rewrap;
  var setInnerHTML = scope.setInnerHTML;
  var unwrap = scope.unwrap;

  var shadowHostTable = new WeakMap();
  var nextOlderShadowTreeTable = new WeakMap();

  function ShadowRoot(hostWrapper) {
    var node = unwrap(hostWrapper.impl.ownerDocument.createDocumentFragment());
    DocumentFragment.call(this, node);

    // createDocumentFragment associates the node with a wrapper
    // DocumentFragment instance. Override that.
    rewrap(node, this);

    var oldShadowRoot = hostWrapper.shadowRoot;
    nextOlderShadowTreeTable.set(this, oldShadowRoot);

    shadowHostTable.set(this, hostWrapper);
  }
  ShadowRoot.prototype = Object.create(DocumentFragment.prototype);
  mixin(ShadowRoot.prototype, {
    get innerHTML() {
      return getInnerHTML(this);
    },
    set innerHTML(value) {
      setInnerHTML(this, value);
      this.invalidateShadowRenderer();
    },

    get olderShadowRoot() {
      return nextOlderShadowTreeTable.get(this) || null;
    },

    invalidateShadowRenderer: function() {
      return shadowHostTable.get(this).invalidateShadowRenderer();
    },

    elementFromPoint: function(x, y) {
      return elementFromPoint(this, this.ownerDocument, x, y);
    },

    getElementById: function(id) {
      return this.querySelector('#' + id);
    }
  });

  scope.wrappers.ShadowRoot = ShadowRoot;
  scope.getHostForShadowRoot = function(node) {
    return shadowHostTable.get(node);
  };
})(this.ShadowDOMPolyfill);
// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var Element = scope.wrappers.Element;
  var HTMLContentElement = scope.wrappers.HTMLContentElement;
  var HTMLShadowElement = scope.wrappers.HTMLShadowElement;
  var Node = scope.wrappers.Node;
  var ShadowRoot = scope.wrappers.ShadowRoot;
  var assert = scope.assert;
  var getHostForShadowRoot = scope.getHostForShadowRoot;
  var mixin = scope.mixin;
  var oneOf = scope.oneOf;
  var unwrap = scope.unwrap;
  var wrap = scope.wrap;

  /**
   * Updates the fields of a wrapper to a snapshot of the logical DOM as needed.
   * Up means parentNode
   * Sideways means previous and next sibling.
   * @param {!Node} wrapper
   */
  function updateWrapperUpAndSideways(wrapper) {
    wrapper.previousSibling_ = wrapper.previousSibling;
    wrapper.nextSibling_ = wrapper.nextSibling;
    wrapper.parentNode_ = wrapper.parentNode;
  }

  /**
   * Updates the fields of a wrapper to a snapshot of the logical DOM as needed.
   * Down means first and last child
   * @param {!Node} wrapper
   */
  function updateWrapperDown(wrapper) {
    wrapper.firstChild_ = wrapper.firstChild;
    wrapper.lastChild_ = wrapper.lastChild;
  }

  function updateAllChildNodes(parentNodeWrapper) {
    assert(parentNodeWrapper instanceof Node);
    for (var childWrapper = parentNodeWrapper.firstChild;
         childWrapper;
         childWrapper = childWrapper.nextSibling) {
      updateWrapperUpAndSideways(childWrapper);
    }
    updateWrapperDown(parentNodeWrapper);
  }

  function insertBefore(parentNodeWrapper, newChildWrapper, refChildWrapper) {
    var parentNode = unwrap(parentNodeWrapper);
    var newChild = unwrap(newChildWrapper);
    var refChild = refChildWrapper ? unwrap(refChildWrapper) : null;

    remove(newChildWrapper);
    updateWrapperUpAndSideways(newChildWrapper);

    if (!refChildWrapper) {
      parentNodeWrapper.lastChild_ = parentNodeWrapper.lastChild;
      if (parentNodeWrapper.lastChild === parentNodeWrapper.firstChild)
        parentNodeWrapper.firstChild_ = parentNodeWrapper.firstChild;

      var lastChildWrapper = wrap(parentNode.lastChild);
      if (lastChildWrapper)
        lastChildWrapper.nextSibling_ = lastChildWrapper.nextSibling;
    } else {
      if (parentNodeWrapper.firstChild === refChildWrapper)
        parentNodeWrapper.firstChild_ = refChildWrapper;

      refChildWrapper.previousSibling_ = refChildWrapper.previousSibling;
    }

    parentNode.insertBefore(newChild, refChild);
  }

  function remove(nodeWrapper) {
    var node = unwrap(nodeWrapper)
    var parentNode = node.parentNode;
    if (!parentNode)
      return;

    var parentNodeWrapper = wrap(parentNode);
    updateWrapperUpAndSideways(nodeWrapper);

    if (nodeWrapper.previousSibling)
      nodeWrapper.previousSibling.nextSibling_ = nodeWrapper;
    if (nodeWrapper.nextSibling)
      nodeWrapper.nextSibling.previousSibling_ = nodeWrapper;

    if (parentNodeWrapper.lastChild === nodeWrapper)
      parentNodeWrapper.lastChild_ = nodeWrapper;
    if (parentNodeWrapper.firstChild === nodeWrapper)
      parentNodeWrapper.firstChild_ = nodeWrapper;

    parentNode.removeChild(node);
  }

  var distributedChildNodesTable = new WeakMap();
  var eventParentsTable = new WeakMap();
  var insertionParentTable = new WeakMap();
  var rendererForHostTable = new WeakMap();
  var shadowDOMRendererTable = new WeakMap();

  function distributeChildToInsertionPoint(child, insertionPoint) {
    getDistributedChildNodes(insertionPoint).push(child);
    assignToInsertionPoint(child, insertionPoint);

    var eventParents = eventParentsTable.get(child);
    if (!eventParents)
      eventParentsTable.set(child, eventParents = []);
    eventParents.push(insertionPoint);
  }

  function resetDistributedChildNodes(insertionPoint) {
    distributedChildNodesTable.set(insertionPoint, []);
  }

  function getDistributedChildNodes(insertionPoint) {
    return distributedChildNodesTable.get(insertionPoint);
  }

  function getChildNodesSnapshot(node) {
    var result = [], i = 0;
    for (var child = node.firstChild; child; child = child.nextSibling) {
      result[i++] = child;
    }
    return result;
  }

  /**
   * Visits all nodes in the tree that fulfils the |predicate|. If the |visitor|
   * function returns |false| the traversal is aborted.
   * @param {!Node} tree
   * @param {function(!Node) : boolean} predicate
   * @param {function(!Node) : *} visitor
   */
  function visit(tree, predicate, visitor) {
    // This operates on logical DOM.
    for (var node = tree.firstChild; node; node = node.nextSibling) {
      if (predicate(node)) {
        if (visitor(node) === false)
          return;
      } else {
        visit(node, predicate, visitor);
      }
    }
  }

  // Matching Insertion Points
  // http://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#matching-insertion-points

  // TODO(arv): Verify this... I don't remember why I picked this regexp.
  var selectorMatchRegExp = /^[*.:#[a-zA-Z_|]/;

  var allowedPseudoRegExp = new RegExp('^:(' + [
    'link',
    'visited',
    'target',
    'enabled',
    'disabled',
    'checked',
    'indeterminate',
    'nth-child',
    'nth-last-child',
    'nth-of-type',
    'nth-last-of-type',
    'first-child',
    'last-child',
    'first-of-type',
    'last-of-type',
    'only-of-type',
  ].join('|') + ')');


  /**
   * @param {Element} node
   * @oaram {Element} point The insertion point element.
   * @return {boolean} Whether the node matches the insertion point.
   */
  function matchesCriteria(node, point) {
    var select = point.getAttribute('select');
    if (!select)
      return true;

    // Here we know the select attribute is a non empty string.
    select = select.trim();
    if (!select)
      return true;

    if (!(node instanceof Element))
      return false;

    // TODO(arv): This does not seem right. Need to check for a simple selector.
    if (!selectorMatchRegExp.test(select))
      return false;

    if (select[0] === ':' && !allowedPseudoRegExp.test(select))
      return false;

    try {
      return node.matches(select);
    } catch (ex) {
      // Invalid selector.
      return false;
    }
  }

  var request = oneOf(window, [
    'requestAnimationFrame',
    'mozRequestAnimationFrame',
    'webkitRequestAnimationFrame',
    'setTimeout'
  ]);

  var pendingDirtyRenderers = [];
  var renderTimer;

  function renderAllPending() {
    for (var i = 0; i < pendingDirtyRenderers.length; i++) {
      pendingDirtyRenderers[i].render();
    }
    pendingDirtyRenderers = [];
  }

  function handleRequestAnimationFrame() {
    renderTimer = null;
    renderAllPending();
  }

  /**
   * Returns existing shadow renderer for a host or creates it if it is needed.
   * @params {!Element} host
   * @return {!ShadowRenderer}
   */
  function getRendererForHost(host) {
    var renderer = rendererForHostTable.get(host);
    if (!renderer) {
      renderer = new ShadowRenderer(host);
      rendererForHostTable.set(host, renderer);
    }
    return renderer;
  }

  function getShadowRootAncestor(node) {
    for (; node; node = node.parentNode) {
      if (node instanceof ShadowRoot)
        return node;
    }
    return null;
  }

  function getRendererForShadowRoot(shadowRoot) {
    return getRendererForHost(getHostForShadowRoot(shadowRoot));
  }

  var spliceDiff = new ArraySplice();
  spliceDiff.equals = function(renderNode, rawNode) {
    return unwrap(renderNode.node) === rawNode;
  };

  /**
   * RenderNode is used as an in memory "render tree". When we render the
   * composed tree we create a tree of RenderNodes, then we diff this against
   * the real DOM tree and make minimal changes as needed.
   */
  function RenderNode(node) {
    this.skip = false;
    this.node = node;
    this.childNodes = [];
  }

  RenderNode.prototype = {
    append: function(node) {
      var rv = new RenderNode(node);
      this.childNodes.push(rv);
      return rv;
    },

    sync: function(opt_added) {
      if (this.skip)
        return;

      var nodeWrapper = this.node;
      // plain array of RenderNodes
      var newChildren = this.childNodes;
      // plain array of real nodes.
      var oldChildren = getChildNodesSnapshot(unwrap(nodeWrapper));
      var added = opt_added || new WeakMap();

      var splices = spliceDiff.calculateSplices(newChildren, oldChildren);

      var newIndex = 0, oldIndex = 0;
      var lastIndex = 0;
      for (var i = 0; i < splices.length; i++) {
        var splice = splices[i];
        for (; lastIndex < splice.index; lastIndex++) {
          oldIndex++;
          newChildren[newIndex++].sync(added);
        }

        var removedCount = splice.removed.length;
        for (var j = 0; j < removedCount; j++) {
          var wrapper = wrap(oldChildren[oldIndex++]);
          if (!added.get(wrapper))
            remove(wrapper);
        }

        var addedCount = splice.addedCount;
        var refNode = oldChildren[oldIndex] && wrap(oldChildren[oldIndex]);
        for (var j = 0; j < addedCount; j++) {
          var newChildRenderNode = newChildren[newIndex++];
          var newChildWrapper = newChildRenderNode.node;
          insertBefore(nodeWrapper, newChildWrapper, refNode);

          // Keep track of added so that we do not remove the node after it
          // has been added.
          added.set(newChildWrapper, true);

          newChildRenderNode.sync(added);
        }

        lastIndex += addedCount;
      }

      for (var i = lastIndex; i < newChildren.length; i++) {
        newChildren[i++].sync(added);
      }
    }
  };

  function ShadowRenderer(host) {
    this.host = host;
    this.dirty = false;
    this.invalidateAttributes();
    this.associateNode(host);
  }

  ShadowRenderer.prototype = {

    // http://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#rendering-shadow-trees
    render: function(opt_renderNode) {
      if (!this.dirty)
        return;

      this.invalidateAttributes();
      this.treeComposition();

      var host = this.host;
      var shadowRoot = host.shadowRoot;

      this.associateNode(host);
      var topMostRenderer = !renderNode;
      var renderNode = opt_renderNode || new RenderNode(host);

      for (var node = shadowRoot.firstChild; node; node = node.nextSibling) {
        this.renderNode(shadowRoot, renderNode, node, false);
      }

      if (topMostRenderer)
        renderNode.sync();

      this.dirty = false;
    },

    invalidate: function() {
      if (!this.dirty) {
        this.dirty = true;
        pendingDirtyRenderers.push(this);
        if (renderTimer)
          return;
        renderTimer = window[request](handleRequestAnimationFrame, 0);
      }
    },

    renderNode: function(shadowRoot, renderNode, node, isNested) {
      if (isShadowHost(node)) {
        renderNode = renderNode.append(node);
        var renderer = getRendererForHost(node);
        renderer.dirty = true;  // Need to rerender due to reprojection.
        renderer.render(renderNode);
      } else if (isInsertionPoint(node)) {
        this.renderInsertionPoint(shadowRoot, renderNode, node, isNested);
      } else if (isShadowInsertionPoint(node)) {
        this.renderShadowInsertionPoint(shadowRoot, renderNode, node);
      } else {
        this.renderAsAnyDomTree(shadowRoot, renderNode, node, isNested);
      }
    },

    renderAsAnyDomTree: function(shadowRoot, renderNode, node, isNested) {
      renderNode = renderNode.append(node);

      if (isShadowHost(node)) {
        var renderer = getRendererForHost(node);
        renderNode.skip = !renderer.dirty;
        renderer.render(renderNode);
      } else {
        for (var child = node.firstChild; child; child = child.nextSibling) {
          this.renderNode(shadowRoot, renderNode, child, isNested);
        }
      }
    },

    renderInsertionPoint: function(shadowRoot, renderNode, insertionPoint,
                                   isNested) {
      var distributedChildNodes = getDistributedChildNodes(insertionPoint);
      if (distributedChildNodes.length) {
        this.associateNode(insertionPoint);

        for (var i = 0; i < distributedChildNodes.length; i++) {
          var child = distributedChildNodes[i];
          if (isInsertionPoint(child) && isNested)
            this.renderInsertionPoint(shadowRoot, renderNode, child, isNested);
          else
            this.renderAsAnyDomTree(shadowRoot, renderNode, child, isNested);
        }
      } else {
        this.renderFallbackContent(shadowRoot, renderNode, insertionPoint);
      }
      this.associateNode(insertionPoint.parentNode);
    },

    renderShadowInsertionPoint: function(shadowRoot, renderNode,
                                         shadowInsertionPoint) {
      var nextOlderTree = shadowRoot.olderShadowRoot;
      if (nextOlderTree) {
        assignToInsertionPoint(nextOlderTree, shadowInsertionPoint);
        this.associateNode(shadowInsertionPoint.parentNode);
        for (var node = nextOlderTree.firstChild;
             node;
             node = node.nextSibling) {
          this.renderNode(nextOlderTree, renderNode, node, true);
        }
      } else {
        this.renderFallbackContent(shadowRoot, renderNode,
                                   shadowInsertionPoint);
      }
    },

    renderFallbackContent: function(shadowRoot, renderNode, fallbackHost) {
      this.associateNode(fallbackHost);
      this.associateNode(fallbackHost.parentNode);
      for (var node = fallbackHost.firstChild; node; node = node.nextSibling) {
        this.renderAsAnyDomTree(shadowRoot, renderNode, node, false);
      }
    },

    /**
     * Invalidates the attributes used to keep track of which attributes may
     * cause the renderer to be invalidated.
     */
    invalidateAttributes: function() {
      this.attributes = Object.create(null);
    },

    /**
     * Parses the selector and makes this renderer dependent on the attribute
     * being used in the selector.
     * @param {string} selector
     */
    updateDependentAttributes: function(selector) {
      if (!selector)
        return;

      var attributes = this.attributes;

      // .class
      if (/\.\w+/.test(selector))
        attributes['class'] = true;

      // #id
      if (/#\w+/.test(selector))
        attributes['id'] = true;

      selector.replace(/\[\s*([^\s=\|~\]]+)/g, function(_, name) {
        attributes[name] = true;
      });

      // Pseudo selectors have been removed from the spec.
    },

    dependsOnAttribute: function(name) {
      return this.attributes[name];
    },

    // http://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#dfn-distribution-algorithm
    distribute: function(tree, pool) {
      var self = this;

      visit(tree, isActiveInsertionPoint,
          function(insertionPoint) {
            resetDistributedChildNodes(insertionPoint);
            self.updateDependentAttributes(
                insertionPoint.getAttribute('select'));

            for (var i = 0; i < pool.length; i++) {  // 1.2
              var node = pool[i];  // 1.2.1
              if (node === undefined)  // removed
                continue;
              if (matchesCriteria(node, insertionPoint)) {  // 1.2.2
                distributeChildToInsertionPoint(node, insertionPoint);  // 1.2.2.1
                pool[i] = undefined;  // 1.2.2.2
              }
            }
          });
    },

    // http://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#dfn-tree-composition
    treeComposition: function () {
      var shadowHost = this.host;
      var tree = shadowHost.shadowRoot;  // 1.
      var pool = [];  // 2.

      for (var child = shadowHost.firstChild;
           child;
           child = child.nextSibling) {  // 3.
        if (isInsertionPoint(child)) {  // 3.2.
          var reprojected = getDistributedChildNodes(child);  // 3.2.1.
          // if reprojected is undef... reset it?
          if (!reprojected || !reprojected.length)  // 3.2.2.
            reprojected = getChildNodesSnapshot(child);
          pool.push.apply(pool, reprojected);  // 3.2.3.
        } else {
          pool.push(child); // 3.3.
        }
      }

      var shadowInsertionPoint, point;
      while (tree) {  // 4.
        // 4.1.
        shadowInsertionPoint = undefined;  // Reset every iteration.
        visit(tree, isActiveShadowInsertionPoint, function(point) {
          shadowInsertionPoint = point;
          return false;
        });
        point = shadowInsertionPoint;

        this.distribute(tree, pool);  // 4.2.
        if (point) {  // 4.3.
          var nextOlderTree = tree.olderShadowRoot;  // 4.3.1.
          if (!nextOlderTree) {
            break;  // 4.3.1.1.
          } else {
            tree = nextOlderTree;  // 4.3.2.2.
            assignToInsertionPoint(tree, point);  // 4.3.2.2.
            continue;  // 4.3.2.3.
          }
        } else {
          break;  // 4.4.
        }
      }
    },

    associateNode: function(node) {
      shadowDOMRendererTable.set(node, this);
    }
  };

  function isInsertionPoint(node) {
    // Should this include <shadow>?
    return node instanceof HTMLContentElement;
  }

  function isActiveInsertionPoint(node) {
    // <content> inside another <content> or <shadow> is considered inactive.
    return node instanceof HTMLContentElement;
  }

  function isShadowInsertionPoint(node) {
    return node instanceof HTMLShadowElement;
  }

  function isActiveShadowInsertionPoint(node) {
    // <shadow> inside another <content> or <shadow> is considered inactive.
    return node instanceof HTMLShadowElement;
  }

  function isShadowHost(shadowHost) {
    return shadowHost.shadowRoot;
  }

  function getShadowTrees(host) {
    var trees = [];

    for (var tree = host.shadowRoot; tree; tree = tree.olderShadowRoot) {
      trees.push(tree);
    }
    return trees;
  }

  function assignToInsertionPoint(tree, point) {
    insertionParentTable.set(tree, point);
  }

  // http://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#rendering-shadow-trees
  function render(host) {
    new ShadowRenderer(host).render();
  };

  // Need to rerender shadow host when:
  //
  // - a direct child to the ShadowRoot is added or removed
  // - a direct child to the host is added or removed
  // - a new shadow root is created
  // - a direct child to a content/shadow element is added or removed
  // - a sibling to a content/shadow element is added or removed
  // - content[select] is changed
  // - an attribute in a direct child to a host is modified

  /**
   * This gets called when a node was added or removed to it.
   */
  Node.prototype.invalidateShadowRenderer = function(force) {
    var renderer = shadowDOMRendererTable.get(this);
    if (renderer) {
      renderer.invalidate();
      return true;
    }

    return false;
  };

  HTMLContentElement.prototype.getDistributedNodes = function() {
    var renderer = shadowDOMRendererTable.get(this);
    if (renderer)
      renderer.render();
    return getDistributedChildNodes(this);
  };

  HTMLShadowElement.prototype.nodeWasAdded_ =
  HTMLContentElement.prototype.nodeWasAdded_ = function() {
    // Invalidate old renderer if any.
    this.invalidateShadowRenderer();

    var shadowRoot = getShadowRootAncestor(this);
    var renderer;
    if (shadowRoot)
      renderer = getRendererForShadowRoot(shadowRoot);
    shadowDOMRendererTable.set(this, renderer);
    if (renderer)
      renderer.invalidate();
  };

  scope.eventParentsTable = eventParentsTable;
  scope.getRendererForHost = getRendererForHost;
  scope.getShadowTrees = getShadowTrees;
  scope.insertionParentTable = insertionParentTable;
  scope.renderAllPending = renderAllPending;

  // Exposed for testing
  scope.visual = {
    insertBefore: insertBefore,
    remove: remove,
  };

})(this.ShadowDOMPolyfill);
// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var HTMLElement = scope.wrappers.HTMLElement;
  var assert = scope.assert;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;
  var unwrap = scope.unwrap;
  var wrap = scope.wrap;

  var elementsWithFormProperty = [
    'HTMLButtonElement',
    'HTMLFieldSetElement',
    'HTMLInputElement',
    'HTMLKeygenElement',
    'HTMLLabelElement',
    'HTMLLegendElement',
    'HTMLObjectElement',
    'HTMLOptionElement',
    'HTMLOutputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
  ];

  function createWrapperConstructor(name) {
    if (!window[name])
      return;

    // Ensure we are not overriding an already existing constructor.
    assert(!scope.wrappers[name]);

    var GeneratedWrapper = function(node) {
      // At this point all of them extend HTMLElement.
      HTMLElement.call(this, node);
    }
    GeneratedWrapper.prototype = Object.create(HTMLElement.prototype);
    mixin(GeneratedWrapper.prototype, {
      get form() {
        return wrap(unwrap(this).form);
      },
    });

    registerWrapper(window[name], GeneratedWrapper,
        document.createElement(name.slice(4, -7)));
    scope.wrappers[name] = GeneratedWrapper;
  }

  elementsWithFormProperty.forEach(createWrapperConstructor);

})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var GetElementsByInterface = scope.GetElementsByInterface;
  var Node = scope.wrappers.Node;
  var ParentNodeInterface = scope.ParentNodeInterface;
  var SelectorsInterface = scope.SelectorsInterface;
  var ShadowRoot = scope.wrappers.ShadowRoot;
  var defineWrapGetter = scope.defineWrapGetter;
  var elementFromPoint = scope.elementFromPoint;
  var forwardMethodsToWrapper = scope.forwardMethodsToWrapper;
  var matchesName = scope.matchesName;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;
  var unwrap = scope.unwrap;
  var wrap = scope.wrap;
  var wrapEventTargetMethods = scope.wrapEventTargetMethods;
  var wrapNodeList = scope.wrapNodeList;

  var implementationTable = new WeakMap();

  function Document(node) {
    Node.call(this, node);
  }
  Document.prototype = Object.create(Node.prototype);

  defineWrapGetter(Document, 'documentElement');

  // Conceptually both body and head can be in a shadow but suporting that seems
  // overkill at this point.
  defineWrapGetter(Document, 'body');
  defineWrapGetter(Document, 'head');

  // document cannot be overridden so we override a bunch of its methods
  // directly on the instance.

  function wrapMethod(name) {
    var original = document[name];
    Document.prototype[name] = function() {
      return wrap(original.apply(this.impl, arguments));
    };
  }

  [
    'createComment',
    'createDocumentFragment',
    'createElement',
    'createElementNS',
    'createEvent',
    'createEventNS',
    'createRange',
    'createTextNode',
    'getElementById',
  ].forEach(wrapMethod);

  var originalAdoptNode = document.adoptNode;

  function adoptNodeNoRemove(node, doc) {
    originalAdoptNode.call(doc.impl, unwrap(node));
    adoptSubtree(node, doc);
  }

  function adoptSubtree(node, doc) {
    if (node.shadowRoot)
      doc.adoptNode(node.shadowRoot);
    if (node instanceof ShadowRoot)
      adoptOlderShadowRoots(node, doc);
    for (var child = node.firstChild; child; child = child.nextSibling) {
      adoptSubtree(child, doc);
    }
  }

  function adoptOlderShadowRoots(shadowRoot, doc) {
    var oldShadowRoot = shadowRoot.olderShadowRoot;
    if (oldShadowRoot)
      doc.adoptNode(oldShadowRoot);
  }

  mixin(Document.prototype, {
    adoptNode: function(node) {
      if (node.parentNode)
        node.parentNode.removeChild(node);
      adoptNodeNoRemove(node, this);
      return node;
    },
    elementFromPoint: function(x, y) {
      return elementFromPoint(this, this, x, y);
    }
  });

  if (document.register) {
    var originalRegister = document.register;
    Document.prototype.register = function(tagName, object) {
      var prototype = object.prototype;

      // If we already used the object as a prototype for another custom
      // element.
      if (scope.nativePrototypeTable.get(prototype)) {
        // TODO(arv): DOMException
        throw new Error('NotSupportedError');
      }

      // Find first object on the prototype chain that already have a native
      // prototype. Keep track of all the objects before that so we can create
      // a similar structure for the native case.
      var proto = Object.getPrototypeOf(prototype);
      var nativePrototype;
      var prototypes = [];
      while (proto) {
        nativePrototype = scope.nativePrototypeTable.get(proto);
        if (nativePrototype)
          break;
        prototypes.push(proto);
        proto = Object.getPrototypeOf(proto);
      }

      if (!nativePrototype) {
        // TODO(arv): DOMException
        throw new Error('NotSupportedError');
      }

      // This works by creating a new prototype object that is empty, but has
      // the native prototype as its proto. The original prototype object
      // passed into register is used as the wrapper prototype.

      var newPrototype = Object.create(nativePrototype);
      for (var i = prototypes.length - 1; i >= 0; i--) {
        newPrototype = Object.create(newPrototype);
      }

      // Add callbacks if present.
      // Names are taken from:
      //   https://code.google.com/p/chromium/codesearch#chromium/src/third_party/WebKit/Source/bindings/v8/CustomElementConstructorBuilder.cpp&sq=package:chromium&type=cs&l=156
      // and not from the spec since the spec is out of date.
      [
        'createdCallback',
        'enteredDocumentCallback',
        'leftDocumentCallback',
        'attributeChangedCallback',
      ].forEach(function(name) {
        var f = prototype[name];
        if (!f)
          return;
        newPrototype[name] = function() {
          f.apply(wrap(this), arguments);
        };
      });

      var nativeConstructor = originalRegister.call(unwrap(this), tagName,
          {prototype: newPrototype});

      function GeneratedWrapper(node) {
        if (!node)
          return document.createElement(tagName);
        this.impl = node;
      }
      GeneratedWrapper.prototype = prototype;
      GeneratedWrapper.prototype.constructor = GeneratedWrapper;

      scope.constructorTable.set(newPrototype, GeneratedWrapper);
      scope.nativePrototypeTable.set(prototype, newPrototype);

      return GeneratedWrapper;
    };

    forwardMethodsToWrapper([
      window.HTMLDocument || window.Document,  // Gecko adds these to HTMLDocument
    ], [
      'register',
    ]);
  }

  // We also override some of the methods on document.body and document.head
  // for convenience.
  forwardMethodsToWrapper([
    window.HTMLBodyElement,
    window.HTMLDocument || window.Document,  // Gecko adds these to HTMLDocument
    window.HTMLHeadElement,
    window.HTMLHtmlElement,
  ], [
    'appendChild',
    'compareDocumentPosition',
    'contains',
    'getElementsByClassName',
    'getElementsByTagName',
    'getElementsByTagNameNS',
    'insertBefore',
    'querySelector',
    'querySelectorAll',
    'removeChild',
    'replaceChild',
    matchesName,
  ]);

  forwardMethodsToWrapper([
    window.HTMLDocument || window.Document,  // Gecko adds these to HTMLDocument
  ], [
    'adoptNode',
    'contains',
    'createComment',
    'createDocumentFragment',
    'createElement',
    'createElementNS',
    'createEvent',
    'createEventNS',
    'createRange',
    'createTextNode',
    'elementFromPoint',
    'getElementById',
  ]);

  mixin(Document.prototype, GetElementsByInterface);
  mixin(Document.prototype, ParentNodeInterface);
  mixin(Document.prototype, SelectorsInterface);

  mixin(Document.prototype, {
    get implementation() {
      var implementation = implementationTable.get(this);
      if (implementation)
        return implementation;
      implementation =
          new DOMImplementation(unwrap(this).implementation);
      implementationTable.set(this, implementation);
      return implementation;
    }
  });

  registerWrapper(window.Document, Document,
      document.implementation.createHTMLDocument(''));

  // Both WebKit and Gecko uses HTMLDocument for document. HTML5/DOM only has
  // one Document interface and IE implements the standard correctly.
  if (window.HTMLDocument)
    registerWrapper(window.HTMLDocument, Document);

  wrapEventTargetMethods([
    window.HTMLBodyElement,
    window.HTMLDocument || window.Document,  // Gecko adds these to HTMLDocument
    window.HTMLHeadElement,
  ]);

  function DOMImplementation(impl) {
    this.impl = impl;
  }

  function wrapImplMethod(constructor, name) {
    var original = document.implementation[name];
    constructor.prototype[name] = function() {
      return wrap(original.apply(this.impl, arguments));
    };
  }

  function forwardImplMethod(constructor, name) {
    var original = document.implementation[name];
    constructor.prototype[name] = function() {
      return original.apply(this.impl, arguments);
    };
  }

  wrapImplMethod(DOMImplementation, 'createDocumentType');
  wrapImplMethod(DOMImplementation, 'createDocument');
  wrapImplMethod(DOMImplementation, 'createHTMLDocument');
  forwardImplMethod(DOMImplementation, 'hasFeature');

  registerWrapper(window.DOMImplementation, DOMImplementation);

  forwardMethodsToWrapper([
    window.DOMImplementation,
  ], [
    'createDocumentType',
    'createDocument',
    'createHTMLDocument',
    'hasFeature',
  ]);

  scope.adoptNodeNoRemove = adoptNodeNoRemove;
  scope.wrappers.DOMImplementation = DOMImplementation;
  scope.wrappers.Document = Document;

})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var EventTarget = scope.wrappers.EventTarget;
  var mixin = scope.mixin;
  var registerWrapper = scope.registerWrapper;
  var unwrap = scope.unwrap;
  var unwrapIfNeeded = scope.unwrapIfNeeded;
  var wrap = scope.wrap;
  var renderAllPending = scope.renderAllPending;

  var OriginalWindow = window.Window;

  function Window(impl) {
    EventTarget.call(this, impl);
  }
  Window.prototype = Object.create(EventTarget.prototype);

  var originalGetComputedStyle = window.getComputedStyle;
  OriginalWindow.prototype.getComputedStyle = function(el, pseudo) {
    renderAllPending();
    return originalGetComputedStyle.call(this || window, unwrapIfNeeded(el),
                                         pseudo);
  };

  ['addEventListener', 'removeEventListener', 'dispatchEvent'].forEach(
      function(name) {
        OriginalWindow.prototype[name] = function() {
          var w = wrap(this || window);
          return w[name].apply(w, arguments);
        };
      });

  mixin(Window.prototype, {
    getComputedStyle: function(el, pseudo) {
      return originalGetComputedStyle.call(unwrap(this), unwrapIfNeeded(el),
                                           pseudo);
    }
  });

  registerWrapper(OriginalWindow, Window);

  scope.wrappers.Window = Window;

})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var defineGetter = scope.defineGetter;
  var defineWrapGetter = scope.defineWrapGetter;
  var registerWrapper = scope.registerWrapper;
  var unwrapIfNeeded = scope.unwrapIfNeeded;
  var wrapNodeList = scope.wrapNodeList;
  var wrappers = scope.wrappers;

  var OriginalMutationObserver = window.MutationObserver ||
      window.WebKitMutationObserver;

  if (!OriginalMutationObserver)
    return;

  var OriginalMutationRecord = window.MutationRecord;

  function MutationRecord(impl) {
    this.impl = impl;
  }

  MutationRecord.prototype = {
    get addedNodes() {
      return wrapNodeList(this.impl.addedNodes);
    },
    get removedNodes() {
      return wrapNodeList(this.impl.removedNodes);
    }
  };

  ['target', 'previousSibling', 'nextSibling'].forEach(function(name) {
    defineWrapGetter(MutationRecord, name);
  });

  // WebKit/Blink treats these as instance properties so we override
  [
    'type',
    'attributeName',
    'attributeNamespace',
    'oldValue'
  ].forEach(function(name) {
    defineGetter(MutationRecord, name, function() {
      return this.impl[name];
    });
  });

  if (OriginalMutationRecord)
    registerWrapper(OriginalMutationRecord, MutationRecord);

  function wrapRecord(record) {
    return new MutationRecord(record);
  }

  function wrapRecords(records) {
    return records.map(wrapRecord);
  }

  function MutationObserver(callback) {
    var self = this;
    this.impl = new OriginalMutationObserver(function(mutations, observer) {
      callback.call(self, wrapRecords(mutations), self);
    });
  }

  var OriginalNode = window.Node;

  MutationObserver.prototype = {
    observe: function(target, options) {
      this.impl.observe(unwrapIfNeeded(target), options);
    },
    disconnect: function() {
      this.impl.disconnect();
    },
    takeRecords: function() {
      return wrapRecords(this.impl.takeRecords());
    }
  };

  scope.wrappers.MutationObserver = MutationObserver;
  scope.wrappers.MutationRecord = MutationRecord;

})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var registerWrapper = scope.registerWrapper;
  var unwrap = scope.unwrap;
  var unwrapIfNeeded = scope.unwrapIfNeeded;
  var wrap = scope.wrap;

  var OriginalRange = window.Range;

  function Range(impl) {
    this.impl = impl;
  }
  Range.prototype = {
    get startContainer() {
      return wrap(this.impl.startContainer);
    },
    get endContainer() {
      return wrap(this.impl.endContainer);
    },
    get commonAncestorContainer() {
      return wrap(this.impl.commonAncestorContainer);
    },
    setStart: function(refNode,offset) {
      this.impl.setStart(unwrapIfNeeded(refNode), offset);
    },
    setEnd: function(refNode,offset) {
      this.impl.setEnd(unwrapIfNeeded(refNode), offset);
    },
    setStartBefore: function(refNode) {
      this.impl.setStartBefore(unwrapIfNeeded(refNode));
    },
    setStartAfter: function(refNode) {
      this.impl.setStartAfter(unwrapIfNeeded(refNode));
    },
    setEndBefore: function(refNode) {
      this.impl.setEndBefore(unwrapIfNeeded(refNode));
    },
    setEndAfter: function(refNode) {
      this.impl.setEndAfter(unwrapIfNeeded(refNode));
    },
    selectNode: function(refNode) {
      this.impl.selectNode(unwrapIfNeeded(refNode));
    },
    selectNodeContents: function(refNode) {
      this.impl.selectNodeContents(unwrapIfNeeded(refNode));
    },
    compareBoundaryPoints: function(how, sourceRange) {
      return this.impl.compareBoundaryPoints(how, unwrap(sourceRange));
    },
    extractContents: function() {
      return wrap(this.impl.extractContents());
    },
    cloneContents: function() {
      return wrap(this.impl.cloneContents());
    },
    insertNode: function(node) {
      this.impl.insertNode(unwrapIfNeeded(node));
    },
    surroundContents: function(newParent) {
      this.impl.surroundContents(unwrapIfNeeded(newParent));
    },
    cloneRange: function() {
      return wrap(this.impl.cloneRange());
    },
    isPointInRange: function(node, offset) {
      return this.impl.isPointInRange(unwrapIfNeeded(node), offset);
    },
    comparePoint: function(node, offset) {
      return this.impl.comparePoint(unwrapIfNeeded(node), offset);
    },
    intersectsNode: function(node) {
      return this.impl.intersectsNode(unwrapIfNeeded(node));
    }
  };

  // IE9 does not have createContextualFragment.
  if (OriginalRange.prototype.createContextualFragment) {
    Range.prototype.createContextualFragment = function(html) {
      return wrap(this.impl.createContextualFragment(html));
    };
  }

  registerWrapper(window.Range, Range);

  scope.wrappers.Range = Range;

})(this.ShadowDOMPolyfill);

// Copyright 2013 The Polymer Authors. All rights reserved.
// Use of this source code is goverened by a BSD-style
// license that can be found in the LICENSE file.

(function(scope) {
  'use strict';

  var isWrapperFor = scope.isWrapperFor;

  // This is a list of the elements we currently override the global constructor
  // for.
  var elements = {
    'a': 'HTMLAnchorElement',
    'applet': 'HTMLAppletElement',
    'area': 'HTMLAreaElement',
    'audio': 'HTMLAudioElement',
    'br': 'HTMLBRElement',
    'base': 'HTMLBaseElement',
    'body': 'HTMLBodyElement',
    'button': 'HTMLButtonElement',
    'canvas': 'HTMLCanvasElement',
    // 'command': 'HTMLCommandElement',  // Not fully implemented in Gecko.
    'dl': 'HTMLDListElement',
    'datalist': 'HTMLDataListElement',
    'dir': 'HTMLDirectoryElement',
    'div': 'HTMLDivElement',
    'embed': 'HTMLEmbedElement',
    'fieldset': 'HTMLFieldSetElement',
    'font': 'HTMLFontElement',
    'form': 'HTMLFormElement',
    'frame': 'HTMLFrameElement',
    'frameset': 'HTMLFrameSetElement',
    'hr': 'HTMLHRElement',
    'head': 'HTMLHeadElement',
    'h1': 'HTMLHeadingElement',
    'html': 'HTMLHtmlElement',
    'iframe': 'HTMLIFrameElement',

    // Uses HTMLSpanElement in Firefox.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=843881
    // 'image',

    'input': 'HTMLInputElement',
    'li': 'HTMLLIElement',
    'label': 'HTMLLabelElement',
    'legend': 'HTMLLegendElement',
    'link': 'HTMLLinkElement',
    'map': 'HTMLMapElement',
    // 'media', Covered by audio and video
    'menu': 'HTMLMenuElement',
    'menuitem': 'HTMLMenuItemElement',
    'meta': 'HTMLMetaElement',
    'meter': 'HTMLMeterElement',
    'del': 'HTMLModElement',
    'ol': 'HTMLOListElement',
    'object': 'HTMLObjectElement',
    'optgroup': 'HTMLOptGroupElement',
    'option': 'HTMLOptionElement',
    'output': 'HTMLOutputElement',
    'p': 'HTMLParagraphElement',
    'param': 'HTMLParamElement',
    'pre': 'HTMLPreElement',
    'progress': 'HTMLProgressElement',
    'q': 'HTMLQuoteElement',
    'script': 'HTMLScriptElement',
    'select': 'HTMLSelectElement',
    'source': 'HTMLSourceElement',
    'span': 'HTMLSpanElement',
    'style': 'HTMLStyleElement',
    'caption': 'HTMLTableCaptionElement',
    // WebKit and Moz are wrong:
    // https://bugs.webkit.org/show_bug.cgi?id=111469
    // https://bugzilla.mozilla.org/show_bug.cgi?id=848096
    // 'td': 'HTMLTableCellElement',
    'col': 'HTMLTableColElement',
    'table': 'HTMLTableElement',
    'tr': 'HTMLTableRowElement',
    'thead': 'HTMLTableSectionElement',
    'tbody': 'HTMLTableSectionElement',
    'textarea': 'HTMLTextAreaElement',
    'title': 'HTMLTitleElement',
    'ul': 'HTMLUListElement',
    'video': 'HTMLVideoElement',
  };

  function overrideConstructor(tagName) {
    var nativeConstructorName = elements[tagName];
    var nativeConstructor = window[nativeConstructorName];
    if (!nativeConstructor)
      return;
    var element = document.createElement(tagName);
    var wrapperConstructor = element.constructor;
    window[nativeConstructorName] = wrapperConstructor;
  }

  Object.keys(elements).forEach(overrideConstructor);

  Object.getOwnPropertyNames(scope.wrappers).forEach(function(name) {
    window[name] = scope.wrappers[name]
  });

  // Export for testing.
  scope.knownElements = elements;

})(this.ShadowDOMPolyfill);
/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function() {

  // convenient global
  window.wrap = function(n) {
    return n.impl ? n : ShadowDOMPolyfill.wrap(n);
  }
  window.unwrap = function(n){
    return n.impl ? ShadowDOMPolyfill.unwrap(n) : n;
  }

  // getComputedStyle patch to tolerate unwrapped input
  var originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function(n, pseudo) {
    return originalGetComputedStyle.call(window, wrap(n), pseudo);
  };
  
  // users may want to customize other types
  // TODO(sjmiles): 'button' is now supported by ShadowDOMPolyfill, but
  // I've left this code here in case we need to temporarily patch another
  // type
  /*
  (function() {
    var elts = {HTMLButtonElement: 'button'};
    for (var c in elts) {
      window[c] = function() { throw 'Patched Constructor'; };
      window[c].prototype = Object.getPrototypeOf(
          document.createElement(elts[c]));
    }
  })();
  */
 
  // patch in prefixed name
  Object.defineProperties(HTMLElement.prototype, {
    //TODO(sjmiles): review accessor alias with Arv
    webkitShadowRoot: {
      get: function() {
        return this.shadowRoot;
      }
    }
  });
  
  // include .host reference
  var originalCreateShadowRoot = HTMLElement.prototype.createShadowRoot;
  HTMLElement.prototype.createShadowRoot = function() {
    var root = originalCreateShadowRoot.call(this);
    root.host = this;
    return root;
  }

  //TODO(sjmiles): review method alias with Arv
  HTMLElement.prototype.webkitCreateShadowRoot =
      HTMLElement.prototype.createShadowRoot;    
})();

/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/*
  This is a limited shim for ShadowDOM css styling.
  https://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#styles
  
  The intention here is to support only the styling features which can be 
  relatively simply implemented. The goal is to allow users to avoid the 
  most obvious pitfalls and do so without compromising performance significantly. 
  For ShadowDOM styling that's not covered here, a set of best practices
  can be provided that should allow users to accomplish more complex styling.

  The following is a list of specific ShadowDOM styling features and a brief
  discussion of the approach used to shim.

  Shimmed features:

  * @host: ShadowDOM allows styling of the shadowRoot's host element using the 
  @host rule. To shim this feature, the @host styles are reformatted and 
  prefixed with a given scope name and promoted to a document level stylesheet.
  For example, given a scope name of .foo, a rule like this:
  
    @host {
      * {
        background: red;
      }
    }
  
  becomes:
  
    .foo {
      background: red;
    }
  
  * encapsultion: Styles defined within ShadowDOM, apply only to 
  dom inside the ShadowDOM. Polymer uses one of two techniques to imlement
  this feature.
  
  By default, rules are prefixed with the host element tag name 
  as a descendant selector. This ensures styling does not leak out of the 'top'
  of the element's ShadowDOM. For example,

  div {
      font-weight: bold;
    }
  
  becomes:

  x-foo div {
      font-weight: bold;
    }
  
  becomes:


  Alternatively, if Platform.ShadowCSS.strictStyling is set to true then 
  selectors are scoped by adding an attribute selector suffix to each
  simple selector that contains the host element tag name. Each element 
  in the element's ShadowDOM template is also given the scope attribute. 
  Thus, these rules match only elements that have the scope attribute.
  For example, given a scope name of x-foo, a rule like this:
  
    div {
      font-weight: bold;
    }
  
  becomes:
  
    div[x-foo] {
      font-weight: bold;
    }

  Note that elements that are dynamically added to a scope must have the scope
  selector added to them manually.

  * ::pseudo: These rules are converted to rules that take advantage of the
  pseudo attribute. For example, a shadowRoot like this inside an x-foo

    <div pseudo="x-special">Special</div>

  with a rule like this:

    x-foo::x-special { ... }

  becomes:

    x-foo [pseudo=x-special] { ... }
  
  Unaddressed ShadowDOM styling features:
  
  * upper/lower bound encapsulation: Styles which are defined outside a
  shadowRoot should not cross the ShadowDOM boundary and should not apply
  inside a shadowRoot.

  This styling behavior is not emulated. Some possible ways to do this that 
  were rejected due to complexity and/or performance concerns include: (1) reset
  every possible property for every possible selector for a given scope name;
  (2) re-implement css in javascript.
  
  As an alternative, users should make sure to use selectors
  specific to the scope in which they are working.
  
  * ::distributed: This behavior is not emulated. It's often not necessary
  to style the contents of a specific insertion point and instead, descendants
  of the host element can be styled selectively. Users can also create an 
  extra node around an insertion point and style that node's contents
  via descendent selectors. For example, with a shadowRoot like this:
  
    <style>
      content::-webkit-distributed(div) {
        background: red;
      }
    </style>
    <content></content>
  
  could become:
  
    <style>
      / *@polyfill .content-container div * / 
      content::-webkit-distributed(div) {
        background: red;
      }
    </style>
    <div class="content-container">
      <content></content>
    </div>
  
  Note the use of @polyfill in the comment above a ShadowDOM specific style
  declaration. This is a directive to the styling shim to use the selector 
  in comments in lieu of the next selector when running under polyfill.
*/
(function(scope) {

var ShadowCSS = {
  strictStyling: false,
  registry: {},
  // Shim styles for a given root associated with a name and extendsName
  // 1. cache root styles by name
  // 2. optionally tag root nodes with scope name
  // 3. shim polyfill directives /* @polyfill */
  // 4. shim @host and scoping
  shimStyling: function(root, name, extendsName) {
    if (root) {
      // use caching to make working with styles nodes easier and to facilitate
      // lookup of extendee
      var def = this.registerDefinition(root, name, extendsName);
      // find styles and apply shimming...
      if (this.strictStyling) {
        this.applyScopeToContent(root, name);
      }
      this.shimPolyfillDirectives(def.rootStyles, name);
      this.applyShimming(def.scopeStyles, name);
      this.applyPolyfillRules(def.rootStyles, name);
    }
  },
  // Shim styles to be placed inside a shadowRoot.
  // 1. shim polyfill directives /* @polyfill */
  // 2. shim @host and scoping
  shimShadowDOMStyling: function(styles, name) {
    this.shimPolyfillDirectives(styles, name);
    this.applyShimming(styles, name);
    this.applyPolyfillRules(styles, name);
  },
  registerDefinition: function(root, name, extendsName) {
    var def = this.registry[name] = {
      root: root,
      name: name,
      extendsName: extendsName
    }
    var styles = root.querySelectorAll('style');
    styles = styles ? Array.prototype.slice.call(styles, 0) : [];
    def.rootStyles = styles;
    def.scopeStyles = def.rootStyles;
    var extendee = this.registry[def.extendsName];
    if (extendee && root.querySelector('shadow')) {
      def.scopeStyles = extendee.scopeStyles.concat(def.scopeStyles);
    }
    return def;
  },
  applyScopeToContent: function(root, name) {
    if (root) {
      // add the name attribute to each node in root.
      Array.prototype.forEach.call(root.querySelectorAll('*'),
          function(node) {
            node.setAttribute(name, '');
          });
      // and template contents too
      Array.prototype.forEach.call(root.querySelectorAll('template'),
          function(template) {
            this.applyScopeToContent(template.content, name);
          },
          this);
    }
  },
  /*
   * Process styles to convert native ShadowDOM rules that will trip
   * up the css parser; we rely on decorating the stylesheet with comments.
   * 
   * For example, we convert this rule:
   * 
   * (comment start) @polyfill @host g-menu-item (comment end)
   * shadow::-webkit-distributed(g-menu-item) {
   * 
   * to this:
   * 
   * scopeName g-menu-item {
   *
  **/
  shimPolyfillDirectives: function(styles, name) {
    if (styles) {
      Array.prototype.forEach.call(styles, function(s) {
        s.textContent = this.convertPolyfillDirectives(s.textContent, name);
      }, this);
    }
  },
  convertPolyfillDirectives: function(cssText, name) {
    var r = '', l = 0, matches, selector;
    while (matches = cssPolyfillCommentRe.exec(cssText)) {
      r += cssText.substring(l, matches.index);
      // remove end comment delimiter (*/)
      selector = matches[1].slice(0, -2).replace(hostRe, name);
      r += this.scopeSelector(selector, name) + '{';
      l = cssPolyfillCommentRe.lastIndex;
    }
    r += cssText.substring(l, cssText.length);
    return r;
  },
  // apply @host and scope shimming
  applyShimming: function(styles, name) {
    var cssText = this.shimAtHost(styles, name);
    cssText += this.shimScoping(styles, name);
    addCssToDocument(cssText);
  },
  // form: @host { .foo { declarations } }
  // becomes: scopeName.foo { declarations }
  shimAtHost: function(styles, name) {
    if (styles) {
      return this.convertAtHostStyles(styles, name);
    }
  },
  convertAtHostStyles: function(styles, name) {
    var cssText = stylesToCssText(styles);
    var r = '', l=0, matches;
    while (matches = hostRuleRe.exec(cssText)) {
      r += cssText.substring(l, matches.index);
      r += this.scopeHostCss(matches[1], name);
      l = hostRuleRe.lastIndex;
    }
    r += cssText.substring(l, cssText.length);
    var re = new RegExp('^' + name + selectorReSuffix, 'm');
    var cssText = rulesToCss(this.findAtHostRules(cssToRules(r),
      re));
    return cssText;
  },
  scopeHostCss: function(cssText, name) {
    var r = '', matches;
    while (matches = selectorRe.exec(cssText)) {
      r += this.scopeHostSelector(matches[1], name) +' ' + matches[2] + '\n\t';
    }
    return r;
  },
  // supports scopig by name and  [is=name] syntax
  scopeHostSelector: function(selector, name) {
    var r = [], parts = selector.split(','), is = '[is=' + name + ']';
    parts.forEach(function(p) {
      p = p.trim();
      // selector: *|:scope -> name
      if (p.match(hostElementRe)) {
        p = p.replace(hostElementRe, name + '$1$3, ' + is + '$1$3');
      // selector: .foo -> name.foo, [bar] -> name[bar]
      } else if (p.match(hostFixableRe)) {
        p = name + p + ', ' + is + p;
      }
      r.push(p);
    }, this);
    return r.join(', ');
  },
  // consider styles that do not include component name in the selector to be
  // unscoped and in need of promotion; 
  // for convenience, also consider keyframe rules this way.
  findAtHostRules: function(cssRules, matcher) {
    return Array.prototype.filter.call(cssRules, 
      this.isHostRule.bind(this, matcher));
  },
  isHostRule: function(matcher, cssRule) {
    return (cssRule.selectorText && cssRule.selectorText.match(matcher)) ||
      (cssRule.cssRules && this.findAtHostRules(cssRule.cssRules, matcher).length) ||
      (cssRule.type == CSSRule.WEBKIT_KEYFRAMES_RULE);
  },
  /* Ensure styles are scoped. Pseudo-scoping takes a rule like:
   * 
   *  .foo {... } 
   *  
   *  and converts this to
   *  
   *  scopeName .foo { ... }
  */
  shimScoping: function(styles, name) {
    if (styles) {
      return this.convertScopedStyles(styles, name);
    }
  },
  convertScopedStyles: function(styles, name) {
    Array.prototype.forEach.call(styles, function(s) {
      if (s.parentNode) {
        s.parentNode.removeChild(s);
      }
    });
    var cssText = stylesToCssText(styles).replace(hostRuleRe, '');
    cssText = this.convertPseudos(cssText);
    var rules = cssToRules(cssText);
    cssText = this.scopeRules(rules, name);
    return cssText;
  },
  convertPseudos: function(cssText) {
    return cssText.replace(cssPseudoRe, ' [pseudo=$1]');
  },
  // change a selector like 'div' to 'name div'
  scopeRules: function(cssRules, name) {
    var cssText = '';
    Array.prototype.forEach.call(cssRules, function(rule) {
      if (rule.selectorText && (rule.style && rule.style.cssText)) {
        cssText += this.scopeSelector(rule.selectorText, name, 
          this.strictStyling) + ' {\n\t';
        cssText += this.propertiesFromRule(rule) + '\n}\n\n';
      } else if (rule.media) {
        cssText += '@media ' + rule.media.mediaText + ' {\n';
        cssText += this.scopeRules(rule.cssRules, name);
        cssText += '\n}\n\n';
      } else if (rule.cssText) {
        cssText += rule.cssText + '\n\n';
      }
    }, this);
    return cssText;
  },
  scopeSelector: function(selector, name, strict) {
    var r = [], parts = selector.split(',');
    parts.forEach(function(p) {
      p = p.trim();
      if (this.selectorNeedsScoping(p, name)) {
        p = strict ? this.applyStrictSelectorScope(p, name) :
          this.applySimpleSelectorScope(p, name);
      }
      r.push(p);
    }, this);
    return r.join(', ');
  },
  selectorNeedsScoping: function(selector, name) {
    var matchScope = '(' + name + '|\\[is=' + name + '\\])';
    var re = new RegExp('^' + matchScope + selectorReSuffix, 'm');
    return !selector.match(re);
  },
  // scope via name and [is=name]
  applySimpleSelectorScope: function(selector, name) {
    return name + ' ' + selector + ', ' + '[is=' + name + '] ' + selector;
  },
  // return a selector with [name] suffix on each simple selector
  // e.g. .foo.bar > .zot becomes .foo[name].bar[name] > .zot[name]
  applyStrictSelectorScope: function(selector, name) {
    var splits = [' ', '>', '+', '~'],
      scoped = selector,
      attrName = '[' + name + ']';
    splits.forEach(function(sep) {
      var parts = scoped.split(sep);
      scoped = parts.map(function(p) {
        var t = p.trim();
        if (t && (splits.indexOf(t) < 0) && (t.indexOf(attrName) < 0)) {
          p = t.replace(/([^:]*)(:*)(.*)/, '$1' + attrName + '$2$3')
        }
        return p;
      }).join(sep);
    });
    return scoped;
  },
  propertiesFromRule: function(rule) {
    var properties = rule.style.cssText;
    // TODO(sorvell): Chrome cssom incorrectly removes quotes from the content
    // property. (https://code.google.com/p/chromium/issues/detail?id=247231)
    if (rule.style.content && !rule.style.content.match(/['"]+/)) {
      properties = 'content: \'' + rule.style.content + '\';\n' + 
        rule.style.cssText.replace(/content:[^;]*;/g, '');
    }
    return properties;
  },
  applyPolyfillRules: function(styles, name) {
    if (styles) {
      var cssText = '';
      Array.prototype.forEach.call(styles, function(s) {
        cssText += this.extractPolyfillRules(s.textContent, name) + '\n\n';
      }, this);
    }
    addCssToDocument(cssText);
  },
  extractPolyfillRules: function(cssText, name) {
    var r = '', l = 0, matches, selector;
    while (matches = cssPolyfillRuleCommentRe.exec(cssText)) {
      rule = matches[1].slice(0, -1).replace(hostRe, name);
      r += rule + '\n\n';
    }
    return r;
  }
};

var hostRuleRe = /@host[^{]*{(([^}]*?{[^{]*?}[\s\S]*?)+)}/gim,
    selectorRe = /([^{]*)({[\s\S]*?})/gim,
    hostElementRe = /(.*)((?:\*)|(?:\:scope))(.*)/,
    hostFixableRe = /^[.\[:]/,
    cssCommentRe = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//gim,
    cssPolyfillCommentRe = /\/\*\s*@polyfill ([^*]*\*+([^/*][^*]*\*+)*\/)([^{]*?){/gim,
    cssPolyfillRuleCommentRe = /\/\*\s@polyfill-rule([^*]*\*+([^/*][^*]*\*+)*)\//gim,
    cssPseudoRe = /::(x-[^\s{,(]*)/gim,
    selectorReSuffix = '([>\\s~+\[.,{:][\\s\\S]*)?$',
    hostRe = /@host/gim;

function stylesToCssText(styles, preserveComments) {
  var cssText = '';
  Array.prototype.forEach.call(styles, function(s) {
    cssText += s.textContent + '\n\n';
  });
  // strip comments for easier processing
  if (!preserveComments) {
    cssText = cssText.replace(cssCommentRe, '');
  }
  return cssText;
}

function cssToRules(cssText) {
  var style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);
  var rules = style.sheet.cssRules;
  style.parentNode.removeChild(style);
  return rules;
}

function rulesToCss(cssRules) {
  for (var i=0, css=[]; i < cssRules.length; i++) {
    css.push(cssRules[i].cssText);
  }
  return css.join('\n\n');
}

function addCssToDocument(cssText) {
  if (cssText) {
    getSheet().appendChild(document.createTextNode(cssText));
  }
}

var sheet;
function getSheet() {
  if (!sheet) {
    sheet = document.createElement("style");
    sheet.setAttribute('ShadowCSSShim', '');
  }
  return sheet;
}

// add polyfill stylesheet to document
if (window.ShadowDOMPolyfill) {
  addCssToDocument('style { display: none !important; }\n');
  var head = document.querySelector('head');
  head.insertBefore(getSheet(), head.childNodes[0]);
}

// exports
scope.ShadowCSS = ShadowCSS;

})(window.Platform);
} else {
/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function() {
  
  // poor man's adapter for template.content on various platform scenarios
  window.templateContent = window.templateContent || function(inTemplate) {
    return inTemplate.content;
  };

  // so we can call wrap/unwrap without testing for ShadowDOMPolyfill

  window.wrap = window.unwrap = function(n){
    return n;
  }
  
  var originalCreateShadowRoot = HTMLElement.prototype.webkitCreateShadowRoot;
  HTMLElement.prototype.webkitCreateShadowRoot = function() {
    var elderRoot = this.webkitShadowRoot;
    var root = originalCreateShadowRoot.call(this);
    root.olderShadowRoot = elderRoot;
    root.host = this;
    CustomElements.watchShadow(this);
    return root;
  }

  Object.defineProperties(HTMLElement.prototype, {
    shadowRoot: {
      get: function() {
        return this.webkitShadowRoot;
      }
    },
    createShadowRoot: {
      value: function() {
        return this.webkitCreateShadowRoot();
      }
    }
  });

  window.templateContent = function(inTemplate) {
    // if MDV exists, it may need to boostrap this template to reveal content
    if (window.HTMLTemplateElement && HTMLTemplateElement.bootstrap) {
      HTMLTemplateElement.bootstrap(inTemplate);
    }
    // fallback when there is no Shadow DOM polyfill, no MDV polyfill, and no
    // native template support
    if (!inTemplate.content && !inTemplate._content) {
      var frag = document.createDocumentFragment();
      while (inTemplate.firstChild) {
        frag.appendChild(inTemplate.firstChild);
      }
      inTemplate._content = frag;
    }
    return inTemplate.content || inTemplate._content;
  };

})();
}
/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

// Old versions of iOS do not have bind.

if (!Function.prototype.bind) {
  Function.prototype.bind = function(scope) {
    var self = this;
    var args = Array.prototype.slice.call(arguments, 1);
    return function() {
      var args2 = args.slice();
      args2.push.apply(args2, arguments);
      return self.apply(scope, args2);
    };
  };
}

// mixin

// copy all properties from inProps (et al) to inObj
function mixin(inObj/*, inProps, inMoreProps, ...*/) {
  var obj = inObj || {};
  for (var i = 1; i < arguments.length; i++) {
    var p = arguments[i];
    try {
      for (var n in p) {
        copyProperty(n, p, obj);
      }
    } catch(x) {
    }
  }
  return obj;
}

// copy property inName from inSource object to inTarget object
function copyProperty(inName, inSource, inTarget) {
  var pd = getPropertyDescriptor(inSource, inName);
  Object.defineProperty(inTarget, inName, pd);
}

// get property descriptor for inName on inObject, even if
// inName exists on some link in inObject's prototype chain
function getPropertyDescriptor(inObject, inName) {
  if (inObject) {
    var pd = Object.getOwnPropertyDescriptor(inObject, inName);
    return pd || getPropertyDescriptor(Object.getPrototypeOf(inObject), inName);
  }
}

// export

scope.mixin = mixin;

})(window.Platform);
// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(scope) {

  'use strict';

  // polyfill DOMTokenList
  // * add/remove: allow these methods to take multiple classNames
  // * toggle: add a 2nd argument which forces the given state rather
  //  than toggling.

  var add = DOMTokenList.prototype.add;
  var remove = DOMTokenList.prototype.remove;
  DOMTokenList.prototype.add = function() {
    for (var i = 0; i < arguments.length; i++) {
      add.call(this, arguments[i]);
    }
  };
  DOMTokenList.prototype.remove = function() {
    for (var i = 0; i < arguments.length; i++) {
      remove.call(this, arguments[i]);
    }
  };
  DOMTokenList.prototype.toggle = function(name, bool) {
    if (arguments.length == 1) {
      bool = !this.contains(name);
    }
    bool ? this.add(name) : this.remove(name);
  };
  DOMTokenList.prototype.switch = function(oldName, newName) {
    oldName && this.remove(oldName);
    newName && this.add(newName);
  };
  
  // add array() and forEach() to NodeList, NamedNodeMap, HTMLCollection

  var ArraySlice = function() {
    return Array.prototype.slice.call(this);
  };

  var namedNodeMap = (window.NamedNodeMap || window.MozNamedAttrMap || {});
  
  NodeList.prototype.array = ArraySlice;
  namedNodeMap.prototype.array = ArraySlice;
  HTMLCollection.prototype.array = ArraySlice;

  var ArrayForEach = function(cb, context) {
    ArraySlice.call(this).forEach(cb, context);
  };

  NodeList.prototype.forEach = ArrayForEach;
  namedNodeMap.prototype.forEach = ArrayForEach;
  HTMLCollection.prototype.forEach = ArrayForEach;

  // polyfill performance.now

  if (!window.performance) {
    var start = Date.now();
    // only at millisecond precision
    window.performance = {now: function(){ return Date.now() - start }};
  }

  // polyfill for requestAnimationFrame

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (function() {
      var nativeRaf = window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame;

      return nativeRaf ?
        function(callback) {
          return nativeRaf(function() {
            callback(performance.now());
          });
        } :
        function( callback ){
          return window.setTimeout(callback, 1000 / 60);
        };
    })();
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (function() {
      return  window.webkitCancelAnimationFrame ||
        window.mozCancelAnimationFrame ||
        function(id) {
          clearTimeout(id);
        };
    })();
  }

  // utility

  function createDOM(inTagOrNode, inHTML, inAttrs) {
    var dom = typeof inTagOrNode == 'string' ? 
        document.createElement(inTagOrNode) : inTagOrNode.cloneNode(true);
    dom.innerHTML = inHTML;
    if (inAttrs) {
      for (var n in inAttrs) {
        dom.setAttribute(n, inAttrs[n]);
      }
    }
    return dom;
  }

  // exports

  scope.createDOM = createDOM;

})(window.Platform);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

// poor man's adapter for template.content on various platform scenarios
window.templateContent = window.templateContent || function(inTemplate) {
  return inTemplate.content;
};
(function(scope) {
  
  scope = scope || (window.Inspector = {});
  
  var inspector;

  window.sinspect = function(inNode, inProxy) {
    if (!inspector) {
      inspector = window.open('', 'ShadowDOM Inspector', null, true);
      inspector.document.write(inspectorHTML);
      //inspector.document.close();
      inspector.api = {
        shadowize: shadowize
      };
    }
    inspect(inNode || wrap(document.body), inProxy);
  };

  var inspectorHTML = [
    '<!DOCTYPE html>',
    '<html>',
    '  <head>',
    '    <title>ShadowDOM Inspector</title>',
    '    <style>',
    '      body {',
    '      }',
    '      pre {',
    '        font: 9pt "Courier New", monospace;',
    '        line-height: 1.5em;',
    '      }',
    '      tag {',
    '        color: purple;',
    '      }',
    '      ul {',
    '         margin: 0;',
    '         padding: 0;',
    '         list-style: none;',
    '      }',
    '      li {',
    '         display: inline-block;',
    '         background-color: #f1f1f1;',
    '         padding: 4px 6px;',
    '         border-radius: 4px;',
    '         margin-right: 4px;',
    '      }',
    '    </style>',
    '  </head>',
    '  <body>',
    '    <ul id="crumbs">',
    '    </ul>',
    '    <div id="tree"></div>',
    '  </body>',
    '</html>'
  ].join('\n');
  
  var crumbs = [];

  var displayCrumbs = function() {
    // alias our document
    var d = inspector.document;
    // get crumbbar
    var cb = d.querySelector('#crumbs');
    // clear crumbs
    cb.textContent = '';
    // build new crumbs
    for (var i=0, c; c=crumbs[i]; i++) {
      var a = d.createElement('a');
      a.href = '#';
      a.textContent = c.localName;
      a.idx = i;
      a.onclick = function(event) {
        var c;
        while (crumbs.length > this.idx) {
          c = crumbs.pop();
        }
        inspect(c.shadow || c, c);
        event.preventDefault();
      };
      cb.appendChild(d.createElement('li')).appendChild(a);
    }
  };

  var inspect = function(inNode, inProxy) {
    // alias our document
    var d = inspector.document;
    // reset list of drillable nodes
    drillable = [];
    // memoize our crumb proxy
    var proxy = inProxy || inNode;
    crumbs.push(proxy);
    // update crumbs
    displayCrumbs();
    // reflect local tree
    d.body.querySelector('#tree').innerHTML =
        '<pre>' + output(inNode, inNode.childNodes) + '</pre>';
  };

  var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

  var blacklisted = {STYLE:1, SCRIPT:1, "#comment": 1, TEMPLATE: 1};
  var blacklist = function(inNode) {
    return blacklisted[inNode.nodeName];
  };

  var output = function(inNode, inChildNodes, inIndent) {
    if (blacklist(inNode)) {
      return '';
    }
    var indent = inIndent || '';
    if (inNode.localName || inNode.nodeType == 11) {
      var name = inNode.localName || 'shadow-root';
      //inChildNodes = ShadowDOM.localNodes(inNode);
      var info = indent + describe(inNode);
      // if only textNodes
      // TODO(sjmiles): make correct for ShadowDOM
      /*if (!inNode.children.length && inNode.localName !== 'content' && inNode.localName !== 'shadow') {
        info += catTextContent(inChildNodes);
      } else*/ {
        // TODO(sjmiles): native <shadow> has no reference to its projection
        if (name == 'content' /*|| name == 'shadow'*/) {
          inChildNodes = inNode.getDistributedNodes();
        }
        info += '<br/>';
        var ind = indent + '&nbsp;&nbsp;';
        forEach(inChildNodes, function(n) {
          info += output(n, n.childNodes, ind);
        });
        info += indent;
      }
      if (!({br:1}[name])) {
        info += '<tag>&lt;/' + name + '&gt;</tag>';
        info += '<br/>';
      }
    } else {
      var text = inNode.textContent.trim();
      info = text ? indent + '"' + text + '"' + '<br/>' : '';
    }
    return info;
  };

  var catTextContent = function(inChildNodes) {
    var info = '';
    forEach(inChildNodes, function(n) {
      info += n.textContent.trim();
    });
    return info;
  };

  var drillable = [];

  var describe = function(inNode) {
    var tag = '<tag>' + '&lt;';
    var name = inNode.localName || 'shadow-root';
    if (inNode.webkitShadowRoot || inNode.shadowRoot) {
      tag += ' <button idx="' + drillable.length +
        '" onclick="api.shadowize.call(this)">' + name + '</button>';
      drillable.push(inNode);
    } else {
      tag += name || 'shadow-root';
    }
    if (inNode.attributes) {
      forEach(inNode.attributes, function(a) {
        tag += ' ' + a.name + (a.value ? '="' + a.value + '"' : '');
      });
    }
    tag += '&gt;'+ '</tag>';
    return tag;
  };

  // remote api

  shadowize = function() {
    var idx = Number(this.attributes.idx.value);
    //alert(idx);
    var node = drillable[idx];
    if (node) {
      inspect(node.webkitShadowRoot || node.shadowRoot, node)
    } else {
      console.log("bad shadowize node");
      console.dir(this);
    }
  };
  
  // export
  
  scope.output = output;
  
})(window.Inspector);



// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(global) {
  'use strict';

  var filter = Array.prototype.filter.call.bind(Array.prototype.filter);

  // JScript does not have __proto__. We wrap all object literals with
  // createObject which uses Object.create, Object.defineProperty and
  // Object.getOwnPropertyDescriptor to create a new object that does the exact
  // same thing. The main downside to this solution is that we have to extract
  // all those property descriptors for IE.
  var createObject = ('__proto__' in {}) ?
      function(obj) { return obj; } :
      function(obj) {
        var proto = obj.__proto__;
        if (!proto)
          return obj;
        var newObject = Object.create(proto);
        Object.getOwnPropertyNames(obj).forEach(function(name) {
          Object.defineProperty(newObject, name,
                               Object.getOwnPropertyDescriptor(obj, name));
        });
        return newObject;
      };

  // IE does not support have Document.prototype.contains.
  if (typeof document.contains != 'function') {
    Document.prototype.contains = function(node) {
      if (node === this || node.parentNode === this)
        return true;
      return this.documentElement.contains(node);
    }
  }

  Node.prototype.bind = function(name, model, path) {
    console.error('Unhandled binding to Node: ', this, name, model, path);
  };

  Node.prototype.unbind = function(name) {
    if (!this.bindings)
      this.bindings = {};
    var binding = this.bindings[name];
    if (!binding)
      return;
    if (typeof binding.close === 'function')
      binding.close();
    this.bindings[name] = undefined;
  };

  Node.prototype.unbindAll = function() {
    if (!this.bindings)
      return;
    var names = Object.keys(this.bindings);
    for (var i = 0; i < names.length; i++) {
      var binding = this.bindings[names[i]];
      if (binding)
        binding.close();
    }

    this.bindings = {};
  };

  var valuePath = Path.get('value');

  function NodeBinding(node, property, model, path) {
    this.closed = false;
    this.node = node;
    this.property = property;
    this.model = model;
    this.path = Path.get(path);
    if ((this.model instanceof PathObserver ||
         this.model instanceof CompoundPathObserver) &&
         this.path === valuePath) {
      this.observer = this.model;
      this.observer.target = this;
      this.observer.callback = this.valueChanged;
    } else {
      this.observer = new PathObserver(this.model, this.path,
                                       this.valueChanged,
                                       this);
    }
    this.valueChanged(this.value);
  }

  NodeBinding.prototype = {
    valueChanged: function(value) {
      this.node[this.property] = this.sanitizeBoundValue(value);
    },

    sanitizeBoundValue: function(value) {
      return value == undefined ? '' : String(value);
    },

    close: function() {
      if (this.closed)
        return;
      this.observer.close();
      this.observer = undefined;
      this.node = undefined;
      this.model = undefined;
      this.closed = true;
    },

    get value() {
      return this.observer.value;
    },

    set value(value) {
      this.observer.setValue(value);
    },

    reset: function() {
      this.observer.reset();
    }
  };

  Text.prototype.bind = function(name, model, path) {
    if (name !== 'textContent')
      return Node.prototype.bind.call(this, name, model, path);

    this.unbind(name);
    return this.bindings[name] = new NodeBinding(this, 'data', model, path);
  }

  function AttributeBinding(element, attributeName, model, path) {
    this.conditional = attributeName[attributeName.length - 1] == '?';
    if (this.conditional) {
      element.removeAttribute(attributeName);
      attributeName = attributeName.slice(0, -1);
    }

    NodeBinding.call(this, element, attributeName, model, path);
  }

  AttributeBinding.prototype = createObject({
    __proto__: NodeBinding.prototype,

    valueChanged: function(value) {
      if (this.conditional) {
        if (value)
          this.node.setAttribute(this.property, '');
        else
          this.node.removeAttribute(this.property);
        return;
      }

      this.node.setAttribute(this.property, this.sanitizeBoundValue(value));
    }
  });

  Element.prototype.bind = function(name, model, path) {
    this.unbind(name);
    return this.bindings[name] = new AttributeBinding(this, name, model, path);
  };

  var checkboxEventType;
  (function() {
    // Attempt to feature-detect which event (change or click) is fired first
    // for checkboxes.
    var div = document.createElement('div');
    var checkbox = div.appendChild(document.createElement('input'));
    checkbox.setAttribute('type', 'checkbox');
    var first;
    var count = 0;
    checkbox.addEventListener('click', function(e) {
      count++;
      first = first || 'click';
    });
    checkbox.addEventListener('change', function() {
      count++;
      first = first || 'change';
    });

    var event = document.createEvent('MouseEvent');
    event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false,
        false, false, false, 0, null);
    checkbox.dispatchEvent(event);
    // WebKit/Blink don't fire the change event if the element is outside the
    // document, so assume 'change' for that case.
    checkboxEventType = count == 1 ? 'change' : first;
  })();

  function getEventForInputType(element) {
    switch (element.type) {
      case 'checkbox':
        return checkboxEventType;
      case 'radio':
      case 'select-multiple':
      case 'select-one':
        return 'change';
      default:
        return 'input';
    }
  }

  function InputBinding(node, property, model, path) {
    NodeBinding.call(this, node, property, model, path);
    this.eventType = getEventForInputType(this.node);
    this.boundNodeValueChanged = this.nodeValueChanged.bind(this);
    this.node.addEventListener(this.eventType, this.boundNodeValueChanged,
                               true);
  }

  InputBinding.prototype = createObject({
    __proto__: NodeBinding.prototype,

    nodeValueChanged: function() {
      this.value = this.node[this.property];
      this.reset();
      this.postUpdateBinding();
      Platform.performMicrotaskCheckpoint();
    },

    postUpdateBinding: function() {},

    close: function() {
      if (this.closed)
        return;

      this.node.removeEventListener(this.eventType,
                                    this.boundNodeValueChanged,
                                    true);
      NodeBinding.prototype.close.call(this);
    }
  });

  // |element| is assumed to be an HTMLInputElement with |type| == 'radio'.
  // Returns an array containing all radio buttons other than |element| that
  // have the same |name|, either in the form that |element| belongs to or,
  // if no form, in the document tree to which |element| belongs.
  //
  // This implementation is based upon the HTML spec definition of a
  // "radio button group":
  //   http://www.whatwg.org/specs/web-apps/current-work/multipage/number-state.html#radio-button-group
  //
  function getAssociatedRadioButtons(element) {
    if (!element.ownerDocument.contains(element))
      return [];
    if (element.form) {
      return filter(element.form.elements, function(el) {
        return el != element &&
            el.tagName == 'INPUT' &&
            el.type == 'radio' &&
            el.name == element.name;
      });
    } else {
      var radios = element.ownerDocument.querySelectorAll(
          'input[type="radio"][name="' + element.name + '"]');
      return filter(radios, function(el) {
        return el != element && !el.form;
      });
    }
  }

  function CheckedBinding(element, model, path) {
    InputBinding.call(this, element, 'checked', model, path);
  }

  CheckedBinding.prototype = createObject({
    __proto__: InputBinding.prototype,

    sanitizeBoundValue: function(value) {
      return Boolean(value);
    },

    postUpdateBinding: function() {
      // Only the radio button that is getting checked gets an event. We
      // therefore find all the associated radio buttons and update their
      // CheckedBinding manually.
      if (this.node.tagName === 'INPUT' &&
          this.node.type === 'radio') {
        getAssociatedRadioButtons(this.node).forEach(function(radio) {
          var checkedBinding = radio.bindings.checked;
          if (checkedBinding) {
            // Set the value directly to avoid an infinite call stack.
            checkedBinding.value = false;
          }
        });
      }
    }
  });

  HTMLInputElement.prototype.bind = function(name, model, path) {
    if (name !== 'value' && name !== 'checked')
      return HTMLElement.prototype.bind.call(this, name, model, path);

    this.unbind(name);
    this.removeAttribute(name);
    return this.bindings[name] = name === 'value' ?
        new InputBinding(this, 'value', model, path) :
        new CheckedBinding(this, model, path);
  }

  HTMLTextAreaElement.prototype.bind = function(name, model, path) {
    if (name !== 'value')
      return HTMLElement.prototype.bind.call(this, name, model, path);

    this.unbind(name);
    this.removeAttribute(name);
    return this.bindings[name] = new InputBinding(this, name, model, path);
  }

  function OptionValueBinding(element, model, path) {
    InputBinding.call(this, element, 'value', model, path);
  }

  OptionValueBinding.prototype = createObject({
    __proto__: InputBinding.prototype,

    valueChanged: function(value) {
      var select = this.node.parentNode instanceof HTMLSelectElement ?
          this.node.parentNode : undefined;
      var selectBinding;
      var oldValue;
      if (select &&
          select.bindings &&
          select.bindings.value instanceof SelectBinding) {
        selectBinding = select.bindings.value;
        oldValue = select.value;
      }

      InputBinding.prototype.valueChanged.call(this, value);
      if (selectBinding && !selectBinding.closed && select.value !== oldValue)
        selectBinding.nodeValueChanged();
    }
  });

  HTMLOptionElement.prototype.bind = function(name, model, path) {
    if (name !== 'value')
      return HTMLElement.prototype.bind.call(this, name, model, path);

    this.unbind(name);
    this.removeAttribute(name);
    return this.bindings[name] = new OptionValueBinding(this, model, path);
  }

  function SelectBinding(element, property, model, path) {
    InputBinding.call(this, element, property, model, path);
  }

  SelectBinding.prototype = createObject({
    __proto__: InputBinding.prototype,

    valueChanged: function(value) {
      this.node[this.property] = value;
      if (this.node[this.property] == value)
        return;

      // The binding may wish to bind to an <option> which has not yet been
      // produced by a child <template>. Delay a maximum of two times: once for
      // each of <optgroup> and <option>
      var maxRetries = 2;
      var self = this;
      function delaySetSelectedIndex() {
        self.node[self.property] = value;
        if (self.node[self.property] != value && maxRetries--)
          ensureScheduled(delaySetSelectedIndex);
      }
      ensureScheduled(delaySetSelectedIndex);
    }
  });

  HTMLSelectElement.prototype.bind = function(name, model, path) {
    if (name === 'selectedindex')
      name = 'selectedIndex';

    if (name !== 'selectedIndex' && name !== 'value')
      return HTMLElement.prototype.bind.call(this, name, model, path);

    this.unbind(name);
    this.removeAttribute(name);
    return this.bindings[name] = new SelectBinding(this, name, model, path);
  }

  // TODO(rafaelw): We should polyfill a Microtask Promise and define it if it isn't.
  var ensureScheduled = function() {
    // We need to ping-pong between two Runners in order for the tests to
    // simulate proper end-of-microtask behavior for Object.observe. Without
    // this, we'll continue delivering to a single observer without allowing
    // other observers in the same microtask to make progress.

    function Runner(nextRunner) {
      this.nextRunner = nextRunner;
      this.value = false;
      this.lastValue = this.value;
      this.scheduled = [];
      this.scheduledIds = [];
      this.running = false;
      this.observer = new PathObserver(this, 'value', this.run, this);
    }

    Runner.prototype = {
      schedule: function(async, id) {
        if (this.scheduledIds[id])
          return;

        if (this.running)
          return this.nextRunner.schedule(async, id);

        this.scheduledIds[id] = true;
        this.scheduled.push(async);

        if (this.lastValue !== this.value)
          return;

        this.value = !this.value;
      },

      run: function() {
        this.running = true;

        for (var i = 0; i < this.scheduled.length; i++) {
          var async = this.scheduled[i];
          var id = async[idExpando];
          this.scheduledIds[id] = false;

          if (typeof async === 'function')
            async();
          else
            async.resolve();
        }

        this.scheduled = [];
        this.scheduledIds = [];
        this.lastValue = this.value;

        this.running = false;
      }
    }

    var runner = new Runner(new Runner());

    var nextId = 1;
    var idExpando = '__scheduledId__';

    function ensureScheduled(async) {
      var id = async[idExpando];
      if (!async[idExpando]) {
        id = nextId++;
        async[idExpando] = id;
      }

      runner.schedule(async, id);
    }

    return ensureScheduled;
  }();

})(this);

// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(global) {
  'use strict';

  function assert(v) {
    if (!v)
      throw new Error('Assertion failed');
  }

  var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

  function getTreeScope(node) {
    while (node.parentNode) {
      node = node.parentNode;
    }

    return typeof node.getElementById === 'function' ? node : null;
  }

  var Map;
  if (global.Map && typeof global.Map.prototype.forEach === 'function') {
    Map = global.Map;
  } else {
    Map = function() {
      this.keys = [];
      this.values = [];
    };

    Map.prototype = {
      set: function(key, value) {
        var index = this.keys.indexOf(key);
        if (index < 0) {
          this.keys.push(key);
          this.values.push(value);
        } else {
          this.values[index] = value;
        }
      },

      get: function(key) {
        var index = this.keys.indexOf(key);
        if (index < 0)
          return;

        return this.values[index];
      },

      delete: function(key, value) {
        var index = this.keys.indexOf(key);
        if (index < 0)
          return false;

        this.keys.splice(index, 1);
        this.values.splice(index, 1);
        return true;
      },

      forEach: function(f, opt_this) {
        for (var i = 0; i < this.keys.length; i++)
          f.call(opt_this || this, this.values[i], this.keys[i], this);
      }
    };
  }

  // JScript does not have __proto__. We wrap all object literals with
  // createObject which uses Object.create, Object.defineProperty and
  // Object.getOwnPropertyDescriptor to create a new object that does the exact
  // same thing. The main downside to this solution is that we have to extract
  // all those property descriptors for IE.
  var createObject = ('__proto__' in {}) ?
      function(obj) { return obj; } :
      function(obj) {
        var proto = obj.__proto__;
        if (!proto)
          return obj;
        var newObject = Object.create(proto);
        Object.getOwnPropertyNames(obj).forEach(function(name) {
          Object.defineProperty(newObject, name,
                               Object.getOwnPropertyDescriptor(obj, name));
        });
        return newObject;
      };

  // IE does not support have Document.prototype.contains.
  if (typeof document.contains != 'function') {
    Document.prototype.contains = function(node) {
      if (node === this || node.parentNode === this)
        return true;
      return this.documentElement.contains(node);
    }
  }

  var BIND = 'bind';
  var REPEAT = 'repeat';
  var IF = 'if';

  var templateAttributeDirectives = {
    'template': true,
    'repeat': true,
    'bind': true,
    'ref': true
  };

  var semanticTemplateElements = {
    'THEAD': true,
    'TBODY': true,
    'TFOOT': true,
    'TH': true,
    'TR': true,
    'TD': true,
    'COLGROUP': true,
    'COL': true,
    'CAPTION': true,
    'OPTION': true,
    'OPTGROUP': true
  };

  var hasTemplateElement = typeof HTMLTemplateElement !== 'undefined';

  var allTemplatesSelectors = 'template, ' +
      Object.keys(semanticTemplateElements).map(function(tagName) {
        return tagName.toLowerCase() + '[template]';
      }).join(', ');

  function isAttributeTemplate(el) {
    return semanticTemplateElements[el.tagName] &&
        el.hasAttribute('template');
  }

  function isTemplate(el) {
    return el.tagName == 'TEMPLATE' || isAttributeTemplate(el);
  }

  function isNativeTemplate(el) {
    return hasTemplateElement && el.tagName == 'TEMPLATE';
  }

  var ensureScheduled = function() {
    // We need to ping-pong between two Runners in order for the tests to
    // simulate proper end-of-microtask behavior for Object.observe. Without
    // this, we'll continue delivering to a single observer without allowing
    // other observers in the same microtask to make progress.

    function Runner(nextRunner) {
      this.nextRunner = nextRunner;
      this.value = false;
      this.lastValue = this.value;
      this.scheduled = [];
      this.scheduledIds = [];
      this.running = false;
      this.observer = new PathObserver(this, 'value', this.run, this);
    }

    Runner.prototype = {
      schedule: function(async, id) {
        if (this.scheduledIds[id])
          return;

        if (this.running)
          return this.nextRunner.schedule(async, id);

        this.scheduledIds[id] = true;
        this.scheduled.push(async);

        if (this.lastValue !== this.value)
          return;

        this.value = !this.value;
      },

      run: function() {
        this.running = true;

        for (var i = 0; i < this.scheduled.length; i++) {
          var async = this.scheduled[i];
          var id = async[idExpando];
          this.scheduledIds[id] = false;

          if (typeof async === 'function')
            async();
          else
            async.resolve();
        }

        this.scheduled = [];
        this.scheduledIds = [];
        this.lastValue = this.value;

        this.running = false;
      }
    }

    var runner = new Runner(new Runner());

    var nextId = 1;
    var idExpando = '__scheduledId__';

    function ensureScheduled(async) {
      var id = async[idExpando];
      if (!async[idExpando]) {
        id = nextId++;
        async[idExpando] = id;
      }

      runner.schedule(async, id);
    }

    return ensureScheduled;
  }();

  // FIXME: Observe templates being added/removed from documents
  // FIXME: Expose imperative API to decorate and observe templates in
  // "disconnected tress" (e.g. ShadowRoot)
  document.addEventListener('DOMContentLoaded', function(e) {
    bootstrapTemplatesRecursivelyFrom(document);
    // FIXME: Is this needed? Seems like it shouldn't be.
    Platform.performMicrotaskCheckpoint();
  }, false);

  function forAllTemplatesFrom(node, fn) {
    var subTemplates = node.querySelectorAll(allTemplatesSelectors);

    if (isTemplate(node))
      fn(node)
    forEach(subTemplates, fn);
  }

  function bootstrapTemplatesRecursivelyFrom(node) {
    function bootstrap(template) {
      if (!HTMLTemplateElement.decorate(template))
        bootstrapTemplatesRecursivelyFrom(template.content);
    }

    forAllTemplatesFrom(node, bootstrap);
  }

  if (!hasTemplateElement) {
    /**
     * This represents a <template> element.
     * @constructor
     * @extends {HTMLElement}
     */
    global.HTMLTemplateElement = function() {
      throw TypeError('Illegal constructor');
    };
  }

  var hasProto = '__proto__' in {};

  function mixin(to, from) {
    Object.getOwnPropertyNames(from).forEach(function(name) {
      Object.defineProperty(to, name,
                            Object.getOwnPropertyDescriptor(from, name));
    });
  }

  // http://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/templates/index.html#dfn-template-contents-owner
  function getTemplateContentsOwner(doc) {
    if (!doc.defaultView)
      return doc;
    var d = doc.templateContentsOwner_;
    if (!d) {
      // TODO(arv): This should either be a Document or HTMLDocument depending
      // on doc.
      d = doc.implementation.createHTMLDocument('');
      while (d.lastChild) {
        d.removeChild(d.lastChild);
      }
      doc.templateContentsOwner_ = d;
    }
    return d;
  }

  // For non-template browsers, the parser will disallow <template> in certain
  // locations, so we allow "attribute templates" which combine the template
  // element with the top-level container node of the content, e.g.
  //
  //   <tr template repeat="{{ foo }}"" class="bar"><td>Bar</td></tr>
  //
  // becomes
  //
  //   <template repeat="{{ foo }}">
  //   + #document-fragment
  //     + <tr class="bar">
  //       + <td>Bar</td>
  //
  function extractTemplateFromAttributeTemplate(el) {
    var template = el.ownerDocument.createElement('template');
    el.parentNode.insertBefore(template, el);

    var attribs = el.attributes;
    var count = attribs.length;
    while (count-- > 0) {
      var attrib = attribs[count];
      if (templateAttributeDirectives[attrib.name]) {
        if (attrib.name !== 'template')
          template.setAttribute(attrib.name, attrib.value);
        el.removeAttribute(attrib.name);
      }
    }

    return template;
  }

  function liftNonNativeTemplateChildrenIntoContent(template, el, useRoot) {
    var content = template.content;
    if (useRoot) {
      content.appendChild(el);
      return;
    }

    var child;
    while (child = el.firstChild) {
      content.appendChild(child);
    }
  }

  /**
   * Ensures proper API and content model for template elements.
   * @param {HTMLTemplateElement} opt_instanceRef The template element which
   *     |el| template element will return as the value of its ref(), and whose
   *     content will be used as source when createInstance() is invoked.
   */
  HTMLTemplateElement.decorate = function(el, opt_instanceRef) {
    if (el.templateIsDecorated_)
      return false;

    var templateElement = el;
    templateElement.templateIsDecorated_ = true;

    var isNative = isNativeTemplate(templateElement);
    var bootstrapContents = isNative;
    var liftContents = !isNative;
    var liftRoot = false;

    if (!isNative && isAttributeTemplate(templateElement)) {
      assert(!opt_instanceRef);
      templateElement = extractTemplateFromAttributeTemplate(el);
      templateElement.templateIsDecorated_ = true;

      isNative = isNativeTemplate(templateElement);
      liftRoot = true;
    }

    if (!isNative) {
      fixTemplateElementPrototype(templateElement);
      var doc = getTemplateContentsOwner(templateElement.ownerDocument);
      templateElement.content_ = doc.createDocumentFragment();
    }

    if (opt_instanceRef) {
      // template is contained within an instance, its direct content must be
      // empty
      templateElement.instanceRef_ = opt_instanceRef;
    } else if (liftContents) {
      liftNonNativeTemplateChildrenIntoContent(templateElement,
                                               el,
                                               liftRoot);
    } else if (bootstrapContents) {
      bootstrapTemplatesRecursivelyFrom(templateElement.content);
    }

    return true;
  };

  // TODO(rafaelw): This used to decorate recursively all templates from a given
  // node. This happens by default on 'DOMContentLoaded', but may be needed
  // in subtrees not descendent from document (e.g. ShadowRoot).
  // Review whether this is the right public API.
  HTMLTemplateElement.bootstrap = bootstrapTemplatesRecursivelyFrom;

  var htmlElement = global.HTMLUnknownElement || HTMLElement;

  var contentDescriptor = {
    get: function() {
      return this.content_;
    },
    enumerable: true,
    configurable: true
  };

  if (!hasTemplateElement) {
    // Gecko is more picky with the prototype than WebKit. Make sure to use the
    // same prototype as created in the constructor.
    HTMLTemplateElement.prototype = Object.create(htmlElement.prototype);

    Object.defineProperty(HTMLTemplateElement.prototype, 'content',
                          contentDescriptor);
  }

  function fixTemplateElementPrototype(el) {
    // Note: because we need to treat some semantic elements as template
    // elements (like tr or td), but don't want to reassign their proto (gecko
    // doesn't like that), we mixin the properties for those elements.
    if (el.tagName === 'TEMPLATE') {
      if (!hasTemplateElement) {
        if (hasProto)
          el.__proto__ = HTMLTemplateElement.prototype;
        else
          mixin(el, HTMLTemplateElement.prototype);
      }
    } else {
      mixin(el, HTMLTemplateElement.prototype);
      // FIXME: Won't need this when webkit methods move to the prototype.
      Object.defineProperty(el, 'content', contentDescriptor);
    }
  }

  function ensureSetModelScheduled(template) {
    if (!template.setModelFn_) {
      template.setModelFn_ = function() {
        addBindings(template, template.model, template.bindingDelegate);
      };
    }

    ensureScheduled(template.setModelFn_);
  }

  mixin(HTMLTemplateElement.prototype, {
    bind: function(name, model, path) {
      if (!this.iterator_)
        this.iterator_ = new TemplateIterator(this);

      this.bindings = this.bindings || {};
      if (name === 'bind') {
        this.iterator_.hasBind = true;
        this.iterator_.bindModel = model;
        this.iterator_.bindPath = path;
        if (!this.iterator_.depsChanging) {
          this.iterator_.depsChanging = true;
          ensureScheduled(this.iterator_);
        }

        return this.bindings.bind = this.iterator_;
      }

      if (name === 'repeat') {
        this.iterator_.hasRepeat = true;
        this.iterator_.repeatModel = model;
        this.iterator_.repeatPath = path;
        if (!this.iterator_.depsChanging) {
          this.iterator_.depsChanging = true;
          ensureScheduled(this.iterator_);
        }
        return this.bindings.repeat = this.iterator_;
      }

      if (name === 'if') {
        this.iterator_.hasIf = true;
        this.iterator_.ifModel = model;
        this.iterator_.ifPath = path;
        if (!this.iterator_.depsChanging) {
          this.iterator_.depsChanging = true;
          ensureScheduled(this.iterator_);
        }
        return this.bindings.if = this.iterator_;
      }

      return HTMLElement.prototype.bind.call(this, name, model, path);
    },

    unbind: function(name) {
      if (name === 'bind') {
        if (!this.iterator_)
          return;

        this.iterator_.hasBind = false;
        this.iterator_.bindModel = undefined;
        this.iterator_.bindPath = undefined;
        if (!this.iterator_.depsChanging) {
          this.iterator_.depsChanging = true;
          ensureScheduled(this.iterator_);
        }

        return this.bindings.bind = undefined;
      }

      if (name === 'repeat') {
        if (!this.iterator_)
          return;
        this.iterator_.hasRepeat = false;
        this.iterator_.repeatModel = undefined;
        this.iterator_.repeatPath = undefined;
        if (!this.iterator_.depsChanging) {
          this.iterator_.depsChanging = true;
          ensureScheduled(this.iterator_);
        }
        return this.bindings.repeat = undefined;
      }

      if (name === 'if') {
        if (!this.iterator_)
          return;
        this.iterator_.hasIf = false;
        this.iterator_.ifModel = undefined;
        this.iterator_.ifPath = undefined;
        if (!this.iterator_.depsChanging) {
          this.iterator_.depsChanging = true;
          ensureScheduled(this.iterator_);
        }
        return this.bindings.if = undefined;
      }

      return HTMLElement.prototype.unbind.call(this, name);
    },

    createInstance: function(model, delegate, bound) {
      var content = this.ref.content;
      var map = content.bindingMap_;
      if (!map) {
        var delegatePrepareBindingFn =
            delegate && typeof delegate.prepareBinding === 'function' ?
            delegate.prepareBinding : undefined;
        // TODO(rafaelw): Setup a MutationObserver on content to detect
        // when the instanceMap is invalid.
        map = createInstanceBindingMap(content, delegatePrepareBindingFn) || [];
        content.bindingMap_ = map;
      }

      var instance = map.hasSubTemplate ?
          deepCloneIgnoreTemplateContent(content) : content.cloneNode(true);

      addMapBindings(instance, map, model, delegate, bound);
      // TODO(rafaelw): We can do this more lazily, but setting a sentinel
      // in the parent of the template element, and creating it when it's
      // asked for by walking back to find the iterating template.
      addTemplateInstanceRecord(instance, model);
      return instance;
    },

    get model() {
      return this.model_;
    },

    set model(model) {
      this.model_ = model;
      ensureSetModelScheduled(this);
    },

    get bindingDelegate() {
      return this.bindingDelegate_;
    },

    set bindingDelegate(bindingDelegate) {
      this.bindingDelegate_ = bindingDelegate;
      ensureSetModelScheduled(this);
    },

    get ref() {
      var ref;
      var refId = this.getAttribute('ref');
      if (refId) {
        var treeScope = getTreeScope(this);
        if (treeScope)
          ref = treeScope.getElementById(refId);
      }

      if (!ref)
        ref = this.instanceRef_;

      if (!ref)
        return this;

      var nextRef = ref.ref;
      return nextRef ? nextRef : ref;
    }
  });

  // Returns
  //   a) undefined if there are no mustaches.
  //   b) [TEXT, (PATH, DELEGATE_FN, TEXT)+] if there is at least one mustache.
  function parseMustaches(s, name, node, delegatePrepareBindingFn) {
    if (!s || !s.length)
      return;

    var tokens;
    var length = s.length;
    var startIndex = 0, lastIndex = 0, endIndex = 0;
    while (lastIndex < length) {
      startIndex = s.indexOf('{{', lastIndex);
      endIndex = startIndex < 0 ? -1 : s.indexOf('}}', startIndex + 2);

      if (endIndex < 0) {
        if (!tokens)
          return;

        tokens.push(s.slice(lastIndex)); // TEXT
        break;
      }

      tokens = tokens || [];
      tokens.push(s.slice(lastIndex, startIndex)); // TEXT
      var pathString = s.slice(startIndex + 2, endIndex).trim();
      tokens.push(Path.get(pathString)); // PATH
      var delegateFn = delegatePrepareBindingFn &&
                       delegatePrepareBindingFn(pathString, name, node)
      tokens.push(delegateFn); // DELEGATE_FN
      lastIndex = endIndex + 2;
    }

    if (lastIndex === length)
      tokens.push(''); // TEXT

    tokens.hasOnePath = tokens.length === 4;
    tokens.isSimplePath = tokens.hasOnePath &&
                          tokens[0] == '' &&
                          tokens[3] == '';

    tokens.combinator = function(values) {
      var newValue = tokens[0];

      for (var i = 1; i < tokens.length; i += 3) {
        var value = tokens.hasOnePath ? values : values[(i - 1) / 3];
        if (value !== undefined)
          newValue += value;
        newValue += tokens[i + 2];
      }

      return newValue;
    }

    return tokens;
  }

  var valuePath = Path.get('value');

  function processBindings(bindings, node, model, bound) {
    for (var i = 0; i < bindings.length; i += 2) {
      var name = bindings[i];
      var tokens = bindings[i + 1];
      var bindingModel = model;
      var bindingPath = tokens[1];
      if (tokens.hasOnePath) {
        var delegateFn = tokens[2];
        var delegateBinding = delegateFn && delegateFn(model, name, node);

        if (delegateBinding !== undefined) {
          bindingModel = delegateBinding;
          bindingPath = valuePath;
        }

        if (!tokens.isSimplePath) {
          bindingModel = new PathObserver(bindingModel, bindingPath, undefined,
                                          undefined,
                                          undefined,
                                          tokens.combinator);
          bindingPath = valuePath;
        }
      } else {
        var observer = new CompoundPathObserver(undefined,
                                                undefined,
                                                undefined,
                                                tokens.combinator);

        for (var j = 1; j < tokens.length; j += 3) {
          var subModel = model;
          var subPath = tokens[j];
          var delegateFn = tokens[j + 1];
          var delegateBinding = delegateFn && delegateFn(subModel, name, node);

          if (delegateBinding !== undefined) {
            subModel = delegateBinding;
            subPath = valuePath;
          }

          observer.addPath(subModel, subPath);
        }

        observer.start();
        bindingModel = observer;
        bindingPath = valuePath;
      }

      var binding = node.bind(name, bindingModel, bindingPath);
      if (bound)
        bound.push(binding);
    }
  }

  function parseAttributeBindings(element, delegatePrepareBindingFn) {
    assert(element);

    var bindings;
    var isTemplateNode = isTemplate(element);
    var ifFound = false;
    var bindFound = false;

    for (var i = 0; i < element.attributes.length; i++) {
      var attr = element.attributes[i];
      var name = attr.name;
      var value = attr.value;

      if (isTemplateNode) {
        if (name === IF) {
          ifFound = true;
          value = value || '{{}}';  // Accept 'naked' if.
        } else if (name === BIND || name === REPEAT) {
          bindFound = true;
          value = value || '{{}}';  // Accept 'naked' bind & repeat.
        }
      }

      var tokens = parseMustaches(value, name, element,
                                  delegatePrepareBindingFn);
      if (!tokens)
        continue;

      bindings = bindings || [];
      bindings.push(name, tokens);
    }

    // Treat <template if> as <template bind if>
    if (ifFound && !bindFound) {
      bindings = bindings || [];
      bindings.push(BIND, parseMustaches('{{}}', BIND, element,
                                         delegatePrepareBindingFn));
    }

    return bindings;
  }

  function getBindings(node, delegatePrepareBindingFn) {
    if (node.nodeType === Node.ELEMENT_NODE)
      return parseAttributeBindings(node, delegatePrepareBindingFn);

    if (node.nodeType === Node.TEXT_NODE) {
      var tokens = parseMustaches(node.data, 'textContent', node,
                                  delegatePrepareBindingFn);
      if (tokens)
        return ['textContent', tokens];
    }
  }

  function addMapBindings(node, bindings, model, delegate, bound) {
    if (!bindings)
      return;

    if (bindings.templateRef) {
      HTMLTemplateElement.decorate(node, bindings.templateRef);
      if (delegate) {
        node.bindingDelegate_ = delegate;
      }
    }

    if (bindings.length)
      processBindings(bindings, node, model, bound);

    if (!bindings.children)
      return;

    var i = 0;
    for (var child = node.firstChild; child; child = child.nextSibling) {
      addMapBindings(child, bindings.children[i++], model, delegate, bound);
    }
  }

  function addBindings(node, model, delegate) {
    assert(node);

    var delegatePrepareBindingFn =
        delegate && typeof delegate.prepareBinding === 'function' ?
        delegate.prepareBinding : undefined;

    var bindings = getBindings(node, delegatePrepareBindingFn);
    if (bindings)
      processBindings(bindings, node, model);

    for (var child = node.firstChild; child ; child = child.nextSibling)
      addBindings(child, model, delegate);
  }

  function deepCloneIgnoreTemplateContent(node, delegate) {
    var clone = node.cloneNode(false);
    if (node.isTemplate_) {
      return clone;
    }

    for (var child = node.firstChild; child; child = child.nextSibling) {
      clone.appendChild(deepCloneIgnoreTemplateContent(child, delegate))
    }

    return clone;
  }

  function createInstanceBindingMap(node, delegatePrepareBindingFn) {
    var map = getBindings(node, delegatePrepareBindingFn);
    if (isTemplate(node)) {
      node.isTemplate_ = true;
      map = map || [];
      map.templateRef = node;
      map.hasSubTemplate = true;
    }

    var child = node.firstChild, index = 0;
    for (; child; child = child.nextSibling, index++) {
      var childMap = createInstanceBindingMap(child, delegatePrepareBindingFn);
      if (!childMap)
        continue;

      map = map || [];
      map.children = map.children || {};
      map.children[index] = childMap;
      if (childMap.hasSubTemplate)
        map.hasSubTemplate = true;
    }

    return map;
  }

  function TemplateInstance(firstNode, lastNode, model) {
    // TODO(rafaelw): firstNode & lastNode should be read-synchronous
    // in cases where script has modified the template instance boundary.
    // All should be read-only.
    this.firstNode = firstNode;
    this.lastNode = lastNode;
    this.model = model;
  }

  function addTemplateInstanceRecord(fragment, model) {
    if (!fragment.firstChild)
      return;

    var instanceRecord = new TemplateInstance(fragment.firstChild,
                                              fragment.lastChild, model);
    var node = instanceRecord.firstNode;
    while (node) {
      node.templateInstance_ = instanceRecord;
      node = node.nextSibling;
    }
  }

  Object.defineProperty(Node.prototype, 'templateInstance', {
    get: function() {
      var instance = this.templateInstance_;
      return instance ? instance :
          (this.parentNode ? this.parentNode.templateInstance : undefined);
    }
  });

  function TemplateIterator(templateElement) {
    this.closed = false;
    this.templateElement_ = templateElement;

    // Flattened array of tuples:
    //   <instanceTerminatorNode, [bindingsSetupByInstance]>
    this.terminators = [];

    this.iteratedValue = undefined;
    this.arrayObserver = undefined;

    this.depsChanged = false;
    this.hasRepeat = false;
    this.repeatModel = undefined;
    this.repeatPath = undefined;
    this.hasBind = false;
    this.bindModel = undefined;
    this.bindPath = undefined;
    this.hasIf = false;
    this.ifModel = undefined;
    this.ifPath = undefined;
  }

  TemplateIterator.prototype = {
    resolve: function() {
      this.depsChanging = false;
      if (this.valueObserver) {
        this.valueObserver.close();
        this.valueObserver = undefined;
      }

      if (!this.hasRepeat && !this.hasBind) {
        this.valueChanged();
        return;
      }

      var isRepeat = this.hasRepeat === true;
      var model = isRepeat ? this.repeatModel : this.bindModel;
      var path = isRepeat ? this.repeatPath : this.bindPath;

      if (!this.hasIf) {
        var valueFn = this.hasRepeat ? undefined : function(value) {
          return [value];
        };

        this.valueObserver = new PathObserver(model,
                                              path,
                                              this.valueChanged,
                                              this,
                                              undefined,
                                              valueFn);
      } else {
        var valueFn = function(values) {
          var modelValue = values[0];
          var ifValue = values[1]
          if (!ifValue)
            return;
          return isRepeat ? modelValue : [ modelValue ];
        };

        this.valueObserver = new CompoundPathObserver(this.valueChanged,
                                                      this,
                                                      undefined,
                                                      valueFn);

        this.valueObserver.addPath(model, path);
        this.valueObserver.addPath(this.ifModel, this.ifPath);
        this.valueObserver.start();
      }

      this.valueChanged(this.valueObserver.value);
    },

    valueChanged: function(value) {
      if (!Array.isArray(value))
        value = undefined;

      var oldValue = this.iteratedValue;
      this.unobserve();
      this.iteratedValue = value;

      if (this.iteratedValue) {
        this.arrayObserver =
            new ArrayObserver(this.iteratedValue, this.handleSplices, this);
      }

      var splices = ArrayObserver.calculateSplices(this.iteratedValue || [],
                                                   oldValue || []);

      if (splices.length)
        this.handleSplices(splices);
    },

    getTerminatorAt: function(index) {
      if (index == -1)
        return this.templateElement_;
      var terminator = this.terminators[index*2];
      if (terminator.nodeType !== Node.ELEMENT_NODE ||
          this.templateElement_ === terminator) {
        return terminator;
      }

      var subIterator = terminator.iterator_;
      if (!subIterator)
        return terminator;

      return subIterator.getTerminatorAt(subIterator.terminators.length/2 - 1);
    },

    // TODO(rafaelw): If we inserting sequences of instances we can probably
    // avoid lots of calls to getTerminatorAt(), or cache its result.
    insertInstanceAt: function(index, fragment, instanceNodes, bound) {
      var previousTerminator = this.getTerminatorAt(index - 1);
      var terminator = previousTerminator;
      if (fragment)
        terminator = fragment.lastChild || terminator;
      else if (instanceNodes)
        terminator = instanceNodes[instanceNodes.length - 1] || terminator;

      this.terminators.splice(index*2, 0, terminator, bound);
      var parent = this.templateElement_.parentNode;
      var insertBeforeNode = previousTerminator.nextSibling;

      if (fragment) {
        parent.insertBefore(fragment, insertBeforeNode);
      } else if (instanceNodes) {
        for (var i = 0; i < instanceNodes.length; i++)
          parent.insertBefore(instanceNodes[i], insertBeforeNode);
      }
    },

    extractInstanceAt: function(index) {
      var instanceNodes = [];
      var previousTerminator = this.getTerminatorAt(index - 1);
      var terminator = this.getTerminatorAt(index);
      instanceNodes.bound = this.terminators[index*2 + 1];
      this.terminators.splice(index*2, 2);

      var parent = this.templateElement_.parentNode;
      while (terminator !== previousTerminator) {
        var node = previousTerminator.nextSibling;
        if (node == terminator)
          terminator = previousTerminator;

        parent.removeChild(node);
        instanceNodes.push(node);
      }

      return instanceNodes;
    },

    handleSplices: function(splices) {
      if (this.closed)
        return;

      var template = this.templateElement_;
      if (!template.parentNode || !template.ownerDocument.defaultView) {
        this.close();
        return;
      }

      if (this.instanceModelFn_ === undefined) {
        var delegate = template.bindingDelegate;
        if (delegate && typeof delegate.prepareInstanceModel === 'function')
          this.instanceModelFn_ = delegate.prepareInstanceModel(template);
        if (typeof this.instanceModelFn_ !== 'function')
          this.instanceModelFn_ = false;
      }

      var instanceCache = new Map;
      var removeDelta = 0;
      splices.forEach(function(splice) {
        splice.removed.forEach(function(model) {
          var instanceNodes =
              this.extractInstanceAt(splice.index + removeDelta);
          instanceCache.set(model, instanceNodes);
        }, this);

        removeDelta -= splice.addedCount;
      }, this);

      splices.forEach(function(splice) {
        var addIndex = splice.index;
        for (; addIndex < splice.index + splice.addedCount; addIndex++) {
          var model = this.iteratedValue[addIndex];
          var fragment = undefined;
          var instanceNodes = instanceCache.get(model);
          var bound;
          if (instanceNodes) {
            instanceCache.delete(model);
            bound = instanceNodes.bound;
          } else {
            bound = [];
            if (this.instanceModelFn_)
              model = this.instanceModelFn_(model);

            if (model !== undefined) {
              fragment = this.templateElement_.createInstance(model,
                                                              delegate,
                                                              bound);
            }
          }

          this.insertInstanceAt(addIndex, fragment, instanceNodes, bound);
        }
      }, this);

      instanceCache.forEach(function(instanceNodes) {
        this.closeInstanceBindings(instanceNodes.bound);
      }, this);
    },

    closeInstanceBindings: function(bound) {
      for (var i = 0; i < bound.length; i++) {
        bound[i].close();
      }
    },

    unobserve: function() {
      if (!this.arrayObserver)
        return;

      this.arrayObserver.close();
      this.arrayObserver = undefined;
    },

    close: function() {
      if (this.closed)
        return;
      this.unobserve();
      for (var i = 1; i < this.terminators.length; i += 2) {
        this.closeInstanceBindings(this.terminators[i]);
      }

      this.terminators.length = 0;
      if (this.valueObserver)
        this.valueObserver.close();
      this.valueObserver = undefined;
      this.templateElement_.iterator_ = undefined;
      this.closed = true;
    }
  };

  // Polyfill-specific API.
  HTMLTemplateElement.forAllTemplatesFrom_ = forAllTemplatesFrom;
})(this);

/*
  Copyright (C) 2013 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2013 Thaddee Tyl <thaddee.tyl@gmail.com>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

(function (global) {
    'use strict';

    var Token,
        TokenName,
        Syntax,
        Messages,
        source,
        index,
        length,
        delegate,
        lookahead,
        state;

    Token = {
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8
    };

    TokenName = {};
    TokenName[Token.BooleanLiteral] = 'Boolean';
    TokenName[Token.EOF] = '<end>';
    TokenName[Token.Identifier] = 'Identifier';
    TokenName[Token.Keyword] = 'Keyword';
    TokenName[Token.NullLiteral] = 'Null';
    TokenName[Token.NumericLiteral] = 'Numeric';
    TokenName[Token.Punctuator] = 'Punctuator';
    TokenName[Token.StringLiteral] = 'String';

    Syntax = {
        ArrayExpression: 'ArrayExpression',
        BinaryExpression: 'BinaryExpression',
        CallExpression: 'CallExpression',
        ConditionalExpression: 'ConditionalExpression',
        EmptyStatement: 'EmptyStatement',
        ExpressionStatement: 'ExpressionStatement',
        Identifier: 'Identifier',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        ObjectExpression: 'ObjectExpression',
        Program: 'Program',
        Property: 'Property',
        ThisExpression: 'ThisExpression',
        UnaryExpression: 'UnaryExpression'
    };

    // Error messages should be identical to V8.
    Messages = {
        UnexpectedToken:  'Unexpected token %0',
        UnknownLabel: 'Undefined label \'%0\'',
        Redeclaration: '%0 \'%1\' has already been declared'
    };

    // Ensure the condition is true, otherwise throw an error.
    // This is only to have a better contract semantic, i.e. another safety net
    // to catch a logic error. The condition shall be fulfilled in normal case.
    // Do NOT use this to enforce a certain condition on any user input.

    function assert(condition, message) {
        if (!condition) {
            throw new Error('ASSERT: ' + message);
        }
    }

    function isDecimalDigit(ch) {
        return (ch >= 48 && ch <= 57);   // 0..9
    }


    // 7.2 White Space

    function isWhiteSpace(ch) {
        return (ch === 32) ||  // space
            (ch === 9) ||      // tab
            (ch === 0xB) ||
            (ch === 0xC) ||
            (ch === 0xA0) ||
            (ch >= 0x1680 && '\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF'.indexOf(String.fromCharCode(ch)) > 0);
    }

    // 7.3 Line Terminators

    function isLineTerminator(ch) {
        return (ch === 10) || (ch === 13) || (ch === 0x2028) || (ch === 0x2029);
    }

    // 7.6 Identifier Names and Identifiers

    function isIdentifierStart(ch) {
        return (ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
            (ch >= 65 && ch <= 90) ||         // A..Z
            (ch >= 97 && ch <= 122);          // a..z
    }

    function isIdentifierPart(ch) {
        return (ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
            (ch >= 65 && ch <= 90) ||         // A..Z
            (ch >= 97 && ch <= 122) ||        // a..z
            (ch >= 48 && ch <= 57);           // 0..9
    }

    // 7.6.1.1 Keywords

    function isKeyword(id) {
        return (id === 'this')
    }

    // 7.4 Comments

    function skipWhitespace() {
        while (index < length && isWhiteSpace(source.charCodeAt(index))) {
           ++index;
        }
    }

    function getIdentifier() {
        var start, ch;

        start = index++;
        while (index < length) {
            ch = source.charCodeAt(index);
            if (isIdentifierPart(ch)) {
                ++index;
            } else {
                break;
            }
        }

        return source.slice(start, index);
    }

    function scanIdentifier() {
        var start, id, type;

        start = index;

        id = getIdentifier();

        // There is no keyword or literal with only one character.
        // Thus, it must be an identifier.
        if (id.length === 1) {
            type = Token.Identifier;
        } else if (isKeyword(id)) {
            type = Token.Keyword;
        } else if (id === 'null') {
            type = Token.NullLiteral;
        } else if (id === 'true' || id === 'false') {
            type = Token.BooleanLiteral;
        } else {
            type = Token.Identifier;
        }

        return {
            type: type,
            value: id,
            range: [start, index]
        };
    }


    // 7.7 Punctuators

    function scanPunctuator() {
        var start = index,
            code = source.charCodeAt(index),
            code2,
            ch1 = source[index],
            ch2;

        switch (code) {

        // Check for most common single-character punctuators.
        case 46:   // . dot
        case 40:   // ( open bracket
        case 41:   // ) close bracket
        case 59:   // ; semicolon
        case 44:   // , comma
        case 123:  // { open curly brace
        case 125:  // } close curly brace
        case 91:   // [
        case 93:   // ]
        case 58:   // :
        case 63:   // ?
        case 126:  // ~
            ++index;
            return {
                type: Token.Punctuator,
                value: String.fromCharCode(code),
                range: [start, index]
            };

        default:
            code2 = source.charCodeAt(index + 1);

            // '=' (char #61) marks an assignment or comparison operator.
            if (code2 === 61) {
                switch (code) {
                case 37:  // %
                case 38:  // &
                case 42:  // *:
                case 43:  // +
                case 45:  // -
                case 47:  // /
                case 60:  // <
                case 62:  // >
                // Binary operators are not supported.
                // case 94:  // ^
                case 124: // |
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: String.fromCharCode(code) + String.fromCharCode(code2),
                        range: [start, index]
                    };

                case 33: // !
                case 61: // =
                    index += 2;

                    // !== and ===
                    if (source.charCodeAt(index) === 61) {
                        ++index;
                    }
                    return {
                        type: Token.Punctuator,
                        value: source.slice(start, index),
                        range: [start, index]
                    };
                default:
                    break;
                }
            }
            break;
        }

        // Peek more characters.

        ch2 = source[index + 1];

        // Other 2-character punctuators: && ||

        if (ch1 === ch2 && ('&|'.indexOf(ch1) >= 0)) {
            index += 2;
            return {
                type: Token.Punctuator,
                value: ch1 + ch2,
                range: [start, index]
            };
        }

        if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                range: [start, index]
            };
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    // 7.8.3 Numeric Literals
    function scanNumericLiteral() {
        var number, start, ch;

        ch = source[index];
        assert(isDecimalDigit(ch.charCodeAt(0)) || (ch === '.'),
            'Numeric literal must start with a decimal digit or a decimal point');

        start = index;
        number = '';
        if (ch !== '.') {
            number = source[index++];
            ch = source[index];

            // Hex number starts with '0x'.
            // Octal number starts with '0'.
            if (number === '0') {
                // decimal number starts with '0' such as '09' is illegal.
                if (ch && isDecimalDigit(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === '.') {
            number += source[index++];
            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === 'e' || ch === 'E') {
            number += source[index++];

            ch = source[index];
            if (ch === '+' || ch === '-') {
                number += source[index++];
            }
            if (isDecimalDigit(source.charCodeAt(index))) {
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++];
                }
            } else {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            range: [start, index]
        };
    }

    // 7.8.4 String Literals

    function scanStringLiteral() {
        var str = '', quote, start, ch, octal = false;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        while (index < length) {
            ch = source[index++];

            if (ch === quote) {
                quote = '';
                break;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case 'n':
                        str += '\n';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'b':
                        str += '\b';
                        break;
                    case 'f':
                        str += '\f';
                        break;
                    case 'v':
                        str += '\x0B';
                        break;

                    default:
                        str += ch;
                        break;
                    }
                } else {
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                break;
            } else {
                str += ch;
            }
        }

        if (quote !== '') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            range: [start, index]
        };
    }

    function isIdentifierName(token) {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.NullLiteral;
    }

    function advance() {
        var ch;

        skipWhitespace();

        if (index >= length) {
            return {
                type: Token.EOF,
                range: [index, index]
            };
        }

        ch = source.charCodeAt(index);

        // Very common: ( and ) and ;
        if (ch === 40 || ch === 41 || ch === 58) {
            return scanPunctuator();
        }

        // String literal starts with single quote (#39) or double quote (#34).
        if (ch === 39 || ch === 34) {
            return scanStringLiteral();
        }

        if (isIdentifierStart(ch)) {
            return scanIdentifier();
        }

        // Dot (.) char #46 can also start a floating-point number, hence the need
        // to check the next character.
        if (ch === 46) {
            if (isDecimalDigit(source.charCodeAt(index + 1))) {
                return scanNumericLiteral();
            }
            return scanPunctuator();
        }

        if (isDecimalDigit(ch)) {
            return scanNumericLiteral();
        }

        return scanPunctuator();
    }

    function lex() {
        var token;

        token = lookahead;
        index = token.range[1];

        lookahead = advance();

        index = token.range[1];

        return token;
    }

    function peek() {
        var pos;

        pos = index;
        lookahead = advance();
        index = pos;
    }

    // Throw an exception

    function throwError(token, messageFormat) {
        var error,
            args = Array.prototype.slice.call(arguments, 2),
            msg = messageFormat.replace(
                /%(\d)/g,
                function (whole, index) {
                    assert(index < args.length, 'Message reference must be in range');
                    return args[index];
                }
            );

        error = new Error(msg);
        error.index = index;
        error.description = msg;
        throw error;
    }

    // Throw an exception because of the token.

    function throwUnexpected(token) {
        throwError(token, Messages.UnexpectedToken, token.value);
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token);
        }
    }

    // Return true if the next token matches the specified punctuator.

    function match(value) {
        return lookahead.type === Token.Punctuator && lookahead.value === value;
    }

    // Return true if the next token matches the specified keyword

    function matchKeyword(keyword) {
        return lookahead.type === Token.Keyword && lookahead.value === keyword;
    }

    function consumeSemicolon() {
        // Catch the very common case first: immediately a semicolon (char #59).
        if (source.charCodeAt(index) === 59) {
            lex();
            return;
        }

        skipWhitespace();

        if (match(';')) {
            lex();
            return;
        }

        if (lookahead.type !== Token.EOF && !match('}')) {
            throwUnexpected(lookahead);
        }
    }

    // 11.1.4 Array Initialiser

    function parseArrayInitialiser() {
        var elements = [];

        expect('[');

        while (!match(']')) {
            if (match(',')) {
                lex();
                elements.push(null);
            } else {
                elements.push(parseExpression());

                if (!match(']')) {
                    expect(',');
                }
            }
        }

        expect(']');

        return delegate.createArrayExpression(elements);
    }

    // 11.1.5 Object Initialiser

    function parseObjectPropertyKey() {
        var token;

        skipWhitespace();
        token = lex();

        // Note: This function is called only from parseObjectProperty(), where
        // EOF and Punctuator tokens are already filtered out.
        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            return delegate.createLiteral(token);
        }

        return delegate.createIdentifier(token.value);
    }

    function parseObjectProperty() {
        var token, key;

        token = lookahead;
        skipWhitespace();

        if (token.type === Token.EOF || token.type === Token.Punctuator) {
            throwUnexpected(token);
        }

        key = parseObjectPropertyKey();
        expect(':');
        return delegate.createProperty('init', key, parseExpression());
    }

    function parseObjectInitialiser() {
        var properties = [];

        expect('{');

        while (!match('}')) {
            properties.push(parseObjectProperty());

            if (!match('}')) {
                expect(',');
            }
        }

        expect('}');

        return delegate.createObjectExpression(properties);
    }

    // 11.1.6 The Grouping Operator

    function parseGroupExpression() {
        var expr;

        expect('(');

        expr = parseExpression();

        expect(')');

        return expr;
    }


    // 11.1 Primary Expressions

    function parsePrimaryExpression() {
        var type, token, expr;

        if (match('(')) {
            return parseGroupExpression();
        }

        type = lookahead.type;

        if (type === Token.Identifier) {
            expr = delegate.createIdentifier(lex().value);
        } else if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            expr = delegate.createLiteral(lex());
        } else if (type === Token.Keyword) {
            if (matchKeyword('this')) {
                lex();
                expr = delegate.createThisExpression();
            }
        } else if (type === Token.BooleanLiteral) {
            token = lex();
            token.value = (token.value === 'true');
            expr = delegate.createLiteral(token);
        } else if (type === Token.NullLiteral) {
            token = lex();
            token.value = null;
            expr = delegate.createLiteral(token);
        } else if (match('[')) {
            expr = parseArrayInitialiser();
        } else if (match('{')) {
            expr = parseObjectInitialiser();
        }

        if (expr) {
            return expr;
        }

        throwUnexpected(lex());
    }

    // 11.2 Left-Hand-Side Expressions

    function parseArguments() {
        var args = [];

        expect('(');

        if (!match(')')) {
            while (index < length) {
                args.push(parseExpression());
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return args;
    }

    function parseNonComputedProperty() {
        var token;

        token = lex();

        if (!isIdentifierName(token)) {
            throwUnexpected(token);
        }

        return delegate.createIdentifier(token.value);
    }

    function parseNonComputedMember() {
        expect('.');

        return parseNonComputedProperty();
    }

    function parseComputedMember() {
        var expr;

        expect('[');

        expr = parseExpression();

        expect(']');

        return expr;
    }

    function parseLeftHandSideExpression() {
        var expr, property;

        expr = parsePrimaryExpression();

        while (match('.') || match('[')) {
            if (match('[')) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression('[', expr, property);
            } else {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression('.', expr, property);
            }
        }

        return expr;
    }

    // 11.3 Postfix Expressions

    var parsePostfixExpression = parseLeftHandSideExpression;

    // 11.4 Unary Operators

    function parseUnaryExpression() {
        var token, expr;

        if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
            expr = parsePostfixExpression();
        } else if (match('+') || match('-') || match('!')) {
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr);
        } else if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            throwError({}, Messages.UnexpectedToken);
        } else {
            expr = parsePostfixExpression();
        }

        return expr;
    }

    function binaryPrecedence(token) {
        var prec = 0;

        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return 0;
        }

        switch (token.value) {
        case '||':
            prec = 1;
            break;

        case '&&':
            prec = 2;
            break;

        case '==':
        case '!=':
        case '===':
        case '!==':
            prec = 6;
            break;

        case '<':
        case '>':
        case '<=':
        case '>=':
        case 'instanceof':
            prec = 7;
            break;

        case 'in':
            prec = 7;
            break;

        case '+':
        case '-':
            prec = 9;
            break;

        case '*':
        case '/':
        case '%':
            prec = 11;
            break;

        default:
            break;
        }

        return prec;
    }

    // 11.5 Multiplicative Operators
    // 11.6 Additive Operators
    // 11.7 Bitwise Shift Operators
    // 11.8 Relational Operators
    // 11.9 Equality Operators
    // 11.10 Binary Bitwise Operators
    // 11.11 Binary Logical Operators

    function parseBinaryExpression() {
        var expr, token, prec, stack, right, operator, left, i;

        left = parseUnaryExpression();

        token = lookahead;
        prec = binaryPrecedence(token);
        if (prec === 0) {
            return left;
        }
        token.prec = prec;
        lex();

        right = parseUnaryExpression();

        stack = [left, token, right];

        while ((prec = binaryPrecedence(lookahead)) > 0) {

            // Reduce: make a binary expression from the three topmost entries.
            while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
                right = stack.pop();
                operator = stack.pop().value;
                left = stack.pop();
                expr = delegate.createBinaryExpression(operator, left, right);
                stack.push(expr);
            }

            // Shift.
            token = lex();
            token.prec = prec;
            stack.push(token);
            expr = parseUnaryExpression();
            stack.push(expr);
        }

        // Final reduce to clean-up the stack.
        i = stack.length - 1;
        expr = stack[i];
        while (i > 1) {
            expr = delegate.createBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
            i -= 2;
        }

        return expr;
    }


    // 11.12 Conditional Operator

    function parseConditionalExpression() {
        var expr, consequent, alternate;

        expr = parseBinaryExpression();

        if (match('?')) {
            lex();
            consequent = parseConditionalExpression();
            expect(':');
            alternate = parseConditionalExpression();

            expr = delegate.createConditionalExpression(expr, consequent, alternate);
        }

        return expr;
    }

    // Simplification since we do not support AssignmentExpression.
    var parseExpression = parseConditionalExpression;

    // Polymer Syntax extensions

    // Filter ::
    //   Identifier
    //   Identifier "(" ")"
    //   Identifier "(" FilterArguments ")"

    function parseFilter() {
        var identifier, args;

        identifier = lex();

        if (identifier.type !== Token.Identifier) {
            throwUnexpected(identifier);
        }

        args = match('(') ? parseArguments() : [];

        return delegate.createFilter(identifier.value, args);
    }

    // Filters ::
    //   "|" Filter
    //   Filters "|" Filter

    function parseFilters(expr) {
        delegate.createTopLevel(expr);
        while (match('|')) {
            lex();
            parseFilter();
        }
    }

    // TopLevel ::
    //   LabelledExpressions
    //   AsExpression
    //   InExpression
    //   Expression
    //   Expression Filters

    // AsExpression ::
    //   Expression as Identifier

    // InExpression ::
    //   Identifier in Expression

    function parseTopLevel() {
        skipWhitespace();
        peek();

        var expr = parseExpression();
        if (expr) {
            if (lookahead.value === 'as') {
                parseAsExpression(expr);
            } else if (lookahead.value === 'in' &&
                       expr.type === Syntax.Identifier) {
                parseInExpression(expr);
            } else if (match('|')) {
                parseFilters(expr);
            } else if (expr.type === Syntax.Identifier && match(':')) {
                parseLabelledExpressions(expr);
            } else {
                delegate.createTopLevel(expr);
            }
        }

        if (lookahead.type !== Token.EOF) {
            throwUnexpected(lookahead);
        }
    }

    // LabelledExpressions ::
    //   LabelExpression
    //   LabelExpression ";"
    //   LabelledExpressions ";" LabelledExpression

    // LabelExpression ::
    //   Identifier ":" Expression

    function parseLabelledExpressions(expr) {
        var label = expr.name;
        expect(':');

        expr = parseExpression();
        delegate.createLabeledStatement(label, expr);

        consumeSemicolon();

        while (lookahead.type === Token.Identifier) {
            label = lex().value;
            expect(':');
            expr = parseExpression();
            delegate.createLabeledStatement(label, expr);

            consumeSemicolon();
        }

        return null;
    }

    function parseAsExpression(expr) {
        lex();  // as
        var identifier = lex().value;
        delegate.createAsExpression(expr, identifier);
    }

    function parseInExpression(identifier) {
        lex();  // in
        var expr = parseExpression();
        delegate.createInExpression(identifier.name, expr);
    }

    function parse(code, inDelegate) {
        delegate = inDelegate;
        source = code;
        index = 0;
        length = source.length;
        lookahead = null;
        state = {
            labelSet: {}
        };

        return parseTopLevel();
    }

    global.esprima = {
        parse: parse
    };
})(this);

// Copyright 2013 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function (global) {
  'use strict';

  // JScript does not have __proto__. We wrap all object literals with
  // createObject which uses Object.create, Object.defineProperty and
  // Object.getOwnPropertyDescriptor to create a new object that does the exact
  // same thing. The main downside to this solution is that we have to extract
  // all those property descriptors for IE.
  var createObject = ('__proto__' in {}) ?
      function(obj) { return obj; } :
      function(obj) {
        var proto = obj.__proto__;
        if (!proto)
          return obj;
        var newObject = Object.create(proto);
        Object.getOwnPropertyNames(obj).forEach(function(name) {
          Object.defineProperty(newObject, name,
                               Object.getOwnPropertyDescriptor(obj, name));
        });
        return newObject;
      };

  function prepareBinding(expressionText, name, node) {
    var expression;
    try {
      expression = getExpression(expressionText);
      if (expression.scopeIdent &&
          (node.nodeType !== Node.ELEMENT_NODE ||
           node.tagName !== 'TEMPLATE' ||
           (name !== 'bind' && name !== 'repeat'))) {
        throw Error('as and in can only be used within <template bind/repeat>');
      }
    } catch (ex) {
      console.error('Invalid expression syntax: ' + expressionText, ex);
      return;
    }

    return function(model, name, node) {
      var binding = expression.getBinding(model);
      if (expression.scopeIdent && binding)
        node.polymerExpressionScopeName_ = expression.scopeIdent;

      return binding
    }
  }

  // TODO(rafaelw): Implement simple LRU.
  var expressionParseCache = Object.create(null);

  function getExpression(expressionText) {
    var expression = expressionParseCache[expressionText];
    if (!expression) {
      var delegate = new ASTDelegate();
      esprima.parse(expressionText, delegate);
      expression = new Expression(delegate);
      expressionParseCache[expressionText] = expression;
    }
    return expression;
  }

  function newLabeledResolve(labeledStatements) {
    return function(values) {
      var labels = [];
      for (var i = 0; i < labeledStatements.length; i++) {
        if (labeledStatements[i].expression(values))
          labels.push(labeledStatements[i].label);
      }

      return labels.join(' ');
    }
  }

  function IdentPath(delegate, name, last) {
    this.delegate = delegate;
    this.name = name;
    this.last = last;
  }

  IdentPath.prototype = {
    getPath: function() {
      if (!this.path_) {
        if (this.last)
          this.path_ = Path.get(this.last.getPath() + '.' + this.name);
        else
          this.path_ = Path.get(this.name);
      }
      return this.path_;
    },

    valueFn: function() {
      if (!this.valueFn_) {
        var path = this.getPath();
        var delegate = this.delegate;
        var index = this.delegate.deps[path];
        if (index === undefined) {
          index = this.delegate.deps[path] = this.delegate.depsList.length;
          this.delegate.depsList.push(path);
        }

        var depsList = delegate.depsList;
        this.valueFn_ = function(values) {
          return depsList.length === 1 ? values : values[index];
        }
      }

      return this.valueFn_;
    }
  };

  function Filter(name, args) {
    this.name = name;
    this.args = args;
    this.object_ = null;
  }

  Filter.prototype = {
    get object() {
      if (this.object_)
        return this.object_;

      var f = PolymerExpressions.filters[this.name];
      var argumentValues = this.args.map(function(arg) {
        var fn = getFn(arg);
        return fn();
      });
      return this.object_ = f.apply(null, argumentValues);
    },

    toDOM: function(fn) {
      var object = this.object;
      return function(values) {
        var value = fn(values);
        return object.toDOM(value);
      };
    },

    toModel: function(value) {
      var object = this.object;
      if (object.toModel)
        return object.toModel(value);
      return value;
    }
  };

  function notImplemented() { throw Error('Not Implemented'); }

  var unaryOperators = {
    '+': function(v) { return +v; },
    '-': function(v) { return -v; },
    '!': function(v) { return !v; }
  };

  var binaryOperators = {
    '+': function(l, r) { return l+r; },
    '-': function(l, r) { return l-r; },
    '*': function(l, r) { return l*r; },
    '/': function(l, r) { return l/r; },
    '%': function(l, r) { return l%r; },
    '<': function(l, r) { return l<r; },
    '>': function(l, r) { return l>r; },
    '<=': function(l, r) { return l<=r; },
    '>=': function(l, r) { return l>=r; },
    '==': function(l, r) { return l==r; },
    '!=': function(l, r) { return l!=r; },
    '===': function(l, r) { return l===r; },
    '!==': function(l, r) { return l!==r; },
    '&&': function(l, r) { return l&&r; },
    '||': function(l, r) { return l||r; },
  };

  function getFn(arg) {
    return arg instanceof IdentPath ? arg.valueFn() : arg;
  }

  function ASTDelegate() {
    this.expression = null;
    this.filters = [];
    this.labeledStatements = [];
    this.deps = {};
    this.depsList = [];
    this.currentPath = undefined;
    this.ident = undefined;
  }

  ASTDelegate.prototype = {

    get filtersSetValueFn() {
      if (!this.filtersSetValueFn_) {
        var filters = this.filters;
        this.filtersSetValueFn_ = function(value) {
          for (var i = filters.length - 1; i >= 0; i--) {
            value = filters[i].toModel(value);
          }
          return value;
        };
      }

      return this.filtersSetValueFn_;
    },

    createLabeledStatement: function(label, expression) {
      this.labeledStatements.push({
        label: label,
        expression: expression instanceof IdentPath ? expression.valueFn() : expression
      });
      return expression;
    },

    createUnaryExpression: function(op, argument) {
      if (!unaryOperators[op])
        throw Error('Disallowed operator: ' + op);

      argument = getFn(argument);

      return function(values) {
        return unaryOperators[op](argument(values));
      };
    },

    createBinaryExpression: function(op, left, right) {
      if (!binaryOperators[op])
        throw Error('Disallowed operator: ' + op);

      left = getFn(left);
      right = getFn(right);

      return function(values) {
        return binaryOperators[op](left(values), right(values));
      };
    },

    createConditionalExpression: function(test, consequent, alternate) {
      test = getFn(test);
      consequent = getFn(consequent);
      alternate = getFn(alternate);

      return function(values) {
        return test(values) ? consequent(values) : alternate(values);
      }
    },

    createIdentifier: function(name) {
      var ident = new IdentPath(this, name);
      ident.type = 'Identifier';
      return ident;
    },

    createMemberExpression: function(accessor, object, property) {
      if (accessor === '[') {
        object = getFn(object);
        property = getFn(property);
        return function(values) {
          return object(values)[property(values)];
        };
      }
      return new IdentPath(this, property.name, object);
    },

    createLiteral: function(token) {
      return function() { return token.value; };
    },

    createArrayExpression: function(elements) {
      for (var i = 0; i < elements.length; i++)
        elements[i] = getFn(elements[i]);

      return function(values) {
        var arr = []
        for (var i = 0; i < elements.length; i++)
          arr.push(elements[i](values));
        return arr;
      }
    },

    createProperty: function(kind, key, value) {
      return {
        key: key instanceof IdentPath ? key.getPath() : key(),
        value: value
      };
    },

    createObjectExpression: function(properties) {
      for (var i = 0; i < properties.length; i++)
        properties[i].value = getFn(properties[i].value);

      return function(values) {
        var obj = {};
        for (var i = 0; i < properties.length; i++)
          obj[properties[i].key] = properties[i].value(values);
        return obj;
      }
    },

    createFilter: function(name, args) {
      this.filters.push(new Filter(name, args));
    },

    createAsExpression: function(expression, ident) {
      this.expression = expression;
      this.ident = ident;
    },

    createInExpression: function(ident, expression) {
      this.expression = expression;
      this.ident = ident;
    },

    createTopLevel: function(expression) {
      this.expression = expression;
    },

    createThisExpression: notImplemented
  }

  function Expression(delegate) {
    this.scopeIdent = delegate.ident;

    if (!delegate.expression && !delegate.labeledStatements.length)
      throw Error('No expression or labelled statements found.');

    // TODO(rafaelw): This is a bit of hack. We'd like to support syntax for
    // binding to class like class="{{ foo: bar; baz: bat }}", so we're
    // abusing ECMAScript labelled statements for this use. The main downside
    // is that ECMAScript indentifiers are more limited than CSS classnames.
    var resolveFn = delegate.labeledStatements.length ?
        newLabeledResolve(delegate.labeledStatements) :
        getFn(delegate.expression);

    delegate.filters.forEach(function(filter) {
      resolveFn = filter.toDOM(resolveFn);
    });

    this.resolveFn = resolveFn;
    this.paths = delegate.depsList;

    if (this.paths.length === 1 &&
        delegate.filters.length &&
        delegate.expression instanceof IdentPath) {
      this.filtersSetValueFn = delegate.filtersSetValueFn;
    }
  }

  Expression.prototype = {
    getBinding: function(model) {
      var paths = this.paths;
      if (!paths.length)
        return { value: this.resolveFn({}) }; // only literals in expression.

      if (paths.length === 1) {
        return new PathObserver(model, paths[0], undefined, undefined,
                                undefined,
                                this.resolveFn,
                                this.filtersSetValueFn);
      }

      var binding = new CompoundPathObserver(undefined, undefined, undefined,
                                             this.resolveFn);
      for (var i = 0; i < paths.length; i++) {
        binding.addPath(model, paths[i]);
      }

      binding.start();
      return binding;
    }
  }

  function PolymerExpressions() {}

  PolymerExpressions.filters = Object.create(null);

  PolymerExpressions.prototype = {
    prepareBinding: function(pathString, name, node) {
      if (Path.get(pathString).valid)
        return; // bail out early if pathString is simple path.

      return prepareBinding(pathString, name, node);
    },

    prepareInstanceModel: function(template) {
      var scopeName = template.polymerExpressionScopeName_;
      if (!scopeName)
        return;

      var parentScope = template.templateInstance ?
          template.templateInstance.model :
          template.model;

      return function(model) {
        var scope = Object.create(parentScope);
        scope[scopeName] = model;
        return scope;
      };
    }
  };

  global.PolymerExpressions = PolymerExpressions;

})(this);
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


/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

if (!scope) {
  scope = window.HTMLImports = {flags:{}};
}

// imports

var xhr = scope.xhr;

// importer

var IMPORT_LINK_TYPE = 'import';
var STYLE_LINK_TYPE = 'stylesheet';

// highlander object represents a primary document (the argument to 'load')
// at the root of a tree of documents

// for any document, importer:
// - loads any linked documents (with deduping), modifies paths and feeds them back into importer
// - loads text of external script tags
// - loads text of external style tags inside of <element>, modifies paths

// when importer 'modifies paths' in a document, this includes
// - href/src/action in node attributes
// - paths in inline stylesheets
// - all content inside templates

// linked style sheets in an import have their own path fixed up when their containing import modifies paths
// linked style sheets in an <element> are loaded, and the content gets path fixups
// inline style sheets get path fixups when their containing import modifies paths

var loader;

var importer = {
  documents: {},
  cache: {},
  preloadSelectors: [
    'link[rel=' + IMPORT_LINK_TYPE + ']',
    'element link[rel=' + STYLE_LINK_TYPE + ']',
    'template',
    'script[src]:not([type])',
    'script[src][type="text/javascript"]'
  ].join(','),
  loader: function(next) {
    // construct a loader instance
    loader = new Loader(importer.loaded, next);
    // alias the loader cache (for debugging)
    loader.cache = importer.cache;
    return loader;
  },
  load: function(doc, next) {
    // construct a loader instance
    loader = importer.loader(next);
    // add nodes from document into loader queue
    importer.preload(doc);
  },
  preload: function(doc) {
    // all preloadable nodes in inDocument
    var nodes = doc.querySelectorAll(importer.preloadSelectors);
    // from the main document, only load imports
    // TODO(sjmiles): do this by altering the selector list instead
    nodes = this.filterMainDocumentNodes(doc, nodes);
    // extra link nodes from templates, filter templates out of the nodes list
    nodes = this.extractTemplateNodes(nodes);
    // add these nodes to loader's queue
    loader.addNodes(nodes);
  },
  filterMainDocumentNodes: function(doc, nodes) {
    if (doc === document) {
      nodes = Array.prototype.filter.call(nodes, function(n) {
        return !isScript(n);
      });
    }
    return nodes;
  },
  extractTemplateNodes: function(nodes) {
    var extra = [];
    nodes = Array.prototype.filter.call(nodes, function(n) {
      if (n.localName === 'template') {
        if (n.content) {
          var l$ = n.content.querySelectorAll('link[rel=' + STYLE_LINK_TYPE +
            ']');
          if (l$.length) {
            extra = extra.concat(Array.prototype.slice.call(l$, 0));
          }
        }
        return false;
      }
      return true;
    });
    if (extra.length) {
      nodes = nodes.concat(extra);
    }
    return nodes;
  },
  loaded: function(url, elt, resource) {
    if (isDocumentLink(elt)) {
      var document = importer.documents[url];
      // if we've never seen a document at this url
      if (!document) {
        // generate an HTMLDocument from data
        document = makeDocument(resource, url);
        // resolve resource paths relative to host document
        path.resolvePathsInHTML(document);
        // cache document
        importer.documents[url] = document;
        // add nodes from this document to the loader queue
        importer.preload(document);
      }
      // store import record
      elt.import = {
        href: url,
        ownerNode: elt,
        content: document
      };
      // store document resource
      elt.content = resource = document;
    }
    // store generic resource
    // TODO(sorvell): fails for nodes inside <template>.content
    // see https://code.google.com/p/chromium/issues/detail?id=249381.
    elt.__resource = resource;
    // css path fixups
    if (isStylesheetLink(elt)) {
      path.resolvePathsInStylesheet(elt);
    }
  }
};

function isDocumentLink(elt) {
  return isLinkRel(elt, IMPORT_LINK_TYPE);
}

function isStylesheetLink(elt) {
  return isLinkRel(elt, STYLE_LINK_TYPE);
}

function isLinkRel(elt, rel) {
  return elt.localName === 'link' && elt.getAttribute('rel') === rel;
}

function isScript(elt) {
  return elt.localName === 'script';
}

function makeDocument(resource, url) {
  // create a new HTML document
  var doc = resource;
  if (!(doc instanceof Document)) {
    doc = document.implementation.createHTMLDocument(IMPORT_LINK_TYPE);
    // install html
    doc.body.innerHTML = resource;
  }
  // cache the new document's source url
  doc._URL = url;
  // establish a relative path via <base>
  var base = doc.createElement('base');
  base.setAttribute('href', document.baseURI || document.URL);
  doc.head.appendChild(base);
  // TODO(sorvell): ideally this code is not aware of Template polyfill,
  // but for now the polyfill needs help to bootstrap these templates
  if (window.HTMLTemplateElement && HTMLTemplateElement.bootstrap) {
    HTMLTemplateElement.bootstrap(doc);
  }
  return doc;
}

var Loader = function(onLoad, onComplete) {
  this.onload = onLoad;
  this.oncomplete = onComplete;
  this.inflight = 0;
  this.pending = {};
  this.cache = {};
};

Loader.prototype = {
  addNodes: function(nodes) {
    // number of transactions to complete
    this.inflight += nodes.length;
    // commence transactions
    forEach(nodes, this.require, this);
    // anything to do?
    this.checkDone();
  },
  require: function(elt) {
    var url = path.nodeUrl(elt);
    // TODO(sjmiles): ad-hoc
    elt.__nodeUrl = url;
    // deduplication
    if (!this.dedupe(url, elt)) {
      // fetch this resource
      this.fetch(url, elt);
    }
  },
  dedupe: function(url, elt) {
    if (this.pending[url]) {
      // add to list of nodes waiting for inUrl
      this.pending[url].push(elt);
      // don't need fetch
      return true;
    }
    if (this.cache[url]) {
      // complete load using cache data
      this.onload(url, elt, loader.cache[url]);
      // finished this transaction
      this.tail();
      // don't need fetch
      return true;
    }
    // first node waiting for inUrl
    this.pending[url] = [elt];
    // need fetch (not a dupe)
    return false;
  },
  fetch: function(url, elt) {
    var receiveXhr = function(err, resource) {
      this.receive(url, elt, err, resource);
    }.bind(this);
    xhr.load(url, receiveXhr);
    // TODO(sorvell): blocked on
    // https://code.google.com/p/chromium/issues/detail?id=257221
    // xhr'ing for a document makes scripts in imports runnable; otherwise
    // they are not; however, it requires that we have doctype=html in
    // the import which is unacceptable. This is only needed on Chrome
    // to avoid the bug above.
    /*
    if (isDocumentLink(elt)) {
      xhr.loadDocument(url, receiveXhr);
    } else {
      xhr.load(url, receiveXhr);
    }
    */
  },
  receive: function(url, elt, err, resource) {
    if (!err) {
      loader.cache[url] = resource;
    }
    loader.pending[url].forEach(function(e) {
      if (!err) {
        this.onload(url, e, resource);
      }
      this.tail();
    }, this);
    loader.pending[url] = null;
  },
  tail: function() {
    --this.inflight;
    this.checkDone();
  },
  checkDone: function() {
    if (!this.inflight) {
      this.oncomplete();
    }
  }
};

var URL_ATTRS = ['href', 'src', 'action'];
var URL_ATTRS_SELECTOR = '[' + URL_ATTRS.join('],[') + ']';
var URL_TEMPLATE_SEARCH = '{{.*}}';

var path = {
  nodeUrl: function(node) {
    return path.resolveUrl(path.documentURL, path.hrefOrSrc(node));
  },
  hrefOrSrc: function(node) {
    return node.getAttribute("href") || node.getAttribute("src");
  },
  documentUrlFromNode: function(node) {
    return path.getDocumentUrl(node.ownerDocument || node);
  },
  getDocumentUrl: function(doc) {
    var url = doc &&
        // TODO(sjmiles): ShadowDOMPolyfill intrusion
        (doc._URL || (doc.impl && doc.impl._URL)
            || doc.baseURI || doc.URL)
                || '';
    // take only the left side if there is a #
    return url.split('#')[0];
  },
  resolveUrl: function(baseUrl, url) {
    if (this.isAbsUrl(url)) {
      return url;
    }
    return this.compressUrl(this.urlToPath(baseUrl) + url);
  },
  resolveRelativeUrl: function(baseUrl, url) {
    if (this.isAbsUrl(url)) {
      return url;
    }
    return this.makeDocumentRelPath(this.resolveUrl(baseUrl, url));
  },
  isAbsUrl: function(url) {
    return /(^data:)|(^http[s]?:)|(^\/)/.test(url);
  },
  urlToPath: function(baseUrl) {
    var parts = baseUrl.split("/");
    parts.pop();
    parts.push('');
    return parts.join("/");
  },
  compressUrl: function(url) {
    var search = '';
    var searchPos = url.indexOf('?');
    // query string is not part of the path
    if (searchPos > -1) {
      search = url.substring(searchPos);
      url = url.substring(searchPos, 0);
    }
    var parts = url.split('/');
    for (var i=0, p; i<parts.length; i++) {
      p = parts[i];
      if (p === '..') {
        parts.splice(i-1, 2);
        i -= 2;
      }
    }
    return parts.join('/') + search;
  },
  makeDocumentRelPath: function(url) {
    // test url against document to see if we can construct a relative path
    path.urlElt.href = url;
    // IE does not set host if same as document
    if (!path.urlElt.host || 
        (path.urlElt.host === window.location.host &&
        path.urlElt.protocol === window.location.protocol)) {
      return this.makeRelPath(path.documentURL, path.urlElt.href);
    } else {
      return url;
    }
  },
  // make a relative path from source to target
  makeRelPath: function(source, target) {
    var s = source.split('/');
    var t = target.split('/');
    while (s.length && s[0] === t[0]){
      s.shift();
      t.shift();
    }
    for(var i = 0, l = s.length-1; i < l; i++) {
      t.unshift('..');
    }
    var r = t.join('/');
    return r;
  },
  resolvePathsInHTML: function(root, url) {
    url = url || path.documentUrlFromNode(root)
    path.resolveAttributes(root, url);
    path.resolveStyleElts(root, url);
    // handle template.content
    var templates = root.querySelectorAll('template');
    if (templates) {
      forEach(templates, function(t) {
        if (t.content) {
          path.resolvePathsInHTML(t.content, url);
        }
      });
    }
  },
  resolvePathsInStylesheet: function(sheet) {
    var docUrl = path.nodeUrl(sheet);
    sheet.__resource = path.resolveCssText(sheet.__resource, docUrl);
  },
  resolveStyleElts: function(root, url) {
    var styles = root.querySelectorAll('style');
    if (styles) {
      forEach(styles, function(style) {
        style.textContent = path.resolveCssText(style.textContent, url);
      });
    }
  },
  resolveCssText: function(cssText, baseUrl) {
    return cssText.replace(/url\([^)]*\)/g, function(match) {
      // find the url path, ignore quotes in url string
      var urlPath = match.replace(/["']/g, "").slice(4, -1);
      urlPath = path.resolveRelativeUrl(baseUrl, urlPath);
      return "url(" + urlPath + ")";
    });
  },
  resolveAttributes: function(root, url) {
    // search for attributes that host urls
    var nodes = root && root.querySelectorAll(URL_ATTRS_SELECTOR);
    if (nodes) {
      forEach(nodes, function(n) {
        this.resolveNodeAttributes(n, url);
      }, this);
    }
  },
  resolveNodeAttributes: function(node, url) {
    URL_ATTRS.forEach(function(v) {
      var attr = node.attributes[v];
      if (attr && attr.value &&
         (attr.value.search(URL_TEMPLATE_SEARCH) < 0)) {
        var urlPath = path.resolveRelativeUrl(url, attr.value);
        attr.value = urlPath;
      }
    });
  }
};

path.documentURL = path.getDocumentUrl(document);
path.urlElt = document.createElement('a');

xhr = xhr || {
  async: true,
  ok: function(request) {
    return (request.status >= 200 && request.status < 300)
        || (request.status === 304)
        || (request.status === 0);
  },
  load: function(url, next, nextContext) {
    var request = new XMLHttpRequest();
    if (scope.flags.debug || scope.flags.bust) {
      url += '?' + Math.random();
    }
    request.open('GET', url, xhr.async);
    request.addEventListener('readystatechange', function(e) {
      if (request.readyState === 4) {
        next.call(nextContext, !xhr.ok(request) && request,
          request.response, url);
      }
    });
    request.send();
    return request;
  },
  loadDocument: function(url, next, nextContext) {
    this.load(url, next, nextContext).responseType = 'document';
  }
};

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

// exports

scope.path = path;
scope.xhr = xhr;
scope.importer = importer;
scope.getDocumentUrl = path.getDocumentUrl;
scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;

})(window.HTMLImports);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var IMPORT_LINK_TYPE = 'import';

// highlander object for parsing a document tree

var importParser = {
  selectors: [
    'link[rel=' + IMPORT_LINK_TYPE + ']',
    'link[rel=stylesheet]',
    'style',
    'script:not([type])',
    'script[type="text/javascript"]'
  ],
  map: {
    link: 'parseLink',
    script: 'parseScript',
    style: 'parseGeneric'
  },
  parse: function(inDocument) {
    if (!inDocument.__importParsed) {
      // only parse once
      inDocument.__importParsed = true;
      // all parsable elements in inDocument (depth-first pre-order traversal)
      var elts = inDocument.querySelectorAll(importParser.selectors);
      // for each parsable node type, call the mapped parsing method
      forEach(elts, function(e) {
        importParser[importParser.map[e.localName]](e);
      });
    }
  },
  parseLink: function(linkElt) {
    if (isDocumentLink(linkElt)) {
      if (linkElt.content) {
        importParser.parse(linkElt.content);
      }
    } else {
      this.parseGeneric(linkElt);
    }
  },
  parseGeneric: function(elt) {
    if (needsMainDocumentContext(elt)) {
      document.head.appendChild(elt);
    }
  },
  parseScript: function(scriptElt) {
    if (needsMainDocumentContext(scriptElt)) {
      // acquire code to execute
      var code = (scriptElt.__resource || scriptElt.textContent).trim();
      if (code) {
        // calculate source map hint
        var moniker = scriptElt.__nodeUrl;
        if (!moniker) {
          var moniker = scope.path.documentUrlFromNode(scriptElt);
          // there could be more than one script this url
          var tag = '[' + Math.floor((Math.random()+1)*1000) + ']';
          // TODO(sjmiles): Polymer hack, should be pluggable if we need to allow 
          // this sort of thing
          var matches = code.match(/Polymer\(['"]([^'"]*)/);
          tag = matches && matches[1] || tag;
          // tag the moniker
          moniker += '/' + tag + '.js';
        }
        // source map hint
        code += "\n//# sourceURL=" + moniker + "\n";
        // evaluate the code
        eval.call(window, code);
      }
    }
  }
};

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

function isDocumentLink(elt) {
  return elt.localName === 'link'
      && elt.getAttribute('rel') === IMPORT_LINK_TYPE;
}

function needsMainDocumentContext(node) {
  // nodes can be moved to the main document:
  // if they are in a tree but not in the main document and not children of <element>
  return node.parentNode && !inMainDocument(node) 
      && !isElementElementChild(node);
}

function inMainDocument(elt) {
  return elt.ownerDocument === document ||
    // TODO(sjmiles): ShadowDOMPolyfill intrusion
    elt.ownerDocument.impl === document;
}

function isElementElementChild(elt) {
  return elt.parentNode && elt.parentNode.localName === 'element';
}

// exports

scope.parser = importParser;

})(HTMLImports);
/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(){

// bootstrap

// IE shim for CustomEvent
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function(inType) {
     var e = document.createEvent('HTMLEvents');
     e.initEvent(inType, true, true);
     return e;
  };
}

function bootstrap() {
  // preload document resource trees
  HTMLImports.importer.load(document, function() {
    HTMLImports.parser.parse(document);
    HTMLImports.readyTime = new Date().getTime();
    // send HTMLImportsLoaded when finished
    document.dispatchEvent(
      new CustomEvent('HTMLImportsLoaded', {bubbles: true})
    );
  });
};

if (document.readyState === 'complete') {
  bootstrap();
} else {
  window.addEventListener('DOMContentLoaded', bootstrap);
}

})();

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
window.CustomElements = {flags:{}};
/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(global) {

  var registrationsTable = new SideTable();

  // We use setImmediate or postMessage for our future callback.
  var setImmediate = window.msSetImmediate;

  // Use post message to emulate setImmediate.
  if (!setImmediate) {
    var setImmediateQueue = [];
    var sentinel = String(Math.random());
    window.addEventListener('message', function(e) {
      if (e.data === sentinel) {
        var queue = setImmediateQueue;
        setImmediateQueue = [];
        queue.forEach(function(func) {
          func();
        });
      }
    });
    setImmediate = function(func) {
      setImmediateQueue.push(func);
      window.postMessage(sentinel, '*');
    };
  }

  // This is used to ensure that we never schedule 2 callas to setImmediate
  var isScheduled = false;

  // Keep track of observers that needs to be notified next time.
  var scheduledObservers = [];

  /**
   * Schedules |dispatchCallback| to be called in the future.
   * @param {MutationObserver} observer
   */
  function scheduleCallback(observer) {
    scheduledObservers.push(observer);
    if (!isScheduled) {
      isScheduled = true;
      setImmediate(dispatchCallbacks);
    }
  }

  function wrapIfNeeded(node) {
    return window.ShadowDOMPolyfill &&
        window.ShadowDOMPolyfill.wrapIfNeeded(node) ||
        node;
  }

  function dispatchCallbacks() {
    // http://dom.spec.whatwg.org/#mutation-observers

    isScheduled = false; // Used to allow a new setImmediate call above.

    var observers = scheduledObservers;
    scheduledObservers = [];
    // Sort observers based on their creation UID (incremental).
    observers.sort(function(o1, o2) {
      return o1.uid_ - o2.uid_;
    });

    var anyNonEmpty = false;
    observers.forEach(function(observer) {

      // 2.1, 2.2
      var queue = observer.takeRecords();
      // 2.3. Remove all transient registered observers whose observer is mo.
      removeTransientObserversFor(observer);

      // 2.4
      if (queue.length) {
        observer.callback_(queue, observer);
        anyNonEmpty = true;
      }
    });

    // 3.
    if (anyNonEmpty)
      dispatchCallbacks();
  }

  function removeTransientObserversFor(observer) {
    observer.nodes_.forEach(function(node) {
      var registrations = registrationsTable.get(node);
      if (!registrations)
        return;
      registrations.forEach(function(registration) {
        if (registration.observer === observer)
          registration.removeTransientObservers();
      });
    });
  }

  /**
   * This function is used for the "For each registered observer observer (with
   * observer's options as options) in target's list of registered observers,
   * run these substeps:" and the "For each ancestor ancestor of target, and for
   * each registered observer observer (with options options) in ancestor's list
   * of registered observers, run these substeps:" part of the algorithms. The
   * |options.subtree| is checked to ensure that the callback is called
   * correctly.
   *
   * @param {Node} target
   * @param {function(MutationObserverInit):MutationRecord} callback
   */
  function forEachAncestorAndObserverEnqueueRecord(target, callback) {
    for (var node = target; node; node = node.parentNode) {
      var registrations = registrationsTable.get(node);

      if (registrations) {
        for (var j = 0; j < registrations.length; j++) {
          var registration = registrations[j];
          var options = registration.options;

          // Only target ignores subtree.
          if (node !== target && !options.subtree)
            continue;

          var record = callback(options);
          if (record)
            registration.enqueue(record);
        }
      }
    }
  }

  var uidCounter = 0;

  /**
   * The class that maps to the DOM MutationObserver interface.
   * @param {Function} callback.
   * @constructor
   */
  function JsMutationObserver(callback) {
    this.callback_ = callback;
    this.nodes_ = [];
    this.records_ = [];
    this.uid_ = ++uidCounter;
  }

  JsMutationObserver.prototype = {
    observe: function(target, options) {
      target = wrapIfNeeded(target);

      // 1.1
      if (!options.childList && !options.attributes && !options.characterData ||

          // 1.2
          options.attributeOldValue && !options.attributes ||

          // 1.3
          options.attributeFilter && options.attributeFilter.length &&
              !options.attributes ||

          // 1.4
          options.characterDataOldValue && !options.characterData) {

        throw new SyntaxError();
      }

      var registrations = registrationsTable.get(target);
      if (!registrations)
        registrationsTable.set(target, registrations = []);

      // 2
      // If target's list of registered observers already includes a registered
      // observer associated with the context object, replace that registered
      // observer's options with options.
      var registration;
      for (var i = 0; i < registrations.length; i++) {
        if (registrations[i].observer === this) {
          registration = registrations[i];
          registration.removeListeners();
          registration.options = options;
          break;
        }
      }

      // 3.
      // Otherwise, add a new registered observer to target's list of registered
      // observers with the context object as the observer and options as the
      // options, and add target to context object's list of nodes on which it
      // is registered.
      if (!registration) {
        registration = new Registration(this, target, options);
        registrations.push(registration);
        this.nodes_.push(target);
      }

      registration.addListeners();
    },

    disconnect: function() {
      this.nodes_.forEach(function(node) {
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          var registration = registrations[i];
          if (registration.observer === this) {
            registration.removeListeners();
            registrations.splice(i, 1);
            // Each node can only have one registered observer associated with
            // this observer.
            break;
          }
        }
      }, this);
      this.records_ = [];
    },

    takeRecords: function() {
      var copyOfRecords = this.records_;
      this.records_ = [];
      return copyOfRecords;
    }
  };

  /**
   * @param {string} type
   * @param {Node} target
   * @constructor
   */
  function MutationRecord(type, target) {
    this.type = type;
    this.target = target;
    this.addedNodes = [];
    this.removedNodes = [];
    this.previousSibling = null;
    this.nextSibling = null;
    this.attributeName = null;
    this.attributeNamespace = null;
    this.oldValue = null;
  }

  function copyMutationRecord(original) {
    var record = new MutationRecord(original.type, original.target);
    record.addedNodes = original.addedNodes.slice();
    record.removedNodes = original.removedNodes.slice();
    record.previousSibling = original.previousSibling;
    record.nextSibling = original.nextSibling;
    record.attributeName = original.attributeName;
    record.attributeNamespace = original.attributeNamespace;
    record.oldValue = original.oldValue;
    return record;
  };

  // We keep track of the two (possibly one) records used in a single mutation.
  var currentRecord, recordWithOldValue;

  /**
   * Creates a record without |oldValue| and caches it as |currentRecord| for
   * later use.
   * @param {string} oldValue
   * @return {MutationRecord}
   */
  function getRecord(type, target) {
    return currentRecord = new MutationRecord(type, target);
  }

  /**
   * Gets or creates a record with |oldValue| based in the |currentRecord|
   * @param {string} oldValue
   * @return {MutationRecord}
   */
  function getRecordWithOldValue(oldValue) {
    if (recordWithOldValue)
      return recordWithOldValue;
    recordWithOldValue = copyMutationRecord(currentRecord);
    recordWithOldValue.oldValue = oldValue;
    return recordWithOldValue;
  }

  function clearRecords() {
    currentRecord = recordWithOldValue = undefined;
  }

  /**
   * @param {MutationRecord} record
   * @return {boolean} Whether the record represents a record from the current
   * mutation event.
   */
  function recordRepresentsCurrentMutation(record) {
    return record === recordWithOldValue || record === currentRecord;
  }

  /**
   * Selects which record, if any, to replace the last record in the queue.
   * This returns |null| if no record should be replaced.
   *
   * @param {MutationRecord} lastRecord
   * @param {MutationRecord} newRecord
   * @param {MutationRecord}
   */
  function selectRecord(lastRecord, newRecord) {
    if (lastRecord === newRecord)
      return lastRecord;

    // Check if the the record we are adding represents the same record. If
    // so, we keep the one with the oldValue in it.
    if (recordWithOldValue && recordRepresentsCurrentMutation(lastRecord))
      return recordWithOldValue;

    return null;
  }

  /**
   * Class used to represent a registered observer.
   * @param {MutationObserver} observer
   * @param {Node} target
   * @param {MutationObserverInit} options
   * @constructor
   */
  function Registration(observer, target, options) {
    this.observer = observer;
    this.target = target;
    this.options = options;
    this.transientObservedNodes = [];
  }

  Registration.prototype = {
    enqueue: function(record) {
      var records = this.observer.records_;
      var length = records.length;

      // There are cases where we replace the last record with the new record.
      // For example if the record represents the same mutation we need to use
      // the one with the oldValue. If we get same record (this can happen as we
      // walk up the tree) we ignore the new record.
      if (records.length > 0) {
        var lastRecord = records[length - 1];
        var recordToReplaceLast = selectRecord(lastRecord, record);
        if (recordToReplaceLast) {
          records[length - 1] = recordToReplaceLast;
          return;
        }
      } else {
        scheduleCallback(this.observer);
      }

      records[length] = record;
    },

    addListeners: function() {
      this.addListeners_(this.target);
    },

    addListeners_: function(node) {
      var options = this.options;
      if (options.attributes)
        node.addEventListener('DOMAttrModified', this, true);

      if (options.characterData)
        node.addEventListener('DOMCharacterDataModified', this, true);

      if (options.childList)
        node.addEventListener('DOMNodeInserted', this, true);

      if (options.childList || options.subtree)
        node.addEventListener('DOMNodeRemoved', this, true);
    },

    removeListeners: function() {
      this.removeListeners_(this.target);
    },

    removeListeners_: function(node) {
      var options = this.options;
      if (options.attributes)
        node.removeEventListener('DOMAttrModified', this, true);

      if (options.characterData)
        node.removeEventListener('DOMCharacterDataModified', this, true);

      if (options.childList)
        node.removeEventListener('DOMNodeInserted', this, true);

      if (options.childList || options.subtree)
        node.removeEventListener('DOMNodeRemoved', this, true);
    },

    /**
     * Adds a transient observer on node. The transient observer gets removed
     * next time we deliver the change records.
     * @param {Node} node
     */
    addTransientObserver: function(node) {
      // Don't add transient observers on the target itself. We already have all
      // the required listeners set up on the target.
      if (node === this.target)
        return;

      this.addListeners_(node);
      this.transientObservedNodes.push(node);
      var registrations = registrationsTable.get(node);
      if (!registrations)
        registrationsTable.set(node, registrations = []);

      // We know that registrations does not contain this because we already
      // checked if node === this.target.
      registrations.push(this);
    },

    removeTransientObservers: function() {
      var transientObservedNodes = this.transientObservedNodes;
      this.transientObservedNodes = [];

      transientObservedNodes.forEach(function(node) {
        // Transient observers are never added to the target.
        this.removeListeners_(node);

        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          if (registrations[i] === this) {
            registrations.splice(i, 1);
            // Each node can only have one registered observer associated with
            // this observer.
            break;
          }
        }
      }, this);
    },

    handleEvent: function(e) {
      // Stop propagation since we are managing the propagation manually.
      // This means that other mutation events on the page will not work
      // correctly but that is by design.
      e.stopImmediatePropagation();

      switch (e.type) {
        case 'DOMAttrModified':
          // http://dom.spec.whatwg.org/#concept-mo-queue-attributes

          var name = e.attrName;
          var namespace = e.relatedNode.namespaceURI;
          var target = e.target;

          // 1.
          var record = new getRecord('attributes', target);
          record.attributeName = name;
          record.attributeNamespace = namespace;

          // 2.
          var oldValue =
              e.attrChange === MutationEvent.ADDITION ? null : e.prevValue;

          forEachAncestorAndObserverEnqueueRecord(target, function(options) {
            // 3.1, 4.2
            if (!options.attributes)
              return;

            // 3.2, 4.3
            if (options.attributeFilter && options.attributeFilter.length &&
                options.attributeFilter.indexOf(name) === -1 &&
                options.attributeFilter.indexOf(namespace) === -1) {
              return;
            }
            // 3.3, 4.4
            if (options.attributeOldValue)
              return getRecordWithOldValue(oldValue);

            // 3.4, 4.5
            return record;
          });

          break;

        case 'DOMCharacterDataModified':
          // http://dom.spec.whatwg.org/#concept-mo-queue-characterdata
          var target = e.target;

          // 1.
          var record = getRecord('characterData', target);

          // 2.
          var oldValue = e.prevValue;


          forEachAncestorAndObserverEnqueueRecord(target, function(options) {
            // 3.1, 4.2
            if (!options.characterData)
              return;

            // 3.2, 4.3
            if (options.characterDataOldValue)
              return getRecordWithOldValue(oldValue);

            // 3.3, 4.4
            return record;
          });

          break;

        case 'DOMNodeRemoved':
          this.addTransientObserver(e.target);
          // Fall through.
        case 'DOMNodeInserted':
          // http://dom.spec.whatwg.org/#concept-mo-queue-childlist
          var target = e.relatedNode;
          var changedNode = e.target;
          var addedNodes, removedNodes;
          if (e.type === 'DOMNodeInserted') {
            addedNodes = [changedNode];
            removedNodes = [];
          } else {

            addedNodes = [];
            removedNodes = [changedNode];
          }
          var previousSibling = changedNode.previousSibling;
          var nextSibling = changedNode.nextSibling;

          // 1.
          var record = getRecord('childList', target);
          record.addedNodes = addedNodes;
          record.removedNodes = removedNodes;
          record.previousSibling = previousSibling;
          record.nextSibling = nextSibling;

          forEachAncestorAndObserverEnqueueRecord(target, function(options) {
            // 2.1, 3.2
            if (!options.childList)
              return;

            // 2.2, 3.3
            return record;
          });

      }

      clearRecords();
    }
  };

  global.JsMutationObserver = JsMutationObserver;

})(this);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

if (!window.MutationObserver) {
  window.MutationObserver = 
      window.WebKitMutationObserver || 
      window.JsMutationObserver;
  if (!MutationObserver) {
    throw new Error("no mutation observer support");
  }
}

 /*
Copyright 2013 The Polymer Authors. All rights reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file.
*/

(function(scope){

var logFlags = window.logFlags || {};

// walk the subtree rooted at node, applying 'find(element, data)' function 
// to each element
// if 'find' returns true for 'element', do not search element's subtree  
function findAll(node, find, data) {
  var e = node.firstElementChild;
  if (!e) {
    e = node.firstChild;
    while (e && e.nodeType !== Node.ELEMENT_NODE) {
      e = e.nextSibling;
    }
  }
  while (e) {
    if (find(e, data) !== true) {
      findAll(e, find, data);
    }
    e = e.nextElementSibling;
  }
  return null;
}

// walk all shadowRoots on a given node.
function forRoots(node, cb) {
  var root = node.webkitShadowRoot;
  while(root) {
    forSubtree(root, cb);
    root = root.olderShadowRoot;
  }
}

// walk the subtree rooted at node, including descent into shadow-roots, 
// applying 'cb' to each element
function forSubtree(node, cb) {
  //logFlags.dom && node.childNodes && node.childNodes.length && console.group('subTree: ', node);
  findAll(node, function(e) {
    if (cb(e)) {
      return true;
    }
    forRoots(e, cb);
  });
  forRoots(node, cb);
  //logFlags.dom && node.childNodes && node.childNodes.length && console.groupEnd();
}

// manage lifecycle on added node
function added(node) {
  if (upgrade(node)) {
    insertedNode(node);
    return true; 
  }
  inserted(node);
}

// manage lifecycle on added node's subtree only
function addedSubtree(node) {
  forSubtree(node, function(e) {
    if (added(e)) {
      return true; 
    }
  });
}

// manage lifecycle on added node and it's subtree
function addedNode(node) {
  return added(node) || addedSubtree(node);
}

// upgrade custom elements at node, if applicable
function upgrade(node) {
  if (!node.__upgraded__ && node.nodeType === Node.ELEMENT_NODE) {
    var type = node.getAttribute('is') || node.localName;
    var definition = scope.registry[type];
    if (definition) {
      logFlags.dom && console.group('upgrade:', node.localName);
      scope.upgrade(node);
      logFlags.dom && console.groupEnd();
      return true;
    }
  }
}

function insertedNode(node) {
  inserted(node);
  if (inDocument(node)) {
    forSubtree(node, function(e) {
      inserted(e);
    });
  }
}

// TODO(sjmiles): if there are descents into trees that can never have inDocument(*) true, fix this

function inserted(element) {
  // TODO(sjmiles): it's possible we were inserted and removed in the space
  // of one microtask, in which case we won't be 'inDocument' here
  // But there are other cases where we are testing for inserted without
  // specific knowledge of mutations, and must test 'inDocument' to determine
  // whether to call inserted
  // If we can factor these cases into separate code paths we can have
  // better diagnostics.
  // TODO(sjmiles): when logging, do work on all custom elements so we can
  // track behavior even when callbacks not defined
  //console.log('inserted: ', element.localName);
  if (element.enteredViewCallback || (element.__upgraded__ && logFlags.dom)) {
    logFlags.dom && console.group('inserted:', element.localName);
    if (inDocument(element)) {
      element.__inserted = (element.__inserted || 0) + 1;
      // if we are in a 'removed' state, bluntly adjust to an 'inserted' state
      if (element.__inserted < 1) {
        element.__inserted = 1;
      }
      // if we are 'over inserted', squelch the callback
      if (element.__inserted > 1) {
        logFlags.dom && console.warn('inserted:', element.localName,
          'insert/remove count:', element.__inserted)
      } else if (element.enteredViewCallback) {
        logFlags.dom && console.log('inserted:', element.localName);
        element.enteredViewCallback();
      }
    }
    logFlags.dom && console.groupEnd();
  }
}

function removedNode(node) {
  removed(node);
  forSubtree(node, function(e) {
    removed(e);
  });
}

function removed(element) {
  // TODO(sjmiles): temporary: do work on all custom elements so we can track
  // behavior even when callbacks not defined
  if (element.leftViewCallback || (element.__upgraded__ && logFlags.dom)) {
    logFlags.dom && console.log('removed:', element.localName);
    if (!inDocument(element)) {
      element.__inserted = (element.__inserted || 0) - 1;
      // if we are in a 'inserted' state, bluntly adjust to an 'removed' state
      if (element.__inserted > 0) {
        element.__inserted = 0;
      }
      // if we are 'over removed', squelch the callback
      if (element.__inserted < 0) {
        logFlags.dom && console.warn('removed:', element.localName,
            'insert/remove count:', element.__inserted)
      } else if (element.leftViewCallback) {
        element.leftViewCallback();
      }
    }
  }
}

function inDocument(element) {
  var p = element;
  while (p) {
    if (p == element.ownerDocument) {
      return true;
    }
    p = p.parentNode || p.host;
  }
}

function watchShadow(node) {
  if (node.webkitShadowRoot && !node.webkitShadowRoot.__watched) {
    logFlags.dom && console.log('watching shadow-root for: ', node.localName);
    // watch all unwatched roots...
    var root = node.webkitShadowRoot;
    while (root) {
      watchRoot(root);
      root = root.olderShadowRoot;
    }
  }
}

function watchRoot(root) {
  if (!root.__watched) {
    observe(root);
    root.__watched = true;
  }
}

function filter(inNode) {
  switch (inNode.localName) {
    case 'style':
    case 'script':
    case 'template':
    case undefined:
      return true;
  }
}

function handler(mutations) {
  //
  if (logFlags.dom) {
    var mx = mutations[0];
    if (mx && mx.type === 'childList' && mx.addedNodes) {
        if (mx.addedNodes) {
          var d = mx.addedNodes[0];
          while (d && d !== document && !d.host) {
            d = d.parentNode;
          }
          var u = d && (d.URL || d._URL || (d.host && d.host.localName)) || '';
          u = u.split('/?').shift().split('/').pop();
        }
    }
    console.group('mutations (%d) [%s]', mutations.length, u || '');
  }
  //
  mutations.forEach(function(mx) {
    //logFlags.dom && console.group('mutation');
    if (mx.type === 'childList') {
      forEach(mx.addedNodes, function(n) {
        //logFlags.dom && console.log(n.localName);
        if (filter(n)) {
          return;
        }
        // nodes added may need lifecycle management
        addedNode(n);
      });
      // removed nodes may need lifecycle management
      forEach(mx.removedNodes, function(n) {
        //logFlags.dom && console.log(n.localName);
        if (filter(n)) {
          return;
        }
        removedNode(n);
      });
    }
    //logFlags.dom && console.groupEnd();
  });
  logFlags.dom && console.groupEnd();
};

var observer = new MutationObserver(handler);

function takeRecords() {
  // TODO(sjmiles): ask Raf why we have to call handler ourselves
  handler(observer.takeRecords());
}

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

function observe(inRoot) {
  observer.observe(inRoot, {childList: true, subtree: true});
}

function observeDocument(document) {
  observe(document);
}

function upgradeDocument(document) {
  logFlags.dom && console.group('upgradeDocument: ', (document.URL || document._URL || '').split('/').pop());
  addedNode(document);
  logFlags.dom && console.groupEnd();
}

// exports

scope.watchShadow = watchShadow;
scope.upgradeAll = addedNode;
scope.upgradeSubtree = addedSubtree;

scope.observeDocument = observeDocument;
scope.upgradeDocument = upgradeDocument;

scope.takeRecords = takeRecords;

})(window.CustomElements);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * Implements `document.register`
 * @module CustomElements
*/

/**
 * Polyfilled extensions to the `document` object.
 * @class Document
*/

(function(scope) {

// imports

if (!scope) {
  scope = window.CustomElements = {flags:{}};
}
var flags = scope.flags;

// native document.register?

var hasNative = Boolean(document.webkitRegister || document.register);
var useNative = !flags.register && hasNative;

if (useNative) {

  // normalize
  document.register = document.register || document.webkitRegister;

  // stub
  var nop = function() {};

  // exports
  scope.registry = {};
  scope.upgradeElement = nop;
  
  scope.watchShadow = nop;
  scope.upgrade = nop;
  scope.upgradeAll = nop;
  scope.upgradeSubtree = nop;
  scope.observeDocument = nop;
  scope.upgradeDocument = nop;
  scope.takeRecords = nop;

} else {

  /**
   * Registers a custom tag name with the document.
   *
   * When a registered element is created, a `readyCallback` method is called
   * in the scope of the element. The `readyCallback` method can be specified on
   * either `options.prototype` or `options.lifecycle` with the latter taking
   * precedence.
   *
   * @method register
   * @param {String} name The tag name to register. Must include a dash ('-'),
   *    for example 'x-component'.
   * @param {Object} options
   *    @param {String} [options.extends]
   *      (_off spec_) Tag name of an element to extend (or blank for a new
   *      element). This parameter is not part of the specification, but instead
   *      is a hint for the polyfill because the extendee is difficult to infer.
   *      Remember that the input prototype must chain to the extended element's
   *      prototype (or HTMLElement.prototype) regardless of the value of
   *      `extends`.
   *    @param {Object} options.prototype The prototype to use for the new
   *      element. The prototype must inherit from HTMLElement.
   *    @param {Object} [options.lifecycle]
   *      Callbacks that fire at important phases in the life of the custom
   *      element.
   *
   * @example
   *      FancyButton = document.register("fancy-button", {
   *        extends: 'button',
   *        prototype: Object.create(HTMLButtonElement.prototype, {
   *          readyCallback: {
   *            value: function() {
   *              console.log("a fancy-button was created",
   *            }
   *          }
   *        })
   *      });
   * @return {Function} Constructor for the newly registered type.
   */
  function register(name, options) {
    //console.warn('document.register("' + name + '", ', options, ')');
    // construct a defintion out of options
    // TODO(sjmiles): probably should clone options instead of mutating it
    var definition = options || {};
    if (!name) {
      // TODO(sjmiles): replace with more appropriate error (EricB can probably
      // offer guidance)
      throw new Error('document.register: first argument `name` must not be empty');
    }
    if (name.indexOf('-') < 0) {
      // TODO(sjmiles): replace with more appropriate error (EricB can probably
      // offer guidance)
      throw new Error('document.register: first argument (\'name\') must contain a dash (\'-\'). Argument provided was \'' + String(name) + '\'.');
    }
    // record name
    definition.name = name;
    // must have a prototype, default to an extension of HTMLElement
    // TODO(sjmiles): probably should throw if no prototype, check spec
    if (!definition.prototype) {
      // TODO(sjmiles): replace with more appropriate error (EricB can probably
      // offer guidance)
      throw new Error('Options missing required prototype property');
    }
    // ensure a lifecycle object so we don't have to null test it
    definition.lifecycle = definition.lifecycle || {};
    // build a list of ancestral custom elements (for native base detection)
    // TODO(sjmiles): we used to need to store this, but current code only
    // uses it in 'resolveTagName': it should probably be inlined
    definition.ancestry = ancestry(definition.extends);
    // extensions of native specializations of HTMLElement require localName
    // to remain native, and use secondary 'is' specifier for extension type
    resolveTagName(definition);
    // some platforms require modifications to the user-supplied prototype
    // chain
    resolvePrototypeChain(definition);
    // overrides to implement attributeChanged callback
    overrideAttributeApi(definition.prototype);
    // 7.1.5: Register the DEFINITION with DOCUMENT
    registerDefinition(name, definition);
    // 7.1.7. Run custom element constructor generation algorithm with PROTOTYPE
    // 7.1.8. Return the output of the previous step.
    definition.ctor = generateConstructor(definition);
    definition.ctor.prototype = definition.prototype;
    // force our .constructor to be our actual constructor
    definition.prototype.constructor = definition.ctor;
    // if initial parsing is complete
    if (scope.ready) {
      // upgrade any pre-existing nodes of this type
      scope.upgradeAll(document);
    }
    return definition.ctor;
  }

  function ancestry(extnds) {
    var extendee = registry[extnds];
    if (extendee) {
      return ancestry(extendee.extends).concat([extendee]);
    }
    return [];
  }

  function resolveTagName(definition) {
    // if we are explicitly extending something, that thing is our
    // baseTag, unless it represents a custom component
    var baseTag = definition.extends;
    // if our ancestry includes custom components, we only have a
    // baseTag if one of them does
    for (var i=0, a; (a=definition.ancestry[i]); i++) {
      baseTag = a.is && a.tag;
    }
    // our tag is our baseTag, if it exists, and otherwise just our name
    definition.tag = baseTag || definition.name;
    if (baseTag) {
      // if there is a base tag, use secondary 'is' specifier
      definition.is = definition.name;
    }
  }

  function resolvePrototypeChain(definition) {
    // if we don't support __proto__ we need to locate the native level
    // prototype for precise mixing in
    if (!Object.__proto__) {
      // default prototype
      var nativePrototype = HTMLElement.prototype;
      // work out prototype when using type-extension
      if (definition.is) {
        var inst = document.createElement(definition.tag);
        nativePrototype = Object.getPrototypeOf(inst);
      }
      // ensure __proto__ reference is installed at each point on the prototype
      // chain.
      // NOTE: On platforms without __proto__, a mixin strategy is used instead
      // of prototype swizzling. In this case, this generated __proto__ provides
      // limited support for prototype traversal.
      var proto = definition.prototype, ancestor;
      while (proto && (proto !== nativePrototype)) {
        var ancestor = Object.getPrototypeOf(proto);
        proto.__proto__ = ancestor;
        proto = ancestor;
      }
    }
    // cache this in case of mixin
    definition.native = nativePrototype;
  }

  // SECTION 4

  function instantiate(definition) {
    // 4.a.1. Create a new object that implements PROTOTYPE
    // 4.a.2. Let ELEMENT by this new object
    //
    // the custom element instantiation algorithm must also ensure that the
    // output is a valid DOM element with the proper wrapper in place.
    //
    return upgrade(domCreateElement(definition.tag), definition);
  }

  function upgrade(element, definition) {
    // some definitions specify an 'is' attribute
    if (definition.is) {
      element.setAttribute('is', definition.is);
    }
    // make 'element' implement definition.prototype
    implement(element, definition);
    // flag as upgraded
    element.__upgraded__ = true;
    // there should never be a shadow root on element at this point
    // we require child nodes be upgraded before `created`
    scope.upgradeSubtree(element);
    // lifecycle management
    created(element);
    // OUTPUT
    return element;
  }

  function implement(element, definition) {
    // prototype swizzling is best
    if (Object.__proto__) {
      element.__proto__ = definition.prototype;
    } else {
      // where above we can re-acquire inPrototype via
      // getPrototypeOf(Element), we cannot do so when
      // we use mixin, so we install a magic reference
      customMixin(element, definition.prototype, definition.native);
      element.__proto__ = definition.prototype;
    }
  }

  function customMixin(inTarget, inSrc, inNative) {
    // TODO(sjmiles): 'used' allows us to only copy the 'youngest' version of
    // any property. This set should be precalculated. We also need to
    // consider this for supporting 'super'.
    var used = {};
    // start with inSrc
    var p = inSrc;
    // sometimes the default is HTMLUnknownElement.prototype instead of
    // HTMLElement.prototype, so we add a test
    // the idea is to avoid mixing in native prototypes, so adding
    // the second test is WLOG
    while (p !== inNative && p !== HTMLUnknownElement.prototype) {
      var keys = Object.getOwnPropertyNames(p);
      for (var i=0, k; k=keys[i]; i++) {
        if (!used[k]) {
          Object.defineProperty(inTarget, k,
              Object.getOwnPropertyDescriptor(p, k));
          used[k] = 1;
        }
      }
      p = Object.getPrototypeOf(p);
    }
  }

  function created(element) {
    // invoke createdCallback
    if (element.createdCallback) {
      element.createdCallback();
    }
  }

  // attribute watching

  function overrideAttributeApi(prototype) {
    // overrides to implement callbacks
    // TODO(sjmiles): should support access via .attributes NamedNodeMap
    // TODO(sjmiles): preserves user defined overrides, if any
    var setAttribute = prototype.setAttribute;
    prototype.setAttribute = function(name, value) {
      changeAttribute.call(this, name, value, setAttribute);
    }
    var removeAttribute = prototype.removeAttribute;
    prototype.removeAttribute = function(name, value) {
      changeAttribute.call(this, name, value, removeAttribute);
    }
  }

  function changeAttribute(name, value, operation) {
    var oldValue = this.getAttribute(name);
    operation.apply(this, arguments);
    if (this.attributeChangedCallback 
        && (this.getAttribute(name) !== oldValue)) {
      this.attributeChangedCallback(name, oldValue);
    }
  }

  // element registry (maps tag names to definitions)

  var registry = {};

  function registerDefinition(name, definition) {
    registry[name] = definition;
  }

  function generateConstructor(definition) {
    return function() {
      return instantiate(definition);
    };
  }

  function createElement(tag, typeExtension) {
    // TODO(sjmiles): ignore 'tag' when using 'typeExtension', we could
    // error check it, or perhaps there should only ever be one argument
    var definition = registry[typeExtension || tag];
    if (definition) {
      return new definition.ctor();
    }
    return domCreateElement(tag);
  }

  function upgradeElement(element) {
    if (!element.__upgraded__ && (element.nodeType === Node.ELEMENT_NODE)) {
      var type = element.getAttribute('is') || element.localName;
      var definition = registry[type];
      return definition && upgrade(element, definition);
    }
  }

  function cloneNode(deep) {
    // call original clone
    var n = domCloneNode.call(this, deep);
    // upgrade the element and subtree
    scope.upgradeAll(n);
    // return the clone
    return n;
  }
  // capture native createElement before we override it

  var domCreateElement = document.createElement.bind(document);

  // capture native cloneNode before we override it

  var domCloneNode = Node.prototype.cloneNode;

  // exports

  document.register = register;
  document.createElement = createElement; // override
  Node.prototype.cloneNode = cloneNode; // override

  scope.registry = registry;

  /**
   * Upgrade an element to a custom element. Upgrading an element
   * causes the custom prototype to be applied, an `is` attribute 
   * to be attached (as needed), and invocation of the `readyCallback`.
   * `upgrade` does nothing if the element is already upgraded, or
   * if it matches no registered custom tag name.
   *
   * @method ugprade
   * @param {Element} element The element to upgrade.
   * @return {Element} The upgraded element.
   */
  scope.upgrade = upgradeElement;
}

scope.hasNative = hasNative;
scope.useNative = useNative;

})(window.CustomElements);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function() {

// import

var IMPORT_LINK_TYPE = window.HTMLImports ? HTMLImports.IMPORT_LINK_TYPE : 'none';

// highlander object for parsing a document tree

var parser = {
  selectors: [
    'link[rel=' + IMPORT_LINK_TYPE + ']'
  ],
  map: {
    link: 'parseLink'
  },
  parse: function(inDocument) {
    if (!inDocument.__parsed) {
      // only parse once
      inDocument.__parsed = true;
      // all parsable elements in inDocument (depth-first pre-order traversal)
      var elts = inDocument.querySelectorAll(parser.selectors);
      // for each parsable node type, call the mapped parsing method
      forEach(elts, function(e) {
        parser[parser.map[e.localName]](e);
      });
      // upgrade all upgradeable static elements, anything dynamically
      // created should be caught by observer
      CustomElements.upgradeDocument(inDocument);
      // observe document for dom changes
      CustomElements.observeDocument(inDocument);
    }
  },
  parseLink: function(linkElt) {
    // imports
    if (isDocumentLink(linkElt)) {
      this.parseImport(linkElt);
    }
  },
  parseImport: function(linkElt) {
    if (linkElt.content) {
      parser.parse(linkElt.content);
    }
  }
};

function isDocumentLink(inElt) {
  return (inElt.localName === 'link'
      && inElt.getAttribute('rel') === IMPORT_LINK_TYPE);
}

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

// exports

CustomElements.parser = parser;

})();
/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(){

// bootstrap parsing
function bootstrap() {
  // parse document
  CustomElements.parser.parse(document);
  // one more pass before register is 'live'
  CustomElements.upgradeDocument(document);  
  // choose async
  var async = window.Platform && Platform.endOfMicrotask ? 
    Platform.endOfMicrotask :
    setTimeout;
  async(function() {
    // set internal 'ready' flag, now document.register will trigger 
    // synchronous upgrades
    CustomElements.ready = true;
    // capture blunt profiling data
    CustomElements.readyTime = Date.now();
    if (window.HTMLImports) {
      CustomElements.elapsed = CustomElements.readyTime - HTMLImports.readyTime;
    }
    // notify the system that we are bootstrapped
    document.body.dispatchEvent(
      new CustomEvent('WebComponentsReady', {bubbles: true})
    );
  });
}

// CustomEvent shim for IE
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function(inType) {
     var e = document.createEvent('HTMLEvents');
     e.initEvent(inType, true, true);
     return e;
  };
}

if (document.readyState === 'complete') {
  bootstrap();
} else {
  var loadEvent = window.HTMLImports ? 'HTMLImportsLoaded' : 'DOMContentLoaded';
  window.addEventListener(loadEvent, bootstrap);
}

})();

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function() {

// inject style sheet
var style = document.createElement('style');
style.textContent = 'element {display: none !important;} /* injected by platform.js */';
var head = document.querySelector('head');
head.insertBefore(style, head.firstChild);

if (window.ShadowDOMPolyfill) {

  function nop() {};

  // disable shadow dom watching
  CustomElements.watchShadow = nop;
  CustomElements.watchAllShadows = nop;

  // ensure wrapped inputs for these functions
  var fns = ['upgradeAll', 'upgradeSubtree', 'observeDocument',
      'upgradeDocument'];

  // cache originals
  var original = {};
  fns.forEach(function(fn) {
    original[fn] = CustomElements[fn];
  });

  // override
  fns.forEach(function(fn) {
    CustomElements[fn] = function(inNode) {
      return original[fn](wrap(inNode));
    };
  });

}

})();

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


/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {
  scope = scope || {};
  var target = {
    shadow: function(inEl) {
      if (inEl) {
        return inEl.shadowRoot || inEl.webkitShadowRoot;
      }
    },
    canTarget: function(shadow) {
      return shadow && Boolean(shadow.elementFromPoint);
    },
    targetingShadow: function(inEl) {
      var s = this.shadow(inEl);
      if (this.canTarget(s)) {
        return s;
      }
    },
    olderShadow: function(shadow) {
      var os = shadow.olderShadowRoot;
      if (!os) {
        var se = shadow.querySelector('shadow');
        if (se) {
          os = se.olderShadowRoot;
        }
      }
      return os;
    },
    allShadows: function(element) {
      var shadows = [], s = this.shadow(element);
      while(s) {
        shadows.push(s);
        s = this.olderShadow(s);
      }
      return shadows;
    },
    searchRoot: function(inRoot, x, y) {
      if (inRoot) {
        var t = inRoot.elementFromPoint(x, y);
        var st, sr, os;
        // is element a shadow host?
        sr = this.targetingShadow(t);
        while (sr) {
          // find the the element inside the shadow root
          st = sr.elementFromPoint(x, y);
          if (!st) {
            // check for older shadows
            sr = this.olderShadow(sr);
          } else {
            // shadowed element may contain a shadow root
            var ssr = this.targetingShadow(st);
            return this.searchRoot(ssr, x, y) || st;
          }
        }
        // light dom element is the target
        return t;
      }
    },
    owner: function(element) {
      var s = element;
      // walk up until you hit the shadow root or document
      while (s.parentNode) {
        s = s.parentNode;
      }
      return s;
    },
    findTarget: function(inEvent) {
      var x = inEvent.clientX, y = inEvent.clientY;
      // if the listener is in the shadow root, it is much faster to start there
      var s = this.owner(inEvent.target);
      // if x, y is not in this root, fall back to document search
      if (!s.elementFromPoint(x, y)) {
        s = document;
      }
      return this.searchRoot(document, x, y);
    }
  };
  scope.targetFinding = target;
  scope.findTarget = target.findTarget.bind(target);

  window.PointerEventsPolyfill = scope;
})(window.PointerEventsPolyfill);

(function() {
  function selector(v) {
    return '[touch-action="' + v + '"]';
  }
  function rule(v) {
    return '{ -ms-touch-action: ' + v + '; touch-action: ' + v + '; }';
  }
  var attrib2css = [
    'none',
    'auto',
    'pan-x',
    'pan-y',
    {
      rule: 'pan-x pan-y',
      selectors: [
        'pan-x pan-y',
        'pan-y pan-x'
      ]
    }
  ];
  var styles = '';
  attrib2css.forEach(function(r) {
    if (String(r) === r) {
      styles += selector(r) + rule(r);
    } else {
      styles += r.selectors.map(selector) + rule(r.rule);
    }
  });
  var el = document.createElement('style');
  el.textContent = styles;
  document.head.appendChild(el);
})();

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * This is the constructor for new PointerEvents.
 *
 * New Pointer Events must be given a type, and an optional dictionary of
 * initialization properties.
 *
 * Due to certain platform requirements, events returned from the constructor
 * identify as MouseEvents.
 *
 * @constructor
 * @param {String} inType The type of the event to create.
 * @param {Object} [inDict] An optional dictionary of initial event properties.
 * @return {Event} A new PointerEvent of type `inType` and initialized with properties from `inDict`.
 */
(function(scope) {
  // test for DOM Level 4 Events
  var NEW_MOUSE_EVENT = false;
  var HAS_BUTTONS = false;
  try {
    var ev = new MouseEvent('click', {buttons: 1});
    NEW_MOUSE_EVENT = true;
    HAS_BUTTONS = ev.buttons === 1;
  } catch(e) {
  }

  function PointerEvent(inType, inDict) {
    inDict = inDict || {};
    // According to the w3c spec,
    // http://www.w3.org/TR/DOM-Level-3-Events/#events-MouseEvent-button
    // MouseEvent.button == 0 can mean either no mouse button depressed, or the
    // left mouse button depressed.
    //
    // As of now, the only way to distinguish between the two states of
    // MouseEvent.button is by using the deprecated MouseEvent.which property, as
    // this maps mouse buttons to positive integers > 0, and uses 0 to mean that
    // no mouse button is held.
    //
    // MouseEvent.which is derived from MouseEvent.button at MouseEvent creation,
    // but initMouseEvent does not expose an argument with which to set
    // MouseEvent.which. Calling initMouseEvent with a buttonArg of 0 will set
    // MouseEvent.button == 0 and MouseEvent.which == 1, breaking the expectations
    // of app developers.
    //
    // The only way to propagate the correct state of MouseEvent.which and
    // MouseEvent.button to a new MouseEvent.button == 0 and MouseEvent.which == 0
    // is to call initMouseEvent with a buttonArg value of -1.
    //
    // This is fixed with DOM Level 4's use of buttons
    var buttons = inDict.buttons;
    if (buttons === undefined) {
      switch (inDict.which) {
        case 1: buttons = 1; break;
        case 2: buttons = 4; break;
        case 3: buttons = 2; break;
        default: buttons = 0;
      }
    }

    var e;
    if (NEW_MOUSE_EVENT) {
      e = new MouseEvent(inType, inDict);
    } else {
      e = document.createEvent('MouseEvent');
      // import values from the given dictionary
      var props = {
        bubbles: false,
        cancelable: false,
        view: null,
        detail: null,
        screenX: 0,
        screenY: 0,
        clientX: 0,
        clientY: 0,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        button: 0,
        relatedTarget: null
      };

      Object.keys(props).forEach(function(k) {
        if (k in inDict) {
          props[k] = inDict[k];
        }
      });

      // define the properties inherited from MouseEvent
      e.initMouseEvent(
        inType, props.bubbles, props.cancelable, props.view, props.detail,
        props.screenX, props.screenY, props.clientX, props.clientY, props.ctrlKey,
        props.altKey, props.shiftKey, props.metaKey, props.button, props.relatedTarget
      );
    }

    // define the buttons property according to DOM Level 3 spec
    if (!HAS_BUTTONS) {
      // IE 10 has buttons on MouseEvent.prototype as a getter w/o any setting
      // mechanism
      Object.defineProperty(e, 'buttons', {get: function(){ return buttons; }, enumerable: true});
    }

    // Spec requires that pointers without pressure specified use 0.5 for down
    // state and 0 for up state.
    var pressure = 0;
    if (inDict.pressure) {
      pressure = inDict.pressure;
    } else {
      pressure = buttons ? 0.5 : 0;
    }

    // define the properties of the PointerEvent interface
    Object.defineProperties(e, {
      pointerId: { value: inDict.pointerId || 0, enumerable: true },
      width: { value: inDict.width || 0, enumerable: true },
      height: { value: inDict.height || 0, enumerable: true },
      pressure: { value: pressure, enumerable: true },
      tiltX: { value: inDict.tiltX || 0, enumerable: true },
      tiltY: { value: inDict.tiltY || 0, enumerable: true },
      pointerType: { value: inDict.pointerType || '', enumerable: true },
      hwTimestamp: { value: inDict.hwTimestamp || 0, enumerable: true },
      isPrimary: { value: inDict.isPrimary || false, enumerable: true }
    });
    return e;
  }

  // attach to window
  if (!scope.PointerEvent) {
    scope.PointerEvent = PointerEvent;
  }
})(window);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * This module implements an ordered list of pointer states
 * Each pointer object here has two properties:
 *  - id: the id of the pointer
 *  - event: the source event of the pointer, complete with positions
 *
 * The ordering of the pointers is from oldest pointer to youngest pointer,
 * which allows for multi-pointer gestures to not rely on the actual ids
 * imported from the source events.
 *
 * Any operation that needs to store state information about pointers can hang
 * objects off of the pointer in the pointermap. This information will be
 * preserved until the pointer is removed from the pointermap.
 */
(function(scope) {
  function PointerMap() {
    this.ids = [];
    this.pointers = [];
  };

  PointerMap.prototype = {
    set: function(inId, inEvent) {
      var i = this.ids.indexOf(inId);
      if (i > -1) {
        this.pointers[i] = inEvent;
      } else {
        this.ids.push(inId);
        this.pointers.push(inEvent);
      }
    },
    has: function(inId) {
      return this.ids.indexOf(inId) > -1;
    },
    'delete': function(inId) {
      var i = this.ids.indexOf(inId);
      if (i > -1) {
        this.ids.splice(i, 1);
        this.pointers.splice(i, 1);
      }
    },
    get: function(inId) {
      var i = this.ids.indexOf(inId);
      return this.pointers[i];
    },
    get size() {
      return this.pointers.length;
    },
    clear: function() {
      this.ids.length = 0;
      this.pointers.length = 0;
    },
    forEach: function(callback, thisArg) {
      this.ids.forEach(function(id, i) {
        callback.call(thisArg, id, this.pointers[i], this);
      }, this);
    }
  };

  if (window.Map && Map.prototype.forEach) {
    scope.PointerMap = Map;
  } else {
    scope.PointerMap = PointerMap;
  }
})(window.PointerEventsPolyfill);

/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

// SideTable is a weak map where possible. If WeakMap is not available the
// association is stored as an expando property.
var SideTable;
// TODO(arv): WeakMap does not allow for Node etc to be keys in Firefox
if (typeof WeakMap !== 'undefined' && navigator.userAgent.indexOf('Firefox/') < 0) {
  SideTable = WeakMap;
} else {
  (function() {
    var defineProperty = Object.defineProperty;
    var counter = Date.now() % 1e9;

    SideTable = function() {
      this.name = '__st' + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
    };

    SideTable.prototype = {
      set: function(key, value) {
        var entry = key[this.name];
        if (entry && entry[0] === key)
          entry[1] = value;
        else
          defineProperty(key, this.name, {value: [key, value], writable: true});
      },
      get: function(key) {
        var entry;
        return (entry = key[this.name]) && entry[0] === key ?
            entry[1] : undefined;
      },
      delete: function(key) {
        this.set(key, undefined);
      }
    }
  })();
}

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

  /**
   * This module is for normalizing events. Mouse and Touch events will be
   * collected here, and fire PointerEvents that have the same semantics, no
   * matter the source.
   * Events fired:
   *   - pointerdown: a pointing is added
   *   - pointerup: a pointer is removed
   *   - pointermove: a pointer is moved
   *   - pointerover: a pointer crosses into an element
   *   - pointerout: a pointer leaves an element
   *   - pointercancel: a pointer will no longer generate events
   */
  var dispatcher = {
    targets: new SideTable,
    handledEvents: new SideTable,
    pointermap: new scope.PointerMap,
    eventMap: {},
    // Scope objects for native events.
    // This exists for ease of testing.
    eventSources: {},
    eventSourceList: [],
    /**
     * Add a new event source that will generate pointer events.
     *
     * `inSource` must contain an array of event names named `events`, and
     * functions with the names specified in the `events` array.
     * @param {string} name A name for the event source
     * @param {Object} source A new source of platform events.
     */
    registerSource: function(name, source) {
      var s = source;
      var newEvents = s.events;
      if (newEvents) {
        newEvents.forEach(function(e) {
          if (s[e]) {
            this.eventMap[e] = s[e].bind(s);
          }
        }, this);
        this.eventSources[name] = s;
        this.eventSourceList.push(s);
      }
    },
    register: function(element) {
      var l = this.eventSourceList.length;
      for (var i = 0, es; (i < l) && (es = this.eventSourceList[i]); i++) {
        // call eventsource register
        es.register.call(es, element);
      }
    },
    unregister: function(element) {
      var l = this.eventSourceList.length;
      for (var i = 0, es; (i < l) && (es = this.eventSourceList[i]); i++) {
        // call eventsource register
        es.unregister.call(es, element);
      }
    },
    // EVENTS
    down: function(inEvent) {
      this.fireEvent('pointerdown', inEvent);
    },
    move: function(inEvent) {
      this.fireEvent('pointermove', inEvent);
    },
    up: function(inEvent) {
      this.fireEvent('pointerup', inEvent);
    },
    enter: function(inEvent) {
      inEvent.bubbles = false;
      this.fireEvent('pointerenter', inEvent);
    },
    leave: function(inEvent) {
      inEvent.bubbles = false;
      this.fireEvent('pointerleave', inEvent);
    },
    over: function(inEvent) {
      inEvent.bubbles = true;
      this.fireEvent('pointerover', inEvent);
    },
    out: function(inEvent) {
      inEvent.bubbles = true;
      this.fireEvent('pointerout', inEvent);
    },
    cancel: function(inEvent) {
      this.fireEvent('pointercancel', inEvent);
    },
    leaveOut: function(event) {
      if (!event.target.contains(event.relatedTarget)) {
        this.leave(event);
      }
      this.out(event);
    },
    enterOver: function(event) {
      if (!event.target.contains(event.relatedTarget)) {
        this.enter(event);
      }
      this.over(event);
    },
    // LISTENER LOGIC
    eventHandler: function(inEvent) {
      // This is used to prevent multiple dispatch of pointerevents from
      // platform events. This can happen when two elements in different scopes
      // are set up to create pointer events, which is relevant to Shadow DOM.
      if (this.handledEvents.get(inEvent)) {
        return;
      }
      var type = inEvent.type;
      var fn = this.eventMap && this.eventMap[type];
      if (fn) {
        fn(inEvent);
      }
      this.handledEvents.set(inEvent, true);
    },
    // set up event listeners
    listen: function(target, events) {
      events.forEach(function(e) {
        this.addEvent(target, e);
      }, this);
    },
    // remove event listeners
    unlisten: function(target, events) {
      events.forEach(function(e) {
        this.removeEvent(target, e);
      }, this);
    },
    addEvent: function(target, eventName) {
      target.addEventListener(eventName, this.boundHandler);
    },
    removeEvent: function(target, eventName) {
      target.removeEventListener(eventName, this.boundHandler);
    },
    // EVENT CREATION AND TRACKING
    /**
     * Creates a new Event of type `inType`, based on the information in
     * `inEvent`.
     *
     * @param {string} inType A string representing the type of event to create
     * @param {Event} inEvent A platform event with a target
     * @return {Event} A PointerEvent of type `inType`
     */
    makeEvent: function(inType, inEvent) {
      var e = new PointerEvent(inType, inEvent);
      this.targets.set(e, this.targets.get(inEvent) || inEvent.target);
      return e;
    },
    // make and dispatch an event in one call
    fireEvent: function(inType, inEvent) {
      var e = this.makeEvent(inType, inEvent);
      return this.dispatchEvent(e);
    },
    /**
     * Returns a snapshot of inEvent, with writable properties.
     *
     * @param {Event} inEvent An event that contains properties to copy.
     * @return {Object} An object containing shallow copies of `inEvent`'s
     *    properties.
     */
    cloneEvent: function(inEvent) {
      var eventCopy = {};
      for (var n in inEvent) {
        eventCopy[n] = inEvent[n];
      }
      return eventCopy;
    },
    getTarget: function(inEvent) {
      // if pointer capture is set, route all events for the specified pointerId
      // to the capture target
      if (this.captureInfo) {
        if (this.captureInfo.id === inEvent.pointerId) {
          return this.captureInfo.target;
        }
      }
      return this.targets.get(inEvent);
    },
    setCapture: function(inPointerId, inTarget) {
      if (this.captureInfo) {
        this.releaseCapture(this.captureInfo.id);
      }
      this.captureInfo = {id: inPointerId, target: inTarget};
      var e = new PointerEvent('gotpointercapture', { bubbles: true });
      this.implicitRelease = this.releaseCapture.bind(this, inPointerId);
      document.addEventListener('pointerup', this.implicitRelease);
      document.addEventListener('pointercancel', this.implicitRelease);
      this.targets.set(e, inTarget);
      this.asyncDispatchEvent(e);
    },
    releaseCapture: function(inPointerId) {
      if (this.captureInfo && this.captureInfo.id === inPointerId) {
        var e = new PointerEvent('lostpointercapture', { bubbles: true });
        var t = this.captureInfo.target;
        this.captureInfo = null;
        document.removeEventListener('pointerup', this.implicitRelease);
        document.removeEventListener('pointercancel', this.implicitRelease);
        this.targets.set(e, t);
        this.asyncDispatchEvent(e);
      }
    },
    /**
     * Dispatches the event to its target.
     *
     * @param {Event} inEvent The event to be dispatched.
     * @return {Boolean} True if an event handler returns true, false otherwise.
     */
    dispatchEvent: function(inEvent) {
      var t = this.getTarget(inEvent);
      if (t) {
        return t.dispatchEvent(inEvent);
      }
    },
    asyncDispatchEvent: function(inEvent) {
      setTimeout(this.dispatchEvent.bind(this, inEvent), 0);
    }
  };
  dispatcher.boundHandler = dispatcher.eventHandler.bind(dispatcher);
  scope.dispatcher = dispatcher;
  scope.register = dispatcher.register.bind(dispatcher);
  scope.unregister = dispatcher.unregister.bind(dispatcher);
})(window.PointerEventsPolyfill);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * This module uses Mutation Observers to dynamically adjust which nodes will
 * generate Pointer Events.
 *
 * All nodes that wish to generate Pointer Events must have the attribute
 * `touch-action` set to `none`.
 */
(function(scope) {
  var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
  var map = Array.prototype.map.call.bind(Array.prototype.map);
  var toArray = Array.prototype.slice.call.bind(Array.prototype.slice);
  var filter = Array.prototype.filter.call.bind(Array.prototype.filter);
  var MO = window.MutationObserver || window.WebKitMutationObserver;
  var SELECTOR = '[touch-action]';
  var OBSERVER_INIT = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['touch-action']
  };

  function Installer(add, remove, changed, binder) {
    this.addCallback = add.bind(binder);
    this.removeCallback = remove.bind(binder);
    this.changedCallback = changed.bind(binder);
    if (MO) {
      this.observer = new MO(this.mutationWatcher.bind(this));
    }
  }

  Installer.prototype = {
    watchSubtree: function(target) {
      // Only watch scopes that can target find, as these are top-level.
      // Otherwise we can see duplicate additions and removals that add noise.
      //
      // TODO(dfreedman): For some instances with ShadowDOMPolyfill, we can see
      // a removal without an insertion when a node is redistributed among
      // shadows. Since it all ends up correct in the document, watching only
      // the document will yield the correct mutations to watch.
      if (scope.targetFinding.canTarget(target)) {
        this.observer.observe(target, OBSERVER_INIT);
      }
    },
    enableOnSubtree: function(target) {
      this.watchSubtree(target);
      if (target === document && document.readyState !== 'complete') {
        this.installOnLoad();
      } else {
        this.installNewSubtree(target);
      }
    },
    installNewSubtree: function(target) {
      forEach(this.findElements(target), this.addElement, this);
    },
    findElements: function(target) {
      if (target.querySelectorAll) {
        return target.querySelectorAll(SELECTOR);
      }
      return [];
    },
    removeElement: function(el) {
      this.removeCallback(el);
    },
    addElement: function(el) {
      this.addCallback(el);
    },
    elementChanged: function(el, oldValue) {
      this.changedCallback(el, oldValue);
    },
    concatLists: function(accum, list) {
      return accum.concat(toArray(list));
    },
    // register all touch-action = none nodes on document load
    installOnLoad: function() {
      document.addEventListener('DOMContentLoaded', this.installNewSubtree.bind(this, document));
    },
    isElement: function(n) {
      return n.nodeType === Node.ELEMENT_NODE;
    },
    flattenMutationTree: function(inNodes) {
      // find children with touch-action
      var tree = map(inNodes, this.findElements, this);
      // make sure the added nodes are accounted for
      tree.push(filter(inNodes, this.isElement));
      // flatten the list
      return tree.reduce(this.concatLists, []);
    },
    mutationWatcher: function(mutations) {
      mutations.forEach(this.mutationHandler, this);
    },
    mutationHandler: function(m) {
      if (m.type === 'childList') {
        var added = this.flattenMutationTree(m.addedNodes);
        added.forEach(this.addElement, this);
        var removed = this.flattenMutationTree(m.removedNodes);
        removed.forEach(this.removeElement, this);
      } else if (m.type === 'attributes') {
        this.elementChanged(m.target, m.oldValue);
      }
    }
  };

  if (!MO) {
    Installer.prototype.watchSubtree = function(){
      console.warn('PointerEventsPolyfill: MutationObservers not found, touch-action will not be dynamically detected');
    };
  }

  scope.Installer = Installer;
})(window.PointerEventsPolyfill);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function (scope) {
  var dispatcher = scope.dispatcher;
  var pointermap = dispatcher.pointermap;
  // radius around touchend that swallows mouse events
  var DEDUP_DIST = 25;

  // handler block for native mouse events
  var mouseEvents = {
    POINTER_ID: 1,
    POINTER_TYPE: 'mouse',
    events: [
      'mousedown',
      'mousemove',
      'mouseup',
      'mouseover',
      'mouseout'
    ],
    register: function(target) {
      dispatcher.listen(target, this.events);
    },
    unregister: function(target) {
      dispatcher.unlisten(target, this.events);
    },
    lastTouches: [],
    // collide with the global mouse listener
    isEventSimulatedFromTouch: function(inEvent) {
      var lts = this.lastTouches;
      var x = inEvent.clientX, y = inEvent.clientY;
      for (var i = 0, l = lts.length, t; i < l && (t = lts[i]); i++) {
        // simulated mouse events will be swallowed near a primary touchend
        var dx = Math.abs(x - t.x), dy = Math.abs(y - t.y);
        if (dx <= DEDUP_DIST && dy <= DEDUP_DIST) {
          return true;
        }
      }
    },
    prepareEvent: function(inEvent) {
      var e = dispatcher.cloneEvent(inEvent);
      e.pointerId = this.POINTER_ID;
      e.isPrimary = true;
      e.pointerType = this.POINTER_TYPE;
      return e;
    },
    mousedown: function(inEvent) {
      if (!this.isEventSimulatedFromTouch(inEvent)) {
        var p = pointermap.has(this.POINTER_ID);
        // TODO(dfreedman) workaround for some elements not sending mouseup
        // http://crbug/149091
        if (p) {
          this.cancel(inEvent);
        }
        var e = this.prepareEvent(inEvent);
        pointermap.set(this.POINTER_ID, inEvent);
        dispatcher.down(e);
      }
    },
    mousemove: function(inEvent) {
      if (!this.isEventSimulatedFromTouch(inEvent)) {
        var e = this.prepareEvent(inEvent);
        dispatcher.move(e);
      }
    },
    mouseup: function(inEvent) {
      if (!this.isEventSimulatedFromTouch(inEvent)) {
        var p = pointermap.get(this.POINTER_ID);
        if (p && p.button === inEvent.button) {
          var e = this.prepareEvent(inEvent);
          dispatcher.up(e);
          this.cleanupMouse();
        }
      }
    },
    mouseover: function(inEvent) {
      if (!this.isEventSimulatedFromTouch(inEvent)) {
        var e = this.prepareEvent(inEvent);
        dispatcher.enterOver(e);
      }
    },
    mouseout: function(inEvent) {
      if (!this.isEventSimulatedFromTouch(inEvent)) {
        var e = this.prepareEvent(inEvent);
        dispatcher.leaveOut(e);
      }
    },
    cancel: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      dispatcher.cancel(e);
      this.cleanupMouse();
    },
    cleanupMouse: function() {
      pointermap.delete(this.POINTER_ID);
    }
  };

  scope.mouseEvents = mouseEvents;
})(window.PointerEventsPolyfill);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {
  var dispatcher = scope.dispatcher;
  var findTarget = scope.findTarget;
  var allShadows = scope.targetFinding.allShadows.bind(scope.targetFinding);
  var pointermap = dispatcher.pointermap;
  var touchMap = Array.prototype.map.call.bind(Array.prototype.map);
  // This should be long enough to ignore compat mouse events made by touch
  var DEDUP_TIMEOUT = 2500;
  var CLICK_COUNT_TIMEOUT = 200;
  var ATTRIB = 'touch-action';
  var INSTALLER;
  var HAS_TOUCH_ACTION = (typeof document.head.style.touchAction) === 'string';

  // handler block for native touch events
  var touchEvents = {
    scrollType: new SideTable,
    events: [
      'touchstart',
      'touchmove',
      'touchend',
      'touchcancel'
    ],
    register: function(target) {
      if (HAS_TOUCH_ACTION) {
        dispatcher.listen(target, this.events);
      } else {
        INSTALLER.enableOnSubtree(target);
      }
    },
    unregister: function(target) {
      if (HAS_TOUCH_ACTION) {
        dispatcher.unlisten(target, this.events);
      } else {
        // TODO(dfreedman): is it worth it to disconnect the MO?
      }
    },
    elementAdded: function(el) {
      var a = el.getAttribute(ATTRIB);
      var st = this.touchActionToScrollType(a);
      if (st) {
        this.scrollType.set(el, st);
        dispatcher.listen(el, this.events);
        // set touch-action on shadows as well
        allShadows(el).forEach(function(s) {
          this.scrollType.set(s, st);
          dispatcher.listen(s, this.events);
        }, this);
      }
    },
    elementRemoved: function(el) {
      this.scrollType.delete(el);
      dispatcher.unlisten(el, this.events);
      // remove touch-action from shadow
      allShadows(el).forEach(function(s) {
        this.scrollType.delete(s);
        dispatcher.unlisten(s, this.events);
      }, this);
    },
    elementChanged: function(el, oldValue) {
      var a = el.getAttribute(ATTRIB);
      var st = this.touchActionToScrollType(a);
      var oldSt = this.touchActionToScrollType(oldValue);
      // simply update scrollType if listeners are already established
      if (st && oldSt) {
        this.scrollType.set(el, st);
        allShadows(el).forEach(function(s) {
          this.scrollType.set(s, st);
        }, this);
      } else if (oldSt) {
        this.elementRemoved(el);
      } else if (st) {
        this.elementAdded(el);
      }
    },
    scrollTypes: {
      EMITTER: 'none',
      XSCROLLER: 'pan-x',
      YSCROLLER: 'pan-y',
      SCROLLER: /^(?:pan-x pan-y)|(?:pan-y pan-x)|auto$/
    },
    touchActionToScrollType: function(touchAction) {
      var t = touchAction;
      var st = this.scrollTypes;
      if (t === 'none') {
        return 'none';
      } else if (t === st.XSCROLLER) {
        return 'X';
      } else if (t === st.YSCROLLER) {
        return 'Y';
      } else if (st.SCROLLER.exec(t)) {
        return 'XY';
      }
    },
    POINTER_TYPE: 'touch',
    firstTouch: null,
    isPrimaryTouch: function(inTouch) {
      return this.firstTouch === inTouch.identifier;
    },
    setPrimaryTouch: function(inTouch) {
      if (this.firstTouch === null) {
        this.firstTouch = inTouch.identifier;
        this.firstXY = {X: inTouch.clientX, Y: inTouch.clientY};
        this.scrolling = false;
        this.cancelResetClickCount();
      }
    },
    removePrimaryTouch: function(inTouch) {
      if (this.isPrimaryTouch(inTouch)) {
        this.firstTouch = null;
        this.firstXY = null;
        this.resetClickCount();
      }
    },
    clickCount: 0,
    resetId: null,
    resetClickCount: function() {
      var fn = function() {
        this.clickCount = 0;
        this.resetId = null;
      }.bind(this);
      this.resetId = setTimeout(fn, CLICK_COUNT_TIMEOUT);
    },
    cancelResetClickCount: function() {
      if (this.resetId) {
        clearTimeout(this.resetId);
      }
    },
    touchToPointer: function(inTouch) {
      var e = dispatcher.cloneEvent(inTouch);
      // Spec specifies that pointerId 1 is reserved for Mouse.
      // Touch identifiers can start at 0.
      // Add 2 to the touch identifier for compatibility.
      e.pointerId = inTouch.identifier + 2;
      e.target = findTarget(e);
      e.bubbles = true;
      e.cancelable = true;
      e.detail = this.clickCount;
      e.button = 0;
      e.buttons = 1;
      e.width = inTouch.webkitRadiusX || inTouch.radiusX || 0;
      e.height = inTouch.webkitRadiusY || inTouch.radiusY || 0;
      e.pressure = inTouch.webkitForce || inTouch.force || 0.5;
      e.isPrimary = this.isPrimaryTouch(inTouch);
      e.pointerType = this.POINTER_TYPE;
      return e;
    },
    processTouches: function(inEvent, inFunction) {
      var tl = inEvent.changedTouches;
      var pointers = touchMap(tl, this.touchToPointer, this);
      pointers.forEach(inFunction, this);
    },
    // For single axis scrollers, determines whether the element should emit
    // pointer events or behave as a scroller
    shouldScroll: function(inEvent) {
      if (this.firstXY) {
        var ret;
        var scrollAxis = this.scrollType.get(inEvent.currentTarget);
        if (scrollAxis === 'none') {
          // this element is a touch-action: none, should never scroll
          ret = false;
        } else if (scrollAxis === 'XY') {
          // this element should always scroll
          ret = true;
        } else {
          var t = inEvent.changedTouches[0];
          // check the intended scroll axis, and other axis
          var a = scrollAxis;
          var oa = scrollAxis === 'Y' ? 'X' : 'Y';
          var da = Math.abs(t['client' + a] - this.firstXY[a]);
          var doa = Math.abs(t['client' + oa] - this.firstXY[oa]);
          // if delta in the scroll axis > delta other axis, scroll instead of
          // making events
          ret = da >= doa;
        }
        this.firstXY = null;
        return ret;
      }
    },
    findTouch: function(inTL, inId) {
      for (var i = 0, l = inTL.length, t; i < l && (t = inTL[i]); i++) {
        if (t.identifier === inId) {
          return true;
        }
      }
    },
    // In some instances, a touchstart can happen without a touchend. This
    // leaves the pointermap in a broken state.
    // Therefore, on every touchstart, we remove the touches that did not fire a
    // touchend event.
    // To keep state globally consistent, we fire a
    // pointercancel for this "abandoned" touch
    vacuumTouches: function(inEvent) {
      var tl = inEvent.touches;
      // pointermap.size should be < tl.length here, as the touchstart has not
      // been processed yet.
      if (pointermap.size >= tl.length) {
        var d = [];
        pointermap.forEach(function(key, value) {
          // Never remove pointerId == 1, which is mouse.
          // Touch identifiers are 2 smaller than their pointerId, which is the
          // index in pointermap.
          if (key !== 1 && !this.findTouch(tl, key - 2)) {
            var p = value.out;
            d.push(this.touchToPointer(p));
          }
        }, this);
        d.forEach(this.cancelOut, this);
      }
    },
    touchstart: function(inEvent) {
      this.vacuumTouches(inEvent);
      this.setPrimaryTouch(inEvent.changedTouches[0]);
      this.dedupSynthMouse(inEvent);
      if (!this.scrolling) {
        this.clickCount++;
        this.processTouches(inEvent, this.overDown);
      }
    },
    overDown: function(inPointer) {
      var p = pointermap.set(inPointer.pointerId, {
        target: inPointer.target,
        out: inPointer,
        outTarget: inPointer.target
      });
      dispatcher.over(inPointer);
      dispatcher.down(inPointer);
    },
    touchmove: function(inEvent) {
      if (!this.scrolling) {
        if (this.shouldScroll(inEvent)) {
          this.scrolling = true;
          this.touchcancel(inEvent);
        } else {
          inEvent.preventDefault();
          this.processTouches(inEvent, this.moveOverOut);
        }
      }
    },
    moveOverOut: function(inPointer) {
      var event = inPointer;
      var pointer = pointermap.get(event.pointerId);
      // a finger drifted off the screen, ignore it
      if (!pointer) {
        return;
      }
      var outEvent = pointer.out;
      var outTarget = pointer.outTarget;
      dispatcher.move(event);
      if (outEvent && outTarget !== event.target) {
        outEvent.relatedTarget = event.target;
        event.relatedTarget = outTarget;
        // recover from retargeting by shadow
        outEvent.target = outTarget;
        if (event.target) {
          dispatcher.leaveOut(outEvent);
          dispatcher.enterOver(event);
        } else {
          // clean up case when finger leaves the screen
          event.target = outTarget;
          event.relatedTarget = null;
          this.cancelOut(event);
        }
      }
      pointer.out = event;
      pointer.outTarget = event.target;
    },
    touchend: function(inEvent) {
      this.dedupSynthMouse(inEvent);
      this.processTouches(inEvent, this.upOut);
    },
    upOut: function(inPointer) {
      if (!this.scrolling) {
        dispatcher.up(inPointer);
        dispatcher.out(inPointer);
      }
      this.cleanUpPointer(inPointer);
    },
    touchcancel: function(inEvent) {
      this.processTouches(inEvent, this.cancelOut);
    },
    cancelOut: function(inPointer) {
      dispatcher.cancel(inPointer);
      dispatcher.out(inPointer);
      this.cleanUpPointer(inPointer);
    },
    cleanUpPointer: function(inPointer) {
      pointermap.delete(inPointer.pointerId);
      this.removePrimaryTouch(inPointer);
    },
    // prevent synth mouse events from creating pointer events
    dedupSynthMouse: function(inEvent) {
      var lts = scope.mouseEvents.lastTouches;
      var t = inEvent.changedTouches[0];
      // only the primary finger will synth mouse events
      if (this.isPrimaryTouch(t)) {
        // remember x/y of last touch
        var lt = {x: t.clientX, y: t.clientY};
        lts.push(lt);
        var fn = (function(lts, lt){
          var i = lts.indexOf(lt);
          if (i > -1) {
            lts.splice(i, 1);
          }
        }).bind(null, lts, lt);
        setTimeout(fn, DEDUP_TIMEOUT);
      }
    }
  };

  if (!HAS_TOUCH_ACTION) {
    INSTALLER = new scope.Installer(touchEvents.elementAdded, touchEvents.elementRemoved, touchEvents.elementChanged, touchEvents);
  }

  scope.touchEvents = touchEvents;
})(window.PointerEventsPolyfill);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {
  var dispatcher = scope.dispatcher;
  var pointermap = dispatcher.pointermap;
  var HAS_BITMAP_TYPE = window.MSPointerEvent && typeof window.MSPointerEvent.MSPOINTER_TYPE_MOUSE === 'number';
  var msEvents = {
    events: [
      'MSPointerDown',
      'MSPointerMove',
      'MSPointerUp',
      'MSPointerOut',
      'MSPointerOver',
      'MSPointerCancel',
      'MSGotPointerCapture',
      'MSLostPointerCapture'
    ],
    register: function(target) {
      dispatcher.listen(target, this.events);
    },
    unregister: function(target) {
      dispatcher.unlisten(target, this.events);
    },
    POINTER_TYPES: [
      '',
      'unavailable',
      'touch',
      'pen',
      'mouse'
    ],
    prepareEvent: function(inEvent) {
      var e = inEvent;
      if (HAS_BITMAP_TYPE) {
        e = dispatcher.cloneEvent(inEvent);
        e.pointerType = this.POINTER_TYPES[inEvent.pointerType];
      }
      return e;
    },
    cleanup: function(id) {
      pointermap.delete(id);
    },
    MSPointerDown: function(inEvent) {
      pointermap.set(inEvent.pointerId, inEvent);
      var e = this.prepareEvent(inEvent);
      dispatcher.down(e);
    },
    MSPointerMove: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      dispatcher.move(e);
    },
    MSPointerUp: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      dispatcher.up(e);
      this.cleanup(inEvent.pointerId);
    },
    MSPointerOut: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      dispatcher.leaveOut(e);
    },
    MSPointerOver: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      dispatcher.enterOver(e);
    },
    MSPointerCancel: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      dispatcher.cancel(e);
      this.cleanup(inEvent.pointerId);
    },
    MSLostPointerCapture: function(inEvent) {
      var e = dispatcher.makeEvent('lostpointercapture', inEvent);
      dispatcher.dispatchEvent(e);
    },
    MSGotPointerCapture: function(inEvent) {
      var e = dispatcher.makeEvent('gotpointercapture', inEvent);
      dispatcher.dispatchEvent(e);
    }
  };

  scope.msEvents = msEvents;
})(window.PointerEventsPolyfill);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * This module contains the handlers for native platform events.
 * From here, the dispatcher is called to create unified pointer events.
 * Included are touch events (v1), mouse events, and MSPointerEvents.
 */
(function(scope) {
  var dispatcher = scope.dispatcher;

  // only activate if this platform does not have pointer events
  if (window.navigator.pointerEnabled === undefined) {
    Object.defineProperty(window.navigator, 'pointerEnabled', {value: true, enumerable: true});

    if (window.navigator.msPointerEnabled) {
      var tp = window.navigator.msMaxTouchPoints;
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        value: tp,
        enumerable: true
      });
      dispatcher.registerSource('ms', scope.msEvents);
    } else {
      dispatcher.registerSource('mouse', scope.mouseEvents);
      if (window.ontouchstart !== undefined) {
        dispatcher.registerSource('touch', scope.touchEvents);
      }
    }

    dispatcher.register(document);
  }
})(window.PointerEventsPolyfill);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {
  var dispatcher = scope.dispatcher;
  var n = window.navigator;
  var s, r;
  function assertDown(id) {
    if (!dispatcher.pointermap.has(id)) {
      throw new Error('InvalidPointerId');
    }
  }
  if (n.msPointerEnabled) {
    s = function(pointerId) {
      assertDown(pointerId);
      this.msSetPointerCapture(pointerId);
    };
    r = function(pointerId) {
      assertDown(pointerId);
      this.msReleasePointerCapture(pointerId);
    };
  } else {
    s = function setPointerCapture(pointerId) {
      assertDown(pointerId);
      dispatcher.setCapture(pointerId, this);
    };
    r = function releasePointerCapture(pointerId) {
      assertDown(pointerId);
      dispatcher.releaseCapture(pointerId, this);
    };
  }
  if (!Element.prototype.setPointerCapture) {
    Object.defineProperties(Element.prototype, {
      'setPointerCapture': {
        value: s
      },
      'releasePointerCapture': {
        value: r
      }
    });
  }
})(window.PointerEventsPolyfill);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * PointerGestureEvent is the constructor for all PointerGesture events.
 *
 * @module PointerGestures
 * @class PointerGestureEvent
 * @extends UIEvent
 * @constructor
 * @param {String} inType Event type
 * @param {Object} [inDict] Dictionary of properties to initialize on the event
 */

function PointerGestureEvent(inType, inDict) {
  var dict = inDict || {};
  var e = document.createEvent('Event');
  var props = {
    bubbles: true,
    cancelable: true,
  };
  Object.keys(props).forEach(function(k) {
    if (k in dict) {
      props[k] = dict[k];
    }
  });

  e.initEvent(inType, props.bubbles, props.cancelable);

  Object.keys(dict).forEach(function(k) {
    e[k] = inDict[k];
  });

  e.preventTap = this.preventTap;

  return e;
}

/**
 * Allows for any gesture to prevent the tap gesture.
 *
 * @method preventTap
 */
PointerGestureEvent.prototype.preventTap = function() {
  this.tapPrevented = true;
};


/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {
  /**
   * This class contains the gesture recognizers that create the PointerGesture
   * events.
   *
   * @class PointerGestures
   * @static
   */
  scope = scope || {};
  scope.utils = {
    LCA: {
      // Determines the lowest node in the ancestor chain of a and b
      find: function(a, b) {
        if (a === b) {
          return a;
        }
        // fast case, a is a direct descendant of b or vice versa
        if (a.contains) {
          if (a.contains(b)) {
            return a;
          }
          if (b.contains(a)) {
            return b;
          }
        }
        var adepth = this.depth(a);
        var bdepth = this.depth(b);
        var d = adepth - bdepth;
        if (d > 0) {
          a = this.walk(a, d);
        } else {
          b = this.walk(b, -d);
        }
        while(a && b && a !== b) {
          a = this.walk(a, 1);
          b = this.walk(b, 1);
        }
        return a;
      },
      walk: function(n, u) {
        for (var i = 0; i < u; i++) {
          n = n.parentNode;
        }
        return n;
      },
      depth: function(n) {
        var d = 0;
        while(n) {
          d++;
          n = n.parentNode;
        }
        return d;
      }
    }
  };
  scope.findLCA = function(a, b) {
    return scope.utils.LCA.find(a, b);
  }
  window.PointerGestures = scope;
})(window.PointerGestures);

/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

// SideTable is a weak map where possible. If WeakMap is not available the
// association is stored as an expando property.
var SideTable;
// TODO(arv): WeakMap does not allow for Node etc to be keys in Firefox
if (typeof WeakMap !== 'undefined' && navigator.userAgent.indexOf('Firefox/') < 0) {
  SideTable = WeakMap;
} else {
  (function() {
    var defineProperty = Object.defineProperty;
    var counter = Date.now() % 1e9;

    SideTable = function() {
      this.name = '__st' + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
    };

    SideTable.prototype = {
      set: function(key, value) {
        var entry = key[this.name];
        if (entry && entry[0] === key)
          entry[1] = value;
        else
          defineProperty(key, this.name, {value: [key, value], writable: true});
      },
      get: function(key) {
        var entry;
        return (entry = key[this.name]) && entry[0] === key ?
            entry[1] : undefined;
      },
      delete: function(key) {
        this.set(key, undefined);
      }
    }
  })();
}

/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

// This module implements an ordered list of pointer states.
//
// Each pointer object here has two properties:
//   - id: the id of the pointer
//   - event: the source event of the pointer, complete with positions
//
// The ordering of the pointers is from oldest pointer to youngest pointer,
// which allows for multi-pointer gestures to not rely on the actual ids
// imported from the source events.
//
// Any operation that needs to store state information about pointers can hang
// objects off of the pointer in the pointermap. This information will be
// preserved until the pointer is removed from the pointermap.

(function(scope) {
  function PointerMap() {
    this.ids = [];
    this.pointers = [];
  };

  PointerMap.prototype = {
    set: function(inId, inEvent) {
      var i = this.ids.indexOf(inId);
      if (i > -1) {
        this.pointers[i] = inEvent;
      } else {
        this.ids.push(inId);
        this.pointers.push(inEvent);
      }
    },
    has: function(inId) {
      return this.ids.indexOf(inId) > -1;
    },
    'delete': function(inId) {
      var i = this.ids.indexOf(inId);
      if (i > -1) {
        this.ids.splice(i, 1);
        this.pointers.splice(i, 1);
      }
    },
    get: function(inId) {
      var i = this.ids.indexOf(inId);
      return this.pointers[i];
    },
    get size() {
      return this.pointers.length;
    },
    clear: function() {
      this.ids.length = 0;
      this.pointers.length = 0;
    }
  };

  if (window.Map) {
    PointerMap = window.Map;
  }
  scope.PointerMap = PointerMap;
})(window.PointerGestures);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {
  var dispatcher = {
    handledEvents: new SideTable,
    targets: new SideTable,
    handlers: {},
    recognizers: {},
    events: {},
    // Add a new gesture recognizer to the event listeners.
    // Recognizer needs an `events` property.
    registerRecognizer: function(inName, inRecognizer) {
      var r = inRecognizer;
      this.recognizers[inName] = r;
      r.events.forEach(function(e) {
        if (r[e]) {
          this.events[e] = true;
          var f = r[e].bind(r);
          this.addHandler(e, f);
        }
      }, this);
    },
    addHandler: function(inEvent, inFn) {
      var e = inEvent;
      if (!this.handlers[e]) {
        this.handlers[e] = [];
      }
      this.handlers[e].push(inFn);
    },
    // add event listeners for inTarget
    registerTarget: function(inTarget) {
      this.listen(Object.keys(this.events), inTarget);
    },
    // remove event listeners for inTarget
    unregisterTarget: function(inTarget) {
      this.unlisten(Object.keys(this.events), inTarget);
    },
    // LISTENER LOGIC
    eventHandler: function(inEvent) {
      if (this.handledEvents.get(inEvent)) {
        return;
      }
      var type = inEvent.type, fns = this.handlers[type];
      if (fns) {
        this.makeQueue(fns, inEvent);
      }
      this.handledEvents.set(inEvent, true);
    },
    // queue event for async dispatch
    makeQueue: function(inHandlerFns, inEvent) {
      // must clone events to keep the (possibly shadowed) target correct for
      // async dispatching
      var e = this.cloneEvent(inEvent);
      setTimeout(this.runQueue.bind(this, inHandlerFns, e), 0);
    },
    // Dispatch the queued events
    runQueue: function(inHandlers, inEvent) {
      this.currentPointerId = inEvent.pointerId;
      for (var i = 0, f, l = inHandlers.length; (i < l) && (f = inHandlers[i]); i++) {
        f(inEvent);
      }
      this.currentPointerId = 0;
    },
    // set up event listeners
    listen: function(inEvents, inTarget) {
      inEvents.forEach(function(e) {
        this.addEvent(e, this.boundHandler, false, inTarget);
      }, this);
    },
    // remove event listeners
    unlisten: function(inEvents) {
      inEvents.forEach(function(e) {
        this.removeEvent(e, this.boundHandler, false, inTarget);
      }, this);
    },
    addEvent: function(inEventName, inEventHandler, inCapture, inTarget) {
      inTarget.addEventListener(inEventName, inEventHandler, inCapture);
    },
    removeEvent: function(inEventName, inEventHandler, inCapture, inTarget) {
      inTarget.removeEventListener(inEventName, inEventHandler, inCapture);
    },
    // EVENT CREATION AND TRACKING
    // Creates a new Event of type `inType`, based on the information in
    // `inEvent`.
    makeEvent: function(inType, inDict) {
      return new PointerGestureEvent(inType, inDict);
    },
    /*
     * Returns a snapshot of inEvent, with writable properties.
     *
     * @method cloneEvent
     * @param {Event} inEvent An event that contains properties to copy.
     * @return {Object} An object containing shallow copies of `inEvent`'s
     *    properties.
     */
    cloneEvent: function(inEvent) {
      var eventCopy = {};
      for (var n in inEvent) {
        eventCopy[n] = inEvent[n];
      }
      return eventCopy;
    },
    // Dispatches the event to its target.
    dispatchEvent: function(inEvent, inTarget) {
      var t = inTarget || this.targets.get(inEvent);
      if (t) {
        t.dispatchEvent(inEvent);
        if (inEvent.tapPrevented) {
          this.preventTap(this.currentPointerId);
        }
      }
    },
    asyncDispatchEvent: function(inEvent, inTarget) {
      var fn = function() {
        this.dispatchEvent(inEvent, inTarget);
      }.bind(this);
      setTimeout(fn, 0);
    },
    preventTap: function(inPointerId) {
      var t = this.recognizers.tap;
      if (t){
        t.preventTap(inPointerId);
      }
    }
  };
  dispatcher.boundHandler = dispatcher.eventHandler.bind(dispatcher);
  scope.dispatcher = dispatcher;
  var registerQueue = [];
  var immediateRegister = false;
  /**
   * Enable gesture events for a given scope, typically
   * [ShadowRoots](https://dvcs.w3.org/hg/webcomponents/raw-file/tip/spec/shadow/index.html#shadow-root-object).
   *
   * @for PointerGestures
   * @method register
   * @param {ShadowRoot} scope A top level scope to enable gesture
   * support on.
   */
  scope.register = function(inScope) {
    if (immediateRegister) {
      var pe = window.PointerEventsPolyfill;
      if (pe) {
        pe.register(inScope);
      }
      scope.dispatcher.registerTarget(inScope);
    } else {
      registerQueue.push(inScope);
    }
  };
  // wait to register scopes until recognizers load
  document.addEventListener('DOMContentLoaded', function() {
    immediateRegister = true;
    registerQueue.push(document);
    registerQueue.forEach(scope.register);
  });
})(window.PointerGestures);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * This event is fired when a pointer is held down for 200ms.
 *
 * @module PointerGestures
 * @submodule Events
 * @class hold
 */
/**
 * Milliseconds pointer has been held down.
 * @type Number
 * @property holdTime
 */
/**
 * Type of pointer that made the holding event.
 * @type String
 * @property pointerType
 */
/**
 * This event is fired every 200ms while a pointer is held down.
 *
 * @class holdpulse
 * @extends hold
 */
/**
 * This event is fired when a held pointer is released or moved.
 *
 * @class released
 */
/**
 * Type of pointer that made the holding event.
 * @type String
 * @property pointerType
 */

(function(scope) {
  var dispatcher = scope.dispatcher;
  var hold = {
    // wait at least HOLD_DELAY ms between hold and pulse events
    HOLD_DELAY: 200,
    // pointer can move WIGGLE_THRESHOLD pixels before not counting as a hold
    WIGGLE_THRESHOLD: 16,
    events: [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel'
    ],
    heldPointer: null,
    holdJob: null,
    pulse: function() {
      var hold = Date.now() - this.heldPointer.timeStamp;
      var type = this.held ? 'holdpulse' : 'hold';
      this.fireHold(type, hold);
      this.held = true;
    },
    cancel: function() {
      clearInterval(this.holdJob);
      if (this.held) {
        this.fireHold('release');
      }
      this.held = false;
      this.heldPointer = null;
      this.target = null;
      this.holdJob = null;
    },
    pointerdown: function(inEvent) {
      if (inEvent.isPrimary && !this.heldPointer) {
        this.heldPointer = inEvent;
        this.target = inEvent.target;
        this.holdJob = setInterval(this.pulse.bind(this), this.HOLD_DELAY);
      }
    },
    pointerup: function(inEvent) {
      if (this.heldPointer && this.heldPointer.pointerId === inEvent.pointerId) {
        this.cancel();
      }
    },
    pointercancel: function(inEvent) {
      this.cancel();
    },
    pointermove: function(inEvent) {
      if (this.heldPointer && this.heldPointer.pointerId === inEvent.pointerId) {
        var x = inEvent.clientX - this.heldPointer.clientX;
        var y = inEvent.clientY - this.heldPointer.clientY;
        if ((x * x + y * y) > this.WIGGLE_THRESHOLD) {
          this.cancel();
        }
      }
    },
    fireHold: function(inType, inHoldTime) {
      var p = {
        pointerType: this.heldPointer.pointerType
      };
      if (inHoldTime) {
        p.holdTime = inHoldTime;
      }
      var e = dispatcher.makeEvent(inType, p);
      dispatcher.dispatchEvent(e, this.target);
      if (e.tapPrevented) {
        dispatcher.preventTap(this.heldPointer.pointerId);
      }
    }
  };
  dispatcher.registerRecognizer('hold', hold);
})(window.PointerGestures);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * This event denotes the beginning of a series of tracking events.
 *
 * @module PointerGestures
 * @submodule Events
 * @class trackstart
 */
/**
 * Pixels moved in the x direction since trackstart.
 * @type Number
 * @property dx
 */
/**
 * Pixes moved in the y direction since trackstart.
 * @type Number
 * @property dy
 */
/**
 * Pixels moved in the x direction since the last track.
 * @type Number
 * @property ddx
 */
/**
 * Pixles moved in the y direction since the last track.
 * @type Number
 * @property ddy
 */
/**
 * The clientX position of the track gesture.
 * @type Number
 * @property clientX
 */
/**
 * The clientY position of the track gesture.
 * @type Number
 * @property clientY
 */
/**
 * The pageX position of the track gesture.
 * @type Number
 * @property pageX
 */
/**
 * The pageY position of the track gesture.
 * @type Number
 * @property pageY
 */
/**
 * The screenX position of the track gesture.
 * @type Number
 * @property screenX
 */
/**
 * The screenY position of the track gesture.
 * @type Number
 * @property screenY
 */
/**
 * The last x axis direction of the pointer.
 * @type Number
 * @property xDirection
 */
/**
 * The last y axis direction of the pointer.
 * @type Number
 * @property yDirection
 */
/**
 * A shared object between all tracking events.
 * @type Object
 * @property trackInfo
 */
/**
 * The type of pointer that make the track gesture.
 * @type String
 * @property pointerType
 */
/**
 *
 * This event fires for all pointer movement being tracked.
 *
 * @class track
 * @extends trackstart
 */
/**
 * This event fires when the pointer is no longer being tracked.
 *
 * @class trackend
 * @extends trackstart
 */

 (function(scope) {
   var dispatcher = scope.dispatcher;
   var pointermap = new scope.PointerMap;
   var track = {
     events: [
       'pointerdown',
       'pointermove',
       'pointerup',
       'pointercancel'
     ],
     WIGGLE_THRESHOLD: 4,
     clampDir: function(inDelta) {
       return inDelta > 0 ? 1 : -1;
     },
     calcPositionDelta: function(inA, inB) {
       var x = 0, y = 0;
       if (inA && inB) {
         x = inB.pageX - inA.pageX;
         y = inB.pageY - inA.pageY;
       }
       return {x: x, y: y};
     },
     fireTrack: function(inType, inEvent, inTrackingData) {
       var t = inTrackingData;
       var d = this.calcPositionDelta(t.downEvent, inEvent);
       var dd = this.calcPositionDelta(t.lastMoveEvent, inEvent);
       if (dd.x) {
         t.xDirection = this.clampDir(dd.x);
       }
       if (dd.y) {
         t.yDirection = this.clampDir(dd.y);
       }
       var trackData = {
         dx: d.x,
         dy: d.y,
         ddx: dd.x,
         ddy: dd.y,
         clientX: inEvent.clientX,
         clientY: inEvent.clientY,
         pageX: inEvent.pageX,
         pageY: inEvent.pageY,
         screenX: inEvent.screenX,
         screenY: inEvent.screenY,
         xDirection: t.xDirection,
         yDirection: t.yDirection,
         trackInfo: t.trackInfo,
         pointerType: inEvent.pointerType
       };
       if (inType === 'trackend') {
         // TODO(dfreedman): this will leak shadowdom targets, replace with a
         // more sophisticated mechanism
         trackData._releaseTarget = inEvent.target;
       }
       var e = dispatcher.makeEvent(inType, trackData);
       t.lastMoveEvent = inEvent;
       dispatcher.dispatchEvent(e, t.downTarget);
     },
     pointerdown: function(inEvent) {
       if (inEvent.isPrimary && (inEvent.pointerType === 'mouse' ? inEvent.buttons === 1 : true)) {
         var p = {
           downEvent: inEvent,
           downTarget: inEvent.target,
           trackInfo: {},
           lastMoveEvent: null,
           xDirection: 0,
           yDirection: 0,
           tracking: false
         };
         pointermap.set(inEvent.pointerId, p);
       }
     },
     pointermove: function(inEvent) {
       var p = pointermap.get(inEvent.pointerId);
       if (p) {
         if (!p.tracking) {
           var d = this.calcPositionDelta(p.downEvent, inEvent);
           var move = d.x * d.x + d.y * d.y;
           // start tracking only if finger moves more than WIGGLE_THRESHOLD
           if (move > this.WIGGLE_THRESHOLD) {
             p.tracking = true;
             this.fireTrack('trackstart', p.downEvent, p);
             this.fireTrack('track', inEvent, p);
           }
         } else {
           this.fireTrack('track', inEvent, p);
         }
       }
     },
     pointerup: function(inEvent) {
       var p = pointermap.get(inEvent.pointerId);
       if (p) {
         if (p.tracking) {
           this.fireTrack('trackend', inEvent, p);
         }
         pointermap.delete(inEvent.pointerId);
       }
     },
     pointercancel: function(inEvent) {
       this.pointerup(inEvent);
     }
   };
   dispatcher.registerRecognizer('track', track);
 })(window.PointerGestures);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * This event denotes a rapid down/move/up sequence from a pointer.
 *
 * The event is sent to the first element the pointer went down on.
 *
 * @module PointerGestures
 * @submodule Events
 * @class flick
 */
/**
 * Signed velocity of the flick in the x direction.
 * @property xVelocity
 * @type Number
 */
/**
 * Signed velocity of the flick in the y direction.
 * @type Number
 * @property yVelocity
 */
/**
 * Unsigned total velocity of the flick.
 * @type Number
 * @property velocity
 */
/**
 * Angle of the flick in degrees, with 0 along the
 * positive x axis.
 * @type Number
 * @property angle
 */
/**
 * Axis with the greatest absolute velocity. Denoted
 * with 'x' or 'y'.
 * @type String
 * @property majorAxis
 */
/**
 * Type of the pointer that made the flick.
 * @type String
 * @property pointerType
 */

(function(scope) {
  var dispatcher = scope.dispatcher;
  var flick = {
    // TODO(dfreedman): value should be low enough for low speed flicks, but
    // high enough to remove accidental flicks
    MIN_VELOCITY: 0.5 /* px/ms */,
    MAX_QUEUE: 4,
    moveQueue: [],
    target: null,
    pointerId: null,
    events: [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel'
    ],
    pointerdown: function(inEvent) {
      if (inEvent.isPrimary && !this.pointerId) {
        this.pointerId = inEvent.pointerId;
        this.target = inEvent.target;
        this.addMove(inEvent);
      }
    },
    pointermove: function(inEvent) {
      if (inEvent.pointerId === this.pointerId) {
        this.addMove(inEvent);
      }
    },
    pointerup: function(inEvent) {
      if (inEvent.pointerId === this.pointerId) {
        this.fireFlick(inEvent);
      }
      this.cleanup();
    },
    pointercancel: function(inEvent) {
      this.cleanup();
    },
    cleanup: function() {
      this.moveQueue = [];
      this.target = null;
      this.pointerId = null;
    },
    addMove: function(inEvent) {
      if (this.moveQueue.length >= this.MAX_QUEUE) {
        this.moveQueue.shift();
      }
      this.moveQueue.push(inEvent);
    },
    fireFlick: function(inEvent) {
      var e = inEvent;
      var l = this.moveQueue.length;
      var dt, dx, dy, tx, ty, tv, x = 0, y = 0, v = 0;
      // flick based off the fastest segment of movement
      for (var i = 0, m; i < l && (m = this.moveQueue[i]); i++) {
        dt = e.timeStamp - m.timeStamp;
        dx = e.clientX - m.clientX, dy = e.clientY - m.clientY;
        tx = dx / dt, ty = dy / dt, tv = Math.sqrt(tx * tx + ty * ty);
        if (tv > v) {
          x = tx, y = ty, v = tv;
        }
      }
      var ma = Math.abs(x) > Math.abs(y) ? 'x' : 'y';
      var a = this.calcAngle(x, y);
      if (Math.abs(v) >= this.MIN_VELOCITY) {
        var ev = dispatcher.makeEvent('flick', {
          xVelocity: x,
          yVelocity: y,
          velocity: v,
          angle: a,
          majorAxis: ma,
          pointerType: inEvent.pointerType
        });
        dispatcher.dispatchEvent(ev, this.target);
      }
    },
    calcAngle: function(inX, inY) {
      return (Math.atan2(inY, inX) * 180 / Math.PI);
    }
  };
  dispatcher.registerRecognizer('flick', flick);
})(window.PointerGestures);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * This event is fired when a pointer quickly goes down and up, and is used to
 * denote activation.
 *
 * Any gesture event can prevent the tap event from being created by calling
 * `event.preventTap`.
 *
 * Any pointer event can prevent the tap by setting the `tapPrevented` property
 * on itself.
 *
 * @module PointerGestures
 * @submodule Events
 * @class tap
 */
/**
 * X axis position of the tap.
 * @property x
 * @type Number
 */
/**
 * Y axis position of the tap.
 * @property y
 * @type Number
 */
/**
 * Type of the pointer that made the tap.
 * @property pointerType
 * @type String
 */
(function(scope) {
  var dispatcher = scope.dispatcher;
  var pointermap = new scope.PointerMap;
  var tap = {
    events: [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'keyup'
    ],
    pointerdown: function(inEvent) {
      if (inEvent.isPrimary && !inEvent.tapPrevented) {
        pointermap.set(inEvent.pointerId, {
          target: inEvent.target,
          x: inEvent.clientX,
          y: inEvent.clientY
        });
      }
    },
    pointermove: function(inEvent) {
      if (inEvent.isPrimary) {
        var start = pointermap.get(inEvent.pointerId);
        if (start) {
          if (inEvent.tapPrevented) {
            pointermap.delete(inEvent.pointerId);
          }
        }
      }
    },
    pointerup: function(inEvent) {
      var start = pointermap.get(inEvent.pointerId);
      if (start && !inEvent.tapPrevented) {
        var t = scope.findLCA(start.target, inEvent.target);
        if (t) {
          var e = dispatcher.makeEvent('tap', {
            x: inEvent.clientX,
            y: inEvent.clientY,
            detail: inEvent.detail,
            pointerType: inEvent.pointerType
          });
          dispatcher.dispatchEvent(e, t);
        }
      }
      pointermap.delete(inEvent.pointerId);
    },
    pointercancel: function(inEvent) {
      pointermap.delete(inEvent.pointerId);
    },
    keyup: function(inEvent) {
      var code = inEvent.keyCode;
      // 32 == spacebar
      if (code === 32) {
        var t = inEvent.target;
        if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) {
          dispatcher.dispatchEvent(dispatcher.makeEvent('tap', {
            x: 0,
            y: 0,
            detail: 0,
            pointerType: 'unavailable'
          }), t);
        }
      }
    },
    preventTap: function(inPointerId) {
      pointermap.delete(inPointerId);
    }
  };
  dispatcher.registerRecognizer('tap', tap);
})(window.PointerGestures);

//@ sourceMappingURL=platform.concat.js.map