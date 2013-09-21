/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

suite('HTMLObjectElement', function() {

  test('form', function() {
    var form = document.createElement('form');
    var object = document.createElement('object');
    form.appendChild(object);
    assert.equal(object.form, form);
  });

});
