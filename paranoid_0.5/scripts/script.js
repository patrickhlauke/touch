// wrap the whole thing in an object so we don't pollute the global namespace
var paranoid = {
	ctx: new Object(),
	autopilot:true,
	px:150,
	py:335,
	x:185,
	y:325,
	dx: Math.floor(Math.random()*4+5),
	dy: 0-Math.floor(Math.random()*4+5),
	
	img_bg : new Image(),
	img_shadow : new Image(),
	img_walls : new Image(),
	img_paddle : new Image(),
	img_ball : new Image(),
	img_brick : new Image(),
	
	bricks : new Array,
	bricks_count : 10,
	
	
	init: function() {
		var elem = document.getElementById('bouncy');

		paranoid.ctx = elem.getContext('2d');
		
		elem.addEventListener('touchmove', function(e){ e.preventDefault(); paranoid.mouse(e); }, false);
		elem.addEventListener('MozTouchMove', function(e){ e.preventDefault(); paranoid.mouse(e); }, false);
		elem.addEventListener('mousemove', function(e){ paranoid.mouse(e); }, false);
		elem.addEventListener('touchstart', function(e){ e.preventDefault(); paranoid.auto(false); }, false);
		elem.addEventListener('MozTouchDown', function(e){ e.preventDefault(); paranoid.auto(false); }, false);
		elem.addEventListener('mouseover', function(e){ paranoid.auto(false); }, false);
		elem.addEventListener('touchend', function(e){ e.preventDefault();paranoid.auto(true); }, false);
		elem.addEventListener('MozTouchUp', function(e){ e.preventDefault();paranoid.auto(true); }, false);
		elem.addEventListener('mouseout', function(e){ paranoid.auto(true); }, false);
		document.addEventListener('keydown', function(e){ paranoid.kbd(e);}, true);
		
		// if it's a touch device, change autopilot message and hide controls legend
		/* var hazTouch = 'ontouchstart' in window || 'onMozTouchDown' in window || 'createTouch' in document;
		if (hazTouch) {
			document.getElementById('controls').className='off';
			document.getElementById('autopilot').innerHTML+='<br>Touch to play';
		} */
		
		
		
		// PxLoader by ThinkPixelLab http://thinkpixellab.com/pxloader/
		var loader = new PxLoader(); 
		paranoid.img_bg = loader.addImage('images/background.png');
		paranoid.img_shadow = loader.addImage('images/shadow.png');
		paranoid.img_walls = loader.addImage('images/walls.png');
		paranoid.img_paddle = loader.addImage('images/paddle.png');
		paranoid.img_ball = loader.addImage('images/ball.png');
		paranoid.img_brick = loader.addImage('images/brick.png');
		 
		// callback that will be run once images are ready 
		loader.addCompletionListener(function() { 
			paranoid.reset();
			setInterval(paranoid.bounce,30);
		}); 
		 
		// begin downloading images 
		loader.start(); 
	},
	
	reset: function() {
		paranoid.x=paranoid.px+27;
		paranoid.y=paranoid.py-8;
		
		paranoid.bricks = [1,1,1,1,1,1,1,1,1,1];
		paranoid.bricks_count = 10;
		// redraw entire scene
		paranoid.ctx.drawImage(paranoid.img_bg,0,0);
		paranoid.ctx.drawImage(paranoid.img_shadow,0,0);
		for(i = 0; i<10; i++) {
				paranoid.ctx.drawImage(paranoid.img_brick,(i*32)+20,100);
		}
		paranoid.ctx.drawImage(paranoid.img_walls,0,0); // walls drawn last, so paddle shadow always underneath wall
	},

	auto: function(state) {
		paranoid.autopilot = state;
	},
	
	kbd: function(e) {
		switch(e.keyCode) {
			case 65:
				e.preventDefault(); 
				paranoid.auto(!paranoid.autopilot);
				break;
			case 37:
				e.preventDefault(); 
				paranoid.px-=30;
				break;
			case 39:
				e.preventDefault(); 
				paranoid.px+=30;
				break;			
		}
	},
	
	mouse: function(e) {
		if (e.touches) {
			console.log(e.targetTouches[0].clientX);
			console.log(parseInt(window.getComputedStyle(e.target.parentNode).getPropertyValue("margin-left")));
			paranoid.px=e.targetTouches[0].clientX-parseInt(window.getComputedStyle(e.target.parentNode).getPropertyValue("margin-left"));
		}  else if (e.offsetX) {
			paranoid.px=e.offsetX;
		
		} else if (e.layerX) {
			paranoid.px=e.layerX;
		}
		// remove half a paddle size so it's centered
		paranoid.px-=30;
	},

	bounce: function() {
		// the main game loop ... this is where everything happens

		// draw background behind ball
		paranoid.ctx.drawImage(paranoid.img_bg,paranoid.x,paranoid.y,8,8,paranoid.x,paranoid.y,8,8);
		paranoid.ctx.drawImage(paranoid.img_shadow,paranoid.x,paranoid.y,8,8,paranoid.x,paranoid.y,8,8);
		paranoid.ctx.drawImage(paranoid.img_walls,paranoid.x,paranoid.y,8,8,paranoid.x,paranoid.y,8,8);
		
		// draw background behind paddle
		paranoid.ctx.drawImage(paranoid.img_bg,0,paranoid.py,360,21,0,paranoid.py,360,21);
		paranoid.ctx.drawImage(paranoid.img_shadow,0,paranoid.py,360,21,0,paranoid.py,360,21);
		paranoid.ctx.drawImage(paranoid.img_walls,0,paranoid.py,360,21,0,paranoid.py,360,21);
		
		// collision detection
		// with bricks
		hit = false;
		for(i = 0; i<10; i++) {
			if((paranoid.bricks[i]==1)&&(!hit)) {
				if(((paranoid.x+4+paranoid.dx)>=(i*32)+20)&&
					((paranoid.x+4+paranoid.dx)<(i*32)+52)&&
					((paranoid.y+4+paranoid.dy+8)>100)&&
					((paranoid.y+4+paranoid.dy)<115)) {
					hit = true;
					paranoid.ctx.drawImage(paranoid.img_bg,(i*32)+20,100,32,15,(i*32)+20,100,32,15);
					paranoid.ctx.drawImage(paranoid.img_shadow,(i*32)+20,100,32,15,(i*32)+20,100,32,15);
					paranoid.bricks[i]=0;
					paranoid.bricks_count-=1;
					// brick to the right
					if((paranoid.dx>0)&&(paranoid.x+8<=(i*32)+22)) {paranoid.dx=0-paranoid.dx;}
					// brick to the left
					else if((paranoid.dx<0)&&(paranoid.x>=(i*32)+50)) {paranoid.dx=0-paranoid.dx;}
					// brick below
					if((paranoid.dy>0)&&(paranoid.y+8<=102)) {paranoid.dy=0-paranoid.dy;}
					// brick above
					else if((paranoid.dy<0)&&(paranoid.y>=113)) {paranoid.dy=0-paranoid.dy;}
				}
			}
		}
		// with walls
		if (paranoid.x<=20) { paranoid.dx = 0-paranoid.dx; paranoid.x=20; }
		if ((paranoid.x+paranoid.dx+8)>=340) { paranoid.dx = 0-paranoid.dx; paranoid.x=340; }
		if (paranoid.y<=15) { paranoid.dy = 0-paranoid.dy; y=15; }
		// with paddle
		if (((paranoid.y+paranoid.dy+8)>=paranoid.py)&&((paranoid.y+paranoid.dy+8)<=paranoid.py+21)) {
			if ((paranoid.px<paranoid.x)&&((paranoid.px+60)>paranoid.x)) {
				paranoid.dy = 0-paranoid.dy; paranoid.y=340-8;
			}
		}
		if ((paranoid.y+paranoid.dy+8)>=paranoid.py+40) {
				// lost ball
				paranoid.x=paranoid.px+27;
				paranoid.y=paranoid.py-8;
				paranoid.dy = 0-paranoid.dy;
		}
				
		paranoid.x+=paranoid.dx; paranoid.y+=paranoid.dy;

		// paddle control
		if (paranoid.autopilot) { 
			paranoid.px = paranoid.x-30;
			document.getElementById('autopilot').className=""
		} else {
			document.getElementById('autopilot').className="off"
		}
		
		if (paranoid.px<20) { paranoid.px=20; }
		if ((paranoid.px+60)>340) { paranoid.px=280; }
		
		// draw everything (optimised)
		// paranoid.ctx.drawImage(paranoid.img_bg,0,0);
		// paranoid.ctx.drawImage(paranoid.img_shadow,0,0);
		paranoid.ctx.drawImage(paranoid.img_ball,paranoid.x,paranoid.y);
		
		paranoid.ctx.drawImage(paranoid.img_paddle,paranoid.px,paranoid.py);
		paranoid.ctx.drawImage(paranoid.img_walls,0,paranoid.py,360,21,0,paranoid.py,360,21); // walls drawn last, so paddle shadow always underneath wall
		
		if (paranoid.bricks_count==0) {
			paranoid.dy = 0-paranoid.dy;
			paranoid.reset();
		}
			
	}

};

window.addEventListener('load',paranoid.init,false);