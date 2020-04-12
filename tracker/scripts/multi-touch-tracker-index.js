/* tracker for touch events showing TouchList index of individual touch points
   to demonstrate how unreliable/arbitrary the order of Touch objects in TouchList
   objects can be (instead authors should rely on the unique identifier
   when tracking specific touch points) */

var canvas,
	c, // c is the canvas' context 2D
	devicePixelRatio,
	container;

var points = [];

function draw() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight * devicePixelRatio) {
		resetCanvas();
	} else {
		c.clearRect(0,0,canvas.width, canvas.height);
	}
	c.strokeStyle = "#eee";
	c.lineWidth = "10";

	for (var i = 0, l = points.length; i<l; i++) {

		/* draw all circles */
		c.beginPath();
		c.arc(points[i].clientX, points[i].clientY, 50, 0, Math.PI*2, true);
		c.stroke();

		/* draw index info */
		c.fillStyle = "#fff";
		c.font = "50px Arial";
		c.fillText(i, points[i].clientX + 70, points[i].clientY);
		c.font = "15px Arial";
		c.fillText('targetTouches['+i+']', points[i].clientX + 70, points[i].clientY + 20);
		c.fillText('identifier: '+points[i].identifier, points[i].clientX + 70, points[i].clientY + 40);

	}

}

function positionHandler(e) {
	points = [];
	points = e.targetTouches;
	// prevent mouse compat events
	e.preventDefault();
	
	window.requestAnimationFrame(draw);
}

function init() {
	canvas = document.createElement( 'canvas' );
	c = canvas.getContext( '2d' );
	container = document.createElement( 'div' );
	container.className = "container";
	resetCanvas();
	container.appendChild(canvas);
	document.body.appendChild( container );
	// use debounced function for better performance on older/underpowered devices (e.g. Nexus 10)
	var debouncedPositionHandler = debounce(positionHandler, 5, true);

	var events = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];

	for (var i=0, l=events.length; i<l; i++) {
		if (events[i] == 'touchmove') {
			canvas.addEventListener(events[i],  debouncedPositionHandler, false );
		} else {
			canvas.addEventListener(events[i],  positionHandler, false );
		}
	}
	
	// suppress context menu
	canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); }, false)

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