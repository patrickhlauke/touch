/* mouse tracker */

var canvas,
	c, // c is the canvas' context 2D
	container,
	ratio;

var posX, posY;

function draw() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight * ratio) {
		canvas.width = window.innerWidth * ratio;
		canvas.height = window.innerHeight * ratio;
	} else {
		c.clearRect(0,0,canvas.width, canvas.height);
	}

	c.beginPath();
	c.arc(posX, posY, 50, 0, Math.PI*2, true);
	c.stroke();

}

function positionHandler(e) {
	posX = e.clientX;
	posY = e.clientY;
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
	canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
	// upscale the canvas if the two ratios don't match
    if (devicePixelRatio !== backingStoreRatio) {

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
	
	canvas.addEventListener('mousemove', positionHandler, false );	
}

window.addEventListener('load',function() {
	/* hack to prevent firing the init script before the window object's values are populated */
	setTimeout(init,100);
},false);