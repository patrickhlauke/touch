var VirtualList = function(inNode, inTemplate, inCallback) {
  this.list = inNode;
  this.template = inTemplate;
  this.syntax = new ExpressionSyntax();
  this.list.classList.add('virtual-list');
  this.viewport = document.createElement('div');
  this.viewport.classList.add('virtual-list-viewport');
  //this.mo = new MutationObserver(this.observe.bind(this));
  //this.mo.observe(this.viewport, {childList: true});
  this.list.appendChild(this.viewport);
  this.pageDataCallback = inCallback;
  this.pageSize = 50;  // rows per page
  this.numPages = 2;  // number of pages
  this.count = 0;  // total number of rows
  this.numInitialPages = 0; // number of pages to render at start
  this.horiz = false;
  this.fixedHeight = false;
  this.keepAllPages = false;
  this.useRaf = false;
  this.removeUnusedPages = false;
};

VirtualList.prototype = {
  reset: function(inCount) {
    this.count = inCount || this.count;
    this.scrollTop = 0;
    this.viewport.innerText = '';
    this.pageCount = Math.ceil(this.count/this.pageSize);
    this.pageHeights = [];
    this.pages = [];
    this.rowHeight = 0;
    this.pageTops = [];
    for (var i = 0; i < this.numInitialPages; i++) {
      this.generatePage(i);
    }
    this.viewport.classList[this.horiz ? 'add' : 'remove']('horiz');
    if (this.useRaf) {
      this.list.removeEventListener('scroll', this.scroll.bind(this));
      this.rafUpdate();
    } else {
      this.list.addEventListener('scroll', this.scroll.bind(this));
      this.scroll();
    }
  },
  get scrollTop() {
    return this.list[this.horiz ? 'scrollLeft' : 'scrollTop'];
  },
  set scrollTop(inTop) {
    this.list[this.horiz ? 'scrollLeft' : 'scrollTop'] = inTop;
  },
  generatePageContent: function(inPage) {
    var i = inPage.pageNum * this.pageSize;
    var j = Math.min(i + this.pageSize, this.count);
    var data = this.pageDataCallback.call(this, i, j);
    if (data) {
      for (var i=0, l=data.length; i<l; i++) {
        inPage.appendChild(this.template.createInstance(data[i], this.syntax));
      }
    }
  },
  generatePage: function(inPageNum) {
    if (inPageNum < this.pageCount) {
      var p = document.createElement('div');
      p.pageNum = inPageNum;
      p.setAttribute('page', inPageNum);
      if (!this.removeUnusedPages) {
        p.style.display = 'none';
      }
      this.generatePageContent(p);
      this.viewport.appendChild(p);
      return p;
    }
  },
  measurePage: function(inPage) {
    var ph = inPage[this.horiz ? 'offsetWidth' : 'offsetHeight'], pn = inPage.pageNum;
    console.log('measurePage', ph);
    if (!this.rowHeight) {
      this.rowHeight = ph/(this.pageSize < this.count ? this.pageSize : this.count);
      this.viewportHeight = this.count * this.rowHeight;
      this.viewport.style[this.horiz ? 'width' : 'height'] = this.viewportHeight + 'px';
    }
    var ph0 = this.getPageHeight(pn);
    this.pageHeights[pn] = ph;
    if (ph0 != ph) {
      // since page height has changed, invalidate all the pageTops after this page
      this.pageTops.splice(pn+1, this.pageTops.length);
      // also adjust the viewport's height
      this.viewportHeight += ph - ph0;
      this.viewport.style[this.horiz ? 'width' : 'height'] = this.viewportHeight + 'px';
    }
  },
  getPageHeight: function(inPageNum) {
    return this.pageHeights[inPageNum] || this.pageSize * (this.rowHeight || 100);
  },
  locatePage: function(inPos) {
    var n = inPos/this.getPageHeight(0);
    if (this.fixedHeight) {
      return n;
    }
    n = Math.floor(n);
    while (n && !this.pageTops[n] || (this.pageTops[n] > inPos)) {
      n--;
    }
    var p = this.pageTops[n] || 0;
    while (inPos >= p) {
      p += this.getPageHeight(n++);
      this.pageTops[n] = p;
    }
    n--;
    var ph = this.getPageHeight(n);
    return n + (inPos-p+ph)/ph;
  },
  positionPage: function(inPage) {
    var pn = inPage.pageNum;
    if (this.fixedHeight) {
      t = pn * this.rowHeight * this.pageSize;
    } else {
      if (this.pageTops[pn]) {
        t = this.pageTops[pn];
      } else {
        var n = 0, t = 0; 
        while (n < pn) {
          t += this.getPageHeight(n);
          n++;
        }
      }
    }
    var t0 = inPage.style[this.horiz ? 'left' : 'top'].slice(0, -2);
    // update pageTops cache
    this.pageTops[pn] = t;
    this.pageTops[pn+1] = t + this.getPageHeight(pn);
    // set the page's top
    inPage.style[this.horiz ? 'left' : 'top'] = t + 'px';
    if (t0) {
      return t0 - t;
    }
  },
  findPage: function(inPageNum) {
    return this.viewport.querySelector('[page="' + inPageNum + '"]');
  },
  scroll: function() {
    var c = Math.floor(this.locatePage(this.scrollTop + this.list[this.horiz ? 'offsetWidth' : 'offsetHeight']/2) + 0.5);
    var k = c - Math.floor(this.numPages/2);
    k = Math.max(0, k);
    if (!this.pages[0] || this.pages[0].pageNum != k) {
      this.update(k, c);
    }
  },
  rafUpdate: function() {
    webkitRequestAnimationFrame(function() {
      this.scroll();
      this.rafUpdate();
    }.bind(this));
  },
  update: function(inStartPageNum, inCenterPageNum) {
    var k = inStartPageNum, n = k+this.numPages, c = inCenterPageNum;
    this.pages = [];
    for (; k<n; k++) {
      var p = this.findPage(k) || this.generatePage(k);
      if (p) {
        if (!this.removeUnusedPages) {
          p.style.display = null;
        }
        //Platform.flush();
        this.measurePage(p);
        var d = this.positionPage(p);
        this.pages.push(p);
        // adjust scrollTop if centerPage's top has changed
        if (d && k == c) {
          this.scrollTop -= d;
        }
      }
    }
    if (!this.keepAllPages) {
      // remove out-of-bounds pages
      this.cleanupPages();
    }
  },
  cleanupPages: function() {
    for (var c=this.viewport.children, i=c.length-1, p; p=c[i]; i--) {
      if (this.pages.indexOf(p) == -1) {
        if (this.removeUnusedPages) {
          this.viewport.removeChild(p);
        } else {
          p.style.display = 'none';
        }
      }
    }
  }
};