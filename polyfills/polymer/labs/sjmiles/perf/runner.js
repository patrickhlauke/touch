document.addEventListener('WebComponentsReady', function() {
  // unwind stack
  requestAnimationFrame(function() {
    console.profile();
    test(3000);
    console.profileEnd();
  });
});