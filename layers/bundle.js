(function () {
  'use strict';

  var babelHelpers = {};
  babelHelpers.typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  babelHelpers.classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  babelHelpers.createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  babelHelpers;


  var __commonjs_global = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this;
  function __commonjs(fn, module) { return module = { exports: {} }, fn(module, module.exports, __commonjs_global), module.exports; }

  var kran$1 = __commonjs(function (module, exports, global) {
  (function () {

    var Kran = function Kran() {
      this.components = [];

      this.systems = [];
      this.systemGroups = {};
      this.systemGroups.all = new SystemGroup();

      this.entityCollections = {};
    };

    // ***********************************************
    // Component
    //
    function Component(comp) {
      if (isFunc(comp) || typeof comp === "string") {
        this.value = comp;
      } else if (comp === true || comp === undefined) {
        this.value = true;
      } else {
        throw new TypeError("Argument " + comp + " is given but not a function or string");
      }
      this.collectionsRequieringComp = [];
    }

    Kran.prototype.component = function (comp) {
      this.components.push(new Component(comp));
      return this.components.length - 1;
    };

    function checkComponentExistence(comps, compId) {
      if (comps[compId] !== undefined) {
        return compId;
      } else {
        throw new Error("Component " + compId + " does no exist");
      }
    }

    // ***********************************************
    // Entity collections
    //
    var EntityCollection = function EntityCollection(comps) {
      this.comps = comps;
      this.buffer = new Array(comps.length + 2);
      this.ents = new LinkedList();
      this.arrival = [];
    };

    EntityCollection.prototype.callWithComps = function (ent, func, context, ev) {
      var offset = 0;
      if (ev) this.buffer[offset++] = ev;
      for (var i = 0; i < this.comps.length; i++) {
        // Boolean components are equal to their id
        if (ent.comps[this.comps[i]] !== this.comps[i]) {
          this.buffer[offset++] = ent.comps[this.comps[i]];
        }
      }
      this.buffer[offset] = ent;
      func.apply(context, this.buffer);
    };

    EntityCollection.prototype.forEachWithComps = function (every, context, ev) {
      this.ents.forEach(function (ent) {
        // Call every
        this.callWithComps(ent, every, context, ev);
      }, this);
    };

    Kran.prototype.getEntityCollection = function (comps) {
      comps = wrapInArray(comps);
      var key = comps.slice(0).sort().toString();
      if (this.entityCollections[key] === undefined) {
        var newCol = this.entityCollections[key] = new EntityCollection(comps);

        // Mark components that are part of this collection
        comps.forEach(function (compId) {
          compId = getCompId(compId);
          checkComponentExistence(this.components, compId);
          this.components[compId].collectionsRequieringComp.push(newCol);
        }, this);
      }
      return this.entityCollections[key];
    };

    // ***********************************************
    // System
    //
    var SystemGroup = function SystemGroup() {
      this.members = [];
    };

    SystemGroup.prototype.run = function () {
      this.members.forEach(function (member) {
        member.run();
      });
    };

    Kran.prototype.system = function (props) {
      var id = this.systems.length;
      props.run = runSystem;

      if (props.components !== undefined) {
        props.collection = this.getEntityCollection(props.components);
        if (isFunc(props.arrival)) props.collection.arrival.push(props.arrival);
      }
      if (props.on) {
        props.on = wrapInArray(props.on);
        props.on.forEach(function (event) {
          window.addEventListener(event, props.run.bind(props));
        });
      } else {
        // Only systems not listening for events are put in the all group
        this.systemGroups.all.members.push(props);
      }
      if (props.group) {
        if (this.systemGroups[props.group] === undefined) {
          this.systemGroups[props.group] = new SystemGroup(props.group);
        }
        this.systemGroups[props.group].members.push(props);
      }
      this.systems.push(props);
    };

    Kran.prototype.run = function (group) {
      this.systemGroups[group].members.forEach(function (member) {
        member.run();
      });
    };

    Kran.prototype.init = function (group) {
      this.systemGroups[group].members.forEach(function (member) {
        if (isFunc(member.init)) {
          member.init();
        }
      });
    };

    var runSystem = function runSystem(ev) {
      if (this.collection !== undefined && this.collection.ents.length === 0) {
        return;
      }
      if (ev && ev instanceof CustomEvent) {
        ev = ev.detail;
      }
      if (isFunc(this.pre)) this.pre(ev);
      if (isFunc(this.every)) {
        this.collection.forEachWithComps(this.every, this, ev);
      }
      if (isFunc(this.post)) this.post(ev);
    };

    // ***********************************************
    // Entity
    //
    var Entity = function Entity(compBlueprints) {
      this.comps = new Array(compBlueprints.length);
      this.compBlueprints = compBlueprints;
      this.belongsTo = new LinkedList();
    };

    Entity.prototype.add = function (compId, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
      compId = getCompId(compId);
      checkComponentExistence(this.compBlueprints, compId);
      if (this.comps[compId] !== undefined) throw new Error("The entity already has the component");
      var comp = this.compBlueprints[compId].value;
      if (isFunc(comp)) {
        this.comps[compId] = new comp(arg1, arg2, arg3, arg4, arg5, arg6, arg7);
        this.comps[compId].id = compId;
      } else if (typeof comp === "string") {
        var obj = { id: compId };
        obj[comp] = arg1;
        this.comps[compId] = obj;
      } else {
        this.comps[compId] = compId;
      }
      this.compBlueprints[compId].collectionsRequieringComp.forEach(function (coll) {
        if (qualifiesForCollection(this, coll.comps)) {
          addEntityToCollection(this, coll);
        }
      }, this);
      return this;
    };

    Entity.prototype.get = function (compId) {
      return this.comps[getCompId(compId)];
    };

    Entity.prototype.has = function (compId) {
      return this.comps[getCompId(compId)] !== undefined;
    };

    Entity.prototype.remove = function (compId) {
      compId = getCompId(compId);
      if (this.comps[compId] === undefined) throw new Error("The entity doesn't have the component");
      this.comps[compId] = undefined;
      this.belongsTo.forEach(function (collBelonging, elm) {
        if (!qualifiesForCollection(this, collBelonging.comps)) {
          collBelonging.entry.remove();
          elm.remove();
        }
      }, this);
      return this;
    };

    Entity.prototype.trigger = function (compId, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
      compId = getCompId(compId);
      this.add(compId, arg1, arg2, arg3, arg4, arg5, arg6, arg7);
      this.remove(compId);
    };

    Entity.prototype.delete = function () {
      this.belongsTo.forEach(function (collBelonging, elm) {
        collBelonging.entry.remove();
      });
    };

    Kran.prototype.entity = function () {
      return new Entity(this.components);
    };

    var CollectionBelonging = function CollectionBelonging(comps, entry) {
      this.comps = comps;
      this.entry = entry;
    };

    var addEntityToCollection = function addEntityToCollection(ent, coll) {
      coll.arrival.forEach(function (func) {
        coll.callWithComps(ent, func);
      });
      var collEntry = coll.ents.add(ent);
      ent.belongsTo.add(new CollectionBelonging(coll.comps, collEntry));
    };

    function getCompId(compId) {
      if (typeof compId === "number") {
        return compId;
      } else if ((typeof compId === "undefined" ? "undefined" : babelHelpers.typeof(compId)) === "object" && typeof compId.id === "number") {
        return compId.id;
      }
      throw new TypeError(compId + " is not a component id or an oject containing an id");
    }

    var qualifiesForCollection = function qualifiesForCollection(ent, comps) {
      return comps.every(function (compId) {
        if (ent.comps[compId] === undefined) {
          return false;
        }
        return true;
      });
    };

    // ***********************************************
    // Event system
    //
    Kran.prototype.trigger = function (name, data) {
      var event = new CustomEvent(name, { detail: data });
      window.dispatchEvent(event);
    };

    // ***********************************************
    // Helper functions
    //
    var isFunc = function isFunc(func) {
      if (typeof func === 'function') {
        return true;
      } else {
        return false;
      }
    };

    var wrapInArray = function wrapInArray(arg) {
      if (arg instanceof Array) {
        return arg;
      } else {
        return [arg];
      }
    };

    // ***********************************************
    // Linked list
    //
    var LinkedList = Kran.LinkedList = function () {
      this.head = null;
      this.tail = null;
      this.length = 0;
    };

    function Element(data, list) {
      this.data = data;
      this.list = list;
      this.prev = list.tail;
      this.next = null;
    }

    Element.prototype.remove = function () {
      if (this.prev) {
        this.prev.next = this.next;
      } else {
        this.list.head = this.next;
      }
      if (this.next) {
        this.next.prev = this.prev;
      } else {
        this.list.tail = this.prev;
      }
      this.list.length--;
    };

    LinkedList.prototype.add = function (data) {
      var elm = new Element(data, this);
      if (this.tail) {
        this.tail.next = elm;
      } else {
        this.head = elm;
      }
      this.tail = elm;
      this.length++;
      return elm;
    };

    LinkedList.prototype.forEach = function (func, context) {
      var elm,
          nextElm = this.head;

      while (nextElm !== null) {
        elm = nextElm;
        nextElm = elm.next;
        func.call(context, elm.data, elm);
      }
    };

    // ***********************************************
    // Export
    //
    if ((typeof module === "undefined" ? "undefined" : babelHelpers.typeof(module)) === "object" && // CommonJS
    babelHelpers.typeof(module.exports) === "object") {
      module.exports = Kran;
    } else if (typeof define === "function" && define.amd) {
      // AMD module
      define("kran", [], function () {
        return Kran;
      });
    } else {
      // Otherwise just attach to the global object
      this.Kran = Kran;
    }
  }).call(__commonjs_global);
  });

  var Kran = (kran$1 && typeof kran$1 === 'object' && 'default' in kran$1 ? kran$1['default'] : kran$1);

  var Tween = __commonjs(function (module, exports, global) {
  /**
   * Tween.js - Licensed under the MIT license
   * https://github.com/tweenjs/tween.js
   * ----------------------------------------------
   *
   * See https://github.com/tweenjs/tween.js/graphs/contributors for the full list of contributors.
   * Thank you all, you're awesome!
   */

  // Include a performance.now polyfill
  (function () {

  	if ('performance' in window === false) {
  		window.performance = {};
  	}

  	// IE 8
  	Date.now = Date.now || function () {
  		return new Date().getTime();
  	};

  	if ('now' in window.performance === false) {
  		var offset = window.performance.timing && window.performance.timing.navigationStart ? window.performance.timing.navigationStart : Date.now();

  		window.performance.now = function () {
  			return Date.now() - offset;
  		};
  	}
  })();

  var TWEEN = TWEEN || function () {

  	var _tweens = [];

  	return {

  		getAll: function getAll() {

  			return _tweens;
  		},

  		removeAll: function removeAll() {

  			_tweens = [];
  		},

  		add: function add(tween) {

  			_tweens.push(tween);
  		},

  		remove: function remove(tween) {

  			var i = _tweens.indexOf(tween);

  			if (i !== -1) {
  				_tweens.splice(i, 1);
  			}
  		},

  		update: function update(time) {

  			if (_tweens.length === 0) {
  				return false;
  			}

  			var i = 0;

  			time = time !== undefined ? time : window.performance.now();

  			while (i < _tweens.length) {

  				if (_tweens[i].update(time)) {
  					i++;
  				} else {
  					_tweens.splice(i, 1);
  				}
  			}

  			return true;
  		}
  	};
  }();

  TWEEN.Tween = function (object) {

  	var _object = object;
  	var _valuesStart = {};
  	var _valuesEnd = {};
  	var _valuesStartRepeat = {};
  	var _duration = 1000;
  	var _repeat = 0;
  	var _yoyo = false;
  	var _isPlaying = false;
  	var _reversed = false;
  	var _delayTime = 0;
  	var _startTime = null;
  	var _easingFunction = TWEEN.Easing.Linear.None;
  	var _interpolationFunction = TWEEN.Interpolation.Linear;
  	var _chainedTweens = [];
  	var _onStartCallback = null;
  	var _onStartCallbackFired = false;
  	var _onUpdateCallback = null;
  	var _onCompleteCallback = null;
  	var _onStopCallback = null;

  	// Set all starting values present on the target object
  	for (var field in object) {
  		_valuesStart[field] = parseFloat(object[field], 10);
  	}

  	this.to = function (properties, duration) {

  		if (duration !== undefined) {
  			_duration = duration;
  		}

  		_valuesEnd = properties;

  		return this;
  	};

  	this.start = function (time) {

  		TWEEN.add(this);

  		_isPlaying = true;

  		_onStartCallbackFired = false;

  		_startTime = time !== undefined ? time : window.performance.now();
  		_startTime += _delayTime;

  		for (var property in _valuesEnd) {

  			// Check if an Array was provided as property value
  			if (_valuesEnd[property] instanceof Array) {

  				if (_valuesEnd[property].length === 0) {
  					continue;
  				}

  				// Create a local copy of the Array with the start value at the front
  				_valuesEnd[property] = [_object[property]].concat(_valuesEnd[property]);
  			}

  			// If `to()` specifies a property that doesn't exist in the source object,
  			// we should not set that property in the object
  			if (_valuesStart[property] === undefined) {
  				continue;
  			}

  			_valuesStart[property] = _object[property];

  			if (_valuesStart[property] instanceof Array === false) {
  				_valuesStart[property] *= 1.0; // Ensures we're using numbers, not strings
  			}

  			_valuesStartRepeat[property] = _valuesStart[property] || 0;
  		}

  		return this;
  	};

  	this.stop = function () {

  		if (!_isPlaying) {
  			return this;
  		}

  		TWEEN.remove(this);
  		_isPlaying = false;

  		if (_onStopCallback !== null) {
  			_onStopCallback.call(_object);
  		}

  		this.stopChainedTweens();
  		return this;
  	};

  	this.stopChainedTweens = function () {

  		for (var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++) {
  			_chainedTweens[i].stop();
  		}
  	};

  	this.delay = function (amount) {

  		_delayTime = amount;
  		return this;
  	};

  	this.repeat = function (times) {

  		_repeat = times;
  		return this;
  	};

  	this.yoyo = function (yoyo) {

  		_yoyo = yoyo;
  		return this;
  	};

  	this.easing = function (easing) {

  		_easingFunction = easing;
  		return this;
  	};

  	this.interpolation = function (interpolation) {

  		_interpolationFunction = interpolation;
  		return this;
  	};

  	this.chain = function () {

  		_chainedTweens = arguments;
  		return this;
  	};

  	this.onStart = function (callback) {

  		_onStartCallback = callback;
  		return this;
  	};

  	this.onUpdate = function (callback) {

  		_onUpdateCallback = callback;
  		return this;
  	};

  	this.onComplete = function (callback) {

  		_onCompleteCallback = callback;
  		return this;
  	};

  	this.onStop = function (callback) {

  		_onStopCallback = callback;
  		return this;
  	};

  	this.update = function (time) {

  		var property;
  		var elapsed;
  		var value;

  		if (time < _startTime) {
  			return true;
  		}

  		if (_onStartCallbackFired === false) {

  			if (_onStartCallback !== null) {
  				_onStartCallback.call(_object);
  			}

  			_onStartCallbackFired = true;
  		}

  		elapsed = (time - _startTime) / _duration;
  		elapsed = elapsed > 1 ? 1 : elapsed;

  		value = _easingFunction(elapsed);

  		for (property in _valuesEnd) {

  			// Don't update properties that do not exist in the source object
  			if (_valuesStart[property] === undefined) {
  				continue;
  			}

  			var start = _valuesStart[property] || 0;
  			var end = _valuesEnd[property];

  			if (end instanceof Array) {

  				_object[property] = _interpolationFunction(end, value);
  			} else {

  				// Parses relative end values with start as base (e.g.: +10, -3)
  				if (typeof end === 'string') {

  					if (end.startsWith('+') || end.startsWith('-')) {
  						end = start + parseFloat(end, 10);
  					} else {
  						end = parseFloat(end, 10);
  					}
  				}

  				// Protect against non numeric properties.
  				if (typeof end === 'number') {
  					_object[property] = start + (end - start) * value;
  				}
  			}
  		}

  		if (_onUpdateCallback !== null) {
  			_onUpdateCallback.call(_object, value);
  		}

  		if (elapsed === 1) {

  			if (_repeat > 0) {

  				if (isFinite(_repeat)) {
  					_repeat--;
  				}

  				// Reassign starting values, restart by making startTime = now
  				for (property in _valuesStartRepeat) {

  					if (typeof _valuesEnd[property] === 'string') {
  						_valuesStartRepeat[property] = _valuesStartRepeat[property] + parseFloat(_valuesEnd[property], 10);
  					}

  					if (_yoyo) {
  						var tmp = _valuesStartRepeat[property];

  						_valuesStartRepeat[property] = _valuesEnd[property];
  						_valuesEnd[property] = tmp;
  					}

  					_valuesStart[property] = _valuesStartRepeat[property];
  				}

  				if (_yoyo) {
  					_reversed = !_reversed;
  				}

  				_startTime = time + _delayTime;

  				return true;
  			} else {

  				if (_onCompleteCallback !== null) {
  					_onCompleteCallback.call(_object);
  				}

  				for (var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++) {
  					// Make the chained tweens start exactly at the time they should,
  					// even if the `update()` method was called way past the duration of the tween
  					_chainedTweens[i].start(_startTime + _duration);
  				}

  				return false;
  			}
  		}

  		return true;
  	};
  };

  TWEEN.Easing = {

  	Linear: {

  		None: function None(k) {

  			return k;
  		}

  	},

  	Quadratic: {

  		In: function In(k) {

  			return k * k;
  		},

  		Out: function Out(k) {

  			return k * (2 - k);
  		},

  		InOut: function InOut(k) {

  			if ((k *= 2) < 1) {
  				return 0.5 * k * k;
  			}

  			return -0.5 * (--k * (k - 2) - 1);
  		}

  	},

  	Cubic: {

  		In: function In(k) {

  			return k * k * k;
  		},

  		Out: function Out(k) {

  			return --k * k * k + 1;
  		},

  		InOut: function InOut(k) {

  			if ((k *= 2) < 1) {
  				return 0.5 * k * k * k;
  			}

  			return 0.5 * ((k -= 2) * k * k + 2);
  		}

  	},

  	Quartic: {

  		In: function In(k) {

  			return k * k * k * k;
  		},

  		Out: function Out(k) {

  			return 1 - --k * k * k * k;
  		},

  		InOut: function InOut(k) {

  			if ((k *= 2) < 1) {
  				return 0.5 * k * k * k * k;
  			}

  			return -0.5 * ((k -= 2) * k * k * k - 2);
  		}

  	},

  	Quintic: {

  		In: function In(k) {

  			return k * k * k * k * k;
  		},

  		Out: function Out(k) {

  			return --k * k * k * k * k + 1;
  		},

  		InOut: function InOut(k) {

  			if ((k *= 2) < 1) {
  				return 0.5 * k * k * k * k * k;
  			}

  			return 0.5 * ((k -= 2) * k * k * k * k + 2);
  		}

  	},

  	Sinusoidal: {

  		In: function In(k) {

  			return 1 - Math.cos(k * Math.PI / 2);
  		},

  		Out: function Out(k) {

  			return Math.sin(k * Math.PI / 2);
  		},

  		InOut: function InOut(k) {

  			return 0.5 * (1 - Math.cos(Math.PI * k));
  		}

  	},

  	Exponential: {

  		In: function In(k) {

  			return k === 0 ? 0 : Math.pow(1024, k - 1);
  		},

  		Out: function Out(k) {

  			return k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
  		},

  		InOut: function InOut(k) {

  			if (k === 0) {
  				return 0;
  			}

  			if (k === 1) {
  				return 1;
  			}

  			if ((k *= 2) < 1) {
  				return 0.5 * Math.pow(1024, k - 1);
  			}

  			return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2);
  		}

  	},

  	Circular: {

  		In: function In(k) {

  			return 1 - Math.sqrt(1 - k * k);
  		},

  		Out: function Out(k) {

  			return Math.sqrt(1 - --k * k);
  		},

  		InOut: function InOut(k) {

  			if ((k *= 2) < 1) {
  				return -0.5 * (Math.sqrt(1 - k * k) - 1);
  			}

  			return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
  		}

  	},

  	Elastic: {

  		In: function In(k) {

  			var s;
  			var a = 0.1;
  			var p = 0.4;

  			if (k === 0) {
  				return 0;
  			}

  			if (k === 1) {
  				return 1;
  			}

  			if (!a || a < 1) {
  				a = 1;
  				s = p / 4;
  			} else {
  				s = p * Math.asin(1 / a) / (2 * Math.PI);
  			}

  			return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
  		},

  		Out: function Out(k) {

  			var s;
  			var a = 0.1;
  			var p = 0.4;

  			if (k === 0) {
  				return 0;
  			}

  			if (k === 1) {
  				return 1;
  			}

  			if (!a || a < 1) {
  				a = 1;
  				s = p / 4;
  			} else {
  				s = p * Math.asin(1 / a) / (2 * Math.PI);
  			}

  			return a * Math.pow(2, -10 * k) * Math.sin((k - s) * (2 * Math.PI) / p) + 1;
  		},

  		InOut: function InOut(k) {

  			var s;
  			var a = 0.1;
  			var p = 0.4;

  			if (k === 0) {
  				return 0;
  			}

  			if (k === 1) {
  				return 1;
  			}

  			if (!a || a < 1) {
  				a = 1;
  				s = p / 4;
  			} else {
  				s = p * Math.asin(1 / a) / (2 * Math.PI);
  			}

  			if ((k *= 2) < 1) {
  				return -0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
  			}

  			return a * Math.pow(2, -10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;
  		}

  	},

  	Back: {

  		In: function In(k) {

  			var s = 1.70158;

  			return k * k * ((s + 1) * k - s);
  		},

  		Out: function Out(k) {

  			var s = 1.70158;

  			return --k * k * ((s + 1) * k + s) + 1;
  		},

  		InOut: function InOut(k) {

  			var s = 1.70158 * 1.525;

  			if ((k *= 2) < 1) {
  				return 0.5 * (k * k * ((s + 1) * k - s));
  			}

  			return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
  		}

  	},

  	Bounce: {

  		In: function In(k) {

  			return 1 - TWEEN.Easing.Bounce.Out(1 - k);
  		},

  		Out: function Out(k) {

  			if (k < 1 / 2.75) {
  				return 7.5625 * k * k;
  			} else if (k < 2 / 2.75) {
  				return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
  			} else if (k < 2.5 / 2.75) {
  				return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
  			} else {
  				return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
  			}
  		},

  		InOut: function InOut(k) {

  			if (k < 0.5) {
  				return TWEEN.Easing.Bounce.In(k * 2) * 0.5;
  			}

  			return TWEEN.Easing.Bounce.Out(k * 2 - 1) * 0.5 + 0.5;
  		}

  	}

  };

  TWEEN.Interpolation = {

  	Linear: function Linear(v, k) {

  		var m = v.length - 1;
  		var f = m * k;
  		var i = Math.floor(f);
  		var fn = TWEEN.Interpolation.Utils.Linear;

  		if (k < 0) {
  			return fn(v[0], v[1], f);
  		}

  		if (k > 1) {
  			return fn(v[m], v[m - 1], m - f);
  		}

  		return fn(v[i], v[i + 1 > m ? m : i + 1], f - i);
  	},

  	Bezier: function Bezier(v, k) {

  		var b = 0;
  		var n = v.length - 1;
  		var pw = Math.pow;
  		var bn = TWEEN.Interpolation.Utils.Bernstein;

  		for (var i = 0; i <= n; i++) {
  			b += pw(1 - k, n - i) * pw(k, i) * v[i] * bn(n, i);
  		}

  		return b;
  	},

  	CatmullRom: function CatmullRom(v, k) {

  		var m = v.length - 1;
  		var f = m * k;
  		var i = Math.floor(f);
  		var fn = TWEEN.Interpolation.Utils.CatmullRom;

  		if (v[0] === v[m]) {

  			if (k < 0) {
  				i = Math.floor(f = m * (1 + k));
  			}

  			return fn(v[(i - 1 + m) % m], v[i], v[(i + 1) % m], v[(i + 2) % m], f - i);
  		} else {

  			if (k < 0) {
  				return v[0] - (fn(v[0], v[0], v[1], v[1], -f) - v[0]);
  			}

  			if (k > 1) {
  				return v[m] - (fn(v[m], v[m], v[m - 1], v[m - 1], f - m) - v[m]);
  			}

  			return fn(v[i ? i - 1 : 0], v[i], v[m < i + 1 ? m : i + 1], v[m < i + 2 ? m : i + 2], f - i);
  		}
  	},

  	Utils: {

  		Linear: function Linear(p0, p1, t) {

  			return (p1 - p0) * t + p0;
  		},

  		Bernstein: function Bernstein(n, i) {

  			var fc = TWEEN.Interpolation.Utils.Factorial;

  			return fc(n) / fc(i) / fc(n - i);
  		},

  		Factorial: function () {

  			var a = [1];

  			return function (n) {

  				var s = 1;

  				if (a[n]) {
  					return a[n];
  				}

  				for (var i = n; i > 1; i--) {
  					s *= i;
  				}

  				a[n] = s;
  				return s;
  			};
  		}(),

  		CatmullRom: function CatmullRom(p0, p1, p2, p3, t) {

  			var v0 = (p2 - p0) * 0.5;
  			var v1 = (p3 - p1) * 0.5;
  			var t2 = t * t;
  			var t3 = t * t2;

  			return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
  		}

  	}

  };

  // UMD (Universal Module Definition)
  (function (root) {

  	if (typeof define === 'function' && define.amd) {

  		// AMD
  		define([], function () {
  			return TWEEN;
  		});
  	} else if (typeof module !== 'undefined' && (typeof exports === 'undefined' ? 'undefined' : babelHelpers.typeof(exports)) === 'object') {

  		// Node.js
  		module.exports = TWEEN;
  	} else if (root !== undefined) {

  		// Global variable
  		root.TWEEN = TWEEN;
  	}
  })(__commonjs_global);
  });

  var TWEEN = (Tween && typeof Tween === 'object' && 'default' in Tween ? Tween['default'] : Tween);

  var kran = new Kran();
  var dt = { val: 0.0, total: 0.0 };

  // Get game window size
  var gameSize = { width: window.innerWidth - 4, height: window.innerHeight - 4 };

  // Create pixi stage
  var stage = new PIXI.Container();

  var components = {
  	// Current position
  	position: kran.component(function (x, y) {
  		this.x = x || 0;
  		this.y = y || 0;
  	}),

  	// Current velocity
  	velocity: kran.component(function (x, y) {
  		this.x = x || 0;
  		this.y = y || 0;
  	}),

  	// Pixi sprite
  	sprite: kran.component(function (stage, texture) {
  		this.s = new PIXI.Sprite(PIXI.utils.TextureCache[texture]);
  		this.s.anchor.x = 0.5;
  		this.s.anchor.y = 0.5;
  		stage.addChild(this.s);
  	}),

  	// Triggers velocity changes from WASD keys
  	inputMovement: kran.component(function (speed) {
  		// 4 tiles per second
  		var defaultSpeed = 64 * 4;
  		this.speed = speed || defaultSpeed;

  		// For requesting movement
  		this.delta = null;
  	}),

  	// Triggers tileMap layer changes from arrow keys
  	inputLayer: kran.component(function () {
  		this.actions = [];
  	}),

  	// Stores a pixi stage (also used as the camera)
  	pixiStage: kran.component(function (stage) {
  		this.root = stage;
  	}),

  	// Stores a tile map with multiple layers
  	tilemap: kran.component(function (tiles) {
  		this.tiles = tiles;
  	}),

  	// Causes the camera to follow this particular entity
  	cameraFollows: kran.component(function () {
  		var outer = 0.33;

  		// The thickness of the invisible border
  		this.borderSize = outer * ((gameSize.width + gameSize.height) / 2);

  		// The inner rectangle representing the deadzone where the camera should not move
  		this.deadzone = new PIXI.Rectangle(this.borderSize.x, this.borderSize.y, gameSize.width - this.borderSize * 2, gameSize.height - this.borderSize * 2);

  		this.center = true;
  	}),

  	// Entity will move to this position smoothly (tweening)
  	destination: kran.component(function (source, target, duration) {
  		var _this = this;

  		this.done = false;
  		this.tween = new TWEEN.Tween(source).to(target, duration).onComplete(function () {
  			_this.done = true;
  		}).start();
  	}),

  	// Current tile-based position
  	tilePosition: kran.component(function (x, y, z) {
  		this.x = x || 0;
  		this.y = y || 0;
  		this.z = z || 0; // z is for which layer
  	}),

  	storage: kran.component(function () {
  		this.color = 'none';
  	}),

  	end: null
  };

  var mousetrap = __commonjs(function (module) {
  /*global define:false */
  /**
   * Copyright 2015 Craig Campbell
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *
   * Mousetrap is a simple keyboard shortcut library for Javascript with
   * no external dependencies
   *
   * @version 1.5.3
   * @url craig.is/killing/mice
   */
  (function (window, document, undefined) {

      /**
       * mapping of special keycodes to their corresponding keys
       *
       * everything in this dictionary cannot use keypress events
       * so it has to be here to map to the correct keycodes for
       * keyup/keydown events
       *
       * @type {Object}
       */
      var _MAP = {
          8: 'backspace',
          9: 'tab',
          13: 'enter',
          16: 'shift',
          17: 'ctrl',
          18: 'alt',
          20: 'capslock',
          27: 'esc',
          32: 'space',
          33: 'pageup',
          34: 'pagedown',
          35: 'end',
          36: 'home',
          37: 'left',
          38: 'up',
          39: 'right',
          40: 'down',
          45: 'ins',
          46: 'del',
          91: 'meta',
          93: 'meta',
          224: 'meta'
      };

      /**
       * mapping for special characters so they can support
       *
       * this dictionary is only used incase you want to bind a
       * keyup or keydown event to one of these keys
       *
       * @type {Object}
       */
      var _KEYCODE_MAP = {
          106: '*',
          107: '+',
          109: '-',
          110: '.',
          111: '/',
          186: ';',
          187: '=',
          188: ',',
          189: '-',
          190: '.',
          191: '/',
          192: '`',
          219: '[',
          220: '\\',
          221: ']',
          222: '\''
      };

      /**
       * this is a mapping of keys that require shift on a US keypad
       * back to the non shift equivelents
       *
       * this is so you can use keyup events with these keys
       *
       * note that this will only work reliably on US keyboards
       *
       * @type {Object}
       */
      var _SHIFT_MAP = {
          '~': '`',
          '!': '1',
          '@': '2',
          '#': '3',
          '$': '4',
          '%': '5',
          '^': '6',
          '&': '7',
          '*': '8',
          '(': '9',
          ')': '0',
          '_': '-',
          '+': '=',
          ':': ';',
          '\"': '\'',
          '<': ',',
          '>': '.',
          '?': '/',
          '|': '\\'
      };

      /**
       * this is a list of special strings you can use to map
       * to modifier keys when you specify your keyboard shortcuts
       *
       * @type {Object}
       */
      var _SPECIAL_ALIASES = {
          'option': 'alt',
          'command': 'meta',
          'return': 'enter',
          'escape': 'esc',
          'plus': '+',
          'mod': /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl'
      };

      /**
       * variable to store the flipped version of _MAP from above
       * needed to check if we should use keypress or not when no action
       * is specified
       *
       * @type {Object|undefined}
       */
      var _REVERSE_MAP;

      /**
       * loop through the f keys, f1 to f19 and add them to the map
       * programatically
       */
      for (var i = 1; i < 20; ++i) {
          _MAP[111 + i] = 'f' + i;
      }

      /**
       * loop through to map numbers on the numeric keypad
       */
      for (i = 0; i <= 9; ++i) {
          _MAP[i + 96] = i;
      }

      /**
       * cross browser add event method
       *
       * @param {Element|HTMLDocument} object
       * @param {string} type
       * @param {Function} callback
       * @returns void
       */
      function _addEvent(object, type, callback) {
          if (object.addEventListener) {
              object.addEventListener(type, callback, false);
              return;
          }

          object.attachEvent('on' + type, callback);
      }

      /**
       * takes the event and returns the key character
       *
       * @param {Event} e
       * @return {string}
       */
      function _characterFromEvent(e) {

          // for keypress events we should return the character as is
          if (e.type == 'keypress') {
              var character = String.fromCharCode(e.which);

              // if the shift key is not pressed then it is safe to assume
              // that we want the character to be lowercase.  this means if
              // you accidentally have caps lock on then your key bindings
              // will continue to work
              //
              // the only side effect that might not be desired is if you
              // bind something like 'A' cause you want to trigger an
              // event when capital A is pressed caps lock will no longer
              // trigger the event.  shift+a will though.
              if (!e.shiftKey) {
                  character = character.toLowerCase();
              }

              return character;
          }

          // for non keypress events the special maps are needed
          if (_MAP[e.which]) {
              return _MAP[e.which];
          }

          if (_KEYCODE_MAP[e.which]) {
              return _KEYCODE_MAP[e.which];
          }

          // if it is not in the special map

          // with keydown and keyup events the character seems to always
          // come in as an uppercase character whether you are pressing shift
          // or not.  we should make sure it is always lowercase for comparisons
          return String.fromCharCode(e.which).toLowerCase();
      }

      /**
       * checks if two arrays are equal
       *
       * @param {Array} modifiers1
       * @param {Array} modifiers2
       * @returns {boolean}
       */
      function _modifiersMatch(modifiers1, modifiers2) {
          return modifiers1.sort().join(',') === modifiers2.sort().join(',');
      }

      /**
       * takes a key event and figures out what the modifiers are
       *
       * @param {Event} e
       * @returns {Array}
       */
      function _eventModifiers(e) {
          var modifiers = [];

          if (e.shiftKey) {
              modifiers.push('shift');
          }

          if (e.altKey) {
              modifiers.push('alt');
          }

          if (e.ctrlKey) {
              modifiers.push('ctrl');
          }

          if (e.metaKey) {
              modifiers.push('meta');
          }

          return modifiers;
      }

      /**
       * prevents default for this event
       *
       * @param {Event} e
       * @returns void
       */
      function _preventDefault(e) {
          if (e.preventDefault) {
              e.preventDefault();
              return;
          }

          e.returnValue = false;
      }

      /**
       * stops propogation for this event
       *
       * @param {Event} e
       * @returns void
       */
      function _stopPropagation(e) {
          if (e.stopPropagation) {
              e.stopPropagation();
              return;
          }

          e.cancelBubble = true;
      }

      /**
       * determines if the keycode specified is a modifier key or not
       *
       * @param {string} key
       * @returns {boolean}
       */
      function _isModifier(key) {
          return key == 'shift' || key == 'ctrl' || key == 'alt' || key == 'meta';
      }

      /**
       * reverses the map lookup so that we can look for specific keys
       * to see what can and can't use keypress
       *
       * @return {Object}
       */
      function _getReverseMap() {
          if (!_REVERSE_MAP) {
              _REVERSE_MAP = {};
              for (var key in _MAP) {

                  // pull out the numeric keypad from here cause keypress should
                  // be able to detect the keys from the character
                  if (key > 95 && key < 112) {
                      continue;
                  }

                  if (_MAP.hasOwnProperty(key)) {
                      _REVERSE_MAP[_MAP[key]] = key;
                  }
              }
          }
          return _REVERSE_MAP;
      }

      /**
       * picks the best action based on the key combination
       *
       * @param {string} key - character for key
       * @param {Array} modifiers
       * @param {string=} action passed in
       */
      function _pickBestAction(key, modifiers, action) {

          // if no action was picked in we should try to pick the one
          // that we think would work best for this key
          if (!action) {
              action = _getReverseMap()[key] ? 'keydown' : 'keypress';
          }

          // modifier keys don't work as expected with keypress,
          // switch to keydown
          if (action == 'keypress' && modifiers.length) {
              action = 'keydown';
          }

          return action;
      }

      /**
       * Converts from a string key combination to an array
       *
       * @param  {string} combination like "command+shift+l"
       * @return {Array}
       */
      function _keysFromString(combination) {
          if (combination === '+') {
              return ['+'];
          }

          combination = combination.replace(/\+{2}/g, '+plus');
          return combination.split('+');
      }

      /**
       * Gets info for a specific key combination
       *
       * @param  {string} combination key combination ("command+s" or "a" or "*")
       * @param  {string=} action
       * @returns {Object}
       */
      function _getKeyInfo(combination, action) {
          var keys;
          var key;
          var i;
          var modifiers = [];

          // take the keys from this pattern and figure out what the actual
          // pattern is all about
          keys = _keysFromString(combination);

          for (i = 0; i < keys.length; ++i) {
              key = keys[i];

              // normalize key names
              if (_SPECIAL_ALIASES[key]) {
                  key = _SPECIAL_ALIASES[key];
              }

              // if this is not a keypress event then we should
              // be smart about using shift keys
              // this will only work for US keyboards however
              if (action && action != 'keypress' && _SHIFT_MAP[key]) {
                  key = _SHIFT_MAP[key];
                  modifiers.push('shift');
              }

              // if this key is a modifier then add it to the list of modifiers
              if (_isModifier(key)) {
                  modifiers.push(key);
              }
          }

          // depending on what the key combination is
          // we will try to pick the best event for it
          action = _pickBestAction(key, modifiers, action);

          return {
              key: key,
              modifiers: modifiers,
              action: action
          };
      }

      function _belongsTo(element, ancestor) {
          if (element === null || element === document) {
              return false;
          }

          if (element === ancestor) {
              return true;
          }

          return _belongsTo(element.parentNode, ancestor);
      }

      function Mousetrap(targetElement) {
          var self = this;

          targetElement = targetElement || document;

          if (!(self instanceof Mousetrap)) {
              return new Mousetrap(targetElement);
          }

          /**
           * element to attach key events to
           *
           * @type {Element}
           */
          self.target = targetElement;

          /**
           * a list of all the callbacks setup via Mousetrap.bind()
           *
           * @type {Object}
           */
          self._callbacks = {};

          /**
           * direct map of string combinations to callbacks used for trigger()
           *
           * @type {Object}
           */
          self._directMap = {};

          /**
           * keeps track of what level each sequence is at since multiple
           * sequences can start out with the same sequence
           *
           * @type {Object}
           */
          var _sequenceLevels = {};

          /**
           * variable to store the setTimeout call
           *
           * @type {null|number}
           */
          var _resetTimer;

          /**
           * temporary state where we will ignore the next keyup
           *
           * @type {boolean|string}
           */
          var _ignoreNextKeyup = false;

          /**
           * temporary state where we will ignore the next keypress
           *
           * @type {boolean}
           */
          var _ignoreNextKeypress = false;

          /**
           * are we currently inside of a sequence?
           * type of action ("keyup" or "keydown" or "keypress") or false
           *
           * @type {boolean|string}
           */
          var _nextExpectedAction = false;

          /**
           * resets all sequence counters except for the ones passed in
           *
           * @param {Object} doNotReset
           * @returns void
           */
          function _resetSequences(doNotReset) {
              doNotReset = doNotReset || {};

              var activeSequences = false,
                  key;

              for (key in _sequenceLevels) {
                  if (doNotReset[key]) {
                      activeSequences = true;
                      continue;
                  }
                  _sequenceLevels[key] = 0;
              }

              if (!activeSequences) {
                  _nextExpectedAction = false;
              }
          }

          /**
           * finds all callbacks that match based on the keycode, modifiers,
           * and action
           *
           * @param {string} character
           * @param {Array} modifiers
           * @param {Event|Object} e
           * @param {string=} sequenceName - name of the sequence we are looking for
           * @param {string=} combination
           * @param {number=} level
           * @returns {Array}
           */
          function _getMatches(character, modifiers, e, sequenceName, combination, level) {
              var i;
              var callback;
              var matches = [];
              var action = e.type;

              // if there are no events related to this keycode
              if (!self._callbacks[character]) {
                  return [];
              }

              // if a modifier key is coming up on its own we should allow it
              if (action == 'keyup' && _isModifier(character)) {
                  modifiers = [character];
              }

              // loop through all callbacks for the key that was pressed
              // and see if any of them match
              for (i = 0; i < self._callbacks[character].length; ++i) {
                  callback = self._callbacks[character][i];

                  // if a sequence name is not specified, but this is a sequence at
                  // the wrong level then move onto the next match
                  if (!sequenceName && callback.seq && _sequenceLevels[callback.seq] != callback.level) {
                      continue;
                  }

                  // if the action we are looking for doesn't match the action we got
                  // then we should keep going
                  if (action != callback.action) {
                      continue;
                  }

                  // if this is a keypress event and the meta key and control key
                  // are not pressed that means that we need to only look at the
                  // character, otherwise check the modifiers as well
                  //
                  // chrome will not fire a keypress if meta or control is down
                  // safari will fire a keypress if meta or meta+shift is down
                  // firefox will fire a keypress if meta or control is down
                  if (action == 'keypress' && !e.metaKey && !e.ctrlKey || _modifiersMatch(modifiers, callback.modifiers)) {

                      // when you bind a combination or sequence a second time it
                      // should overwrite the first one.  if a sequenceName or
                      // combination is specified in this call it does just that
                      //
                      // @todo make deleting its own method?
                      var deleteCombo = !sequenceName && callback.combo == combination;
                      var deleteSequence = sequenceName && callback.seq == sequenceName && callback.level == level;
                      if (deleteCombo || deleteSequence) {
                          self._callbacks[character].splice(i, 1);
                      }

                      matches.push(callback);
                  }
              }

              return matches;
          }

          /**
           * actually calls the callback function
           *
           * if your callback function returns false this will use the jquery
           * convention - prevent default and stop propogation on the event
           *
           * @param {Function} callback
           * @param {Event} e
           * @returns void
           */
          function _fireCallback(callback, e, combo, sequence) {

              // if this event should not happen stop here
              if (self.stopCallback(e, e.target || e.srcElement, combo, sequence)) {
                  return;
              }

              if (callback(e, combo) === false) {
                  _preventDefault(e);
                  _stopPropagation(e);
              }
          }

          /**
           * handles a character key event
           *
           * @param {string} character
           * @param {Array} modifiers
           * @param {Event} e
           * @returns void
           */
          self._handleKey = function (character, modifiers, e) {
              var callbacks = _getMatches(character, modifiers, e);
              var i;
              var doNotReset = {};
              var maxLevel = 0;
              var processedSequenceCallback = false;

              // Calculate the maxLevel for sequences so we can only execute the longest callback sequence
              for (i = 0; i < callbacks.length; ++i) {
                  if (callbacks[i].seq) {
                      maxLevel = Math.max(maxLevel, callbacks[i].level);
                  }
              }

              // loop through matching callbacks for this key event
              for (i = 0; i < callbacks.length; ++i) {

                  // fire for all sequence callbacks
                  // this is because if for example you have multiple sequences
                  // bound such as "g i" and "g t" they both need to fire the
                  // callback for matching g cause otherwise you can only ever
                  // match the first one
                  if (callbacks[i].seq) {

                      // only fire callbacks for the maxLevel to prevent
                      // subsequences from also firing
                      //
                      // for example 'a option b' should not cause 'option b' to fire
                      // even though 'option b' is part of the other sequence
                      //
                      // any sequences that do not match here will be discarded
                      // below by the _resetSequences call
                      if (callbacks[i].level != maxLevel) {
                          continue;
                      }

                      processedSequenceCallback = true;

                      // keep a list of which sequences were matches for later
                      doNotReset[callbacks[i].seq] = 1;
                      _fireCallback(callbacks[i].callback, e, callbacks[i].combo, callbacks[i].seq);
                      continue;
                  }

                  // if there were no sequence matches but we are still here
                  // that means this is a regular match so we should fire that
                  if (!processedSequenceCallback) {
                      _fireCallback(callbacks[i].callback, e, callbacks[i].combo);
                  }
              }

              // if the key you pressed matches the type of sequence without
              // being a modifier (ie "keyup" or "keypress") then we should
              // reset all sequences that were not matched by this event
              //
              // this is so, for example, if you have the sequence "h a t" and you
              // type "h e a r t" it does not match.  in this case the "e" will
              // cause the sequence to reset
              //
              // modifier keys are ignored because you can have a sequence
              // that contains modifiers such as "enter ctrl+space" and in most
              // cases the modifier key will be pressed before the next key
              //
              // also if you have a sequence such as "ctrl+b a" then pressing the
              // "b" key will trigger a "keypress" and a "keydown"
              //
              // the "keydown" is expected when there is a modifier, but the
              // "keypress" ends up matching the _nextExpectedAction since it occurs
              // after and that causes the sequence to reset
              //
              // we ignore keypresses in a sequence that directly follow a keydown
              // for the same character
              var ignoreThisKeypress = e.type == 'keypress' && _ignoreNextKeypress;
              if (e.type == _nextExpectedAction && !_isModifier(character) && !ignoreThisKeypress) {
                  _resetSequences(doNotReset);
              }

              _ignoreNextKeypress = processedSequenceCallback && e.type == 'keydown';
          };

          /**
           * handles a keydown event
           *
           * @param {Event} e
           * @returns void
           */
          function _handleKeyEvent(e) {

              // normalize e.which for key events
              // @see http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
              if (typeof e.which !== 'number') {
                  e.which = e.keyCode;
              }

              var character = _characterFromEvent(e);

              // no character found then stop
              if (!character) {
                  return;
              }

              // need to use === for the character check because the character can be 0
              if (e.type == 'keyup' && _ignoreNextKeyup === character) {
                  _ignoreNextKeyup = false;
                  return;
              }

              self.handleKey(character, _eventModifiers(e), e);
          }

          /**
           * called to set a 1 second timeout on the specified sequence
           *
           * this is so after each key press in the sequence you have 1 second
           * to press the next key before you have to start over
           *
           * @returns void
           */
          function _resetSequenceTimer() {
              clearTimeout(_resetTimer);
              _resetTimer = setTimeout(_resetSequences, 1000);
          }

          /**
           * binds a key sequence to an event
           *
           * @param {string} combo - combo specified in bind call
           * @param {Array} keys
           * @param {Function} callback
           * @param {string=} action
           * @returns void
           */
          function _bindSequence(combo, keys, callback, action) {

              // start off by adding a sequence level record for this combination
              // and setting the level to 0
              _sequenceLevels[combo] = 0;

              /**
               * callback to increase the sequence level for this sequence and reset
               * all other sequences that were active
               *
               * @param {string} nextAction
               * @returns {Function}
               */
              function _increaseSequence(nextAction) {
                  return function () {
                      _nextExpectedAction = nextAction;
                      ++_sequenceLevels[combo];
                      _resetSequenceTimer();
                  };
              }

              /**
               * wraps the specified callback inside of another function in order
               * to reset all sequence counters as soon as this sequence is done
               *
               * @param {Event} e
               * @returns void
               */
              function _callbackAndReset(e) {
                  _fireCallback(callback, e, combo);

                  // we should ignore the next key up if the action is key down
                  // or keypress.  this is so if you finish a sequence and
                  // release the key the final key will not trigger a keyup
                  if (action !== 'keyup') {
                      _ignoreNextKeyup = _characterFromEvent(e);
                  }

                  // weird race condition if a sequence ends with the key
                  // another sequence begins with
                  setTimeout(_resetSequences, 10);
              }

              // loop through keys one at a time and bind the appropriate callback
              // function.  for any key leading up to the final one it should
              // increase the sequence. after the final, it should reset all sequences
              //
              // if an action is specified in the original bind call then that will
              // be used throughout.  otherwise we will pass the action that the
              // next key in the sequence should match.  this allows a sequence
              // to mix and match keypress and keydown events depending on which
              // ones are better suited to the key provided
              for (var i = 0; i < keys.length; ++i) {
                  var isFinal = i + 1 === keys.length;
                  var wrappedCallback = isFinal ? _callbackAndReset : _increaseSequence(action || _getKeyInfo(keys[i + 1]).action);
                  _bindSingle(keys[i], wrappedCallback, action, combo, i);
              }
          }

          /**
           * binds a single keyboard combination
           *
           * @param {string} combination
           * @param {Function} callback
           * @param {string=} action
           * @param {string=} sequenceName - name of sequence if part of sequence
           * @param {number=} level - what part of the sequence the command is
           * @returns void
           */
          function _bindSingle(combination, callback, action, sequenceName, level) {

              // store a direct mapped reference for use with Mousetrap.trigger
              self._directMap[combination + ':' + action] = callback;

              // make sure multiple spaces in a row become a single space
              combination = combination.replace(/\s+/g, ' ');

              var sequence = combination.split(' ');
              var info;

              // if this pattern is a sequence of keys then run through this method
              // to reprocess each pattern one key at a time
              if (sequence.length > 1) {
                  _bindSequence(combination, sequence, callback, action);
                  return;
              }

              info = _getKeyInfo(combination, action);

              // make sure to initialize array if this is the first time
              // a callback is added for this key
              self._callbacks[info.key] = self._callbacks[info.key] || [];

              // remove an existing match if there is one
              _getMatches(info.key, info.modifiers, { type: info.action }, sequenceName, combination, level);

              // add this call back to the array
              // if it is a sequence put it at the beginning
              // if not put it at the end
              //
              // this is important because the way these are processed expects
              // the sequence ones to come first
              self._callbacks[info.key][sequenceName ? 'unshift' : 'push']({
                  callback: callback,
                  modifiers: info.modifiers,
                  action: info.action,
                  seq: sequenceName,
                  level: level,
                  combo: combination
              });
          }

          /**
           * binds multiple combinations to the same callback
           *
           * @param {Array} combinations
           * @param {Function} callback
           * @param {string|undefined} action
           * @returns void
           */
          self._bindMultiple = function (combinations, callback, action) {
              for (var i = 0; i < combinations.length; ++i) {
                  _bindSingle(combinations[i], callback, action);
              }
          };

          // start!
          _addEvent(targetElement, 'keypress', _handleKeyEvent);
          _addEvent(targetElement, 'keydown', _handleKeyEvent);
          _addEvent(targetElement, 'keyup', _handleKeyEvent);
      }

      /**
       * binds an event to mousetrap
       *
       * can be a single key, a combination of keys separated with +,
       * an array of keys, or a sequence of keys separated by spaces
       *
       * be sure to list the modifier keys first to make sure that the
       * correct key ends up getting bound (the last key in the pattern)
       *
       * @param {string|Array} keys
       * @param {Function} callback
       * @param {string=} action - 'keypress', 'keydown', or 'keyup'
       * @returns void
       */
      Mousetrap.prototype.bind = function (keys, callback, action) {
          var self = this;
          keys = keys instanceof Array ? keys : [keys];
          self._bindMultiple.call(self, keys, callback, action);
          return self;
      };

      /**
       * unbinds an event to mousetrap
       *
       * the unbinding sets the callback function of the specified key combo
       * to an empty function and deletes the corresponding key in the
       * _directMap dict.
       *
       * TODO: actually remove this from the _callbacks dictionary instead
       * of binding an empty function
       *
       * the keycombo+action has to be exactly the same as
       * it was defined in the bind method
       *
       * @param {string|Array} keys
       * @param {string} action
       * @returns void
       */
      Mousetrap.prototype.unbind = function (keys, action) {
          var self = this;
          return self.bind.call(self, keys, function () {}, action);
      };

      /**
       * triggers an event that has already been bound
       *
       * @param {string} keys
       * @param {string=} action
       * @returns void
       */
      Mousetrap.prototype.trigger = function (keys, action) {
          var self = this;
          if (self._directMap[keys + ':' + action]) {
              self._directMap[keys + ':' + action]({}, keys);
          }
          return self;
      };

      /**
       * resets the library back to its initial state.  this is useful
       * if you want to clear out the current keyboard shortcuts and bind
       * new ones - for example if you switch to another page
       *
       * @returns void
       */
      Mousetrap.prototype.reset = function () {
          var self = this;
          self._callbacks = {};
          self._directMap = {};
          return self;
      };

      /**
       * should we stop this event before firing off callbacks
       *
       * @param {Event} e
       * @param {Element} element
       * @return {boolean}
       */
      Mousetrap.prototype.stopCallback = function (e, element) {
          var self = this;

          // if the element has the class "mousetrap" then no need to stop
          if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
              return false;
          }

          if (_belongsTo(element, self.target)) {
              return false;
          }

          // stop for input, select, and textarea
          return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || element.isContentEditable;
      };

      /**
       * exposes _handleKey publicly so it can be overwritten by extensions
       */
      Mousetrap.prototype.handleKey = function () {
          var self = this;
          return self._handleKey.apply(self, arguments);
      };

      /**
       * Init the global mousetrap functions
       *
       * This method is needed to allow the global mousetrap functions to work
       * now that mousetrap is a constructor function.
       */
      Mousetrap.init = function () {
          var documentMousetrap = Mousetrap(document);
          for (var method in documentMousetrap) {
              if (method.charAt(0) !== '_') {
                  Mousetrap[method] = function (method) {
                      return function () {
                          return documentMousetrap[method].apply(documentMousetrap, arguments);
                      };
                  }(method);
              }
          }
      };

      Mousetrap.init();

      // expose mousetrap to the global object
      window.Mousetrap = Mousetrap;

      // expose as a common js module
      if (typeof module !== 'undefined' && module.exports) {
          module.exports = Mousetrap;
      }

      // expose mousetrap as an AMD module
      if (typeof define === 'function' && define.amd) {
          define(function () {
              return Mousetrap;
          });
      }
  })(window, document);
  });

  var Mousetrap = (mousetrap && typeof mousetrap === 'object' && 'default' in mousetrap ? mousetrap['default'] : mousetrap);

  // Handles movement based input
  kran.system({
  	components: [components.inputMovement],
  	moveDelta: { x: 0, y: 0 },
  	keys: {},
  	id: 0,

  	init: function init() {
  		this.setupKeys();
  	},

  	pre: function pre() {
  		// Process input
  		this.moveDelta = { x: 0, y: 0 };
  		var maxId = 0;
  		for (var name in this.keys) {
  			var key = this.keys[name];
  			// Prefer keys with larger IDs (pressed the latest)
  			if (key.down && key.lastId > maxId) {
  				this.moveDelta = key.delta;
  				maxId = key.lastId;
  			}
  		}
  		// Prevent the ID from overflowing
  		if (maxId == 0) {
  			this.id = 0;
  		}
  	},

  	every: function every(input) {
  		input.delta = this.moveDelta;
  	},

  	makeKey: function makeKey(deltaX, deltaY) {
  		return {
  			delta: {
  				x: deltaX,
  				y: deltaY
  			},
  			down: false,
  			lastId: 0
  		};
  	},

  	keyChanged: function keyChanged(key, down) {
  		this.keys[key].down = down;
  		if (down) {
  			this.keys[key].lastId = ++this.id;
  		}
  	},

  	// Setup keyboard input
  	bindKey: function bindKey(key) {
  		var _this = this;

  		Mousetrap.bind(key, function () {
  			_this.keyChanged(key, true);
  		}, 'keydown');
  		Mousetrap.bind(key, function () {
  			_this.keyChanged(key, false);
  		}, 'keyup');
  	},

  	setupKeys: function setupKeys() {
  		this.keys = {
  			w: this.makeKey(0, -1),
  			a: this.makeKey(-1, 0),
  			s: this.makeKey(0, 1),
  			d: this.makeKey(1, 0)
  		};
  		for (var key in this.keys) {
  			this.bindKey(key);
  		}
  	}
  });

  // Handles layer-switching input
  kran.system({
  	components: [components.inputLayer],
  	actions: [],
  	init: function init() {
  		var _this2 = this;

  		// Layer switching keys
  		Mousetrap.bind('up', function () {
  			_this2.actions.push(1);
  		});
  		Mousetrap.bind('down', function () {
  			_this2.actions.push(-1);
  		});
  	},
  	every: function every(input) {
  		for (var i in this.actions) {
  			input.actions.push(this.actions[i]);
  		}
  		this.actions.length = 0;
  	}
  });

  var nameToId = { "sign_mirrors": "64", "sign_colors": "43", "color_block_none": "18", "color_block_green": "17", "color_transmitter_red": "54", "color_block_orange": "19", "color_transmitter_green": "50", "sign_layers": "44", "controls_s": "60", "sign_blocks": "66", "controls_w": "62", "color_transmitter_none": "51", "color_block_red": "21", "color_transmitter_purple": "53", "controls_d": "59", "color_block_purple": "20", "shadow": "4", "color_block_white": "22", "sign_sliding": "63", "sign_filters": "65", "checkpoint": "46", "color_transmitter_orange": "52", "color_block_blue": "16", "color_transmitter_white": "55", "color_block_yellow": "23", "empty": "1", "controls_a": "61", "controls_up": "58", "normal": "2", "blocking": "0", "color_transmitter_black": "48", "color_transmitter_yellow": "47", "color_block_black": "24", "controls_down": "57", "light": "45", "clearing": "13", "color_transmitter_blue": "49" };
  var idToName = { "0": "blocking", "1": "empty", "2": "normal", "4": "shadow", "13": "clearing", "16": "color_block_blue", "17": "color_block_green", "18": "color_block_none", "19": "color_block_orange", "20": "color_block_purple", "21": "color_block_red", "22": "color_block_white", "23": "color_block_yellow", "24": "color_block_black", "43": "sign_colors", "44": "sign_layers", "45": "light", "46": "checkpoint", "47": "color_transmitter_yellow", "48": "color_transmitter_black", "49": "color_transmitter_blue", "50": "color_transmitter_green", "51": "color_transmitter_none", "52": "color_transmitter_orange", "53": "color_transmitter_purple", "54": "color_transmitter_red", "55": "color_transmitter_white", "57": "controls_down", "58": "controls_up", "59": "controls_d", "60": "controls_s", "61": "controls_a", "62": "controls_w", "63": "sign_sliding", "64": "sign_mirrors", "65": "sign_filters", "66": "sign_blocks" };
  var layers = { "0": { "149,95": 2, "126,131": 2, "122,101": 2, "193,116": 51, "137,115": 2, "191,122": 2, "165,110": 18, "184,96": 18, "170,121": 17, "141,101": 2, "166,123": 46, "108,115": 2, "163,85": 2, "129,128": 2, "127,133": 0, "188,97": 2, "122,112": 2, "131,115": 2, "186,124": 2, "185,104": 2, "128,127": 2, "181,97": 53, "172,123": 2, "172,121": 2, "110,115": 2, "174,85": 0, "116,100": 4, "194,107": 2, "172,85": 0, "136,130": 4, "133,129": 2, "186,99": 2, "177,110": 18, "193,106": 23, "171,95": 2, "165,125": 2, "183,99": 2, "149,117": 2, "145,100": 2, "167,114": 51, "162,87": 2, "179,97": 54, "123,99": 2, "113,115": 2, "169,95": 2, "160,114": 2, "129,134": 2, "130,137": 0, "176,106": 24, "181,107": 22, "179,123": 2, "172,116": 2, "154,98": 2, "138,125": 2, "119,113": 2, "162,99": 2, "187,120": 2, "185,103": 0, "173,123": 2, "154,101": 2, "189,124": 2, "117,95": 2, "163,113": 19, "182,123": 2, "129,122": 58, "187,102": 2, "135,122": 0, "147,126": 2, "149,99": 2, "119,116": 24, "172,112": 2, "109,135": 0, "176,115": 20, "171,98": 2, "181,98": 0, "122,93": 2, "138,108": 2, "139,128": 0, "116,95": 2, "151,117": 2, "154,117": 2, "152,113": 2, "154,121": 2, "183,121": 16, "165,95": 2, "108,111": 2, "155,118": 52, "141,100": 2, "132,119": 2, "177,112": 18, "179,115": 2, "177,113": 2, "116,151": 2, "159,125": 2, "139,107": 2, "181,109": 2, "172,95": 2, "156,120": 2, "178,84": 2, "128,125": 2, "117,153": 2, "123,96": 2, "120,93": 2, "129,133": 0, "136,121": 2, "150,108": 2, "123,100": 2, "169,84": 2, "157,126": 2, "125,114": 2, "122,115": 2, "128,135": 2, "134,125": 2, "172,101": 2, "124,115": 2, "108,112": 2, "173,122": 2, "119,119": 2, "168,95": 2, "128,121": 2, "129,137": 0, "192,119": 2, "159,118": 2, "130,113": 2, "127,131": 61, "183,122": 2, "178,93": 2, "122,106": 2, "119,93": 2, "117,151": 2, "160,119": 2, "171,121": 2, "178,123": 46, "169,101": 2, "138,115": 2, "138,126": 2, "139,106": 49, "187,97": 22, "164,111": 2, "189,123": 0, "128,137": 0, "155,121": 2, "149,97": 2, "141,107": 0, "167,95": 2, "161,85": 0, "115,108": 66, "138,110": 46, "194,113": 2, "153,100": 2, "161,86": 4, "172,99": 2, "162,126": 20, "126,115": 2, "175,112": 54, "193,108": 50, "127,127": 2, "130,109": 2, "149,106": 2, "123,94": 2, "124,107": 2, "126,93": 2, "151,108": 54, "190,94": 2, "130,94": 2, "165,106": 46, "124,113": 2, "130,93": 2, "150,109": 2, "157,108": 2, "170,98": 0, "184,116": 2, "155,113": 2, "126,95": 2, "132,109": 2, "124,97": 2, "132,93": 2, "135,121": 2, "114,109": 2, "179,117": 2, "159,117": 2, "117,152": 2, "149,105": 46, "116,148": 2, "183,120": 2, "123,111": 2, "158,118": 2, "124,114": 2, "172,107": 24, "178,109": 53, "175,117": 2, "156,98": 2, "167,108": 49, "157,118": 0, "123,110": 2, "108,114": 2, "119,115": 2, "158,120": 2, "190,97": 2, "180,93": 2, "191,104": 2, "138,109": 2, "156,118": 2, "127,130": 2, "130,115": 2, "185,95": 2, "160,99": 2, "171,122": 2, "184,97": 2, "124,99": 2, "116,114": 2, "130,97": 2, "122,98": 2, "122,107": 2, "124,111": 2, "146,126": 2, "145,122": 2, "163,86": 2, "122,124": 2, "129,94": 2, "147,120": 2, "172,108": 2, "155,125": 2, "146,124": 2, "160,116": 46, "137,127": 2, "166,112": 2, "139,109": 2, "136,115": 2, "157,120": 0, "127,94": 2, "154,118": 2, "148,103": 2, "111,108": 2, "180,113": 17, "135,120": 2, "170,84": 46, "133,122": 2, "163,110": 2, "178,114": 0, "128,122": 2, "160,100": 2, "115,159": 2, "122,100": 2, "123,105": 2, "129,130": 2, "177,123": 2, "119,151": 2, "111,115": 2, "130,134": 0, "115,93": 2, "138,121": 4, "159,120": 49, "172,110": 2, "175,86": 2, "181,122": 52, "162,84": 2, "170,95": 2, "132,114": 43, "161,87": 0, "135,123": 2, "120,150": 2, "122,129": 2, "156,111": 2, "156,105": 17, "148,100": 2, "167,121": 2, "119,95": 2, "115,109": 2, "119,94": 2, "154,88": 2, "180,117": 2, "126,135": 0, "128,136": 2, "155,103": 2, "141,105": 0, "168,121": 2, "161,114": 2, "188,123": 0, "193,115": 2, "146,100": 2, "179,120": 2, "183,123": 2, "144,109": 2, "130,99": 2, "146,121": 53, "150,110": 19, "175,123": 2, "124,112": 2, "152,101": 2, "143,106": 2, "151,126": 2, "122,95": 2, "151,106": 47, "162,85": 2, "147,124": 2, "122,103": 2, "184,117": 2, "179,84": 2, "187,93": 2, "117,113": 2, "176,105": 2, "168,102": 2, "176,111": 21, "169,123": 2, "123,102": 2, "176,93": 2, "151,95": 2, "155,117": 2, "120,114": 2, "138,106": 2, "179,109": 2, "161,104": 2, "191,124": 2, "126,113": 2, "192,118": 54, "156,103": 2, "132,121": 2, "170,122": 18, "135,118": 2, "186,98": 22, "116,93": 2, "167,106": 2, "116,110": 2, "130,136": 0, "116,97": 2, "179,113": 2, "180,123": 0, "138,130": 4, "188,106": 2, "188,103": 23, "155,98": 20, "179,124": 2, "192,114": 21, "131,109": 2, "123,109": 2, "122,121": 4, "181,111": 2, "124,103": 2, "154,100": 2, "164,95": 2, "181,115": 53, "185,106": 2, "173,85": 49, "142,108": 2, "146,103": 2, "166,99": 46, "124,101": 2, "180,124": 2, "112,109": 2, "173,84": 2, "155,126": 2, "109,136": 2, "130,98": 2, "172,113": 24, "145,120": 2, "127,129": 2, "153,88": 2, "193,121": 2, "152,99": 49, "183,93": 2, "175,110": 21, "184,124": 21, "140,108": 2, "118,95": 2, "156,112": 2, "180,107": 2, "138,123": 2, "130,112": 2, "120,94": 2, "129,129": 2, "130,110": 2, "158,117": 2, "192,104": 2, "108,135": 0, "164,84": 18, "176,104": 2, "182,124": 0, "173,86": 51, "138,118": 2, "122,96": 2, "176,117": 2, "176,100": 2, "161,102": 24, "181,96": 0, "124,105": 2, "142,109": 2, "139,121": 2, "149,98": 2, "124,96": 2, "123,101": 2, "129,114": 2, "174,123": 23, "138,114": 2, "162,114": 2, "129,95": 2, "184,107": 16, "189,122": 21, "128,120": 2, "157,119": 0, "111,93": 4, "154,95": 2, "163,111": 2, "158,126": 20, "173,117": 2, "159,87": 2, "134,93": 2, "166,95": 2, "183,97": 50, "177,107": 2, "138,102": 2, "147,121": 2, "156,88": 2, "126,129": 2, "120,115": 2, "114,143": 2, "171,101": 2, "126,137": 0, "161,99": 2, "159,121": 2, "178,97": 49, "142,107": 2, "128,123": 2, "116,113": 2, "158,121": 2, "193,117": 2, "143,105": 2, "182,96": 0, "172,115": 2, "121,115": 2, "149,126": 2, "140,109": 2, "128,95": 2, "147,100": 2, "174,117": 2, "178,115": 24, "142,105": 2, "140,107": 2, "138,111": 2, "167,122": 2, "127,93": 2, "112,115": 2, "192,113": 2, "184,95": 2, "137,130": 2, "146,125": 53, "137,102": 2, "116,150": 2, "141,108": 0, "147,103": 2, "111,105": 2, "133,115": 2, "193,118": 47, "118,114": 2, "153,126": 2, "173,112": 2, "142,100": 2, "192,107": 2, "122,114": 2, "155,95": 2, "117,114": 2, "145,121": 2, "124,110": 2, "158,98": 2, "138,124": 2, "138,105": 2, "194,110": 19, "151,109": 2, "128,113": 2, "121,114": 2, "194,116": 2, "135,125": 2, "130,114": 2, "124,104": 2, "145,126": 2, "107,134": 51, "173,95": 2, "175,114": 49, "123,104": 2, "148,122": 2, "148,124": 2, "117,98": 64, "149,123": 0, "192,110": 17, "137,128": 4, "144,106": 2, "124,95": 2, "136,124": 2, "160,126": 2, "145,124": 2, "184,122": 21, "173,121": 2, "180,97": 47, "120,151": 2, "164,108": 18, "193,120": 46, "182,95": 2, "167,99": 2, "171,123": 2, "161,101": 2, "172,103": 2, "186,103": 0, "176,103": 2, "161,126": 2, "169,122": 2, "158,88": 46, "123,122": 2, "165,124": 2, "114,93": 2, "156,109": 2, "149,109": 2, "139,108": 2, "155,109": 2, "173,93": 2, "126,134": 0, "184,102": 2, "140,105": 2, "175,113": 2, "119,114": 2, "169,100": 2, "132,120": 2, "137,129": 2, "131,108": 43, "123,108": 2, "119,152": 2, "122,108": 2, "181,93": 2, "125,94": 2, "124,100": 2, "123,93": 2, "123,121": 2, "175,109": 2, "149,104": 2, "160,117": 2, "120,152": 2, "127,134": 2, "117,159": 2, "180,114": 0, "177,117": 2, "172,114": 2, "176,123": 2, "122,111": 2, "124,106": 2, "165,111": 54, "129,115": 2, "193,104": 2, "165,126": 2, "111,136": 2, "112,136": 2, "122,110": 2, "164,126": 2, "134,130": 4, "177,115": 2, "193,107": 2, "128,114": 2, "150,107": 2, "156,113": 2, "161,98": 2, "126,114": 2, "149,118": 2, "115,143": 2, "176,110": 0, "116,153": 2, "157,117": 16, "165,84": 2, "175,85": 2, "153,117": 23, "122,109": 2, "165,99": 2, "171,84": 2, "178,107": 2, "177,109": 2, "129,113": 2, "118,93": 2, "122,104": 2, "127,137": 0, "185,102": 2, "163,109": 16, "181,124": 50, "108,113": 2, "138,113": 2, "193,105": 2, "135,103": 2, "165,108": 2, "122,117": 44, "168,123": 2, "153,103": 2, "175,107": 2, "170,102": 0, "127,114": 2, "128,132": 2, "159,124": 2, "161,103": 2, "128,130": 62, "163,87": 2, "167,101": 2, "163,84": 2, "160,101": 54, "112,93": 2, "190,93": 46, "153,102": 46, "117,143": 2, "186,104": 47, "193,122": 2, "182,122": 0, "181,123": 53, "188,120": 2, "111,106": 2, "172,109": 2, "123,116": 46, "138,127": 4, "189,97": 2, "128,93": 2, "172,86": 0, "123,107": 2, "149,122": 2, "168,106": 2, "155,108": 54, "190,122": 2, "119,117": 2, "132,123": 2, "156,121": 2, "169,99": 2, "156,119": 2, "135,104": 46, "119,150": 2, "121,95": 2, "181,95": 55, "187,104": 18, "167,102": 2, "165,102": 2, "123,95": 2, "130,129": 2, "111,109": 2, "160,124": 2, "123,97": 2, "155,119": 2, "193,111": 2, "124,109": 2, "123,117": 2, "178,111": 52, "188,105": 2, "172,117": 2, "184,114": 2, "138,128": 4, "168,122": 52, "152,100": 54, "156,125": 54, "168,99": 2, "188,104": 2, "124,94": 2, "157,88": 2, "179,93": 2, "193,123": 2, "109,134": 49, "192,108": 2, "108,133": 2, "176,107": 2, "181,113": 2, "139,129": 2, "153,99": 2, "156,117": 2, "122,97": 2, "156,107": 2, "149,121": 2, "149,103": 2, "129,93": 2, "166,114": 47, "185,124": 50, "155,124": 2, "139,120": 2, "194,117": 2, "134,115": 2, "141,102": 2, "130,127": 2, "128,134": 2, "132,115": 2, "188,102": 49, "122,102": 2, "183,98": 0, "179,111": 2, "186,93": 49, "187,105": 0, "151,113": 2, "144,107": 2, "133,93": 2, "160,87": 2, "193,110": 18, "162,95": 23, "175,111": 2, "154,126": 46, "133,92": 65, "112,135": 43, "182,99": 2, "160,84": 2, "190,104": 2, "185,122": 2, "188,124": 2, "167,123": 2, "182,114": 24, "160,85": 2, "138,112": 2, "181,112": 17, "177,111": 2, "165,101": 2, "123,124": 4, "168,104": 2, "186,96": 22, "113,92": 64, "194,109": 2, "155,107": 49, "153,113": 2, "127,115": 2, "157,125": 2, "183,96": 0, "172,100": 2, "156,124": 2, "194,118": 49, "116,96": 2, "184,98": 18, "171,85": 2, "180,112": 0, "188,93": 2, "154,119": 2, "186,122": 2, "156,104": 2, "127,113": 2, "193,112": 47, "106,136": 2, "115,115": 2, "130,96": 2, "162,98": 47, "184,115": 2, "139,102": 2, "143,100": 2, "159,95": 2, "157,109": 2, "187,103": 0, "116,149": 2, "161,88": 0, "186,123": 2, "109,115": 2, "167,84": 2, "190,124": 2, "135,102": 17, "135,107": 22, "128,126": 2, "128,133": 22, "133,109": 2, "127,95": 2, "156,95": 2, "147,122": 2, "152,98": 47, "174,84": 0, "175,115": 2, "116,111": 2, "150,106": 2, "180,109": 18, "122,99": 2, "186,120": 2, "122,105": 2, "192,115": 2, "192,111": 2, "132,122": 0, "165,103": 2, "121,94": 2, "159,84": 4, "173,107": 2, "176,101": 2, "128,128": 2, "156,126": 2, "162,104": 2, "176,114": 0, "132,125": 2, "121,113": 2, "178,110": 0, "135,115": 2, "114,136": 2, "179,114": 47, "133,121": 2, "116,159": 2, "130,135": 0, "180,111": 20, "186,102": 17, "174,93": 2, "130,131": 2, "167,98": 2, "176,97": 46, "176,99": 2, "118,113": 2, "125,93": 2, "192,123": 16, "161,84": 0, "107,135": 0, "114,114": 66, "130,100": 4, "166,84": 2, "188,121": 16, "168,103": 24, "133,125": 2, "167,113": 20, "172,111": 2, "181,117": 2, "167,112": 2, "125,113": 2, "146,120": 2, "129,131": 59, "122,94": 2, "184,104": 2, "186,105": 0, "184,93": 2, "160,115": 2, "154,120": 2, "172,98": 2, "121,93": 2, "116,143": 2, "192,112": 2, "194,115": 2, "162,88": 2, "171,103": 2, "145,125": 2, "118,150": 2, "160,120": 2, "165,112": 2, "132,124": 2, "139,122": 0, "139,127": 2, "185,96": 24, "113,93": 2, "154,103": 2, "159,88": 2, "130,111": 2, "127,128": 2, "123,113": 2, "167,109": 16, "136,125": 2, "191,123": 2, "116,98": 2, "163,114": 2, "192,116": 2, "120,95": 2, "141,106": 0, "179,107": 2, "144,104": 18, "184,105": 16, "152,95": 2, "163,112": 2, "161,125": 2, "173,108": 22, "189,93": 2, "185,105": 23, "138,122": 0, "163,95": 2, "136,123": 2, "176,113": 23, "140,102": 2, "114,159": 2, "187,122": 20, "148,120": 2, "168,101": 2, "129,98": 65, "113,135": 44, "193,113": 2, "157,124": 2, "116,109": 2, "150,113": 2, "179,110": 20, "130,128": 2, "163,104": 2, "172,102": 50, "169,103": 0, "173,94": 2, "124,93": 2, "117,150": 2, "163,88": 4, "170,101": 18, "186,97": 2, "123,115": 2, "170,99": 17, "149,125": 2, "126,133": 0, "177,93": 2, "168,105": 2, "176,109": 16, "168,84": 2, "132,129": 4, "165,123": 2, "127,125": 44, "106,135": 2, "164,104": 2, "181,110": 50, "175,93": 2, "122,123": 0, "145,123": 0, "134,109": 2, "128,94": 2, "118,152": 2, "148,125": 52, "118,94": 2, "172,84": 0, "157,107": 2, "190,96": 2, "181,114": 24, "141,109": 16, "124,102": 2, "143,108": 51, "158,95": 2, "161,100": 2, "135,108": 51, "167,111": 2, "184,123": 0, "131,93": 2, "180,110": 0, "123,123": 0, "144,108": 2, "105,136": 16, "193,114": 18, "167,103": 0, "159,86": 2, "149,124": 2, "172,122": 50, "135,93": 4, "139,123": 4, "146,122": 2, "123,98": 2, "165,100": 2, "185,97": 2, "149,96": 2, "168,100": 54, "149,108": 2, "150,111": 2, "182,107": 55, "108,134": 2, "128,129": 2, "161,124": 2, "150,95": 2, "132,118": 2, "186,95": 2, "149,119": 46, "167,100": 2, "109,133": 2, "118,115": 2, "160,98": 2, "163,108": 49, "159,98": 46, "182,117": 2, "157,98": 2, "170,100": 0, "135,119": 2, "138,129": 2, "149,100": 2, "170,123": 23, "176,102": 2, "153,95": 2, "189,104": 46, "136,118": 2, "194,114": 23, "137,118": 2, "130,130": 2, "144,103": 2, "187,124": 2, "179,112": 16, "183,95": 2, "169,121": 2, "123,112": 2, "125,115": 2, "176,112": 0, "120,113": 2, "184,120": 2, "169,98": 2, "124,98": 2, "123,106": 2, "148,126": 2, "110,136": 46, "160,95": 49, "127,136": 2, "179,122": 2, "182,97": 52, "158,124": 16, "174,86": 2, "180,122": 2, "150,112": 2, "166,111": 2, "128,124": 2, "158,119": 2, "145,103": 2, "162,100": 2, "160,118": 2, "116,152": 2, "138,107": 2, "171,99": 2, "146,123": 0, "185,93": 47, "122,113": 2, "130,133": 0, "155,120": 50, "178,117": 2, "135,106": 55, "150,126": 21, "107,136": 0, "135,105": 2, "114,115": 2, "143,107": 2, "176,84": 16, "169,102": 2, "162,86": 2, "124,108": 2, "182,120": 2, "183,124": 2, "149,107": 2, "180,115": 23, "193,109": 2, "194,108": 2, "159,126": 2, "144,105": 2, "155,88": 2, "186,106": 2, "117,94": 2, "157,121": 0, "194,111": 2, "151,107": 49, "174,112": 51, "166,106": 2, "111,107": 2, "129,135": 2, "128,115": 2, "194,119": 2, "136,102": 2, "106,134": 2, "160,125": 49, "177,97": 55, "194,112": 2, "113,109": 2, "148,123": 0, "188,122": 49, "133,123": 2, "126,136": 0, "187,106": 23, "152,88": 2, "154,113": 2, "165,109": 2, "192,117": 2, "165,104": 2, "153,98": 2, "156,106": 2, "167,110": 2, "117,93": 2, "147,123": 16, "126,128": 2, "123,129": 2, "182,98": 0, "150,117": 2, "160,86": 2, "183,114": 2, "130,95": 2, "156,108": 2, "180,120": 2, "171,102": 2, "116,115": 2, "171,86": 2, "184,106": 2, "116,99": 2, "123,114": 2, "185,123": 2, "185,98": 24, "177,114": 51, "116,94": 2, "158,125": 18, "185,120": 2, "192,109": 2, "190,123": 2, "134,129": 2, "129,127": 2, "140,106": 2, "168,98": 2, "166,113": 23, "126,94": 2, "157,95": 2, "148,121": 50, "161,95": 2, "143,109": 2, "177,84": 2, "159,85": 2, "174,107": 2, "113,136": 2, "183,107": 46, "178,112": 0, "176,98": 2, "160,88": 2, "184,99": 2, "124,129": 4, "127,135": 2, "175,84": 2, "179,121": 2, "170,103": 0, "165,107": 2, "160,121": 2, "193,119": 2, "111,104": 2, "159,119": 2, "139,118": 2, "126,130": 2, "147,125": 2, "139,119": 2, "184,103": 53, "183,117": 2, "178,113": 22, "139,105": 2, "129,123": 57, "157,106": 2, "153,101": 2, "152,126": 2, "125,95": 2, "166,108": 18, "162,101": 49, "118,151": 2, "136,122": 0, "135,109": 2, "126,127": 2, "181,120": 2, "164,112": 2, "123,103": 2, "128,131": 60, "108,136": 2, "117,115": 2, "142,106": 2, "181,99": 51, "187,123": 0, "190,95": 2, "152,117": 2, "122,122": 0, "116,112": 2, "144,100": 2, "185,99": 2, "155,106": 47, "163,126": 2, "149,120": 2, "156,110": 46, "171,100": 2, "119,118": 2, "182,93": 2, "129,136": 2, "154,99": 2 }, "1": { "112,152": 2, "129,118": 2, "115,155": 2, "122,101": 4, "117,157": 2, "119,149": 2, "127,151": 2, "128,130": 2, "125,104": 2, "145,84": 2, "148,88": 2, "145,78": 2, "121,154": 2, "121,151": 2, "121,106": 2, "115,150": 2, "121,148": 2, "112,150": 2, "122,104": 2, "119,133": 2, "129,128": 2, "128,102": 2, "126,102": 2, "125,106": 2, "112,148": 2, "112,155": 2, "120,133": 2, "111,156": 2, "147,88": 2, "113,159": 53, "119,123": 2, "118,157": 2, "113,149": 18, "122,124": 4, "118,154": 2, "172,85": 2, "128,132": 4, "128,133": 2, "111,143": 47, "128,142": 2, "172,84": 2, "117,153": 2, "113,151": 20, "119,132": 2, "114,158": 2, "114,156": 2, "117,144": 2, "119,128": 2, "124,102": 2, "113,146": 2, "117,143": 2, "116,145": 2, "117,158": 2, "126,106": 2, "127,128": 2, "111,147": 2, "128,147": 2, "136,123": 2, "114,146": 2, "172,86": 2, "123,107": 4, "126,133": 2, "119,145": 48, "111,148": 2, "115,158": 2, "113,155": 24, "121,152": 2, "151,88": 2, "113,152": 21, "145,88": 2, "128,139": 2, "106,134": 4, "127,102": 2, "111,145": 2, "128,129": 48, "173,85": 4, "126,103": 2, "132,118": 4, "124,101": 4, "115,151": 2, "119,153": 2, "173,84": 4, "128,138": 2, "122,152": 2, "145,79": 2, "123,101": 4, "123,117": 4, "118,148": 2, "113,154": 23, "111,154": 2, "149,88": 2, "111,157": 2, "117,154": 2, "123,104": 2, "115,152": 2, "124,152": 2, "113,145": 2, "125,102": 2, "129,129": 2, "123,102": 2, "119,125": 2, "122,127": 2, "117,149": 2, "108,133": 2, "145,73": 2, "127,133": 2, "173,86": 2, "115,156": 2, "119,127": 2, "113,156": 2, "113,144": 2, "112,146": 2, "145,72": 2, "123,106": 2, "128,143": 2, "125,133": 2, "122,154": 2, "136,121": 4, "128,119": 2, "120,103": 2, "146,88": 2, "128,145": 2, "119,156": 2, "174,86": 4, "119,120": 2, "116,146": 2, "112,144": 2, "120,105": 2, "113,150": 19, "125,151": 2, "116,158": 2, "128,120": 4, "112,154": 2, "122,102": 2, "126,104": 2, "115,146": 2, "120,153": 2, "122,151": 2, "128,148": 2, "114,144": 2, "145,86": 2, "112,158": 2, "145,81": 2, "119,119": 4, "112,157": 2, "122,106": 2, "116,154": 2, "119,129": 2, "120,148": 2, "117,155": 2, "120,104": 2, "124,151": 2, "111,146": 2, "128,151": 2, "129,130": 2, "123,124": 2, "109,133": 4, "118,155": 2, "115,149": 2, "120,156": 2, "128,150": 2, "113,157": 2, "119,147": 2, "115,153": 2, "123,151": 13, "118,144": 2, "115,154": 2, "124,133": 2, "120,102": 2, "116,156": 2, "123,123": 0, "118,153": 2, "108,134": 2, "124,107": 4, "122,149": 2, "123,118": 2, "114,152": 2, "122,150": 2, "145,85": 2, "121,147": 2, "128,149": 2, "114,153": 2, "114,150": 2, "120,149": 2, "112,143": 54, "128,141": 2, "152,88": 4, "118,158": 2, "117,146": 51, "111,152": 2, "135,121": 2, "116,157": 2, "119,157": 55, "121,153": 2, "116,148": 2, "114,149": 2, "119,146": 2, "111,158": 2, "119,155": 2, "123,122": 4, "120,106": 2, "114,154": 2, "119,126": 2, "123,152": 13, "114,155": 2, "113,158": 2, "136,122": 2, "120,146": 2, "129,102": 2, "120,155": 2, "130,118": 2, "118,156": 2, "124,104": 2, "171,86": 4, "113,147": 16, "128,128": 2, "112,147": 2, "127,130": 2, "117,156": 51, "107,134": 2, "123,133": 2, "113,148": 17, "122,153": 2, "118,106": 2, "114,148": 2, "112,156": 2, "114,145": 2, "115,157": 2, "135,122": 2, "128,140": 2, "124,150": 2, "117,145": 2, "145,82": 2, "122,107": 4, "111,149": 2, "115,148": 2, "131,118": 2, "145,76": 2, "117,106": 2, "111,159": 50, "128,146": 2, "118,146": 2, "150,88": 2, "114,157": 2, "120,147": 2, "111,153": 2, "126,151": 2, "119,106": 2, "115,144": 2, "122,148": 2, "123,149": 13, "121,149": 2, "118,149": 2, "128,135": 4, "119,121": 2, "117,148": 2, "112,145": 2, "118,147": 2, "119,122": 2, "112,153": 2, "114,147": 2, "122,123": 0, "121,155": 2, "116,144": 2, "145,74": 2, "112,151": 2, "115,147": 2, "128,137": 2, "121,104": 2, "113,153": 22, "128,131": 2, "145,80": 2, "111,151": 2, "113,143": 49, "114,151": 2, "121,150": 2, "135,123": 4, "122,129": 4, "145,83": 2, "123,121": 0, "145,77": 2, "145,75": 2, "108,135": 2, "122,121": 0, "123,153": 13, "128,136": 2, "119,124": 2, "117,159": 2, "109,134": 4, "117,147": 2, "111,155": 2, "108,136": 4, "119,154": 2, "124,106": 2, "122,133": 2, "116,147": 2, "111,150": 2, "122,122": 2, "121,102": 2, "116,155": 2, "112,149": 2, "118,105": 63, "115,145": 2, "128,118": 2, "118,145": 2, "119,148": 2, "112,159": 52, "120,154": 2, "122,128": 2, "123,150": 13, "126,105": 2, "119,131": 2, "119,130": 2, "128,144": 2, "128,101": 63, "111,144": 2, "127,129": 2, "121,133": 2 }, "2": { "120,76": 2, "123,92": 2, "118,88": 2, "105,88": 2, "123,91": 2, "144,88": 2, "118,71": 2, "114,88": 2, "122,120": 2, "120,77": 2, "128,81": 2, "126,74": 2, "124,88": 2, "126,71": 2, "111,87": 2, "103,88": 2, "122,124": 0, "138,86": 2, "118,74": 2, "128,80": 2, "128,77": 2, "120,75": 2, "111,88": 2, "110,88": 2, "128,72": 2, "141,88": 2, "118,87": 2, "127,79": 63, "141,86": 2, "120,73": 2, "118,76": 2, "120,88": 2, "122,122": 4, "123,104": 4, "120,74": 2, "129,88": 2, "126,72": 2, "126,88": 2, "119,88": 2, "143,86": 2, "128,76": 2, "105,86": 2, "101,88": 2, "133,87": 43, "109,86": 2, "128,85": 2, "126,73": 2, "123,96": 2, "135,86": 22, "123,99": 2, "139,88": 2, "117,88": 2, "139,86": 2, "126,76": 2, "135,87": 51, "123,94": 2, "123,89": 2, "128,82": 2, "128,73": 2, "106,88": 2, "138,88": 2, "123,118": 4, "132,87": 44, "123,98": 2, "116,88": 2, "121,88": 2, "120,72": 2, "110,86": 2, "118,81": 2, "118,82": 2, "145,88": 4, "102,86": 2, "122,88": 2, "113,88": 2, "118,86": 2, "102,88": 2, "122,125": 2, "128,71": 2, "137,88": 2, "123,97": 2, "123,122": 0, "144,86": 2, "118,84": 2, "123,101": 2, "140,88": 2, "128,87": 2, "108,86": 2, "128,75": 2, "118,78": 2, "111,86": 2, "135,88": 2, "118,72": 2, "109,88": 2, "123,93": 2, "122,126": 2, "127,77": 2, "118,79": 2, "122,123": 0, "128,84": 2, "128,83": 2, "128,79": 2, "123,120": 2, "101,86": 2, "126,77": 2, "122,127": 4, "112,88": 2, "114,87": 66, "119,79": 64, "122,121": 2, "119,77": 2, "126,75": 2, "130,88": 2, "123,102": 2, "142,88": 2, "119,80": 43, "125,88": 2, "118,80": 2, "131,88": 2, "123,100": 2, "118,73": 2, "123,88": 2, "134,88": 2, "103,86": 2, "128,88": 2, "100,86": 2, "123,121": 0, "123,124": 4, "136,86": 55, "123,103": 2, "133,88": 2, "128,86": 2, "123,119": 2, "100,88": 2, "123,95": 2, "132,88": 2, "143,88": 2, "115,88": 2, "123,125": 2, "107,88": 2, "128,78": 2, "118,85": 2, "145,86": 4, "128,74": 2, "106,86": 2, "118,83": 2, "123,90": 2, "118,77": 2, "127,80": 43, "118,75": 2, "127,88": 2, "137,86": 2, "140,86": 2, "142,86": 2, "123,123": 0, "120,71": 2, "108,88": 2, "104,86": 2, "107,86": 2, "104,88": 2, "136,88": 2, "113,87": 43 }, "-2": { "123,122": 0, "124,121": 2, "122,121": 2, "123,123": 2, "122,129": 2, "121,124": 2, "93,155": 2, "124,123": 2, "124,129": 2, "124,122": 0, "92,157": 2, "92,158": 2, "123,121": 2, "122,123": 2, "125,129": 2, "122,122": 0, "123,129": 2, "94,158": 2, "94,157": 2, "121,123": 2, "122,124": 2, "93,156": 2, "121,121": 2, "124,124": 2, "123,124": 2, "93,157": 2, "121,122": 2 }, "-1": { "161,86": 16, "131,129": 2, "135,94": 2, "163,88": 2, "123,123": 4, "163,85": 2, "114,100": 2, "138,98": 2, "122,124": 0, "125,129": 2, "135,93": 2, "97,151": 2, "139,128": 2, "132,129": 2, "161,88": 2, "126,129": 2, "137,129": 0, "110,100": 2, "94,154": 2, "136,98": 2, "137,128": 0, "116,100": 2, "137,130": 0, "136,130": 2, "138,127": 2, "110,98": 2, "91,152": 2, "93,148": 2, "163,87": 2, "95,150": 2, "163,84": 2, "111,94": 2, "130,100": 2, "160,86": 0, "123,122": 0, "161,85": 2, "159,88": 51, "137,99": 2, "111,97": 2, "111,98": 2, "135,96": 2, "162,87": 2, "136,99": 2, "159,84": 49, "138,97": 2, "93,155": 4, "162,85": 2, "159,86": 0, "112,100": 2, "94,153": 22, "94,152": 2, "109,98": 2, "139,123": 2, "137,100": 2, "93,145": 19, "93,151": 2, "111,95": 2, "122,121": 2, "95,152": 2, "92,152": 2, "110,97": 2, "108,100": 2, "94,150": 2, "93,147": 2, "113,100": 2, "135,130": 2, "128,129": 2, "138,100": 2, "121,121": 2, "93,150": 2, "163,86": 0, "130,129": 2, "93,152": 2, "121,122": 0, "139,121": 2, "137,97": 2, "111,99": 2, "94,155": 2, "159,85": 2, "137,127": 2, "131,100": 2, "111,96": 2, "138,128": 0, "160,88": 2, "95,151": 2, "124,129": 2, "110,99": 2, "138,123": 2, "133,100": 2, "122,123": 0, "129,129": 2, "108,98": 2, "109,100": 2, "138,129": 2, "99,151": 4, "91,151": 2, "92,150": 2, "109,99": 2, "135,95": 2, "139,129": 2, "136,97": 2, "93,149": 2, "108,99": 2, "162,88": 2, "135,98": 2, "138,99": 2, "138,130": 2, "162,84": 2, "139,122": 2, "139,127": 2, "161,87": 2, "123,121": 4, "138,121": 2, "134,100": 2, "111,100": 2, "109,97": 2, "135,100": 2, "111,93": 2, "136,100": 2, "132,100": 2, "96,151": 23, "159,87": 2, "160,87": 2, "135,99": 2, "122,122": 0, "121,123": 4, "91,150": 2, "92,154": 2, "92,155": 2, "160,84": 2, "93,146": 2, "115,100": 2, "162,86": 0, "160,85": 2, "121,124": 2, "161,84": 2, "98,151": 2, "123,124": 2, "135,97": 2, "137,98": 2, "134,130": 2, "108,97": 2, "138,122": 2, "127,129": 2, "92,153": 17 } };
  var tileSize = { "height": 64, "width": 64 };
  var world = {
  	nameToId: nameToId,
  	idToName: idToName,
  	layers: layers,
  	tileSize: tileSize
  };

  var none = { "none": "none", "blue": "blue", "yellow": "yellow", "red": "red", "green": "green", "orange": "orange", "purple": "purple", "white": "white", "black": "black" };
  var blue = { "none": "none", "blue": "blue", "yellow": "green", "red": "purple", "green": "green", "orange": "black", "purple": "purple", "white": "blue", "black": "black" };
  var yellow = { "none": "none", "blue": "green", "yellow": "yellow", "red": "orange", "green": "green", "orange": "orange", "purple": "black", "white": "yellow", "black": "black" };
  var red = { "none": "none", "blue": "purple", "yellow": "orange", "red": "red", "green": "black", "orange": "orange", "purple": "purple", "white": "red", "black": "black" };
  var green = { "none": "none", "blue": "blue", "yellow": "yellow", "red": "black", "green": "green", "orange": "yellow", "purple": "blue", "white": "green", "black": "black" };
  var orange = { "none": "none", "blue": "black", "yellow": "yellow", "red": "red", "green": "yellow", "orange": "orange", "purple": "red", "white": "orange", "black": "black" };
  var purple = { "none": "none", "blue": "blue", "yellow": "black", "red": "red", "green": "blue", "orange": "red", "purple": "purple", "white": "purple", "black": "black" };
  var white = { "none": "none", "blue": "blue", "yellow": "yellow", "red": "red", "green": "green", "orange": "orange", "purple": "purple", "white": "white", "black": "black" };
  var black = { "none": "none", "blue": "black", "yellow": "black", "red": "black", "green": "black", "orange": "black", "purple": "black", "white": "black", "black": "black" };
  var colorMap = {
  	none: none,
  	blue: blue,
  	yellow: yellow,
  	red: red,
  	green: green,
  	orange: orange,
  	purple: purple,
  	white: white,
  	black: black
  };

  var TileMap = function () {
  	function TileMap(stage, data) {
  		babelHelpers.classCallCheck(this, TileMap);

  		this.data = {};
  		this.stage = stage;
  		this.currentLayer = 0;

  		this.load(data);
  	}

  	// Load tilemap data from json


  	babelHelpers.createClass(TileMap, [{
  		key: 'load',
  		value: function load(data) {
  			if (data) {
  				this.tileSize = data.tileSize;
  				this.idToName = data.idToName;
  				this.nameToId = data.nameToId;

  				// Sort layer names
  				this.layerOrder = [];
  				for (var layerName in data.layers) {
  					// Don't include empty layers or special layers
  					if (!layerName.startsWith('s') && Object.keys(data.layers[layerName]).length > 0) {
  						this.layerOrder.push(layerName);
  					}
  				}
  				this.layerOrder.sort(function (a, b) {
  					return a - b;
  				});

  				// Add layer data in correct order
  				for (var layerId in this.layerOrder) {
  					var layerName = this.layerOrder[layerId].toString();
  					var layer = data.layers[layerName];
  					for (var key in layer) {
  						this.setTileById(layerName, key, layer[key]);
  					}
  				}

  				this.switchLayer(0);
  			}
  		}
  	}, {
  		key: 'createLayer',
  		value: function createLayer(layer) {
  			var newLayer = {
  				tiles: {},
  				container: new PIXI.Container()
  			};
  			this.stage.addChild(newLayer.container);
  			this.data[layer] = newLayer;
  		}

  		// Hide all tiles within a layer

  	}, {
  		key: 'hideTiles',
  		value: function hideTiles(layer) {
  			if (layer in this.data) {
  				var tiles = this.data[layer].tiles;
  				for (var tileId in tiles) {
  					tiles[tileId].sprite.visible = false;
  				}
  			}
  		}
  	}, {
  		key: 'getTexture',
  		value: function getTexture(value) {
  			return PIXI.utils.TextureCache[this.idToName[value] + '.png'];
  		}

  		// Set a tile value (also adds/updates sprite)

  	}, {
  		key: 'setTile',
  		value: function setTile(layer, pos, value) {
  			this.setTileByPosAndId(layer, pos, this.hash(pos), value);
  		}

  		// Set a tile value by key (also adds/updates sprite)

  	}, {
  		key: 'setTileById',
  		value: function setTileById(layer, key, value) {
  			this.setTileByPosAndId(layer, this.unhash(key), key, value);
  		}

  		// Set tile from position and name

  	}, {
  		key: 'setTileByName',
  		value: function setTileByName(pos, layer, name) {
  			if (name in this.nameToId) {
  				if (!layer) {
  					layer = this.currentLayer.toString();
  				}
  				this.setTile(layer, pos, this.nameToId[name]);
  			}
  		}
  	}, {
  		key: 'setTileByPosAndId',
  		value: function setTileByPosAndId(layer, pos, key, value) {
  			// Create a new layer if it doesn't already exist
  			if (!(layer in this.data)) {
  				this.createLayer(layer);
  			}

  			var tiles = this.data[layer].tiles;
  			if (key in tiles) {
  				// Set existing tile and sprite texture
  				tiles[key].value = value;
  				tiles[key].sprite.texture = this.getTexture(value);
  				tiles[key].sprite.visible = true;
  			} else {
  				// Create new sprite
  				var sprite = new PIXI.Sprite(this.getTexture(value));
  				sprite.position.x = pos.x * this.tileSize.width;
  				sprite.position.y = pos.y * this.tileSize.height;
  				sprite.anchor.x = 0.5;
  				sprite.anchor.y = 0.5;

  				// Add new sprite
  				tiles[key] = {
  					value: value,
  					sprite: sprite
  				};
  				this.data[layer].container.addChild(sprite);
  			}
  		}

  		// Get a tile object

  	}, {
  		key: 'getTile',
  		value: function getTile(pos, layer) {
  			if (!layer) {
  				layer = this.currentLayer.toString();
  			}
  			if (layer in this.data) {
  				return this.data[layer].tiles[this.hash(pos)];
  			}
  			return null;
  		}

  		// Get a tile name

  	}, {
  		key: 'getTileName',
  		value: function getTileName(pos, layer) {
  			var tile = this.getTile(pos, layer);
  			return tile ? this.idToName[tile.value] : null;
  		}

  		// Switch layers (numeric layer ID)

  	}, {
  		key: 'switchLayer',
  		value: function switchLayer(layer) {
  			if (layer.toString() in this.data) {
  				this.currentLayer = layer;
  				this.updateVisible();
  			}
  		}

  		// Switch layers (e.g. -1 will move down one)

  	}, {
  		key: 'switchLayerRelative',
  		value: function switchLayerRelative(offset) {
  			this.switchLayer(this.currentLayer + offset);
  		}

  		// Hash a position

  	}, {
  		key: 'hash',
  		value: function hash(pos) {
  			return '' + pos.x + ',' + pos.y;
  		}

  		// Extract position from a hash

  	}, {
  		key: 'unhash',
  		value: function unhash(key) {
  			var values = key.split(',');
  			return { x: values[0], y: values[1] };
  		}

  		// Update visible properties of tiles that should be rendered
  		// Note: This only changes based on current layer - later will need to limit just the screen area too

  	}, {
  		key: 'updateVisible',
  		value: function updateVisible() {
  			var currentLayerData = this.data[this.currentLayer].tiles;

  			for (var i in this.layerOrder) {
  				// Turn on layers below you, and turn off layers above you
  				var layerId = this.layerOrder[i];
  				var layerName = layerId.toString();
  				var visible = this.currentLayer >= layerId;
  				this.data[layerName].container.visible = visible;

  				if (visible) {
  					// Change visibility of all sprites within this layer
  					var tiles = this.data[layerName].tiles;
  					for (var tileId in tiles) {
  						tiles[tileId].sprite.visible = tileId in currentLayerData;
  					}
  				}
  			}
  		}
  	}, {
  		key: 'setTint',
  		value: function setTint(pos, layer, tint) {
  			var tile = this.getTile(pos, layer);
  			if (tile) {
  				tile.sprite.tint = tint;
  			}
  		}
  	}]);
  	return TileMap;
  }();

  var blocking = { "moveCollision": true, "layerCollision": true };
  var empty = { "moveCollision": true, "layerCollision": true };
  var normal = { "moveCollision": false, "layerCollision": true };
  var shadow = { "moveCollision": false, "layerCollision": false, "ignored": true };
  var clearing = { "moveCollision": false, "layerCollision": true, "clears": true };
  var checkpoint = { "moveCollision": false, "layerCollision": true, "checkpoint": true, "clears": true };
  var light = { "moveCollision": false, "layerCollision": false, "ignored": true };
  var controls_w = { "moveCollision": false, "layerCollision": true };
  var controls_a = { "moveCollision": false, "layerCollision": true };
  var controls_s = { "moveCollision": false, "layerCollision": true };
  var controls_d = { "moveCollision": false, "layerCollision": true };
  var color_storage_none = { "moveCollision": false, "layerCollision": true, "color": { "storage": true, "name": "none" } };
  var color_storage_blue = { "moveCollision": false, "layerCollision": true, "color": { "storage": true, "name": "blue" } };
  var color_storage_yellow = { "moveCollision": false, "layerCollision": true, "color": { "storage": true, "name": "yellow" } };
  var color_storage_red = { "moveCollision": false, "layerCollision": true, "color": { "storage": true, "name": "red" } };
  var color_storage_green = { "moveCollision": false, "layerCollision": true, "color": { "storage": true, "name": "green" } };
  var color_storage_orange = { "moveCollision": false, "layerCollision": true, "color": { "storage": true, "name": "orange" } };
  var color_storage_purple = { "moveCollision": false, "layerCollision": true, "color": { "storage": true, "name": "purple" } };
  var color_storage_white = { "moveCollision": false, "layerCollision": true, "color": { "storage": true, "name": "white" } };
  var color_storage_black = { "moveCollision": false, "layerCollision": true, "color": { "storage": true, "name": "black" } };
  var color_template_none = { "moveCollision": false, "layerCollision": true, "color": { "template": true, "name": "none" } };
  var color_template_blue = { "moveCollision": false, "layerCollision": true, "color": { "template": true, "name": "blue" } };
  var color_template_yellow = { "moveCollision": false, "layerCollision": true, "color": { "template": true, "name": "yellow" } };
  var color_template_red = { "moveCollision": false, "layerCollision": true, "color": { "template": true, "name": "red" } };
  var color_template_green = { "moveCollision": false, "layerCollision": true, "color": { "template": true, "name": "green" } };
  var color_template_orange = { "moveCollision": false, "layerCollision": true, "color": { "template": true, "name": "orange" } };
  var color_template_purple = { "moveCollision": false, "layerCollision": true, "color": { "template": true, "name": "purple" } };
  var color_template_white = { "moveCollision": false, "layerCollision": true, "color": { "template": true, "name": "white" } };
  var color_template_black = { "moveCollision": false, "layerCollision": true, "color": { "template": true, "name": "black" } };
  var color_block_none = { "moveCollision": false, "layerCollision": true, "color": { "block": true, "name": "none" } };
  var color_block_blue = { "moveCollision": false, "layerCollision": true, "color": { "block": true, "name": "blue" } };
  var color_block_yellow = { "moveCollision": false, "layerCollision": true, "color": { "block": true, "name": "yellow" } };
  var color_block_red = { "moveCollision": false, "layerCollision": true, "color": { "block": true, "name": "red" } };
  var color_block_green = { "moveCollision": false, "layerCollision": true, "color": { "block": true, "name": "green" } };
  var color_block_orange = { "moveCollision": false, "layerCollision": true, "color": { "block": true, "name": "orange" } };
  var color_block_purple = { "moveCollision": false, "layerCollision": true, "color": { "block": true, "name": "purple" } };
  var color_block_white = { "moveCollision": false, "layerCollision": true, "color": { "block": true, "name": "white" } };
  var color_block_black = { "moveCollision": false, "layerCollision": true, "color": { "block": true, "name": "black" } };
  var color_transmitter_none = { "moveCollision": false, "layerCollision": true, "color": { "transmitter": true, "name": "none" } };
  var color_transmitter_blue = { "moveCollision": false, "layerCollision": true, "color": { "transmitter": true, "name": "blue" } };
  var color_transmitter_yellow = { "moveCollision": false, "layerCollision": true, "color": { "transmitter": true, "name": "yellow" } };
  var color_transmitter_red = { "moveCollision": false, "layerCollision": true, "color": { "transmitter": true, "name": "red" } };
  var color_transmitter_green = { "moveCollision": false, "layerCollision": true, "color": { "transmitter": true, "name": "green" } };
  var color_transmitter_orange = { "moveCollision": false, "layerCollision": true, "color": { "transmitter": true, "name": "orange" } };
  var color_transmitter_purple = { "moveCollision": false, "layerCollision": true, "color": { "transmitter": true, "name": "purple" } };
  var color_transmitter_white = { "moveCollision": false, "layerCollision": true, "color": { "transmitter": true, "name": "white" } };
  var color_transmitter_black = { "moveCollision": false, "layerCollision": true, "color": { "transmitter": true, "name": "black" } };
  var tileInfo = {
  	blocking: blocking,
  	empty: empty,
  	normal: normal,
  	shadow: shadow,
  	clearing: clearing,
  	checkpoint: checkpoint,
  	light: light,
  	controls_w: controls_w,
  	controls_a: controls_a,
  	controls_s: controls_s,
  	controls_d: controls_d,
  	color_storage_none: color_storage_none,
  	color_storage_blue: color_storage_blue,
  	color_storage_yellow: color_storage_yellow,
  	color_storage_red: color_storage_red,
  	color_storage_green: color_storage_green,
  	color_storage_orange: color_storage_orange,
  	color_storage_purple: color_storage_purple,
  	color_storage_white: color_storage_white,
  	color_storage_black: color_storage_black,
  	color_template_none: color_template_none,
  	color_template_blue: color_template_blue,
  	color_template_yellow: color_template_yellow,
  	color_template_red: color_template_red,
  	color_template_green: color_template_green,
  	color_template_orange: color_template_orange,
  	color_template_purple: color_template_purple,
  	color_template_white: color_template_white,
  	color_template_black: color_template_black,
  	color_block_none: color_block_none,
  	color_block_blue: color_block_blue,
  	color_block_yellow: color_block_yellow,
  	color_block_red: color_block_red,
  	color_block_green: color_block_green,
  	color_block_orange: color_block_orange,
  	color_block_purple: color_block_purple,
  	color_block_white: color_block_white,
  	color_block_black: color_block_black,
  	color_transmitter_none: color_transmitter_none,
  	color_transmitter_blue: color_transmitter_blue,
  	color_transmitter_yellow: color_transmitter_yellow,
  	color_transmitter_red: color_transmitter_red,
  	color_transmitter_green: color_transmitter_green,
  	color_transmitter_orange: color_transmitter_orange,
  	color_transmitter_purple: color_transmitter_purple,
  	color_transmitter_white: color_transmitter_white,
  	color_transmitter_black: color_transmitter_black
  };

  // TODO: Either generate most of tile_info or handle special cases somehow
  // The colors are getting very redundant...

  var TileMapUtils = function () {
  	function TileMapUtils(tiles) {
  		babelHelpers.classCallCheck(this, TileMapUtils);

  		this.tiles = tiles;
  	}

  	// Finds the first real tile through shadow tiles


  	babelHelpers.createClass(TileMapUtils, [{
  		key: 'findRealTile',
  		value: function findRealTile(pos, layer) {
  			layer = layer || this.tiles.currentLayer;
  			for (var i = layer; i.toString() in this.tiles.data; --i) {
  				var info = this.getTileInfo(pos, i.toString());
  				if (info) {
  					if (!info.ignored) {
  						return { info: info, layer: i };
  					}
  				} else {
  					break;
  				}
  			}
  			return null;
  		}

  		// Checks if a tile is a shadow/ignored tile

  	}, {
  		key: 'isIgnoredTile',
  		value: function isIgnoredTile(pos, layer) {
  			return this.getTileProperty('ignored', pos, layer, false);
  		}

  		// Returns entire tile info object from json file

  	}, {
  		key: 'getTileInfo',
  		value: function getTileInfo(pos, layer) {
  			var tileName = this.tiles.getTileName(pos, layer);
  			if (tileName) {
  				return tileInfo[tileName];
  			}
  			return null;
  		}

  		// Returns a single property from the tile info object

  	}, {
  		key: 'getTileProperty',
  		value: function getTileProperty(type, pos, layer, fallback) {
  			var info = this.getTileInfo(pos, layer);
  			if (info && type in info) {
  				return info[type];
  			}
  			return fallback;
  		}
  	}]);
  	return TileMapUtils;
  }();

  // Lighting system
  function updateLighting(tilemap, layer) {
  	// Check tiles on layer above current
  	var upperLayer = (layer + 1).toString();
  	var lightValue = tilemap.nameToId['light'];

  	// Clear the layer
  	tilemap.hideTiles('lighting');

  	// Only continue if the layer exists
  	if (upperLayer in tilemap.data) {
  		var tu = new TileMapUtils(tilemap);
  		var tiles = tilemap.data[layer.toString()].tiles;

  		// Go through tiles in current layer to see if they need lighting
  		for (var tileId in tiles) {
  			if (tu.isIgnoredTile(tilemap.unhash(tileId), upperLayer)) {
  				// Set lighting
  				tilemap.setTileById('lighting', tileId, lightValue);
  			}
  		}
  	}
  }

  // Player/level system
  kran.system({
  	components: [components.inputMovement, components.tilePosition],
  	checkpoint: null,
  	createPlayer: function createPlayer() {
  		var startPos = {
  			x: 128,
  			y: 128,
  			z: 0
  		};
  		return kran.entity().add(components.position, startPos.x * this.tiles.tileSize.width, startPos.y * this.tiles.tileSize.height).add(components.velocity).add(components.inputMovement).add(components.cameraFollows).add(components.tilePosition, startPos.x, startPos.y, startPos.z).add(components.sprite, stage, 'player_none.png').add(components.storage);
  	},
  	returnToCheckpoint: function returnToCheckpoint() {
  		if (this.checkpoint) {
  			this.movePlayer(this.player, this.checkpoint);
  			this.setPlayerColor();

  			this.tiles.switchLayer(this.checkpoint.z);
  			updateLighting(this.tiles, this.checkpoint.z);
  		}
  	},
  	init: function init() {
  		var _this = this;

  		Mousetrap.bind('esc', function () {
  			_this.returnToCheckpoint();
  		});

  		// Create tilemap entity
  		this.tiles = new TileMap(stage, world);
  		var tilemap = kran.entity().add(components.tilemap, this.tiles).add(components.inputLayer);
  		this.tu = new TileMapUtils(this.tiles);

  		// Create player entity
  		this.player = this.createPlayer();

  		// Need to store these for layer switching and colors
  		this.tilesInputLayer = tilemap.get(components.inputLayer);
  		this.playerTilePosition = this.player.get(components.tilePosition);
  		this.playerStorage = this.player.get(components.storage);
  		this.playerSprite = this.player.get(components.sprite).s;

  		// Setup lighting for the first time
  		updateLighting(this.tiles, this.tiles.currentLayer);
  	},
  	pre: function pre() {
  		// Handle layer switching
  		for (var i in this.tilesInputLayer.actions) {
  			this.switchLayer(this.tilesInputLayer.actions[i], this.playerTilePosition);
  		}
  		this.tilesInputLayer.actions.length = 0;
  	},
  	every: function every(inputMovement, tilePosition, ent) {
  		// Remove destination component if finished
  		var destination = ent.get(components.destination);
  		if (destination && destination.done) {
  			ent.remove(components.destination);
  			destination = null;
  		}

  		// Move and animate player
  		if (!destination && (inputMovement.delta.x != 0 || inputMovement.delta.y != 0)) {
  			// Movement was requested, so calculate new position
  			var newPosition = {
  				x: tilePosition.x + inputMovement.delta.x,
  				y: tilePosition.y + inputMovement.delta.y
  			};

  			// Check collision on the deepest tile visible
  			var tile = this.tu.findRealTile(newPosition);
  			if (tile && !(tile.info.moveCollision || this.colorBlockCollision(tile.info.color))) {
  				// Trigger exit event
  				this.playerExitedTile(tile.info, {
  					x: tilePosition.x,
  					y: tilePosition.y,
  					z: this.tiles.currentLayer // Note: This is not correct, need to keep track of locations of "deep" tiles
  				});

  				// Move player if no collision
  				this.movePlayer(ent, newPosition);

  				// Trigger enter event
  				this.playerEnteredTile(tile.info, {
  					x: newPosition.x,
  					y: newPosition.y,
  					z: tile.layer
  				});
  			}
  		}
  	},
  	colorBlockCollision: function colorBlockCollision(colorInfo) {
  		if (colorInfo && colorInfo.block) {
  			return colorInfo.name != this.playerStorage.color;
  		}
  		return false;
  	},
  	playerEnteredTile: function playerEnteredTile(info, pos) {
  		if (info.clears) {
  			this.setPlayerColor();
  		}
  		if ('color' in info && info.color.transmitter) {
  			this.mixPlayerColor(info.color.name);
  		}
  		if (info.checkpoint) {
  			this.checkpoint = {
  				x: pos.x,
  				y: pos.y,
  				z: pos.z
  			};
  		}
  	},
  	playerExitedTile: function playerExitedTile(info, pos) {},
  	movePlayer: function movePlayer(ent, target) {
  		// Set tile position
  		var tilePosition = ent.get(components.tilePosition);
  		tilePosition.x = target.x;
  		tilePosition.y = target.y;

  		// Set graphical position (start a tween)
  		var pixelTarget = {
  			x: tilePosition.x * this.tiles.tileSize.width,
  			y: tilePosition.y * this.tiles.tileSize.height
  		};
  		var position = ent.get(components.position);
  		ent.add(components.destination, position, pixelTarget, 200);
  	},
  	switchLayer: function switchLayer(offset, tilePosition) {
  		var pos = {
  			x: tilePosition.x,
  			y: tilePosition.y
  		};
  		var newLayer = this.tiles.currentLayer + offset;

  		// Shifting up goes through the tile above you
  		// Shifting down goes through the tile you are standing on
  		var phaseThroughLayer = offset > 0 ? newLayer : this.tiles.currentLayer;

  		// Check if it's valid to switch layers *from* here
  		if (!this.tu.getTileProperty('layerCollision', pos, phaseThroughLayer.toString(), true)) {
  			// Check if it's valid to switch *to* this tile
  			if (!this.tu.getTileProperty('moveCollision', pos, newLayer.toString(), true)) {
  				// Switch layers and update lighting
  				this.tiles.switchLayerRelative(offset);
  				updateLighting(this.tiles, newLayer);
  			}
  		}
  	},
  	setPlayerColor: function setPlayerColor(color) {
  		color = color || 'none';
  		this.playerStorage.color = color;
  		this.playerSprite.texture = PIXI.utils.TextureCache['player_' + color + '.png'];
  	},
  	mixPlayerColor: function mixPlayerColor(color) {
  		var newColor = colorMap[this.playerStorage.color][color];
  		this.setPlayerColor(newColor);
  	}
  });

  // Run update() for tween.js
  // Note: Using a system so it runs in the correct order
  kran.system({
  	components: [components.destination],
  	pre: function pre() {
  		TWEEN.update(dt.total);
  	}
  });

  // Update positions from velocity
  kran.system({
  	components: [components.position, components.velocity],
  	every: function every(position, velocity, ent) {
  		position.x += velocity.x * dt.val;
  		position.y += velocity.y * dt.val;
  		var sprite = ent.get(components.sprite);
  		if (sprite) {
  			sprite.s.position.x = position.x;
  			sprite.s.position.y = position.y;
  		}
  	}
  });

  // Handles updating camera (stage) position based on followsCamera components
  kran.system({
  	components: [components.position, components.cameraFollows],
  	every: function every(position, follow) {
  		if (follow.center) {
  			this.centerCamera(position, follow);
  			follow.center = false;
  		}

  		// Have deadzone rectangle follow entity
  		if (position.x > follow.deadzone.x + follow.deadzone.width) {
  			follow.deadzone.x = position.x - follow.deadzone.width;
  		}
  		if (position.x < follow.deadzone.x) {
  			follow.deadzone.x = position.x;
  		}
  		if (position.y > follow.deadzone.y + follow.deadzone.height) {
  			follow.deadzone.y = position.y - follow.deadzone.height;
  		}
  		if (position.y < follow.deadzone.y) {
  			follow.deadzone.y = position.y;
  		}

  		// Sync camera position so deadzone is centered
  		stage.position.x = -follow.deadzone.x + follow.borderSize;
  		stage.position.y = -follow.deadzone.y + follow.borderSize;
  	},
  	centerCamera: function centerCamera(position, follow) {
  		follow.deadzone.x = position.x - follow.deadzone.width / 2;
  		follow.deadzone.y = position.y - follow.deadzone.height / 2;
  	}
  });

  // Render the stage
  kran.system({
  	components: [components.pixiStage],
  	renderer: null,
  	init: function init() {
  		// Setup pixi renderer and add to page
  		this.renderer = PIXI.autoDetectRenderer(gameSize.width, gameSize.height, { antialias: true });
  		document.body.appendChild(this.renderer.view);

  		// Add entity with pixi stage
  		kran.entity().add(components.pixiStage, stage);
  	},
  	every: function every(pixiStage) {
  		this.renderer.render(pixiStage.root);
  	}
  });

  var lastTime = 0.0;

  // Initialize systems and start the main loop
  function start() {
  	kran.init("all");
  	requestAnimationFrame(gameLoop);
  }

  function gameLoop(time) {
  	// Calculate delta-time
  	dt.val = (time - lastTime) / 1000.0;
  	lastTime = time;

  	dt.total = time;

  	kran.run("all");
  	requestAnimationFrame(gameLoop);
  }

  PIXI.loader.add('textures', 'data/textures.json').load(start);

}());