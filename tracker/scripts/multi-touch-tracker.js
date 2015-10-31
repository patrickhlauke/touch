/* multi-touch tracker */

var canvas,
	c, // c is the canvas' context 2D
	container;

var points = [];

function draw() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
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
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
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