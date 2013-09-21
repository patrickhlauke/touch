Polymer.addResolvePath = function (proto, element) {
  // monkey patch addResolvePath to use assetpath attribute
  var assetPath = element.getAttribute('assetpath');
  var url = HTMLImports.getDocumentUrl(element.ownerDocument) || '';
  if (url) {
    var parts = url.split('/');
    parts.pop();
    if (assetPath) {
      parts.push(assetPath);
    }
    parts.push('');
    url = parts.join('/');
  }
  proto.resolvePath = function(path) {
    return url + path;
  };
};;

		Polymer('calendar-event-preview', {
			event: {}
		});
	;

		Polymer('calendar-day', {
			start: 0,
			events: [],
			onEventDetailsClick: function(event) {
				this.fire('calendar-event-details', {event: event.target.event});
			},
			onBackgroundClick: function(event) {
				this.fire('calendar-event-create', {
					start: (this.start + event.toElement.offsetTop / 5 * 360000)
				});
			}
		});
	;

		Polymer('calendar-hours');
	;

		Polymer('calendar-day-view', {
			events: [],
			start: 0
		});
	;

    PolymerUI = { 
      findTheme: function() {
        var p = this, theme;
        while (p && !theme) {
          theme = p.getAttribute && p.getAttribute('theme');
          p = p.parentNode || p.host;
        }
        this.theme = theme;
      }
    };
    Polymer('polymer-ui-theme-aware', {
      inserted: function() {
        if (!this.theme) {
          this.findTheme();
        }
      },
      findTheme: PolymerUI.findTheme,
      themeChanged: function(old) {
        this.classList.switch(old, this.theme);
      }
    });
  ;

    (function() {
      var icons = [
       'drawer',
       'menu',
       'search',
       'dropdown',
       'close',
       'add',
       'trash',
       'refresh',
       'settings',
       'dialoga',
       'left',
       'right',
       'down',
       'up',
       'grid',
       'contact',
       'account',
       'plus',
       'time',
       'marker',
       'briefcase',
       'array',
       'columns',
       'list',
       'modules',
       'quilt',
       'stream',
       'maximize',
       'shrink',
       'sort',
       'shortcut',
       'dialog',
       'twitter',
       'facebook',
       'favorite',
       'gplus',
       'filter',
       'tag',
       'plusone',
       'dots'
      ];
      var map = {};
      icons.forEach(function(name, i) {
        map[name] = i;
      });
      icons = map;

      Polymer('polymer-ui-icon', {
        /**
         * The URL of an image for the icon.
         *
         * @attribute src
         * @type string
         * @default ''
         */
        src: '',
        /**
         * Specifies the size of the icon.
         *
         * @attribute size
         * @type string
         * @default 24
         */
        size: 24,
        /**
         * Specifies the icon from the Polymer icon set.
         *
         * @attribute icon
         * @type string
         * @default ''
         */
        icon: '',
        bx: 0,
        by: 0,
        icons: icons,
        ready: function() {
          this.sizeChanged();
        },
        sizeChanged: function() {
          this.style.width = this.style.height = this.size + 'px';
        },
        iconChanged: function() {
          this.index = this.icon in icons ? icons[this.icon] : -1;
        },
        indexChanged: function() {
          this.classList.add('polymer-ui-icons');
          this.by = -this.size * this.index;
          this.updateIcon();
        },
        srcChanged: function() {
          this.classList.remove('polymer-ui-icons');
          this.style.backgroundImage = 'url(' + this.src + ')';
          this.updateIcon();
        },
        themeChanged: function(old) {
          this.style.backgroundPosition = '';
          this.classList.switch(old, this.theme);
          this.asyncMethod('updateIcon');
        },
        updateIcon: function() {
          if (this.src) {
            this.style.backgroundPosition = 'center';
          } else {
            //this.bx = parseFloat(getComputedStyle(this).backgroundPosition.split(' ').shift());
            //this.style.backgroundPosition = (this.bx + 'px') + ' ' + (this.by + 'px');
            this.style.backgroundPositionY = this.by + 'px';
          }
        }
      });
    })();
  ;

    Polymer('polymer-ui-icon-button', {
      /**
       * The URL of an image for the icon.
       *
       * @attribute src
       * @type string
       * @default ''
       */
      src: '',
      /**
       * If true, border is placed around the button to indicate
       * active state.
       *
       * @attribute active
       * @type boolean
       * @default false
       */
      active: false,
      /**
       * Specifies the icon from the Polymer icon set.
       *
       * @attribute icon
       * @type string
       * @default ''
       */
      icon: '',
      /**
       * If a theme is applied that includes an icon set, the index of the 
       * icon to display.
       *
       * @attribute index
       * @type number
       * @default -1
       */     
      index: -1,
      activeChanged: function() {
        // TODO(sjmiles): sugar this common case
        this.classList.toggle('selected', this.active);
      }
    });
  ;

    Polymer('polymer-media-query', {
      queryMatches: false,
      query: '',
      ready: function() {
        this._mqHandler = this.queryHandler.bind(this);
        this._mq = null;
      },
      queryChanged: function() {
        if (this._mq) {
          this._mq.removeListener(this._mqHandler);
        }
        this._mq = window.matchMedia('(' + this.query + ')');
        this._mq.addListener(this._mqHandler);
        this.queryHandler(this._mq);
      },
      queryHandler: function(mq) {
        this.queryMatches = mq.matches;
        this.asyncFire('polymer-mediachange', mq);
      }
    });
  ;

    Polymer('polymer-flex-layout', {
      vertical: false,
      isContainer: false,
      inserted: function() {
        this.installControllerStyles();
        this.layoutContainer = this.isContainer ? 
            this : (this.parentNode.host || this.parentNode);
        if (!this.isContainer) {
          this.style.display = 'none';
        }
        this.layoutContainer.classList.add('flexbox');
        this.verticalChanged();
        this.alignChanged();
        this.justifyChanged();
      },
      switchContainerClass: function(prefix, old, name) {
        if (this.layoutContainer && name) {
          this.layoutContainer.classList.switch(
              prefix + old, prefix + name);
        }
      },
      verticalChanged: function() {
        if (this.layoutContainer) {
          this.layoutContainer.classList.toggle('column', this.vertical);
        }
      },
      alignChanged: function(old) {
        this.switchContainerClass('align-', old, this.align);
      },
      justifyChanged: function(old) {
        this.switchContainerClass('justify-', old, this.justify);
      }
    });
  ;

    Polymer('polymer-ui-toolbar', {
      responsiveWidth: '800px',
      queryMatches: false,
      queryMatchesChanged: function() {
        this.classList.toggle('narrow-layout', this.queryMatches);
      }
    });
  ;

    Polymer('polymer-ui-toggle-button', {
      /**
       * Gets or sets the state, true is ON and false is OFF.
       *
       * @attribute value
       * @type boolean
       * @default false
       */
      value: false,
      noCaption: false,
      onCaption: 'ON',
      offCaption: 'OFF',
      toggle: function() {
        this.value = !this.value;
      },
      valueChanged: function() {
        this.classList.toggle('on', this.value);
        this.$.toggle.classList.toggle('on', this.value);
      },
      trackStart: function(e) {
        e.preventTap();
        this.w = this.$.toggle.offsetWidth - this.clientWidth;
        this.$.toggle.classList.add('dragging');
      },
      track: function(e) {
        this.x = Math.max(-this.w, Math.min(0, this.value ? e.dx : e.dx - this.w));
        this.$.toggle.style.left = this.x + 'px';
      },
      trackEnd: function() {
        this.$.toggle.style.left = null;
        this.$.toggle.classList.remove('dragging');
        this.value = Math.abs(this.x) < this.w / 2;
        Platform.flush();
      },
      flick: function(e) {
        this.value = e.xVelocity > 0;
        Platform.flush();
      }
    });
  ;

    Polymer('polymer-selection', {
      multi: false,
      ready: function() {
        this.clear();
      },
      clear: function() {
        this.selection = [];
      },
      getSelection: function() {
        return this.multi ? this.selection : this.selection[0];
      },
      isSelected: function(item) {
        return this.selection.indexOf(item) >= 0;
      },
      setItemSelected: function(item, isSelected) {
        if (item) {
          if (isSelected) {
            this.selection.push(item);
          } else {
            var i = this.selection.indexOf(item);
            if (i >= 0) {
              this.selection.splice(i, 1);
            }
          }
          this.fire("polymer-select", {isSelected: isSelected, item: item});
        }
      },
      select: function(item) {
        if (this.multi) {
          this.toggle(item);
        } else if (this.getSelection() !== item) {
          this.setItemSelected(this.getSelection(), false);
          this.setItemSelected(item, true);
        }
      },
      toggle: function(item) {
        this.setItemSelected(item, !this.isSelected(item));
      }
    });
  ;

    Polymer('polymer-selector', {
      /**
       * Gets or sets the selected element.  Default to use the index
       * of the item element.
       *
       * If you want a specific attribute value of the element to be
       * used instead of index, set "valueattr" to that attribute name.
       *
       * Example:
       *
       *     <polymer-selector valueattr="label" selected="foo">
       *       <div label="foo"></div>
       *       <div label="bar"></div>
       *       <div label="zot"></div>
       *     </polymer-selector>
       *
       * In multi-selection this should be an array of values.
       *
       * Example:
       *
       *     <polymer-selector id="selector" valueattr="label" multi>
       *       <div label="foo"></div>
       *       <div label="bar"></div>
       *       <div label="zot"></div>
       *     </polymer-selector>
       *
       *     this.$.selector.selected = ['foo', 'zot'];
       *
       * @attribute selected
       * @type string or array
       * @default null
       */
      selected: null,
      /**
       * If true, multiple selections are allowed.
       *
       * @attribute multi
       * @type boolean
       * @default false
       */
      multi: false,
      /**
       * Specifies the attribute to be used for "selected" attribute.
       *
       * @attribute valueattr
       * @type string
       * @default 'name'
       */
      valueattr: 'name',
      /**
       * Specifies the CSS class to be used to add to the selected element.
       * 
       * @attribute selectedClass
       * @type string
       * @default 'polymer-selected'
       */
      selectedClass: 'polymer-selected',
      /**
       * Specifies the property to be used to set on the selected element
       * to indicate its active state.
       *
       * @attribute selectedProperty
       * @type string
       * @default 'active'
       */
      selectedProperty: 'active',
      /**
       * Returns the currently selected element.
       * 
       * @attribute selectedItem
       * @type Object
       * @default null
       */
      selectedItem: null,
      /**
       * In single selection, this returns the model associated with the
       * selected element.
       * 
       * @attribute selectedModel
       * @type Object
       * @default null
       */
      selectedModel: null,
      /**
       * The target element that contains items.
       * 
       * @attribute target
       * @type Object
       * @default null
       */
      target: null,
      itemsSelector: '',
      activateEvent: 'tap',
      notap: false,
      ready: function() {
        this.activateListener = this.activateHandler.bind(this);
        this.observer = new MutationObserver(this.updateSelected.bind(this));
        if (!this.target) {
          this.target = this;
        }
      },
      get items() {
        var nodes = this.target !== this ? (this.itemsSelector ? 
            this.target.querySelectorAll(this.itemsSelector) : 
                this.target.children) : this.$.items.getDistributedNodes();
        return Array.prototype.filter.call(nodes || [], function(n) {
          return n && n.localName !== 'template';
        });
      },
      targetChanged: function(old) {
        if (old) {
          this.removeListener(old);
          this.observer.disconnect();
        }
        if (this.target) {
          this.addListener(this.target);
          this.observer.observe(this.target, {childList: true});
        }
      },
      addListener: function(node) {
        node.addEventListener(this.activateEvent, this.activateListener);
      },
      removeListener: function(node) {
        node.removeEventListener(this.activateEvent, this.activateListener);
      },
      get selection() {
        return this.$.selection.getSelection();
      },
      selectedChanged: function() {
        this.updateSelected();
      },
      updateSelected: function() {
        this.validateSelected();
        if (this.multi) {
          this.clearSelection();
          this.selected && this.selected.forEach(function(s) {
            this.valueToSelection(s);
          }, this);
        } else {
          this.valueToSelection(this.selected);
        }
      },
      validateSelected: function() {
        // convert to an arrray for multi-selection
        if (this.multi && !Array.isArray(this.selected) && 
            this.selected !== null && this.selected !== undefined) {
          this.selected = [this.selected];
        }
      },
      clearSelection: function() {
        if (this.multi) {
          this.selection.slice().forEach(function(s) {
            this.$.selection.setItemSelected(s, false);
          }, this);
        } else {
          this.$.selection.setItemSelected(this.selection, false);
        }
        this.selectedItem = null;
        this.$.selection.clear();
      },
      valueToSelection: function(value) {
        var item = (value === null || value === undefined) ? 
            null : this.items[this.valueToIndex(value)];
        this.$.selection.select(item);
      },
      updateSelectedItem: function() {
        this.selectedItem = this.selection;
      },
      selectedItemChanged: function() {
        if (this.selectedItem) {
          var t = this.selectedItem.templateInstance;
          this.selectedModel = t ? t.model : undefined;
        } else {
          this.selectedModel = null;
        }
      },
      valueToIndex: function(value) {
        // find an item with value == value and return it's index
        for (var i=0, items=this.items, c; (c=items[i]); i++) {
          if (this.valueForNode(c) == value) {
            return i;
          }
        }
        // if no item found, the value itself is probably the index
        return value;
      },
      valueForNode: function(node) {
        return node[this.valueattr] || node.getAttribute(this.valueattr);
      },
      // events fired from <polymer-selection> object
      selectionSelect: function(e, detail) {
        this.updateSelectedItem();
        if (detail.item) {
          this.applySelection(detail.item, detail.isSelected)
        }
      },
      applySelection: function(item, isSelected) {
        if (this.selectedClass) {
          item.classList.toggle(this.selectedClass, isSelected);
        }
        if (this.selectedProperty) {
          item[this.selectedProperty] = isSelected;
        }
      },
      // event fired from host
      activateHandler: function(e) {
        if (!this.notap) {
          var i = this.findDistributedTarget(e.target, this.items);
          if (i >= 0) {
            var item = this.items[i];
            var s = this.valueForNode(item) || i;
            if (this.multi) {
              if (this.selected) {
                this.addRemoveSelected(s);
              } else {
                this.selected = [s];
              }
            } else {
              this.selected = s;
            }
            this.asyncFire('polymer-activate', {item: item});
          }
        }
      },
      addRemoveSelected: function(value) {
        var i = this.selected.indexOf(value);
        if (i >= 0) {
          this.selected.splice(i, 1);
        } else {
          this.selected.push(value);
        }
        this.valueToSelection(value);
      },
      findDistributedTarget: function(target, nodes) {
        // find first ancestor of target (including itself) that
        // is in nodes, if any
        while (target && target != this) {
          var i = Array.prototype.indexOf.call(nodes, target);
          if (i >= 0) {
            return i;
          }
          target = target.parentNode;
        }
      }
    });
  ;

    Polymer('polymer-ui-tabs');
  ;

		Polymer('calendar-color-button');
	;

		var BLANK_EVENT = {
			duration: 0,
			start: 0
		};
		Polymer('calendar-event-details', {
			event: BLANK_EVENT,
			get date() {
				return new Date(this.event.start).toDateString();
			},
			get end() {
				return new Date(this.event.start + this.event.duration * 60000).toLocaleTimeString();
			},
			get start() {
				return new Date(this.event.start).toLocaleTimeString();
			},
			onBackClick: function() {
				this.fire('calendar-event-details-done');
			},
			onDeleteClick: function() {
				this.fire('calendar-event-delete', {event: this.event});
			},
			onEditClick: function() {
				this.fire('calendar-event-details-edit', {event: this.event});
			}
		});
	;

		var BLANK_EVENT = {
			duration: 0,
			start: 0
		};
		Polymer('calendar-event-edit', {
			event: BLANK_EVENT,
			get start() {
				return new Date((this.event.start || 0) - new Date().getTimezoneOffset() * 60000).toISOString().split('.')[0];
			},
			set start(newValue) {
				this.event.start = Date.parse(newValue) + new Date().getTimezoneOffset() * 60000;
			},
			onCancelClick: function() {
				// TODO: revert event
				this.fire('calendar-event-edit-done');
			},
			onSaveClick: function() {
				this.fire('calendar-event-edit-done');
			}
		});
	;

    var BLANK_EVENT = {
      duration: 0,
      start: 0
    };
    Polymer('calendar-app', {
      events: [],
      editingEvent: BLANK_EVENT,
      selectedEvent: BLANK_EVENT,
      viewStart: 1375660800000,
      created: function() {
      },
      eventsChanged: function() {
        console.log('=====Here\'s where you should persist this.events to chrome storage=====');
      },
      onCalendarEventCreate: function(event) {
        this.editingEvent = {
          color: '#000',
          duration: 30,
          start: event.detail.start
        };
        this.events.push(this.editingEvent);
      },
      onCalendarEventDelete: function(event) {
        this.selectedEvent = BLANK_EVENT;
        for (var i = this.events.length - 1; i >= 0; --i) {
          if (this.events[i] == event.detail.event) {
            this.events.splice(i, 1);
            return;
          }
        }
      },
      onCalendarEventDetails: function(event) {
        this.selectedEvent = event.detail.event;
      },
      onCalendarEventDetailsDone: function() {
        this.selectedEvent = BLANK_EVENT;
        this.eventsChanged();
      },
      onCalendarEventDetailsEdit: function(event) {
        this.selectedEvent = BLANK_EVENT;
        this.editingEvent = event.detail.event;
      },
      onCalendarEventEditDone: function() {
        this.selectedEvent = this.editingEvent;
        this.editingEvent = BLANK_EVENT;
        this.eventsChanged();
      },
      ready: function() {
        console.log('=====Here\'s where you should load this.events from chrome storage=====');
        // Remove the rest of this method when you do.

        this.events = [{
          color: '#0066ff',
          description: 'Test description',
          duration: 525,
          isPublic: false,
          location: 'Test Location 1',
          name: 'Test Name 1',
          start: 1375702200000
        }, {
          color: '#009900',
          description: 'Test description',
          duration: 30,
          isPublic: true,
          location: '',
          name: 'Test Name 2 test test test test test test test test test the end',
          start: 1375693200000
        }, {
          color: '#990000',
          description: 'Test description',
          duration: 90,
          isPublic: false,
          location: 'Test Location 3 test test test test test test test',
          name: 'Test Name 3',
          start: 1375696800000
        }, {
          color: '#990099',
          description: 'Test description',
          duration: 120,
          isPublic: true,
          location: 'Test Location 4',
          name: 'Test Name 4',
          start: 1375684200000
        }];
      }
    });
  