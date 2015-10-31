/* mouse tracker */

var canvas,
	c, // c is the canvas' context 2D
	container;

var posX, posY;

function draw() {
	/* hack to work around lack of orientationchange/resize event */
	if(canvas.height != window.innerHeight) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
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
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
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