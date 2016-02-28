function throttle(func, wait) {
    var lastTimeExecuted = null;
    return function() {
        var now = Date.now();
        if ((!lastTimeExecuted) || (now - lastTimeExecuted >= wait)) {
            var context = this, args = arguments;
            func.apply(context, args);
            lastTimeExecuted = now;
        };
    };
};