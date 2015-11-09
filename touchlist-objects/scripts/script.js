/* multi-touch tracker */

var canvas,
	c, // c is the canvas' context 2D
	devicePixelRatio,
	container;

var pointsTouches = [], pointsTargetTouches = [], pointsChangedTouches = [];

function loop() {
	if(canvas.height != window.innerHeight * devicePixelRatio) {
		resetCanvas();
	} else {
		c.clearRect(0,0,canvas.width, canvas.height);
	}
	c.strokeStyle = "#eee";
	c.lineWidth = "10";

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
	resetCanvas();
	container.appendChild(canvas);
	document.body.appendChild( container );

	b = document.getElementsByTagName('button')[0];
	
	// b.addEventListener('mousemove', positionHandler, false );
	b.addEventListener('touchstart', positionHandler, false );
	b.addEventListener('touchmove',  positionHandler, false );
	b.addEventListener('touchend',  positionHandler, false );
	b.addEventListener('touchcancel',  positionHandler, false );
	
	setInterval(loop, 1000/35);
}

function resetCanvas() {
	// HiDPI canvas adapted from http://www.html5rocks.com/en/tutorials/canvas/hidpi/
	devicePixelRatio = window.devicePixelRatio || 1;
	canvas.width = window.innerWidth * devicePixelRatio;
	canvas.height = window.innerHeight * devicePixelRatio;
	canvas.style.width = window.innerWidth + 'px';
	canvas.style.height = window.innerHeight + 'px';
	c.scale(devicePixelRatio, devicePixelRatio);
}

window.addEventListener('load',function() {
	/* hack to prevent firing the init script before the window object's values are populated */
	setTimeout(init,100);
},false);