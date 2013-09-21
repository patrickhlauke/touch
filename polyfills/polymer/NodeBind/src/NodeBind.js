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
