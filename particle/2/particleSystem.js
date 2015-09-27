/* A basic recreation of http://www.cesmes.fi/#pallo.swf using JavaScript and Canvas
   Particle system based on http://www.zen-sign.com/experiments/jsemitter2/
   Patrick H. Lauke / February 2010 */

function Emitter(canvas) {
	this.sizeLimit = 5;
	this.particles = [];
	this.canvas = canvas;
	this.canvasContext = canvas.getContext("2d");
	
	this.createParticle = function(x,y,size,h,s,l) {
		var particle = new Particle();
		particle.x = x;
		particle.y = y;
		particle.size = size;
		particle.h = h;
		particle.s = s;
		particle.l = l;
		this.particles.push(particle);
	}
	
	this.pop = function(e) {
		var x = 0;
		var y = 0;
		var popped = false;
		if(e.offsetX) {
			x=e.offsetX;
			y=e.offsetY;
		} else if (e.layerX) {
			x=e.layerX;
			y=e.layerY;
		}
		
		for(var i = 0; i < this.particles.length; i++)
		{
			if ( (!popped) && (this.particles[i].size > this.sizeLimit) && ((this.particles[i].x-this.particles[i].size)<x) && ((this.particles[i].y-this.particles[i].size)<y) && ((this.particles[i].x+this.particles[i].size)>x) && ((this.particles[i].y+this.particles[i].size)>y) )
			{
				this.particles[i].size=this.particles[i].size/2;
				this.particles[i].h = this.particles[i].h+Math.random()*60-30;
				this.particles[i].s = Math.round(Math.random()*50+50);
				this.particles[i].l = Math.round(Math.random()*50)+25;
				this.createParticle(this.particles[i].x+this.particles[i].size,this.particles[i].y-this.particles[i].size,this.particles[i].size,Math.round(this.particles[i].h+Math.random()*60-30),Math.round(Math.random()*50+50), Math.round(Math.random()*50)+25);
				this.createParticle(this.particles[i].x+this.particles[i].size,this.particles[i].y+this.particles[i].size,this.particles[i].size,Math.round(this.particles[i].h+Math.random()*60-30),Math.round(Math.random()*50+50), Math.round(Math.random()*50)+25);
				this.createParticle(this.particles[i].x-this.particles[i].size,this.particles[i].y+this.particles[i].size,this.particles[i].size,Math.round(this.particles[i].h+Math.random()*60-30),Math.round(Math.random()*50+50), Math.round(Math.random()*50)+25);
				this.particles[i].x=this.particles[i].x-this.particles[i].size;
				this.particles[i].y=this.particles[i].y-this.particles[i].size;
				this.particles[i].age=0;
				popped = true;
			}
		}
		var that = this;
		window.requestAnimationFrame(function() { that.draw(); });
	}
	
	this.draw = function() {
		this.canvasContext.clearRect(0, 0, 400, 400);
		
		for(var i = 0; i < this.particles.length; i++)
		{
			this.canvasContext.fillStyle = 'hsl('+this.particles[i].h+', '+this.particles[i].s+'%, '+this.particles[i].l+'%)';
			this.canvasContext.beginPath();
			this.canvasContext.arc(this.particles[i].x, this.particles[i].y, this.particles[i].size, 0, Math.PI*2, true);
			this.canvasContext.fill();
		}
		
	}

	this.init = function() {
		this.reset();
		var that = this;
		var debouncedPop = debounce(function(e) { that.pop(e); }, 4, true);
		this.canvas.addEventListener('mousemove', debouncedPop, false);
	}
	
	this.reset = function(e) {
		if (this.particles.length > 0) {
			for(var i = 0; i < this.particles.length; i++)
			{
				delete this.particles[i];
				delete this.particles;
				this.particles = [];
			}
		}
		this.createParticle(200,200,200,Math.round(Math.random()*359),Math.round(Math.random()*50)+50,Math.round(Math.random()*50)+25);
		this.draw();
	}
}

function Particle() {
	this.x = 0;
	this.y = 0;
	this.size = 0;
	this.age = 0;
	this.h = 0;
	this.s = 0;
	this.l = 0;
}