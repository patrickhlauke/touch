/* Maus Tracker */

var canvas,
	c, // c is the canvas' context 2D
	container;

var posX, posY;

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
	c.strokeStyle = "cyan";
	c.lineWidth = "6";

	c.beginPath();
	c.arc(posX, posY, 50, 0, Math.PI*2, true);
	c.stroke();

}

function positionHandler(e) {
	posX = e.clientX;
	posY = e.clientY;
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
	
	canvas.addEventListener('mousemove', positionHandler, false );
	setInterval(loop, 1000/35);
	
}

window.addEventListener('load',function() {
	/* hack to prevent firing the init script before the window object's values are populated */
	setTimeout(init,100);
},false);