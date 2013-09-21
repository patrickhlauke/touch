suite('Tap', function() {
  test('Up and Down', function(done) {
    prepare(target, 'tap', done);
    var fireTap = function() {
      target.dispatchEvent(new PointerEvent('pointerdown', {isPrimary: true, buttons: 1, pointerId: 1, bubbles: true}));
      target.dispatchEvent(new PointerEvent('pointerup', {isPrimary: true, buttons: 1, pointerId: 1, bubbles: true}));
    }
    // handle case where DOMContentLoaded has already fired
    if (document.readyState === 'complete') {
      fireTap();
    } else {
      document.addEventListener('DOMContentLoaded', fireTap);
    }
  });
});
