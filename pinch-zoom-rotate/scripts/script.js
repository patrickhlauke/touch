/* Multi-Touch Gestures from basic principles */

var canvas,
	c, // c is the canvas' context 2D
	container;

var points = [], prevpoints = [], active, posx, posy, rotation, size;

function resetCanvas (e) {
	// resize the canvas - but remember - this clears the canvas too.
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
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

	/* only do stuff if there's two active touchpoints going on */
	if ((!active)||(points.length < 2)) { return; }

	/* Work out gesture/calculations */
	posx = (points[0].clientX+points[1].clientX)/2;
	posy = (points[0].clientY+points[1].clientY)/2;
	/* Hurrah for trigonometry */
	size = Math.sqrt(Math.pow(points[0].clientX-points[1].clientX,2)+Math.pow(points[0].clientY-points[1].clientY,2));
	var angle = Math.atan((points[1].clientY-points[0].clientY)/(points[1].clientX-points[0].clientX));
	if (Math.abs(angle-rotation)>3) { // jumped more than approx 180 degrees due to my poor math skills
		angle = angle-Math.PI; // doesn't solve all issues, but still a bit better...
	}
	rotation = angle;

	/* Draw main circle */
	c.strokeStyle = "#eee";
	c.lineWidth = 6;
	c.beginPath();
	c.arc(posx, posy, size/2, 0, Math.PI*2, true);
	c.stroke();
	/* Draw rotation value */
	c.strokeStyle = "#bbb";
	c.lineWidth = size/4;
	c.beginPath();
	c.arc(posx, posy, size/4, 0, rotation, true);
	c.stroke();
}

function positionHandler(e) {
	switch(e.type) {
		case 'touchstart':
			points = prevpoints = e.targetTouches;
			active = true;
			break;
		case 'touchmove':
			prevpoints = points;
			points = e.targetTouches;
			active = true;
			break;
		case 'touchend':
			active = false;
			break;
	}
	e.preventDefault();
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
	
	canvas.addEventListener('touchstart', positionHandler, false );
	canvas.addEventListener('touchmove',  positionHandler, false );
	canvas.addEventListener('touchend',   positionHandler, false );

	posx = canvas.width/2;
	posy = canvas.height/2;
	size = canvas.width/4;
	rotation = 0;

	setInterval(loop, 1000/25);
}

window.addEventListener('load',function() {
	/* hack to prevent firing the init script before the window object's values are populated */
	setTimeout(init,100);
},false);