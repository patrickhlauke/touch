/* multi-touch tracker */

var canvas,
	c, // c is the canvas' context 2D
	container,
	ratio;

var pointsTouches = [], pointsTargetTouches = [], pointsChangedTouches = [];

function resetCanvas (e) {
	// resize the canvas - but remember - this clears the canvas too.
	canvas.width = window.innerWidth * ratio;
	canvas.height = window.innerHeight * ratio;
	//make sure we scroll to the top left.
	window.scrollTo(0,0);
}

function loop() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight * ratio) {
		canvas.width = window.innerWidth * ratio;
		canvas.height = window.innerHeight * ratio;
	} else {
		c.clearRect(0,0,canvas.width, canvas.height);
	}

	c.strokeStyle = "#eee";
	for (var i = 0; i<pointsTouches.length; i++) {
		/* draw all circles */
		c.beginPath();
		c.arc(pointsTouches[i].clientX, pointsTouches[i].clientY, 60, 0, Math.PI*2, true);
		c.stroke();
	}

	c.strokeStyle = "#1f1";
	for (var i = 0; i<pointsTargetTouches.length; i++) {
		/* draw all circles */
		c.beginPath();
		c.arc(pointsTargetTouches[i].clientX, pointsTargetTouches[i].clientY, 50, 0, Math.PI*2, true);
		c.stroke();
	}

	c.strokeStyle = "#f11";
	for (var i = 0; i<pointsChangedTouches.length; i++) {
		/* draw all circles */
		c.beginPath();
		c.arc(pointsChangedTouches[i].clientX, pointsChangedTouches[i].clientY, 40, 0, Math.PI*2, true);
		c.stroke();
	}

}

function positionHandler(e) {
	if ((e.clientX)&&(e.clientY)) {
		points[0] = e;
	} else if (e.targetTouches) {
		pointsTouches = e.touches;
		pointsTargetTouches = e.targetTouches;
		pointsChangedTouches = e.changedTouches;
		e.preventDefault();
	}
}

function init() {
	canvas = document.createElement( 'canvas' );
	c = canvas.getContext( '2d' );
	container = document.createElement( 'div' );
	container.className = "container";
	// HiDPI canvas http://www.html5rocks.com/en/tutorials/canvas/hidpi/
	devicePixelRatio = window.devicePixelRatio || 1,
	backingStoreRatio = c.webkitBackingStorePixelRatio ||
	                    c.mozBackingStorePixelRatio ||
	                    c.msBackingStorePixelRatio ||
	                    c.oBackingStorePixelRatio ||
	                    c.backingStorePixelRatio || 1,

	ratio = devicePixelRatio / backingStoreRatio;
	// ensure we have a value set for auto.
    // If auto is set to false then we
    // will simply not upscale the canvas
    // and the default behaviour will be maintained
    if (typeof auto === 'undefined') {
        auto = true;
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.setAttribute('touch-action','none');
	// upscale the canvas if the two ratios don't match
    if (auto && devicePixelRatio !== backingStoreRatio) {

        var oldWidth = canvas.width;
        var oldHeight = canvas.height;

        canvas.width = oldWidth * ratio;
        canvas.height = oldHeight * ratio;

        canvas.style.width = oldWidth + 'px';
        canvas.style.height = oldHeight + 'px';

        // now scale the context to counter
        // the fact that we've manually scaled
        // our canvas element
        c.scale(ratio, ratio);

    }
	container.appendChild(canvas);
	document.body.appendChild( container );
	c.lineWidth = "5";

	b = document.getElementsByTagName('button')[0];
	
	// b.addEventListener('mousemove', positionHandler, false );
	b.addEventListener('touchstart', positionHandler, false );
	b.addEventListener('touchmove',  positionHandler, false );
	b.addEventListener('touchend',  positionHandler, false );
	b.addEventListener('touchcancel',  positionHandler, false );
	
	setInterval(loop, 1000/35);
	
}

window.addEventListener('load',function() {
	/* hack to prevent firing the init script before the window object's values are populated */
	setTimeout(init,100);
},false);