/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

suite('HTMLContentElement', function() {

  var unwrap = ShadowDOMPolyfill.unwrap;

  test('select', function() {
    var el = document.createElement('content');
    assert.equal(el.select, null);

    el.select = '.xxx';
    assert.equal(el.select, '.xxx');
    assert.isTrue(el.hasAttribute('select'));
    assert.equal(el.getAttribute('select'), '.xxx');

    el.select = '.xxx';
    assert.equal(el.select, '.xxx');
    assert.isTrue(el.hasAttribute('select'));
    assert.equal(el.getAttribute('select'), '.xxx');
  });

  test('getDistributedNodes', function() {
    var host = document.createElement('div');
    host.innerHTML = '<a>a</a><b>b</b>';
    var a = host.firstChild;
    var b = host.lastChild;

    var sr = host.createShadowRoot();
    sr.innerHTML = '<content></content>';
    var content = sr.firstChild;

    assertArrayEqual(content.getDistributedNodes(), [a, b]);

    content.select = 'a';
    assertArrayEqual(content.getDistributedNodes(), [a]);

    content.select = 'b';
    assertArrayEqual(content.getDistributedNodes(), [b]);
  });

  test('getDistributedNodes add document fragment with content', function() {
    var host = document.createElement('div');
    host.innerHTML = ' <a></a> <a></a> <a></a> ';
    var root = host.createShadowRoot();
    var df = document.createDocumentFragment();
    df.appendChild(document.createTextNode(' '));
    var content = df.appendChild(document.createElement('content'));
    df.appendChild(document.createTextNode(' '));
    root.appendChild(df);

    assertArrayEqual(content.getDistributedNodes().length, 3);
  });

  test('adding a new content element to a shadow tree', function() {
    var host = document.createElement('div');
    host.innerHTML = '<a></a><b></b>';
    var a = host.firstChild;
    var b = host.lastChild;

    var sr = host.createShadowRoot();
    sr.innerHTML = '<c></c>';
    var c = sr.firstChild;

    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '<c></c>');

    var content = document.createElement('content');
    content.select = 'b';
    c.appendChild(content);

    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '<c><b></b></c>');

    c.removeChild(content);
    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '<c></c>');
  });

  test('restricting select further', function() {
    var host = document.createElement('div');
    host.innerHTML = '<a></a><b></b>';
    var a = host.firstChild;
    var b = host.lastChild;

    var sr = host.createShadowRoot();
    sr.innerHTML = '<c><content select="*"></content></c>';
    var c = sr.firstChild;
    var content = c.firstChild;

    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '<c><a></a><b></b></c>');

    content.select = 'b';
    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '<c><b></b></c>');
  });

  test('Mutating content fallback', function() {
    var host = document.createElement('div');
    host.innerHTML = '<a></a>';
    var a = host.firstChild;

    var sr = host.createShadowRoot();
    sr.innerHTML = '<content select="x"></content>';
    var content = sr.firstChild;

    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '');

    content.textContent = 'fallback';
    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, 'fallback');

    var b = content.appendChild(document.createElement('b'));
    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, 'fallback<b></b>');

    content.removeChild(b);
    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, 'fallback');
  });

  test('Mutating content fallback 2', function() {
    var host = document.createElement('div');
    host.innerHTML = '<a></a>';
    var a = host.firstChild;

    var sr = host.createShadowRoot();
    sr.innerHTML = '<b><content select="x"></content></b>';
    var b = sr.firstChild;
    var content = b.firstChild;

    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '<b></b>');

    content.textContent = 'fallback';
    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '<b>fallback</b>');

    var c = content.appendChild(document.createElement('c'));
    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '<b>fallback<c></c></b>');

    content.removeChild(c);
    host.offsetHeight;
    assert.equal(unwrap(host).innerHTML, '<b>fallback</b>');
  });
});