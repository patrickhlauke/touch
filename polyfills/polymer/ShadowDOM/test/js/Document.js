/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

htmlSuite('Document', function() {

  var wrap = ShadowDOMPolyfill.wrap;

  var div;
  teardown(function() {
    if (div) {
      if (div.parentNode)
        div.parentNode.removeChild(div);
      div = undefined;
    }
  });

  test('Ensure Document has ParentNodeInterface', function() {
    var doc = wrap(document).implementation.createHTMLDocument('');
    assert.equal(doc.firstElementChild.tagName, 'HTML');
    assert.equal(doc.lastElementChild.tagName, 'HTML');

    var doc2 = document.implementation.createHTMLDocument('');
    assert.equal(doc2.firstElementChild.tagName, 'HTML');
    assert.equal(doc2.lastElementChild.tagName, 'HTML');
  });

  test('document.documentElement', function() {
    var doc = wrap(document);
    assert.equal(doc.documentElement.ownerDocument, doc);
    assert.equal(doc.documentElement.tagName, 'HTML');
  });

  test('document.body', function() {
    var doc = wrap(document);
    assert.equal(doc.body.ownerDocument, doc);
    assert.equal(doc.body.tagName, 'BODY');
    assert.equal(doc.body.parentNode, doc.documentElement);
  });

  test('document.head', function() {
    var doc = wrap(document);
    assert.equal(doc.head.ownerDocument, doc);
    assert.equal(doc.head.tagName, 'HEAD');
    assert.equal(doc.head.parentNode, doc.documentElement);
  });

  test('getElementsByTagName', function() {
    var elements = document.getElementsByTagName('body');
    assert.isTrue(elements instanceof NodeList);
    assert.equal(elements.length, 1);
    assert.isTrue(elements[0] instanceof HTMLElement);

    var doc = wrap(document);
    assert.equal(doc.body, elements[0]);
    assert.equal(doc.body, elements.item(0));

    var elements2 = doc.getElementsByTagName('body');
    assert.isTrue(elements2 instanceof NodeList);
    assert.equal(elements2.length, 1);
    assert.isTrue(elements2[0] instanceof HTMLElement);
    assert.equal(doc.body, elements2[0]);
    assert.equal(doc.body, elements2.item(0));

    div = document.body.appendChild(document.createElement('div'));
    div.innerHTML = '<aa></aa><aa></aa>';
    var aa1 = div.firstChild;
    var aa2 = div.lastChild;

    var sr = div.createShadowRoot();
    sr.innerHTML = '<aa></aa><aa></aa>';
    var aa3 = sr.firstChild;
    var aa4 = sr.lastChild;

    div.offsetHeight;

    var elements = document.getElementsByTagName('aa');
    assert.equal(elements.length, 2);
    assert.equal(elements[0], aa1);
    assert.equal(elements[1], aa2);

    var elements = sr.getElementsByTagName('aa');
    assert.equal(elements.length, 2);
    assert.equal(elements[0], aa3);
    assert.equal(elements[1], aa4);
  });

  test('getElementsByTagNameNS', function() {
    var div = document.createElement('div');
    var nsOne = 'http://one.com';
    var nsTwo = 'http://two.com';
    var aOne = div.appendChild(document.createElementNS(nsOne, 'a'));
    var aTwo = div.appendChild(document.createElementNS(nsTwo, 'a'));

    var all = div.getElementsByTagNameNS(nsOne, 'a');
    assert.equal(all.length, 1);
    assert.equal(all[0], aOne);

    var all = div.getElementsByTagNameNS(nsTwo, 'a');
    assert.equal(all.length, 1);
    assert.equal(all[0], aTwo);

    var all = div.getElementsByTagNameNS('*', 'a');
    assert.equal(all.length, 2);
    assert.equal(all[0], aOne);
    assert.equal(all[1], aTwo);
  });

  test('querySelectorAll', function() {
    var elements = document.querySelectorAll('body');
    assert.isTrue(elements instanceof NodeList);
    assert.equal(elements.length, 1);
    assert.isTrue(elements[0] instanceof HTMLElement);

    var doc = wrap(document);
    assert.equal(doc.body, elements[0]);

    var elements2 = doc.querySelectorAll('body');
    assert.isTrue(elements2 instanceof NodeList);
    assert.equal(elements2.length, 1);
    assert.isTrue(elements2[0] instanceof HTMLElement);
    assert.equal(doc.body, elements2[0]);

    div = document.body.appendChild(document.createElement('div'));
    div.innerHTML = '<aa></aa><aa></aa>';
    var aa1 = div.firstChild;
    var aa2 = div.lastChild;

    var sr = div.createShadowRoot();
    sr.innerHTML = '<aa></aa><aa></aa>';
    var aa3 = sr.firstChild;
    var aa4 = sr.lastChild;

    div.offsetHeight;

    var elements = document.querySelectorAll('aa');
    assert.equal(elements.length, 2);
    assert.equal(elements[0], aa1);
    assert.equal(elements[1], aa2);

    var elements = sr.querySelectorAll('aa');
    assert.equal(elements.length, 2);
    assert.equal(elements[0], aa3);
    assert.equal(elements[1], aa4);
  });

  test('addEventListener', function() {
    var calls = 0;
    var doc = wrap(document);
    document.addEventListener('click', function f(e) {
      calls++;
      assert.equal(this, doc);
      assert.equal(e.target, doc.body);
      assert.equal(e.currentTarget, this);
      document.removeEventListener('click', f);
    });
    doc.addEventListener('click', function f(e) {
      calls++;
      assert.equal(this, doc);
      assert.equal(e.target, doc.body);
      assert.equal(e.currentTarget, this);
      doc.removeEventListener('click', f);
    });

    document.body.click();
    assert.equal(2, calls);

    document.body.click();
    assert.equal(2, calls);
  });

  test('adoptNode', function() {
    var doc = wrap(document);
    var doc2 = doc.implementation.createHTMLDocument('');
    var div = doc2.createElement('div');
    assert.equal(div.ownerDocument, doc2);

    var div2 = document.adoptNode(div);
    assert.equal(div, div2);
    assert.equal(div.ownerDocument, doc);

    var div3 = doc2.adoptNode(div);
    assert.equal(div, div3);
    assert.equal(div.ownerDocument, doc2);
  });

  test('adoptNode with shadowRoot', function() {
    var doc = wrap(document);
    var doc2 = doc.implementation.createHTMLDocument('');
    var div = doc2.createElement('div');
    var sr = div.createShadowRoot();
    sr.innerHTML = '<a></a>';
    var a = sr.firstChild;

    var sr2 = div.createShadowRoot();
    sr2.innerHTML = '<b><shadow></shadow></b>';
    var b = sr2.firstChild;

    var sr3 = a.createShadowRoot();
    sr3.innerHTML = '<c></c>';
    var c = sr3.firstChild;

    assert.equal(div.ownerDocument, doc2);
    assert.equal(sr.ownerDocument, doc2);
    assert.equal(sr2.ownerDocument, doc2);
    assert.equal(sr3.ownerDocument, doc2);
    assert.equal(a.ownerDocument, doc2);
    assert.equal(b.ownerDocument, doc2);
    assert.equal(c.ownerDocument, doc2);

    doc.adoptNode(div);

    assert.equal(div.ownerDocument, doc);
    assert.equal(sr.ownerDocument, doc);
    assert.equal(sr2.ownerDocument, doc);
    assert.equal(sr3.ownerDocument, doc);
    assert.equal(a.ownerDocument, doc);
    assert.equal(b.ownerDocument, doc);
    assert.equal(c.ownerDocument, doc);
  });

  test('elementFromPoint', function() {
    div = document.body.appendChild(document.createElement('div'));
    div.style.cssText = 'position: fixed; background: green; ' +
                        'width: 10px; height: 10px; top: 0; left: 0;';

    assert.equal(document.elementFromPoint(5, 5), div);

    var doc = wrap(document);
    assert.equal(doc.elementFromPoint(5, 5), div);
  });

  test('elementFromPoint in shadow', function() {
    div = document.body.appendChild(document.createElement('div'));
    div.style.cssText = 'position: fixed; background: red; ' +
                        'width: 10px; height: 10px; top: 0; left: 0;';
    var sr = div.createShadowRoot();
    sr.innerHTML = '<a></a>';
    var a = sr.firstChild;
    a.style.cssText = 'position: absolute; width: 100%; height: 100%; ' +
                      'background: green';

    assert.equal(document.elementFromPoint(5, 5), div);

    var doc = wrap(document);
    assert.equal(doc.elementFromPoint(5, 5), div);
  });

  test('document.contains', function() {
    assert.isTrue(document.contains(document.body));
    assert.isTrue(document.contains(document.querySelector('body')));

    assert.isTrue(document.contains(document.head));
    assert.isTrue(document.contains(document.querySelector('head')));

    assert.isTrue(document.contains(document.documentElement));
    assert.isTrue(document.contains(document.querySelector('html')));
  });

  test('document.register', function() {
    if (!document.register)
      return;

    var aPrototype = Object.create(HTMLElement.prototype);
    aPrototype.getName = function() {
      return 'a';
    };

    var A = document.register('x-a', {prototype: aPrototype});

    var a1 = document.createElement('x-a');
    assert.equal('x-a', a1.localName);
    assert.equal(Object.getPrototypeOf(a1), aPrototype);
    assert.instanceOf(a1, A);
    assert.instanceOf(a1, HTMLElement);
    assert.equal(a1.getName(), 'a');

    var a2 = new A();
    assert.equal('x-a', a2.localName);
    assert.equal(Object.getPrototypeOf(a2), aPrototype);
    assert.instanceOf(a2, A);
    assert.instanceOf(a2, HTMLElement);
    assert.equal(a2.getName(), 'a');

    //////////////////////////////////////////////////////////////////////

    var bPrototype = Object.create(A.prototype);
    bPrototype.getName = function() {
      return 'b';
    };

    var B = document.register('x-b', {prototype: bPrototype});

    var b1 = document.createElement('x-b');
    assert.equal('x-b', b1.localName);
    assert.equal(Object.getPrototypeOf(b1), bPrototype);
    assert.instanceOf(b1, B);
    assert.instanceOf(b1, A);
    assert.instanceOf(b1, HTMLElement);
    assert.equal(b1.getName(), 'b');

    var b2 = new B();
    assert.equal('x-b', b2.localName);
    assert.equal(Object.getPrototypeOf(b2), bPrototype);
    assert.instanceOf(b2, B);
    assert.instanceOf(b2, A);
    assert.instanceOf(b2, HTMLElement);
    assert.equal(b2.getName(), 'b');
  });

  test('document.register deeper', function() {
    if (!document.register)
      return;

    function C() {}
    C.prototype = {
      __proto__: HTMLElement.prototype
    };

    function B() {}
    B.prototype = {
      __proto__: C.prototype
    };

    function A() {}
    A.prototype = {
      __proto__: B.prototype
    };

    A = document.register('x-a5', A);

    var a1 = document.createElement('x-a5');
    assert.equal('x-a5', a1.localName);
    assert.equal(a1.__proto__, A.prototype);
    assert.equal(a1.__proto__.__proto__, B.prototype);
    assert.equal(a1.__proto__.__proto__.__proto__, C.prototype);
     assert.equal(a1.__proto__.__proto__.__proto__.__proto__,
                  HTMLElement.prototype);

    var a2 = new A();
    assert.equal('x-a5', a2.localName);
    assert.equal(a2.__proto__, A.prototype);
    assert.equal(a2.__proto__.__proto__, B.prototype);
    assert.equal(a2.__proto__.__proto__.__proto__, C.prototype);
    assert.equal(a2.__proto__.__proto__.__proto__.__proto__,
                 HTMLElement.prototype);
  });

  test('document.register createdCallback', function() {
    if (!document.register)
      return;

    var self;
    var createdCalls = 0;

    function A() {}
    A.prototype = {
      __proto__: HTMLElement.prototype,
      createdCallback: function() {
        createdCalls++;
        assert.isUndefined(a);
        assert.instanceOf(this, A);
        self = this;
      }
    }

    A = document.register('x-a2', A);

    var a = new A;
    assert.equal(createdCalls, 1);
    assert.equal(self, a);
  });

  test('document.register enteredDocumentCallback, leftDocumentCallback',
      function() {
    if (!document.register)
      return;

    var enteredDocumentCalls = 0;
    var leftDocumentCalls = 0;

    function A() {}
    A.prototype = {
      __proto__: HTMLElement.prototype,
      enteredDocumentCallback: function() {
        enteredDocumentCalls++;
        assert.instanceOf(this, A);
        assert.equal(a, this);
      },
      leftDocumentCallback: function() {
        leftDocumentCalls++;
        assert.instanceOf(this, A);
        assert.equal(a, this);
      }
    }

    A = document.register('x-a3', A);

    var a = new A;
    document.body.appendChild(a);
    assert.equal(enteredDocumentCalls, 1);
    document.body.removeChild(a);
    assert.equal(leftDocumentCalls, 1);
  });

  test('document.register attributeChangedCallback', function() {
    if (!document.register)
      return;

    var attributeChangedCalls = 0;

    function A() {}
    A.prototype = {
      __proto__: HTMLElement.prototype,
      attributeChangedCallback: function(name, oldValue, newValue) {
        attributeChangedCalls++;
        assert.equal(name, 'foo');
        switch (attributeChangedCalls) {
          case 1:
            assert.isNull(oldValue);
            assert.equal(newValue, 'bar');
            break;
          case 2:
            assert.equal(oldValue, 'bar');
            assert.equal(newValue, 'baz');
            break;
          case 3:
            assert.equal(oldValue, 'baz');
            assert.isNull(newValue);
            break;
        }
        console.log(arguments);
      }
    }

    A = document.register('x-a4', A);

    var a = new A;
    assert.equal(attributeChangedCalls, 0);
    a.setAttribute('foo', 'bar');
    assert.equal(attributeChangedCalls, 1);
    a.setAttribute('foo', 'baz');
    assert.equal(attributeChangedCalls, 2);
    a.removeAttribute('foo');
    assert.equal(attributeChangedCalls, 3);
  });

  htmlTest('html/document-write.html');

  htmlTest('html/head-then-body.html');
});
