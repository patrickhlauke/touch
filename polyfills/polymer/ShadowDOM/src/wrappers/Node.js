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
