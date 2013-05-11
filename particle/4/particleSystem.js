/* Particle system based on http://www.zen-sign.com/experiments/jsemitter2/
   Patrick H. Lauke / February 2011 */

function Emitter(canvas) {
	this.canvas = canvas;
	this.size = 20;
	this.sizeLimit = 10;
	this.particles = [];
	this.canvasContext = this.canvas.getContext("2d");
	
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
	
	this.react = function(e) {
		var x = 0;
		var y = 0;
		if (e.touches) {
			x=e.touches[0].clientX-e.target.offsetLeft;
			y=e.touches[0].clientY-e.target.offsetTop;
		}  else if (e.offsetX) {
			x=e.offsetX;
			y=e.offsetY;
		} else if (e.layerX) {
			x=e.layerX;
			y=e.layerY;
		}

		for(var i = 0; i < this.particles.length; i++)
		{
			
			this.particles[i].size=this.size - (Math.sqrt(Math.pow(this.particles[i].x-x,2)+Math.pow(this.particles[i].y-y,2)) / 30);
			if (this.particles[i].size < this.sizeLimit) { this.particles[i].size=this.sizeLimit; }
			this.particles[i].s = 100 - (Math.sqrt(Math.pow(this.particles[i].x-x,2)+Math.pow(this.particles[i].y-y,2))/2);
			if (this.particles[i].s < 0) { this.particles[i].s = 0; }
			this.particles[i].h += 1;
			
		}
		this.draw();
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
		this.canvas.addEventListener('mousemove', function(e) { e.preventDefault(); that.react(e); }, false);
		this.canvas.addEventListener('touchstart', function(e) { e.preventDefault(); that.react(e); }, false);
		this.canvas.addEventListener('touchmove', function(e) { e.preventDefault(); that.react(e); }, false);
		this.canvas.addEventListener('dblclick', function(e) { that.reset(e); }, false);
	}
	
	this.reset = function(e) {
		if (this.particles.length === 0) {
			var j = Math.floor(canvas.width/(this.size*2));
			var h = Math.round(Math.random()*359);
			for(var i = 0; i < j*j; i++)
			{
				this.createParticle((i%j)*(this.size*2)+this.size,Math.floor(i/j)*(this.size*2)+this.size,this.sizeLimit,(h += Math.round(Math.random()*30-15)),0,Math.round(Math.random()*50)+25);
			}
		}
		
		this.draw();
	}
}

function Particle() {
	this.x = 0;
	this.y = 0;
	this.size = 0;
	this.h = 0;
	this.s = 0;
	this.l = 0;
}