/* multi-touch tracker */

var canvas,
	c, // c is the canvas' context 2D
	container;

var pointsTouches = [], pointsTargetTouches = [], pointsChangedTouches = [];

function resetCanvas (e) {
	// resize the canvas - but remember - this clears the canvas too.
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	//make sure we scroll to the top left.
	window.scrollTo(0,0);
}

function loop() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	c.clearRect(0,0,canvas.width, canvas.height);
	c.lineWidth = "5";

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
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	container.appendChild(canvas);
	document.body.appendChild( container );
	c.strokeStyle = "#ffffff";
	c.lineWidth =2;

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