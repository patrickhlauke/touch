/* multi-touch tracker */

var canvas,
	c, // c is the canvas' context 2D
	container,
	ratio;

var points = [];

function draw() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight * ratio) {
		canvas.width = window.innerWidth * ratio;
		canvas.height = window.innerHeight * ratio;
	} else {
		c.clearRect(0,0,canvas.width, canvas.height);
	}

	for (var i = 0; i<points.length; i++) {
		/* draw all circles */
		c.beginPath();
		c.arc(points[i].clientX, points[i].clientY, 50, 0, Math.PI*2, true);
		c.stroke();
	}

}

function positionHandler(e) {
	if ((e.clientX)&&(e.clientY)) {
		points = [e];
	} else if (e.targetTouches) {
		points = e.targetTouches;
		e.preventDefault();
	}
	window.requestAnimationFrame(draw);
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
	c.strokeStyle = "#eee";
	c.lineWidth = "10";
	
	canvas.addEventListener('mousemove',  positionHandler, false );
	canvas.addEventListener('touchstart', positionHandler, false );
	canvas.addEventListener('touchmove',  positionHandler, false );
	
	// suppress context menu
	canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); }, false)
}

window.addEventListener('load',function() {
	/* hack to prevent firing the init script before the window object's values are populated */
	setTimeout(init,100);
},false);