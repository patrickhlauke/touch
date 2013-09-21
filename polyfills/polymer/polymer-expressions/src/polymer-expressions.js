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