/* mouse tracker */

var canvas,
	c, // c is the canvas' context 2D
	devicePixelRatio,
	container;

var posX, posY;

function draw() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight * devicePixelRatio) {
		resetCanvas();
	} else {
		c.clearRect(0,0,canvas.width, canvas.height);
	}
	c.strokeStyle = "#eee";
	c.lineWidth = "10";

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
	resetCanvas();
	container.appendChild(canvas);
	document.body.appendChild( container );
	
	canvas.addEventListener('mousemove', positionHandler, false );	
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