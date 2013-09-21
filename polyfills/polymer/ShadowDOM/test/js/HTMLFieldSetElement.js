/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

suite('HTMLFieldSetElement', function() {

  test('form', function() {
    var form = document.createElement('form');
    var fieldSet = document.createElement('fieldset');
    form.appendChild(fieldSet);
    assert.equal(fieldSet.form, form);
  });

});
