/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

suite('HTMLSelectElement', function() {

  test('form', function() {
    var form = document.createElement('form');
    var select = document.createElement('select');
    form.appendChild(select);
    assert.equal(select.form, form);
  });

});
