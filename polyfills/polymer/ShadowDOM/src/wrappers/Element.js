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
