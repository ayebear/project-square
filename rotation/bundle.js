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
  var gameStage = new PIXI.Container();
  gameStage.zIndex = 10;
  stage.addChild(gameStage);

  // For re-ordering containers, source:
  // https://github.com/pixijs/pixi.js/issues/300#issuecomment-86127171
  stage.updateLayersOrder = function () {
  	stage.children.sort(function (a, b) {
  		a.zIndex = a.zIndex || 0;
  		b.zIndex = b.zIndex || 0;
  		return b.zIndex - a.zIndex;
  	});
  };

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

  	// Triggers velocity changes from WASD keys or swipe
  	inputMovement: kran.component(function (speed) {
  		// 4 tiles per second
  		var defaultSpeed = 64 * 4;
  		this.speed = speed || defaultSpeed;

  		// For requesting movement
  		this.delta = null;
  	}),

  	// Triggers rotation with up/down/space keys or tap
  	inputRotate: kran.component(function () {
  		this.actions = [];
  	}),

  	// Triggers checkpoint restoring with escape/pinch
  	inputCheckpoint: kran.component(function (puzzleCallback, areaCallback) {
  		this.puzzleCallback = puzzleCallback;
  		this.areaCallback = areaCallback;
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

  	action: kran.component(function (key) {
  		var _this2 = this;

  		this.key = key;
  		this.pressed = false;
  		Mousetrap.bind(key, function () {
  			_this2.pressed = true;
  		});
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

  var Mousetrap$1 = (mousetrap && typeof mousetrap === 'object' && 'default' in mousetrap ? mousetrap['default'] : mousetrap);

  var hammer = __commonjs(function (module) {
  /*! Hammer.JS - v2.0.6 - 2015-12-23
   * http://hammerjs.github.io/
   *
   * Copyright (c) 2015 Jorik Tangelder;
   * Licensed under the  license */
  (function (window, document, exportName, undefined) {
      'use strict';

      var VENDOR_PREFIXES = ['', 'webkit', 'Moz', 'MS', 'ms', 'o'];
      var TEST_ELEMENT = document.createElement('div');

      var TYPE_FUNCTION = 'function';

      var round = Math.round;
      var abs = Math.abs;
      var now = Date.now;

      /**
       * set a timeout with a given scope
       * @param {Function} fn
       * @param {Number} timeout
       * @param {Object} context
       * @returns {number}
       */
      function setTimeoutContext(fn, timeout, context) {
          return setTimeout(bindFn(fn, context), timeout);
      }

      /**
       * if the argument is an array, we want to execute the fn on each entry
       * if it aint an array we don't want to do a thing.
       * this is used by all the methods that accept a single and array argument.
       * @param {*|Array} arg
       * @param {String} fn
       * @param {Object} [context]
       * @returns {Boolean}
       */
      function invokeArrayArg(arg, fn, context) {
          if (Array.isArray(arg)) {
              each(arg, context[fn], context);
              return true;
          }
          return false;
      }

      /**
       * walk objects and arrays
       * @param {Object} obj
       * @param {Function} iterator
       * @param {Object} context
       */
      function each(obj, iterator, context) {
          var i;

          if (!obj) {
              return;
          }

          if (obj.forEach) {
              obj.forEach(iterator, context);
          } else if (obj.length !== undefined) {
              i = 0;
              while (i < obj.length) {
                  iterator.call(context, obj[i], i, obj);
                  i++;
              }
          } else {
              for (i in obj) {
                  obj.hasOwnProperty(i) && iterator.call(context, obj[i], i, obj);
              }
          }
      }

      /**
       * wrap a method with a deprecation warning and stack trace
       * @param {Function} method
       * @param {String} name
       * @param {String} message
       * @returns {Function} A new function wrapping the supplied method.
       */
      function deprecate(method, name, message) {
          var deprecationMessage = 'DEPRECATED METHOD: ' + name + '\n' + message + ' AT \n';
          return function () {
              var e = new Error('get-stack-trace');
              var stack = e && e.stack ? e.stack.replace(/^[^\(]+?[\n$]/gm, '').replace(/^\s+at\s+/gm, '').replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@') : 'Unknown Stack Trace';

              var log = window.console && (window.console.warn || window.console.log);
              if (log) {
                  log.call(window.console, deprecationMessage, stack);
              }
              return method.apply(this, arguments);
          };
      }

      /**
       * extend object.
       * means that properties in dest will be overwritten by the ones in src.
       * @param {Object} target
       * @param {...Object} objects_to_assign
       * @returns {Object} target
       */
      var assign;
      if (typeof Object.assign !== 'function') {
          assign = function assign(target) {
              if (target === undefined || target === null) {
                  throw new TypeError('Cannot convert undefined or null to object');
              }

              var output = Object(target);
              for (var index = 1; index < arguments.length; index++) {
                  var source = arguments[index];
                  if (source !== undefined && source !== null) {
                      for (var nextKey in source) {
                          if (source.hasOwnProperty(nextKey)) {
                              output[nextKey] = source[nextKey];
                          }
                      }
                  }
              }
              return output;
          };
      } else {
          assign = Object.assign;
      }

      /**
       * extend object.
       * means that properties in dest will be overwritten by the ones in src.
       * @param {Object} dest
       * @param {Object} src
       * @param {Boolean=false} [merge]
       * @returns {Object} dest
       */
      var extend = deprecate(function extend(dest, src, merge) {
          var keys = Object.keys(src);
          var i = 0;
          while (i < keys.length) {
              if (!merge || merge && dest[keys[i]] === undefined) {
                  dest[keys[i]] = src[keys[i]];
              }
              i++;
          }
          return dest;
      }, 'extend', 'Use `assign`.');

      /**
       * merge the values from src in the dest.
       * means that properties that exist in dest will not be overwritten by src
       * @param {Object} dest
       * @param {Object} src
       * @returns {Object} dest
       */
      var merge = deprecate(function merge(dest, src) {
          return extend(dest, src, true);
      }, 'merge', 'Use `assign`.');

      /**
       * simple class inheritance
       * @param {Function} child
       * @param {Function} base
       * @param {Object} [properties]
       */
      function inherit(child, base, properties) {
          var baseP = base.prototype,
              childP;

          childP = child.prototype = Object.create(baseP);
          childP.constructor = child;
          childP._super = baseP;

          if (properties) {
              assign(childP, properties);
          }
      }

      /**
       * simple function bind
       * @param {Function} fn
       * @param {Object} context
       * @returns {Function}
       */
      function bindFn(fn, context) {
          return function boundFn() {
              return fn.apply(context, arguments);
          };
      }

      /**
       * let a boolean value also be a function that must return a boolean
       * this first item in args will be used as the context
       * @param {Boolean|Function} val
       * @param {Array} [args]
       * @returns {Boolean}
       */
      function boolOrFn(val, args) {
          if ((typeof val === 'undefined' ? 'undefined' : babelHelpers.typeof(val)) == TYPE_FUNCTION) {
              return val.apply(args ? args[0] || undefined : undefined, args);
          }
          return val;
      }

      /**
       * use the val2 when val1 is undefined
       * @param {*} val1
       * @param {*} val2
       * @returns {*}
       */
      function ifUndefined(val1, val2) {
          return val1 === undefined ? val2 : val1;
      }

      /**
       * addEventListener with multiple events at once
       * @param {EventTarget} target
       * @param {String} types
       * @param {Function} handler
       */
      function addEventListeners(target, types, handler) {
          each(splitStr(types), function (type) {
              target.addEventListener(type, handler, false);
          });
      }

      /**
       * removeEventListener with multiple events at once
       * @param {EventTarget} target
       * @param {String} types
       * @param {Function} handler
       */
      function removeEventListeners(target, types, handler) {
          each(splitStr(types), function (type) {
              target.removeEventListener(type, handler, false);
          });
      }

      /**
       * find if a node is in the given parent
       * @method hasParent
       * @param {HTMLElement} node
       * @param {HTMLElement} parent
       * @return {Boolean} found
       */
      function hasParent(node, parent) {
          while (node) {
              if (node == parent) {
                  return true;
              }
              node = node.parentNode;
          }
          return false;
      }

      /**
       * small indexOf wrapper
       * @param {String} str
       * @param {String} find
       * @returns {Boolean} found
       */
      function inStr(str, find) {
          return str.indexOf(find) > -1;
      }

      /**
       * split string on whitespace
       * @param {String} str
       * @returns {Array} words
       */
      function splitStr(str) {
          return str.trim().split(/\s+/g);
      }

      /**
       * find if a array contains the object using indexOf or a simple polyFill
       * @param {Array} src
       * @param {String} find
       * @param {String} [findByKey]
       * @return {Boolean|Number} false when not found, or the index
       */
      function inArray(src, find, findByKey) {
          if (src.indexOf && !findByKey) {
              return src.indexOf(find);
          } else {
              var i = 0;
              while (i < src.length) {
                  if (findByKey && src[i][findByKey] == find || !findByKey && src[i] === find) {
                      return i;
                  }
                  i++;
              }
              return -1;
          }
      }

      /**
       * convert array-like objects to real arrays
       * @param {Object} obj
       * @returns {Array}
       */
      function toArray(obj) {
          return Array.prototype.slice.call(obj, 0);
      }

      /**
       * unique array with objects based on a key (like 'id') or just by the array's value
       * @param {Array} src [{id:1},{id:2},{id:1}]
       * @param {String} [key]
       * @param {Boolean} [sort=False]
       * @returns {Array} [{id:1},{id:2}]
       */
      function uniqueArray(src, key, sort) {
          var results = [];
          var values = [];
          var i = 0;

          while (i < src.length) {
              var val = key ? src[i][key] : src[i];
              if (inArray(values, val) < 0) {
                  results.push(src[i]);
              }
              values[i] = val;
              i++;
          }

          if (sort) {
              if (!key) {
                  results = results.sort();
              } else {
                  results = results.sort(function sortUniqueArray(a, b) {
                      return a[key] > b[key];
                  });
              }
          }

          return results;
      }

      /**
       * get the prefixed property
       * @param {Object} obj
       * @param {String} property
       * @returns {String|Undefined} prefixed
       */
      function prefixed(obj, property) {
          var prefix, prop;
          var camelProp = property[0].toUpperCase() + property.slice(1);

          var i = 0;
          while (i < VENDOR_PREFIXES.length) {
              prefix = VENDOR_PREFIXES[i];
              prop = prefix ? prefix + camelProp : property;

              if (prop in obj) {
                  return prop;
              }
              i++;
          }
          return undefined;
      }

      /**
       * get a unique id
       * @returns {number} uniqueId
       */
      var _uniqueId = 1;
      function uniqueId() {
          return _uniqueId++;
      }

      /**
       * get the window object of an element
       * @param {HTMLElement} element
       * @returns {DocumentView|Window}
       */
      function getWindowForElement(element) {
          var doc = element.ownerDocument || element;
          return doc.defaultView || doc.parentWindow || window;
      }

      var MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android/i;

      var SUPPORT_TOUCH = 'ontouchstart' in window;
      var SUPPORT_POINTER_EVENTS = prefixed(window, 'PointerEvent') !== undefined;
      var SUPPORT_ONLY_TOUCH = SUPPORT_TOUCH && MOBILE_REGEX.test(navigator.userAgent);

      var INPUT_TYPE_TOUCH = 'touch';
      var INPUT_TYPE_PEN = 'pen';
      var INPUT_TYPE_MOUSE = 'mouse';
      var INPUT_TYPE_KINECT = 'kinect';

      var COMPUTE_INTERVAL = 25;

      var INPUT_START = 1;
      var INPUT_MOVE = 2;
      var INPUT_END = 4;
      var INPUT_CANCEL = 8;

      var DIRECTION_NONE = 1;
      var DIRECTION_LEFT = 2;
      var DIRECTION_RIGHT = 4;
      var DIRECTION_UP = 8;
      var DIRECTION_DOWN = 16;

      var DIRECTION_HORIZONTAL = DIRECTION_LEFT | DIRECTION_RIGHT;
      var DIRECTION_VERTICAL = DIRECTION_UP | DIRECTION_DOWN;
      var DIRECTION_ALL = DIRECTION_HORIZONTAL | DIRECTION_VERTICAL;

      var PROPS_XY = ['x', 'y'];
      var PROPS_CLIENT_XY = ['clientX', 'clientY'];

      /**
       * create new input type manager
       * @param {Manager} manager
       * @param {Function} callback
       * @returns {Input}
       * @constructor
       */
      function Input(manager, callback) {
          var self = this;
          this.manager = manager;
          this.callback = callback;
          this.element = manager.element;
          this.target = manager.options.inputTarget;

          // smaller wrapper around the handler, for the scope and the enabled state of the manager,
          // so when disabled the input events are completely bypassed.
          this.domHandler = function (ev) {
              if (boolOrFn(manager.options.enable, [manager])) {
                  self.handler(ev);
              }
          };

          this.init();
      }

      Input.prototype = {
          /**
           * should handle the inputEvent data and trigger the callback
           * @virtual
           */
          handler: function handler() {},

          /**
           * bind the events
           */
          init: function init() {
              this.evEl && addEventListeners(this.element, this.evEl, this.domHandler);
              this.evTarget && addEventListeners(this.target, this.evTarget, this.domHandler);
              this.evWin && addEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
          },

          /**
           * unbind the events
           */
          destroy: function destroy() {
              this.evEl && removeEventListeners(this.element, this.evEl, this.domHandler);
              this.evTarget && removeEventListeners(this.target, this.evTarget, this.domHandler);
              this.evWin && removeEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
          }
      };

      /**
       * create new input type manager
       * called by the Manager constructor
       * @param {Hammer} manager
       * @returns {Input}
       */
      function createInputInstance(manager) {
          var Type;
          var inputClass = manager.options.inputClass;

          if (inputClass) {
              Type = inputClass;
          } else if (SUPPORT_POINTER_EVENTS) {
              Type = PointerEventInput;
          } else if (SUPPORT_ONLY_TOUCH) {
              Type = TouchInput;
          } else if (!SUPPORT_TOUCH) {
              Type = MouseInput;
          } else {
              Type = TouchMouseInput;
          }
          return new Type(manager, inputHandler);
      }

      /**
       * handle input events
       * @param {Manager} manager
       * @param {String} eventType
       * @param {Object} input
       */
      function inputHandler(manager, eventType, input) {
          var pointersLen = input.pointers.length;
          var changedPointersLen = input.changedPointers.length;
          var isFirst = eventType & INPUT_START && pointersLen - changedPointersLen === 0;
          var isFinal = eventType & (INPUT_END | INPUT_CANCEL) && pointersLen - changedPointersLen === 0;

          input.isFirst = !!isFirst;
          input.isFinal = !!isFinal;

          if (isFirst) {
              manager.session = {};
          }

          // source event is the normalized value of the domEvents
          // like 'touchstart, mouseup, pointerdown'
          input.eventType = eventType;

          // compute scale, rotation etc
          computeInputData(manager, input);

          // emit secret event
          manager.emit('hammer.input', input);

          manager.recognize(input);
          manager.session.prevInput = input;
      }

      /**
       * extend the data with some usable properties like scale, rotate, velocity etc
       * @param {Object} manager
       * @param {Object} input
       */
      function computeInputData(manager, input) {
          var session = manager.session;
          var pointers = input.pointers;
          var pointersLength = pointers.length;

          // store the first input to calculate the distance and direction
          if (!session.firstInput) {
              session.firstInput = simpleCloneInputData(input);
          }

          // to compute scale and rotation we need to store the multiple touches
          if (pointersLength > 1 && !session.firstMultiple) {
              session.firstMultiple = simpleCloneInputData(input);
          } else if (pointersLength === 1) {
              session.firstMultiple = false;
          }

          var firstInput = session.firstInput;
          var firstMultiple = session.firstMultiple;
          var offsetCenter = firstMultiple ? firstMultiple.center : firstInput.center;

          var center = input.center = getCenter(pointers);
          input.timeStamp = now();
          input.deltaTime = input.timeStamp - firstInput.timeStamp;

          input.angle = getAngle(offsetCenter, center);
          input.distance = getDistance(offsetCenter, center);

          computeDeltaXY(session, input);
          input.offsetDirection = getDirection(input.deltaX, input.deltaY);

          var overallVelocity = getVelocity(input.deltaTime, input.deltaX, input.deltaY);
          input.overallVelocityX = overallVelocity.x;
          input.overallVelocityY = overallVelocity.y;
          input.overallVelocity = abs(overallVelocity.x) > abs(overallVelocity.y) ? overallVelocity.x : overallVelocity.y;

          input.scale = firstMultiple ? getScale(firstMultiple.pointers, pointers) : 1;
          input.rotation = firstMultiple ? getRotation(firstMultiple.pointers, pointers) : 0;

          input.maxPointers = !session.prevInput ? input.pointers.length : input.pointers.length > session.prevInput.maxPointers ? input.pointers.length : session.prevInput.maxPointers;

          computeIntervalInputData(session, input);

          // find the correct target
          var target = manager.element;
          if (hasParent(input.srcEvent.target, target)) {
              target = input.srcEvent.target;
          }
          input.target = target;
      }

      function computeDeltaXY(session, input) {
          var center = input.center;
          var offset = session.offsetDelta || {};
          var prevDelta = session.prevDelta || {};
          var prevInput = session.prevInput || {};

          if (input.eventType === INPUT_START || prevInput.eventType === INPUT_END) {
              prevDelta = session.prevDelta = {
                  x: prevInput.deltaX || 0,
                  y: prevInput.deltaY || 0
              };

              offset = session.offsetDelta = {
                  x: center.x,
                  y: center.y
              };
          }

          input.deltaX = prevDelta.x + (center.x - offset.x);
          input.deltaY = prevDelta.y + (center.y - offset.y);
      }

      /**
       * velocity is calculated every x ms
       * @param {Object} session
       * @param {Object} input
       */
      function computeIntervalInputData(session, input) {
          var last = session.lastInterval || input,
              deltaTime = input.timeStamp - last.timeStamp,
              velocity,
              velocityX,
              velocityY,
              direction;

          if (input.eventType != INPUT_CANCEL && (deltaTime > COMPUTE_INTERVAL || last.velocity === undefined)) {
              var deltaX = input.deltaX - last.deltaX;
              var deltaY = input.deltaY - last.deltaY;

              var v = getVelocity(deltaTime, deltaX, deltaY);
              velocityX = v.x;
              velocityY = v.y;
              velocity = abs(v.x) > abs(v.y) ? v.x : v.y;
              direction = getDirection(deltaX, deltaY);

              session.lastInterval = input;
          } else {
              // use latest velocity info if it doesn't overtake a minimum period
              velocity = last.velocity;
              velocityX = last.velocityX;
              velocityY = last.velocityY;
              direction = last.direction;
          }

          input.velocity = velocity;
          input.velocityX = velocityX;
          input.velocityY = velocityY;
          input.direction = direction;
      }

      /**
       * create a simple clone from the input used for storage of firstInput and firstMultiple
       * @param {Object} input
       * @returns {Object} clonedInputData
       */
      function simpleCloneInputData(input) {
          // make a simple copy of the pointers because we will get a reference if we don't
          // we only need clientXY for the calculations
          var pointers = [];
          var i = 0;
          while (i < input.pointers.length) {
              pointers[i] = {
                  clientX: round(input.pointers[i].clientX),
                  clientY: round(input.pointers[i].clientY)
              };
              i++;
          }

          return {
              timeStamp: now(),
              pointers: pointers,
              center: getCenter(pointers),
              deltaX: input.deltaX,
              deltaY: input.deltaY
          };
      }

      /**
       * get the center of all the pointers
       * @param {Array} pointers
       * @return {Object} center contains `x` and `y` properties
       */
      function getCenter(pointers) {
          var pointersLength = pointers.length;

          // no need to loop when only one touch
          if (pointersLength === 1) {
              return {
                  x: round(pointers[0].clientX),
                  y: round(pointers[0].clientY)
              };
          }

          var x = 0,
              y = 0,
              i = 0;
          while (i < pointersLength) {
              x += pointers[i].clientX;
              y += pointers[i].clientY;
              i++;
          }

          return {
              x: round(x / pointersLength),
              y: round(y / pointersLength)
          };
      }

      /**
       * calculate the velocity between two points. unit is in px per ms.
       * @param {Number} deltaTime
       * @param {Number} x
       * @param {Number} y
       * @return {Object} velocity `x` and `y`
       */
      function getVelocity(deltaTime, x, y) {
          return {
              x: x / deltaTime || 0,
              y: y / deltaTime || 0
          };
      }

      /**
       * get the direction between two points
       * @param {Number} x
       * @param {Number} y
       * @return {Number} direction
       */
      function getDirection(x, y) {
          if (x === y) {
              return DIRECTION_NONE;
          }

          if (abs(x) >= abs(y)) {
              return x < 0 ? DIRECTION_LEFT : DIRECTION_RIGHT;
          }
          return y < 0 ? DIRECTION_UP : DIRECTION_DOWN;
      }

      /**
       * calculate the absolute distance between two points
       * @param {Object} p1 {x, y}
       * @param {Object} p2 {x, y}
       * @param {Array} [props] containing x and y keys
       * @return {Number} distance
       */
      function getDistance(p1, p2, props) {
          if (!props) {
              props = PROPS_XY;
          }
          var x = p2[props[0]] - p1[props[0]],
              y = p2[props[1]] - p1[props[1]];

          return Math.sqrt(x * x + y * y);
      }

      /**
       * calculate the angle between two coordinates
       * @param {Object} p1
       * @param {Object} p2
       * @param {Array} [props] containing x and y keys
       * @return {Number} angle
       */
      function getAngle(p1, p2, props) {
          if (!props) {
              props = PROPS_XY;
          }
          var x = p2[props[0]] - p1[props[0]],
              y = p2[props[1]] - p1[props[1]];
          return Math.atan2(y, x) * 180 / Math.PI;
      }

      /**
       * calculate the rotation degrees between two pointersets
       * @param {Array} start array of pointers
       * @param {Array} end array of pointers
       * @return {Number} rotation
       */
      function getRotation(start, end) {
          return getAngle(end[1], end[0], PROPS_CLIENT_XY) + getAngle(start[1], start[0], PROPS_CLIENT_XY);
      }

      /**
       * calculate the scale factor between two pointersets
       * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
       * @param {Array} start array of pointers
       * @param {Array} end array of pointers
       * @return {Number} scale
       */
      function getScale(start, end) {
          return getDistance(end[0], end[1], PROPS_CLIENT_XY) / getDistance(start[0], start[1], PROPS_CLIENT_XY);
      }

      var MOUSE_INPUT_MAP = {
          mousedown: INPUT_START,
          mousemove: INPUT_MOVE,
          mouseup: INPUT_END
      };

      var MOUSE_ELEMENT_EVENTS = 'mousedown';
      var MOUSE_WINDOW_EVENTS = 'mousemove mouseup';

      /**
       * Mouse events input
       * @constructor
       * @extends Input
       */
      function MouseInput() {
          this.evEl = MOUSE_ELEMENT_EVENTS;
          this.evWin = MOUSE_WINDOW_EVENTS;

          this.allow = true; // used by Input.TouchMouse to disable mouse events
          this.pressed = false; // mousedown state

          Input.apply(this, arguments);
      }

      inherit(MouseInput, Input, {
          /**
           * handle mouse events
           * @param {Object} ev
           */
          handler: function MEhandler(ev) {
              var eventType = MOUSE_INPUT_MAP[ev.type];

              // on start we want to have the left mouse button down
              if (eventType & INPUT_START && ev.button === 0) {
                  this.pressed = true;
              }

              if (eventType & INPUT_MOVE && ev.which !== 1) {
                  eventType = INPUT_END;
              }

              // mouse must be down, and mouse events are allowed (see the TouchMouse input)
              if (!this.pressed || !this.allow) {
                  return;
              }

              if (eventType & INPUT_END) {
                  this.pressed = false;
              }

              this.callback(this.manager, eventType, {
                  pointers: [ev],
                  changedPointers: [ev],
                  pointerType: INPUT_TYPE_MOUSE,
                  srcEvent: ev
              });
          }
      });

      var POINTER_INPUT_MAP = {
          pointerdown: INPUT_START,
          pointermove: INPUT_MOVE,
          pointerup: INPUT_END,
          pointercancel: INPUT_CANCEL,
          pointerout: INPUT_CANCEL
      };

      // in IE10 the pointer types is defined as an enum
      var IE10_POINTER_TYPE_ENUM = {
          2: INPUT_TYPE_TOUCH,
          3: INPUT_TYPE_PEN,
          4: INPUT_TYPE_MOUSE,
          5: INPUT_TYPE_KINECT // see https://twitter.com/jacobrossi/status/480596438489890816
      };

      var POINTER_ELEMENT_EVENTS = 'pointerdown';
      var POINTER_WINDOW_EVENTS = 'pointermove pointerup pointercancel';

      // IE10 has prefixed support, and case-sensitive
      if (window.MSPointerEvent && !window.PointerEvent) {
          POINTER_ELEMENT_EVENTS = 'MSPointerDown';
          POINTER_WINDOW_EVENTS = 'MSPointerMove MSPointerUp MSPointerCancel';
      }

      /**
       * Pointer events input
       * @constructor
       * @extends Input
       */
      function PointerEventInput() {
          this.evEl = POINTER_ELEMENT_EVENTS;
          this.evWin = POINTER_WINDOW_EVENTS;

          Input.apply(this, arguments);

          this.store = this.manager.session.pointerEvents = [];
      }

      inherit(PointerEventInput, Input, {
          /**
           * handle mouse events
           * @param {Object} ev
           */
          handler: function PEhandler(ev) {
              var store = this.store;
              var removePointer = false;

              var eventTypeNormalized = ev.type.toLowerCase().replace('ms', '');
              var eventType = POINTER_INPUT_MAP[eventTypeNormalized];
              var pointerType = IE10_POINTER_TYPE_ENUM[ev.pointerType] || ev.pointerType;

              var isTouch = pointerType == INPUT_TYPE_TOUCH;

              // get index of the event in the store
              var storeIndex = inArray(store, ev.pointerId, 'pointerId');

              // start and mouse must be down
              if (eventType & INPUT_START && (ev.button === 0 || isTouch)) {
                  if (storeIndex < 0) {
                      store.push(ev);
                      storeIndex = store.length - 1;
                  }
              } else if (eventType & (INPUT_END | INPUT_CANCEL)) {
                  removePointer = true;
              }

              // it not found, so the pointer hasn't been down (so it's probably a hover)
              if (storeIndex < 0) {
                  return;
              }

              // update the event in the store
              store[storeIndex] = ev;

              this.callback(this.manager, eventType, {
                  pointers: store,
                  changedPointers: [ev],
                  pointerType: pointerType,
                  srcEvent: ev
              });

              if (removePointer) {
                  // remove from the store
                  store.splice(storeIndex, 1);
              }
          }
      });

      var SINGLE_TOUCH_INPUT_MAP = {
          touchstart: INPUT_START,
          touchmove: INPUT_MOVE,
          touchend: INPUT_END,
          touchcancel: INPUT_CANCEL
      };

      var SINGLE_TOUCH_TARGET_EVENTS = 'touchstart';
      var SINGLE_TOUCH_WINDOW_EVENTS = 'touchstart touchmove touchend touchcancel';

      /**
       * Touch events input
       * @constructor
       * @extends Input
       */
      function SingleTouchInput() {
          this.evTarget = SINGLE_TOUCH_TARGET_EVENTS;
          this.evWin = SINGLE_TOUCH_WINDOW_EVENTS;
          this.started = false;

          Input.apply(this, arguments);
      }

      inherit(SingleTouchInput, Input, {
          handler: function TEhandler(ev) {
              var type = SINGLE_TOUCH_INPUT_MAP[ev.type];

              // should we handle the touch events?
              if (type === INPUT_START) {
                  this.started = true;
              }

              if (!this.started) {
                  return;
              }

              var touches = normalizeSingleTouches.call(this, ev, type);

              // when done, reset the started state
              if (type & (INPUT_END | INPUT_CANCEL) && touches[0].length - touches[1].length === 0) {
                  this.started = false;
              }

              this.callback(this.manager, type, {
                  pointers: touches[0],
                  changedPointers: touches[1],
                  pointerType: INPUT_TYPE_TOUCH,
                  srcEvent: ev
              });
          }
      });

      /**
       * @this {TouchInput}
       * @param {Object} ev
       * @param {Number} type flag
       * @returns {undefined|Array} [all, changed]
       */
      function normalizeSingleTouches(ev, type) {
          var all = toArray(ev.touches);
          var changed = toArray(ev.changedTouches);

          if (type & (INPUT_END | INPUT_CANCEL)) {
              all = uniqueArray(all.concat(changed), 'identifier', true);
          }

          return [all, changed];
      }

      var TOUCH_INPUT_MAP = {
          touchstart: INPUT_START,
          touchmove: INPUT_MOVE,
          touchend: INPUT_END,
          touchcancel: INPUT_CANCEL
      };

      var TOUCH_TARGET_EVENTS = 'touchstart touchmove touchend touchcancel';

      /**
       * Multi-user touch events input
       * @constructor
       * @extends Input
       */
      function TouchInput() {
          this.evTarget = TOUCH_TARGET_EVENTS;
          this.targetIds = {};

          Input.apply(this, arguments);
      }

      inherit(TouchInput, Input, {
          handler: function MTEhandler(ev) {
              var type = TOUCH_INPUT_MAP[ev.type];
              var touches = getTouches.call(this, ev, type);
              if (!touches) {
                  return;
              }

              this.callback(this.manager, type, {
                  pointers: touches[0],
                  changedPointers: touches[1],
                  pointerType: INPUT_TYPE_TOUCH,
                  srcEvent: ev
              });
          }
      });

      /**
       * @this {TouchInput}
       * @param {Object} ev
       * @param {Number} type flag
       * @returns {undefined|Array} [all, changed]
       */
      function getTouches(ev, type) {
          var allTouches = toArray(ev.touches);
          var targetIds = this.targetIds;

          // when there is only one touch, the process can be simplified
          if (type & (INPUT_START | INPUT_MOVE) && allTouches.length === 1) {
              targetIds[allTouches[0].identifier] = true;
              return [allTouches, allTouches];
          }

          var i,
              targetTouches,
              changedTouches = toArray(ev.changedTouches),
              changedTargetTouches = [],
              target = this.target;

          // get target touches from touches
          targetTouches = allTouches.filter(function (touch) {
              return hasParent(touch.target, target);
          });

          // collect touches
          if (type === INPUT_START) {
              i = 0;
              while (i < targetTouches.length) {
                  targetIds[targetTouches[i].identifier] = true;
                  i++;
              }
          }

          // filter changed touches to only contain touches that exist in the collected target ids
          i = 0;
          while (i < changedTouches.length) {
              if (targetIds[changedTouches[i].identifier]) {
                  changedTargetTouches.push(changedTouches[i]);
              }

              // cleanup removed touches
              if (type & (INPUT_END | INPUT_CANCEL)) {
                  delete targetIds[changedTouches[i].identifier];
              }
              i++;
          }

          if (!changedTargetTouches.length) {
              return;
          }

          return [
          // merge targetTouches with changedTargetTouches so it contains ALL touches, including 'end' and 'cancel'
          uniqueArray(targetTouches.concat(changedTargetTouches), 'identifier', true), changedTargetTouches];
      }

      /**
       * Combined touch and mouse input
       *
       * Touch has a higher priority then mouse, and while touching no mouse events are allowed.
       * This because touch devices also emit mouse events while doing a touch.
       *
       * @constructor
       * @extends Input
       */
      function TouchMouseInput() {
          Input.apply(this, arguments);

          var handler = bindFn(this.handler, this);
          this.touch = new TouchInput(this.manager, handler);
          this.mouse = new MouseInput(this.manager, handler);
      }

      inherit(TouchMouseInput, Input, {
          /**
           * handle mouse and touch events
           * @param {Hammer} manager
           * @param {String} inputEvent
           * @param {Object} inputData
           */
          handler: function TMEhandler(manager, inputEvent, inputData) {
              var isTouch = inputData.pointerType == INPUT_TYPE_TOUCH,
                  isMouse = inputData.pointerType == INPUT_TYPE_MOUSE;

              // when we're in a touch event, so  block all upcoming mouse events
              // most mobile browser also emit mouseevents, right after touchstart
              if (isTouch) {
                  this.mouse.allow = false;
              } else if (isMouse && !this.mouse.allow) {
                  return;
              }

              // reset the allowMouse when we're done
              if (inputEvent & (INPUT_END | INPUT_CANCEL)) {
                  this.mouse.allow = true;
              }

              this.callback(manager, inputEvent, inputData);
          },

          /**
           * remove the event listeners
           */
          destroy: function destroy() {
              this.touch.destroy();
              this.mouse.destroy();
          }
      });

      var PREFIXED_TOUCH_ACTION = prefixed(TEST_ELEMENT.style, 'touchAction');
      var NATIVE_TOUCH_ACTION = PREFIXED_TOUCH_ACTION !== undefined;

      // magical touchAction value
      var TOUCH_ACTION_COMPUTE = 'compute';
      var TOUCH_ACTION_AUTO = 'auto';
      var TOUCH_ACTION_MANIPULATION = 'manipulation'; // not implemented
      var TOUCH_ACTION_NONE = 'none';
      var TOUCH_ACTION_PAN_X = 'pan-x';
      var TOUCH_ACTION_PAN_Y = 'pan-y';

      /**
       * Touch Action
       * sets the touchAction property or uses the js alternative
       * @param {Manager} manager
       * @param {String} value
       * @constructor
       */
      function TouchAction(manager, value) {
          this.manager = manager;
          this.set(value);
      }

      TouchAction.prototype = {
          /**
           * set the touchAction value on the element or enable the polyfill
           * @param {String} value
           */
          set: function set(value) {
              // find out the touch-action by the event handlers
              if (value == TOUCH_ACTION_COMPUTE) {
                  value = this.compute();
              }

              if (NATIVE_TOUCH_ACTION && this.manager.element.style) {
                  this.manager.element.style[PREFIXED_TOUCH_ACTION] = value;
              }
              this.actions = value.toLowerCase().trim();
          },

          /**
           * just re-set the touchAction value
           */
          update: function update() {
              this.set(this.manager.options.touchAction);
          },

          /**
           * compute the value for the touchAction property based on the recognizer's settings
           * @returns {String} value
           */
          compute: function compute() {
              var actions = [];
              each(this.manager.recognizers, function (recognizer) {
                  if (boolOrFn(recognizer.options.enable, [recognizer])) {
                      actions = actions.concat(recognizer.getTouchAction());
                  }
              });
              return cleanTouchActions(actions.join(' '));
          },

          /**
           * this method is called on each input cycle and provides the preventing of the browser behavior
           * @param {Object} input
           */
          preventDefaults: function preventDefaults(input) {
              // not needed with native support for the touchAction property
              if (NATIVE_TOUCH_ACTION) {
                  return;
              }

              var srcEvent = input.srcEvent;
              var direction = input.offsetDirection;

              // if the touch action did prevented once this session
              if (this.manager.session.prevented) {
                  srcEvent.preventDefault();
                  return;
              }

              var actions = this.actions;
              var hasNone = inStr(actions, TOUCH_ACTION_NONE);
              var hasPanY = inStr(actions, TOUCH_ACTION_PAN_Y);
              var hasPanX = inStr(actions, TOUCH_ACTION_PAN_X);

              if (hasNone) {
                  //do not prevent defaults if this is a tap gesture

                  var isTapPointer = input.pointers.length === 1;
                  var isTapMovement = input.distance < 2;
                  var isTapTouchTime = input.deltaTime < 250;

                  if (isTapPointer && isTapMovement && isTapTouchTime) {
                      return;
                  }
              }

              if (hasPanX && hasPanY) {
                  // `pan-x pan-y` means browser handles all scrolling/panning, do not prevent
                  return;
              }

              if (hasNone || hasPanY && direction & DIRECTION_HORIZONTAL || hasPanX && direction & DIRECTION_VERTICAL) {
                  return this.preventSrc(srcEvent);
              }
          },

          /**
           * call preventDefault to prevent the browser's default behavior (scrolling in most cases)
           * @param {Object} srcEvent
           */
          preventSrc: function preventSrc(srcEvent) {
              this.manager.session.prevented = true;
              srcEvent.preventDefault();
          }
      };

      /**
       * when the touchActions are collected they are not a valid value, so we need to clean things up. *
       * @param {String} actions
       * @returns {*}
       */
      function cleanTouchActions(actions) {
          // none
          if (inStr(actions, TOUCH_ACTION_NONE)) {
              return TOUCH_ACTION_NONE;
          }

          var hasPanX = inStr(actions, TOUCH_ACTION_PAN_X);
          var hasPanY = inStr(actions, TOUCH_ACTION_PAN_Y);

          // if both pan-x and pan-y are set (different recognizers
          // for different directions, e.g. horizontal pan but vertical swipe?)
          // we need none (as otherwise with pan-x pan-y combined none of these
          // recognizers will work, since the browser would handle all panning
          if (hasPanX && hasPanY) {
              return TOUCH_ACTION_NONE;
          }

          // pan-x OR pan-y
          if (hasPanX || hasPanY) {
              return hasPanX ? TOUCH_ACTION_PAN_X : TOUCH_ACTION_PAN_Y;
          }

          // manipulation
          if (inStr(actions, TOUCH_ACTION_MANIPULATION)) {
              return TOUCH_ACTION_MANIPULATION;
          }

          return TOUCH_ACTION_AUTO;
      }

      /**
       * Recognizer flow explained; *
       * All recognizers have the initial state of POSSIBLE when a input session starts.
       * The definition of a input session is from the first input until the last input, with all it's movement in it. *
       * Example session for mouse-input: mousedown -> mousemove -> mouseup
       *
       * On each recognizing cycle (see Manager.recognize) the .recognize() method is executed
       * which determines with state it should be.
       *
       * If the recognizer has the state FAILED, CANCELLED or RECOGNIZED (equals ENDED), it is reset to
       * POSSIBLE to give it another change on the next cycle.
       *
       *               Possible
       *                  |
       *            +-----+---------------+
       *            |                     |
       *      +-----+-----+               |
       *      |           |               |
       *   Failed      Cancelled          |
       *                          +-------+------+
       *                          |              |
       *                      Recognized       Began
       *                                         |
       *                                      Changed
       *                                         |
       *                                  Ended/Recognized
       */
      var STATE_POSSIBLE = 1;
      var STATE_BEGAN = 2;
      var STATE_CHANGED = 4;
      var STATE_ENDED = 8;
      var STATE_RECOGNIZED = STATE_ENDED;
      var STATE_CANCELLED = 16;
      var STATE_FAILED = 32;

      /**
       * Recognizer
       * Every recognizer needs to extend from this class.
       * @constructor
       * @param {Object} options
       */
      function Recognizer(options) {
          this.options = assign({}, this.defaults, options || {});

          this.id = uniqueId();

          this.manager = null;

          // default is enable true
          this.options.enable = ifUndefined(this.options.enable, true);

          this.state = STATE_POSSIBLE;

          this.simultaneous = {};
          this.requireFail = [];
      }

      Recognizer.prototype = {
          /**
           * @virtual
           * @type {Object}
           */
          defaults: {},

          /**
           * set options
           * @param {Object} options
           * @return {Recognizer}
           */
          set: function set(options) {
              assign(this.options, options);

              // also update the touchAction, in case something changed about the directions/enabled state
              this.manager && this.manager.touchAction.update();
              return this;
          },

          /**
           * recognize simultaneous with an other recognizer.
           * @param {Recognizer} otherRecognizer
           * @returns {Recognizer} this
           */
          recognizeWith: function recognizeWith(otherRecognizer) {
              if (invokeArrayArg(otherRecognizer, 'recognizeWith', this)) {
                  return this;
              }

              var simultaneous = this.simultaneous;
              otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
              if (!simultaneous[otherRecognizer.id]) {
                  simultaneous[otherRecognizer.id] = otherRecognizer;
                  otherRecognizer.recognizeWith(this);
              }
              return this;
          },

          /**
           * drop the simultaneous link. it doesnt remove the link on the other recognizer.
           * @param {Recognizer} otherRecognizer
           * @returns {Recognizer} this
           */
          dropRecognizeWith: function dropRecognizeWith(otherRecognizer) {
              if (invokeArrayArg(otherRecognizer, 'dropRecognizeWith', this)) {
                  return this;
              }

              otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
              delete this.simultaneous[otherRecognizer.id];
              return this;
          },

          /**
           * recognizer can only run when an other is failing
           * @param {Recognizer} otherRecognizer
           * @returns {Recognizer} this
           */
          requireFailure: function requireFailure(otherRecognizer) {
              if (invokeArrayArg(otherRecognizer, 'requireFailure', this)) {
                  return this;
              }

              var requireFail = this.requireFail;
              otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
              if (inArray(requireFail, otherRecognizer) === -1) {
                  requireFail.push(otherRecognizer);
                  otherRecognizer.requireFailure(this);
              }
              return this;
          },

          /**
           * drop the requireFailure link. it does not remove the link on the other recognizer.
           * @param {Recognizer} otherRecognizer
           * @returns {Recognizer} this
           */
          dropRequireFailure: function dropRequireFailure(otherRecognizer) {
              if (invokeArrayArg(otherRecognizer, 'dropRequireFailure', this)) {
                  return this;
              }

              otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
              var index = inArray(this.requireFail, otherRecognizer);
              if (index > -1) {
                  this.requireFail.splice(index, 1);
              }
              return this;
          },

          /**
           * has require failures boolean
           * @returns {boolean}
           */
          hasRequireFailures: function hasRequireFailures() {
              return this.requireFail.length > 0;
          },

          /**
           * if the recognizer can recognize simultaneous with an other recognizer
           * @param {Recognizer} otherRecognizer
           * @returns {Boolean}
           */
          canRecognizeWith: function canRecognizeWith(otherRecognizer) {
              return !!this.simultaneous[otherRecognizer.id];
          },

          /**
           * You should use `tryEmit` instead of `emit` directly to check
           * that all the needed recognizers has failed before emitting.
           * @param {Object} input
           */
          emit: function emit(input) {
              var self = this;
              var state = this.state;

              function emit(event) {
                  self.manager.emit(event, input);
              }

              // 'panstart' and 'panmove'
              if (state < STATE_ENDED) {
                  emit(self.options.event + stateStr(state));
              }

              emit(self.options.event); // simple 'eventName' events

              if (input.additionalEvent) {
                  // additional event(panleft, panright, pinchin, pinchout...)
                  emit(input.additionalEvent);
              }

              // panend and pancancel
              if (state >= STATE_ENDED) {
                  emit(self.options.event + stateStr(state));
              }
          },

          /**
           * Check that all the require failure recognizers has failed,
           * if true, it emits a gesture event,
           * otherwise, setup the state to FAILED.
           * @param {Object} input
           */
          tryEmit: function tryEmit(input) {
              if (this.canEmit()) {
                  return this.emit(input);
              }
              // it's failing anyway
              this.state = STATE_FAILED;
          },

          /**
           * can we emit?
           * @returns {boolean}
           */
          canEmit: function canEmit() {
              var i = 0;
              while (i < this.requireFail.length) {
                  if (!(this.requireFail[i].state & (STATE_FAILED | STATE_POSSIBLE))) {
                      return false;
                  }
                  i++;
              }
              return true;
          },

          /**
           * update the recognizer
           * @param {Object} inputData
           */
          recognize: function recognize(inputData) {
              // make a new copy of the inputData
              // so we can change the inputData without messing up the other recognizers
              var inputDataClone = assign({}, inputData);

              // is is enabled and allow recognizing?
              if (!boolOrFn(this.options.enable, [this, inputDataClone])) {
                  this.reset();
                  this.state = STATE_FAILED;
                  return;
              }

              // reset when we've reached the end
              if (this.state & (STATE_RECOGNIZED | STATE_CANCELLED | STATE_FAILED)) {
                  this.state = STATE_POSSIBLE;
              }

              this.state = this.process(inputDataClone);

              // the recognizer has recognized a gesture
              // so trigger an event
              if (this.state & (STATE_BEGAN | STATE_CHANGED | STATE_ENDED | STATE_CANCELLED)) {
                  this.tryEmit(inputDataClone);
              }
          },

          /**
           * return the state of the recognizer
           * the actual recognizing happens in this method
           * @virtual
           * @param {Object} inputData
           * @returns {Const} STATE
           */
          process: function process(inputData) {}, // jshint ignore:line

          /**
           * return the preferred touch-action
           * @virtual
           * @returns {Array}
           */
          getTouchAction: function getTouchAction() {},

          /**
           * called when the gesture isn't allowed to recognize
           * like when another is being recognized or it is disabled
           * @virtual
           */
          reset: function reset() {}
      };

      /**
       * get a usable string, used as event postfix
       * @param {Const} state
       * @returns {String} state
       */
      function stateStr(state) {
          if (state & STATE_CANCELLED) {
              return 'cancel';
          } else if (state & STATE_ENDED) {
              return 'end';
          } else if (state & STATE_CHANGED) {
              return 'move';
          } else if (state & STATE_BEGAN) {
              return 'start';
          }
          return '';
      }

      /**
       * direction cons to string
       * @param {Const} direction
       * @returns {String}
       */
      function directionStr(direction) {
          if (direction == DIRECTION_DOWN) {
              return 'down';
          } else if (direction == DIRECTION_UP) {
              return 'up';
          } else if (direction == DIRECTION_LEFT) {
              return 'left';
          } else if (direction == DIRECTION_RIGHT) {
              return 'right';
          }
          return '';
      }

      /**
       * get a recognizer by name if it is bound to a manager
       * @param {Recognizer|String} otherRecognizer
       * @param {Recognizer} recognizer
       * @returns {Recognizer}
       */
      function getRecognizerByNameIfManager(otherRecognizer, recognizer) {
          var manager = recognizer.manager;
          if (manager) {
              return manager.get(otherRecognizer);
          }
          return otherRecognizer;
      }

      /**
       * This recognizer is just used as a base for the simple attribute recognizers.
       * @constructor
       * @extends Recognizer
       */
      function AttrRecognizer() {
          Recognizer.apply(this, arguments);
      }

      inherit(AttrRecognizer, Recognizer, {
          /**
           * @namespace
           * @memberof AttrRecognizer
           */
          defaults: {
              /**
               * @type {Number}
               * @default 1
               */
              pointers: 1
          },

          /**
           * Used to check if it the recognizer receives valid input, like input.distance > 10.
           * @memberof AttrRecognizer
           * @param {Object} input
           * @returns {Boolean} recognized
           */
          attrTest: function attrTest(input) {
              var optionPointers = this.options.pointers;
              return optionPointers === 0 || input.pointers.length === optionPointers;
          },

          /**
           * Process the input and return the state for the recognizer
           * @memberof AttrRecognizer
           * @param {Object} input
           * @returns {*} State
           */
          process: function process(input) {
              var state = this.state;
              var eventType = input.eventType;

              var isRecognized = state & (STATE_BEGAN | STATE_CHANGED);
              var isValid = this.attrTest(input);

              // on cancel input and we've recognized before, return STATE_CANCELLED
              if (isRecognized && (eventType & INPUT_CANCEL || !isValid)) {
                  return state | STATE_CANCELLED;
              } else if (isRecognized || isValid) {
                  if (eventType & INPUT_END) {
                      return state | STATE_ENDED;
                  } else if (!(state & STATE_BEGAN)) {
                      return STATE_BEGAN;
                  }
                  return state | STATE_CHANGED;
              }
              return STATE_FAILED;
          }
      });

      /**
       * Pan
       * Recognized when the pointer is down and moved in the allowed direction.
       * @constructor
       * @extends AttrRecognizer
       */
      function PanRecognizer() {
          AttrRecognizer.apply(this, arguments);

          this.pX = null;
          this.pY = null;
      }

      inherit(PanRecognizer, AttrRecognizer, {
          /**
           * @namespace
           * @memberof PanRecognizer
           */
          defaults: {
              event: 'pan',
              threshold: 10,
              pointers: 1,
              direction: DIRECTION_ALL
          },

          getTouchAction: function getTouchAction() {
              var direction = this.options.direction;
              var actions = [];
              if (direction & DIRECTION_HORIZONTAL) {
                  actions.push(TOUCH_ACTION_PAN_Y);
              }
              if (direction & DIRECTION_VERTICAL) {
                  actions.push(TOUCH_ACTION_PAN_X);
              }
              return actions;
          },

          directionTest: function directionTest(input) {
              var options = this.options;
              var hasMoved = true;
              var distance = input.distance;
              var direction = input.direction;
              var x = input.deltaX;
              var y = input.deltaY;

              // lock to axis?
              if (!(direction & options.direction)) {
                  if (options.direction & DIRECTION_HORIZONTAL) {
                      direction = x === 0 ? DIRECTION_NONE : x < 0 ? DIRECTION_LEFT : DIRECTION_RIGHT;
                      hasMoved = x != this.pX;
                      distance = Math.abs(input.deltaX);
                  } else {
                      direction = y === 0 ? DIRECTION_NONE : y < 0 ? DIRECTION_UP : DIRECTION_DOWN;
                      hasMoved = y != this.pY;
                      distance = Math.abs(input.deltaY);
                  }
              }
              input.direction = direction;
              return hasMoved && distance > options.threshold && direction & options.direction;
          },

          attrTest: function attrTest(input) {
              return AttrRecognizer.prototype.attrTest.call(this, input) && (this.state & STATE_BEGAN || !(this.state & STATE_BEGAN) && this.directionTest(input));
          },

          emit: function emit(input) {

              this.pX = input.deltaX;
              this.pY = input.deltaY;

              var direction = directionStr(input.direction);

              if (direction) {
                  input.additionalEvent = this.options.event + direction;
              }
              this._super.emit.call(this, input);
          }
      });

      /**
       * Pinch
       * Recognized when two or more pointers are moving toward (zoom-in) or away from each other (zoom-out).
       * @constructor
       * @extends AttrRecognizer
       */
      function PinchRecognizer() {
          AttrRecognizer.apply(this, arguments);
      }

      inherit(PinchRecognizer, AttrRecognizer, {
          /**
           * @namespace
           * @memberof PinchRecognizer
           */
          defaults: {
              event: 'pinch',
              threshold: 0,
              pointers: 2
          },

          getTouchAction: function getTouchAction() {
              return [TOUCH_ACTION_NONE];
          },

          attrTest: function attrTest(input) {
              return this._super.attrTest.call(this, input) && (Math.abs(input.scale - 1) > this.options.threshold || this.state & STATE_BEGAN);
          },

          emit: function emit(input) {
              if (input.scale !== 1) {
                  var inOut = input.scale < 1 ? 'in' : 'out';
                  input.additionalEvent = this.options.event + inOut;
              }
              this._super.emit.call(this, input);
          }
      });

      /**
       * Press
       * Recognized when the pointer is down for x ms without any movement.
       * @constructor
       * @extends Recognizer
       */
      function PressRecognizer() {
          Recognizer.apply(this, arguments);

          this._timer = null;
          this._input = null;
      }

      inherit(PressRecognizer, Recognizer, {
          /**
           * @namespace
           * @memberof PressRecognizer
           */
          defaults: {
              event: 'press',
              pointers: 1,
              time: 251, // minimal time of the pointer to be pressed
              threshold: 9 // a minimal movement is ok, but keep it low
          },

          getTouchAction: function getTouchAction() {
              return [TOUCH_ACTION_AUTO];
          },

          process: function process(input) {
              var options = this.options;
              var validPointers = input.pointers.length === options.pointers;
              var validMovement = input.distance < options.threshold;
              var validTime = input.deltaTime > options.time;

              this._input = input;

              // we only allow little movement
              // and we've reached an end event, so a tap is possible
              if (!validMovement || !validPointers || input.eventType & (INPUT_END | INPUT_CANCEL) && !validTime) {
                  this.reset();
              } else if (input.eventType & INPUT_START) {
                  this.reset();
                  this._timer = setTimeoutContext(function () {
                      this.state = STATE_RECOGNIZED;
                      this.tryEmit();
                  }, options.time, this);
              } else if (input.eventType & INPUT_END) {
                  return STATE_RECOGNIZED;
              }
              return STATE_FAILED;
          },

          reset: function reset() {
              clearTimeout(this._timer);
          },

          emit: function emit(input) {
              if (this.state !== STATE_RECOGNIZED) {
                  return;
              }

              if (input && input.eventType & INPUT_END) {
                  this.manager.emit(this.options.event + 'up', input);
              } else {
                  this._input.timeStamp = now();
                  this.manager.emit(this.options.event, this._input);
              }
          }
      });

      /**
       * Rotate
       * Recognized when two or more pointer are moving in a circular motion.
       * @constructor
       * @extends AttrRecognizer
       */
      function RotateRecognizer() {
          AttrRecognizer.apply(this, arguments);
      }

      inherit(RotateRecognizer, AttrRecognizer, {
          /**
           * @namespace
           * @memberof RotateRecognizer
           */
          defaults: {
              event: 'rotate',
              threshold: 0,
              pointers: 2
          },

          getTouchAction: function getTouchAction() {
              return [TOUCH_ACTION_NONE];
          },

          attrTest: function attrTest(input) {
              return this._super.attrTest.call(this, input) && (Math.abs(input.rotation) > this.options.threshold || this.state & STATE_BEGAN);
          }
      });

      /**
       * Swipe
       * Recognized when the pointer is moving fast (velocity), with enough distance in the allowed direction.
       * @constructor
       * @extends AttrRecognizer
       */
      function SwipeRecognizer() {
          AttrRecognizer.apply(this, arguments);
      }

      inherit(SwipeRecognizer, AttrRecognizer, {
          /**
           * @namespace
           * @memberof SwipeRecognizer
           */
          defaults: {
              event: 'swipe',
              threshold: 10,
              velocity: 0.3,
              direction: DIRECTION_HORIZONTAL | DIRECTION_VERTICAL,
              pointers: 1
          },

          getTouchAction: function getTouchAction() {
              return PanRecognizer.prototype.getTouchAction.call(this);
          },

          attrTest: function attrTest(input) {
              var direction = this.options.direction;
              var velocity;

              if (direction & (DIRECTION_HORIZONTAL | DIRECTION_VERTICAL)) {
                  velocity = input.overallVelocity;
              } else if (direction & DIRECTION_HORIZONTAL) {
                  velocity = input.overallVelocityX;
              } else if (direction & DIRECTION_VERTICAL) {
                  velocity = input.overallVelocityY;
              }

              return this._super.attrTest.call(this, input) && direction & input.offsetDirection && input.distance > this.options.threshold && input.maxPointers == this.options.pointers && abs(velocity) > this.options.velocity && input.eventType & INPUT_END;
          },

          emit: function emit(input) {
              var direction = directionStr(input.offsetDirection);
              if (direction) {
                  this.manager.emit(this.options.event + direction, input);
              }

              this.manager.emit(this.options.event, input);
          }
      });

      /**
       * A tap is ecognized when the pointer is doing a small tap/click. Multiple taps are recognized if they occur
       * between the given interval and position. The delay option can be used to recognize multi-taps without firing
       * a single tap.
       *
       * The eventData from the emitted event contains the property `tapCount`, which contains the amount of
       * multi-taps being recognized.
       * @constructor
       * @extends Recognizer
       */
      function TapRecognizer() {
          Recognizer.apply(this, arguments);

          // previous time and center,
          // used for tap counting
          this.pTime = false;
          this.pCenter = false;

          this._timer = null;
          this._input = null;
          this.count = 0;
      }

      inherit(TapRecognizer, Recognizer, {
          /**
           * @namespace
           * @memberof PinchRecognizer
           */
          defaults: {
              event: 'tap',
              pointers: 1,
              taps: 1,
              interval: 300, // max time between the multi-tap taps
              time: 250, // max time of the pointer to be down (like finger on the screen)
              threshold: 9, // a minimal movement is ok, but keep it low
              posThreshold: 10 // a multi-tap can be a bit off the initial position
          },

          getTouchAction: function getTouchAction() {
              return [TOUCH_ACTION_MANIPULATION];
          },

          process: function process(input) {
              var options = this.options;

              var validPointers = input.pointers.length === options.pointers;
              var validMovement = input.distance < options.threshold;
              var validTouchTime = input.deltaTime < options.time;

              this.reset();

              if (input.eventType & INPUT_START && this.count === 0) {
                  return this.failTimeout();
              }

              // we only allow little movement
              // and we've reached an end event, so a tap is possible
              if (validMovement && validTouchTime && validPointers) {
                  if (input.eventType != INPUT_END) {
                      return this.failTimeout();
                  }

                  var validInterval = this.pTime ? input.timeStamp - this.pTime < options.interval : true;
                  var validMultiTap = !this.pCenter || getDistance(this.pCenter, input.center) < options.posThreshold;

                  this.pTime = input.timeStamp;
                  this.pCenter = input.center;

                  if (!validMultiTap || !validInterval) {
                      this.count = 1;
                  } else {
                      this.count += 1;
                  }

                  this._input = input;

                  // if tap count matches we have recognized it,
                  // else it has began recognizing...
                  var tapCount = this.count % options.taps;
                  if (tapCount === 0) {
                      // no failing requirements, immediately trigger the tap event
                      // or wait as long as the multitap interval to trigger
                      if (!this.hasRequireFailures()) {
                          return STATE_RECOGNIZED;
                      } else {
                          this._timer = setTimeoutContext(function () {
                              this.state = STATE_RECOGNIZED;
                              this.tryEmit();
                          }, options.interval, this);
                          return STATE_BEGAN;
                      }
                  }
              }
              return STATE_FAILED;
          },

          failTimeout: function failTimeout() {
              this._timer = setTimeoutContext(function () {
                  this.state = STATE_FAILED;
              }, this.options.interval, this);
              return STATE_FAILED;
          },

          reset: function reset() {
              clearTimeout(this._timer);
          },

          emit: function emit() {
              if (this.state == STATE_RECOGNIZED) {
                  this._input.tapCount = this.count;
                  this.manager.emit(this.options.event, this._input);
              }
          }
      });

      /**
       * Simple way to create a manager with a default set of recognizers.
       * @param {HTMLElement} element
       * @param {Object} [options]
       * @constructor
       */
      function Hammer(element, options) {
          options = options || {};
          options.recognizers = ifUndefined(options.recognizers, Hammer.defaults.preset);
          return new Manager(element, options);
      }

      /**
       * @const {string}
       */
      Hammer.VERSION = '2.0.6';

      /**
       * default settings
       * @namespace
       */
      Hammer.defaults = {
          /**
           * set if DOM events are being triggered.
           * But this is slower and unused by simple implementations, so disabled by default.
           * @type {Boolean}
           * @default false
           */
          domEvents: false,

          /**
           * The value for the touchAction property/fallback.
           * When set to `compute` it will magically set the correct value based on the added recognizers.
           * @type {String}
           * @default compute
           */
          touchAction: TOUCH_ACTION_COMPUTE,

          /**
           * @type {Boolean}
           * @default true
           */
          enable: true,

          /**
           * EXPERIMENTAL FEATURE -- can be removed/changed
           * Change the parent input target element.
           * If Null, then it is being set the to main element.
           * @type {Null|EventTarget}
           * @default null
           */
          inputTarget: null,

          /**
           * force an input class
           * @type {Null|Function}
           * @default null
           */
          inputClass: null,

          /**
           * Default recognizer setup when calling `Hammer()`
           * When creating a new Manager these will be skipped.
           * @type {Array}
           */
          preset: [
          // RecognizerClass, options, [recognizeWith, ...], [requireFailure, ...]
          [RotateRecognizer, { enable: false }], [PinchRecognizer, { enable: false }, ['rotate']], [SwipeRecognizer, { direction: DIRECTION_HORIZONTAL }], [PanRecognizer, { direction: DIRECTION_HORIZONTAL }, ['swipe']], [TapRecognizer], [TapRecognizer, { event: 'doubletap', taps: 2 }, ['tap']], [PressRecognizer]],

          /**
           * Some CSS properties can be used to improve the working of Hammer.
           * Add them to this method and they will be set when creating a new Manager.
           * @namespace
           */
          cssProps: {
              /**
               * Disables text selection to improve the dragging gesture. Mainly for desktop browsers.
               * @type {String}
               * @default 'none'
               */
              userSelect: 'none',

              /**
               * Disable the Windows Phone grippers when pressing an element.
               * @type {String}
               * @default 'none'
               */
              touchSelect: 'none',

              /**
               * Disables the default callout shown when you touch and hold a touch target.
               * On iOS, when you touch and hold a touch target such as a link, Safari displays
               * a callout containing information about the link. This property allows you to disable that callout.
               * @type {String}
               * @default 'none'
               */
              touchCallout: 'none',

              /**
               * Specifies whether zooming is enabled. Used by IE10>
               * @type {String}
               * @default 'none'
               */
              contentZooming: 'none',

              /**
               * Specifies that an entire element should be draggable instead of its contents. Mainly for desktop browsers.
               * @type {String}
               * @default 'none'
               */
              userDrag: 'none',

              /**
               * Overrides the highlight color shown when the user taps a link or a JavaScript
               * clickable element in iOS. This property obeys the alpha value, if specified.
               * @type {String}
               * @default 'rgba(0,0,0,0)'
               */
              tapHighlightColor: 'rgba(0,0,0,0)'
          }
      };

      var STOP = 1;
      var FORCED_STOP = 2;

      /**
       * Manager
       * @param {HTMLElement} element
       * @param {Object} [options]
       * @constructor
       */
      function Manager(element, options) {
          this.options = assign({}, Hammer.defaults, options || {});

          this.options.inputTarget = this.options.inputTarget || element;

          this.handlers = {};
          this.session = {};
          this.recognizers = [];

          this.element = element;
          this.input = createInputInstance(this);
          this.touchAction = new TouchAction(this, this.options.touchAction);

          toggleCssProps(this, true);

          each(this.options.recognizers, function (item) {
              var recognizer = this.add(new item[0](item[1]));
              item[2] && recognizer.recognizeWith(item[2]);
              item[3] && recognizer.requireFailure(item[3]);
          }, this);
      }

      Manager.prototype = {
          /**
           * set options
           * @param {Object} options
           * @returns {Manager}
           */
          set: function set(options) {
              assign(this.options, options);

              // Options that need a little more setup
              if (options.touchAction) {
                  this.touchAction.update();
              }
              if (options.inputTarget) {
                  // Clean up existing event listeners and reinitialize
                  this.input.destroy();
                  this.input.target = options.inputTarget;
                  this.input.init();
              }
              return this;
          },

          /**
           * stop recognizing for this session.
           * This session will be discarded, when a new [input]start event is fired.
           * When forced, the recognizer cycle is stopped immediately.
           * @param {Boolean} [force]
           */
          stop: function stop(force) {
              this.session.stopped = force ? FORCED_STOP : STOP;
          },

          /**
           * run the recognizers!
           * called by the inputHandler function on every movement of the pointers (touches)
           * it walks through all the recognizers and tries to detect the gesture that is being made
           * @param {Object} inputData
           */
          recognize: function recognize(inputData) {
              var session = this.session;
              if (session.stopped) {
                  return;
              }

              // run the touch-action polyfill
              this.touchAction.preventDefaults(inputData);

              var recognizer;
              var recognizers = this.recognizers;

              // this holds the recognizer that is being recognized.
              // so the recognizer's state needs to be BEGAN, CHANGED, ENDED or RECOGNIZED
              // if no recognizer is detecting a thing, it is set to `null`
              var curRecognizer = session.curRecognizer;

              // reset when the last recognizer is recognized
              // or when we're in a new session
              if (!curRecognizer || curRecognizer && curRecognizer.state & STATE_RECOGNIZED) {
                  curRecognizer = session.curRecognizer = null;
              }

              var i = 0;
              while (i < recognizers.length) {
                  recognizer = recognizers[i];

                  // find out if we are allowed try to recognize the input for this one.
                  // 1.   allow if the session is NOT forced stopped (see the .stop() method)
                  // 2.   allow if we still haven't recognized a gesture in this session, or the this recognizer is the one
                  //      that is being recognized.
                  // 3.   allow if the recognizer is allowed to run simultaneous with the current recognized recognizer.
                  //      this can be setup with the `recognizeWith()` method on the recognizer.
                  if (session.stopped !== FORCED_STOP && ( // 1
                  !curRecognizer || recognizer == curRecognizer || // 2
                  recognizer.canRecognizeWith(curRecognizer))) {
                      // 3
                      recognizer.recognize(inputData);
                  } else {
                      recognizer.reset();
                  }

                  // if the recognizer has been recognizing the input as a valid gesture, we want to store this one as the
                  // current active recognizer. but only if we don't already have an active recognizer
                  if (!curRecognizer && recognizer.state & (STATE_BEGAN | STATE_CHANGED | STATE_ENDED)) {
                      curRecognizer = session.curRecognizer = recognizer;
                  }
                  i++;
              }
          },

          /**
           * get a recognizer by its event name.
           * @param {Recognizer|String} recognizer
           * @returns {Recognizer|Null}
           */
          get: function get(recognizer) {
              if (recognizer instanceof Recognizer) {
                  return recognizer;
              }

              var recognizers = this.recognizers;
              for (var i = 0; i < recognizers.length; i++) {
                  if (recognizers[i].options.event == recognizer) {
                      return recognizers[i];
                  }
              }
              return null;
          },

          /**
           * add a recognizer to the manager
           * existing recognizers with the same event name will be removed
           * @param {Recognizer} recognizer
           * @returns {Recognizer|Manager}
           */
          add: function add(recognizer) {
              if (invokeArrayArg(recognizer, 'add', this)) {
                  return this;
              }

              // remove existing
              var existing = this.get(recognizer.options.event);
              if (existing) {
                  this.remove(existing);
              }

              this.recognizers.push(recognizer);
              recognizer.manager = this;

              this.touchAction.update();
              return recognizer;
          },

          /**
           * remove a recognizer by name or instance
           * @param {Recognizer|String} recognizer
           * @returns {Manager}
           */
          remove: function remove(recognizer) {
              if (invokeArrayArg(recognizer, 'remove', this)) {
                  return this;
              }

              recognizer = this.get(recognizer);

              // let's make sure this recognizer exists
              if (recognizer) {
                  var recognizers = this.recognizers;
                  var index = inArray(recognizers, recognizer);

                  if (index !== -1) {
                      recognizers.splice(index, 1);
                      this.touchAction.update();
                  }
              }

              return this;
          },

          /**
           * bind event
           * @param {String} events
           * @param {Function} handler
           * @returns {EventEmitter} this
           */
          on: function on(events, handler) {
              var handlers = this.handlers;
              each(splitStr(events), function (event) {
                  handlers[event] = handlers[event] || [];
                  handlers[event].push(handler);
              });
              return this;
          },

          /**
           * unbind event, leave emit blank to remove all handlers
           * @param {String} events
           * @param {Function} [handler]
           * @returns {EventEmitter} this
           */
          off: function off(events, handler) {
              var handlers = this.handlers;
              each(splitStr(events), function (event) {
                  if (!handler) {
                      delete handlers[event];
                  } else {
                      handlers[event] && handlers[event].splice(inArray(handlers[event], handler), 1);
                  }
              });
              return this;
          },

          /**
           * emit event to the listeners
           * @param {String} event
           * @param {Object} data
           */
          emit: function emit(event, data) {
              // we also want to trigger dom events
              if (this.options.domEvents) {
                  triggerDomEvent(event, data);
              }

              // no handlers, so skip it all
              var handlers = this.handlers[event] && this.handlers[event].slice();
              if (!handlers || !handlers.length) {
                  return;
              }

              data.type = event;
              data.preventDefault = function () {
                  data.srcEvent.preventDefault();
              };

              var i = 0;
              while (i < handlers.length) {
                  handlers[i](data);
                  i++;
              }
          },

          /**
           * destroy the manager and unbinds all events
           * it doesn't unbind dom events, that is the user own responsibility
           */
          destroy: function destroy() {
              this.element && toggleCssProps(this, false);

              this.handlers = {};
              this.session = {};
              this.input.destroy();
              this.element = null;
          }
      };

      /**
       * add/remove the css properties as defined in manager.options.cssProps
       * @param {Manager} manager
       * @param {Boolean} add
       */
      function toggleCssProps(manager, add) {
          var element = manager.element;
          if (!element.style) {
              return;
          }
          each(manager.options.cssProps, function (value, name) {
              element.style[prefixed(element.style, name)] = add ? value : '';
          });
      }

      /**
       * trigger dom event
       * @param {String} event
       * @param {Object} data
       */
      function triggerDomEvent(event, data) {
          var gestureEvent = document.createEvent('Event');
          gestureEvent.initEvent(event, true, true);
          gestureEvent.gesture = data;
          data.target.dispatchEvent(gestureEvent);
      }

      assign(Hammer, {
          INPUT_START: INPUT_START,
          INPUT_MOVE: INPUT_MOVE,
          INPUT_END: INPUT_END,
          INPUT_CANCEL: INPUT_CANCEL,

          STATE_POSSIBLE: STATE_POSSIBLE,
          STATE_BEGAN: STATE_BEGAN,
          STATE_CHANGED: STATE_CHANGED,
          STATE_ENDED: STATE_ENDED,
          STATE_RECOGNIZED: STATE_RECOGNIZED,
          STATE_CANCELLED: STATE_CANCELLED,
          STATE_FAILED: STATE_FAILED,

          DIRECTION_NONE: DIRECTION_NONE,
          DIRECTION_LEFT: DIRECTION_LEFT,
          DIRECTION_RIGHT: DIRECTION_RIGHT,
          DIRECTION_UP: DIRECTION_UP,
          DIRECTION_DOWN: DIRECTION_DOWN,
          DIRECTION_HORIZONTAL: DIRECTION_HORIZONTAL,
          DIRECTION_VERTICAL: DIRECTION_VERTICAL,
          DIRECTION_ALL: DIRECTION_ALL,

          Manager: Manager,
          Input: Input,
          TouchAction: TouchAction,

          TouchInput: TouchInput,
          MouseInput: MouseInput,
          PointerEventInput: PointerEventInput,
          TouchMouseInput: TouchMouseInput,
          SingleTouchInput: SingleTouchInput,

          Recognizer: Recognizer,
          AttrRecognizer: AttrRecognizer,
          Tap: TapRecognizer,
          Pan: PanRecognizer,
          Swipe: SwipeRecognizer,
          Pinch: PinchRecognizer,
          Rotate: RotateRecognizer,
          Press: PressRecognizer,

          on: addEventListeners,
          off: removeEventListeners,
          each: each,
          merge: merge,
          extend: extend,
          assign: assign,
          inherit: inherit,
          bindFn: bindFn,
          prefixed: prefixed
      });

      // this prevents errors when Hammer is loaded in the presence of an AMD
      //  style loader but by script tag, not by the loader.
      var freeGlobal = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {}; // jshint ignore:line
      freeGlobal.Hammer = Hammer;

      if (typeof define === 'function' && define.amd) {
          define(function () {
              return Hammer;
          });
      } else if (typeof module != 'undefined' && module.exports) {
          module.exports = Hammer;
      } else {
          window[exportName] = Hammer;
      }
  })(window, document, 'Hammer');
  });

  var Hammer = (hammer && typeof hammer === 'object' && 'default' in hammer ? hammer['default'] : hammer);

  var hammertime = new Hammer(document.body);

  // Handles movement based input
  kran.system({
  	components: [components.inputMovement],
  	moveDelta: { x: 0, y: 0 },
  	currentKey: '',
  	keys: {},
  	id: 0,

  	init: function init() {
  		this.initKeyboardInput();
  		this.initTouchInput();
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

  	resetKeys: function resetKeys() {
  		for (var name in this.keys) {
  			this.keys[name].down = false;
  		}
  	},

  	keyChanged: function keyChanged(key, down) {
  		// Change key state and increment ID
  		this.keys[key].down = down;
  		if (down) {
  			this.keys[key].lastId = ++this.id;
  		}
  	},

  	// Setup keyboard input
  	bindKey: function bindKey(key) {
  		var _this = this;

  		Mousetrap$1.bind(key, function () {
  			_this.keyChanged(key, true);
  		}, 'keydown');
  		Mousetrap$1.bind(key, function () {
  			_this.keyChanged(key, false);
  		}, 'keyup');
  	},

  	initKeyboardInput: function initKeyboardInput() {
  		this.keys = {
  			w: this.makeKey(0, -1),
  			a: this.makeKey(-1, 0),
  			s: this.makeKey(0, 1),
  			d: this.makeKey(1, 0)
  		};
  		for (var key in this.keys) {
  			this.bindKey(key);
  		}
  	},

  	initTouchInput: function initTouchInput() {
  		var _this2 = this;

  		hammertime.on('panleft panright panup pandown', function (ev) {
  			// Map angle to key/direction based on 90 degree-wide sector
  			var angle = ev.angle;
  			_this2.currentKey = '';
  			if (angle >= -45 && angle < 45) {
  				_this2.currentKey = 'd';
  			} else if (angle >= 45 && angle < 135) {
  				_this2.currentKey = 's';
  			} else if (angle >= -135 && angle < -45) {
  				_this2.currentKey = 'w';
  			} else if (angle >= 135 || angle < -135) {
  				_this2.currentKey = 'a';
  			}

  			_this2.resetKeys();
  			_this2.keyChanged(_this2.currentKey, true);
  		});
  		hammertime.on('panend', function (ev) {
  			_this2.currentKey = '';
  			_this2.resetKeys();
  		});
  	}
  });

  // Handles slice rotating input
  kran.system({
  	components: [components.inputRotate],
  	actions: [],
  	initKeyboardInput: function initKeyboardInput() {
  		var _this3 = this;

  		// Absolute based keys
  		Mousetrap$1.bind('up', function () {
  			_this3.actions.push(true);
  		});
  		Mousetrap$1.bind('down', function () {
  			_this3.actions.push(false);
  		});

  		// Toggle based keys
  		Mousetrap$1.bind('space', function () {
  			_this3.actions.push('toggle');
  		});
  	},
  	initTouchInput: function initTouchInput() {
  		var _this4 = this;

  		hammertime.on('tap', function () {
  			_this4.actions.push('toggle');
  		});
  	},
  	init: function init() {
  		this.initKeyboardInput();
  		this.initTouchInput();
  	},
  	every: function every(input) {
  		// Copy global actions to components
  		for (var i in this.actions) {
  			input.actions.push(this.actions[i]);
  		}
  		this.actions.length = 0;
  	}
  });

  // Handles checkpoint restores
  kran.system({
  	components: [components.inputCheckpoint],
  	triggered: false,
  	initKeyboardInput: function initKeyboardInput() {
  		var _this5 = this;

  		Mousetrap$1.bind('esc', function () {
  			_this5.triggered = true;
  		});
  	},
  	initTouchInput: function initTouchInput() {
  		var _this6 = this;

  		// Setup pinch input
  		hammertime.get('pinch').set({ enable: true });
  		hammertime.on('pinchin', function (ev) {
  			_this6.triggered = true;
  		});
  	},
  	init: function init() {
  		this.initKeyboardInput();
  		this.initTouchInput();
  	},
  	every: function every(input) {
  		// Invoke callbacks on components
  		if (this.triggered) {
  			input.puzzleCallback();
  			this.triggered = false;
  		}
  	}
  });

  var layers = { "0": { "16,6": 2, "21,10": 2, "21,16": 2, "20,6": 2, "21,11": 2, "21,21": 2, "17,6": 2, "4,9": 2, "5,6": 2, "3,9": 2, "6,6": 2, "5,10": 2, "3,6": 2, "21,7": 2, "21,14": 2, "21,13": 2, "4,6": 2, "5,11": 2, "7,6": 2, "4,10": 0, "19,6": 2, "3,10": 2, "21,17": 2, "13,6": 2, "8,6": 2, "21,9": 2, "21,15": 2, "21,18": 2, "14,6": 2, "3,11": 2, "10,6": 2, "12,6": 2, "21,6": 2, "21,12": 2, "15,6": 2, "21,20": 2, "3,5": 2, "21,8": 2, "4,11": 0, "9,6": 2, "21,19": 2, "18,6": 2, "5,9": 2, "11,6": 2 }, "1": { "10,8": 0, "22,7": 67, "38,24": 2, "42,31": 2, "35,28": 2, "12,8": 0, "39,21": 2, "38,29": 2, "40,30": 2, "37,30": 78, "38,27": 2, "4,9": 0, "14,9": 2, "39,29": 50, "38,30": 2, "18,2": 67, "40,29": 2, "23,8": 2, "3,9": 2, "42,25": 2, "10,7": 0, "41,30": 20, "5,10": 0, "9,10": 2, "41,26": 23, "39,31": 2, "40,24": 2, "11,9": 0, "43,23": 2, "17,2": 67, "43,31": 2, "36,31": 2, "39,23": 2, "13,7": 0, "18,3": 2, "35,29": 2, "40,27": 2, "42,29": 2, "37,31": 2, "37,25": 74, "4,10": 0, "43,25": 2, "37,23": 2, "37,26": 81, "10,9": 2, "38,28": 2, "35,31": 2, "38,31": 2, "41,31": 2, "15,9": 2, "42,30": 2, "3,11": 2, "36,27": 2, "39,26": 47, "43,28": 2, "42,28": 2, "39,25": 49, "35,25": 2, "12,9": 0, "41,28": 19, "35,23": 2, "42,24": 2, "5,9": 2, "36,26": 2, "12,10": 0, "39,22": 2, "38,25": 2, "9,7": 0, "22,6": 67, "36,25": 2, "39,28": 52, "42,23": 2, "11,10": 2, "13,10": 2, "23,6": 2, "13,8": 0, "39,27": 54, "42,27": 2, "11,7": 0, "43,30": 2, "37,28": 77, "38,23": 2, "40,25": 2, "3,5": 2, "41,25": 16, "23,7": 2, "41,29": 17, "38,26": 2, "37,29": 75, "35,27": 2, "22,8": 67, "36,29": 2, "19,2": 67, "39,30": 53, "35,30": 2, "12,7": 0, "10,10": 2, "5,11": 2, "9,9": 2, "41,24": 24, "36,30": 2, "11,8": 0, "40,23": 2, "13,9": 2, "41,27": 21, "17,3": 2, "37,27": 79, "3,10": 0, "43,24": 2, "40,28": 2, "19,3": 2, "42,26": 2, "40,26": 2, "40,31": 2, "16,9": 2, "36,23": 2, "41,23": 2, "39,24": 48, "43,29": 2, "43,27": 2, "43,26": 2, "36,28": 2, "35,26": 2, "37,24": 73, "4,11": 0, "36,24": 2, "35,24": 82, "9,8": 2, "21,21": 2 }, "2": { "22,7": 0, "79,6": 2, "26,37": 2, "55,35": 46, "68,30": 2, "68,21": 2, "22,24": 2, "24,33": 2, "80,2": 2, "73,20": 2, "48,35": 2, "58,17": 2, "73,2": 2, "72,31": 2, "76,2": 2, "96,22": 2, "84,6": 20, "71,32": 23, "23,7": 0, "26,35": 2, "66,9": 2, "69,12": 24, "31,21": 2, "83,33": 0, "10,14": 2, "67,21": 2, "74,2": 2, "80,23": 2, "87,7": 2, "58,26": 17, "36,20": 2, "79,4": 49, "79,23": 16, "96,10": 2, "54,26": 16, "33,34": 2, "16,2": 46, "86,29": 2, "39,17": 2, "9,5": 69, "58,16": 2, "73,8": 2, "21,24": 2, "27,36": 64, "17,16": 2, "3,5": 60, "12,9": 0, "31,23": 2, "35,34": 2, "57,12": 2, "19,3": 2, "95,22": 2, "50,16": 2, "5,9": 2, "66,13": 2, "31,29": 2, "93,13": 19, "51,35": 19, "73,19": 74, "14,2": 2, "47,35": 2, "52,4": 2, "24,21": 2, "70,12": 0, "3,2": 2, "38,9": 2, "53,8": 49, "71,7": 0, "84,4": 2, "57,14": 17, "18,21": 2, "41,9": 79, "73,32": 2, "15,14": 2, "97,26": 2, "30,27": 2, "47,34": 47, "65,4": 2, "81,22": 2, "63,4": 23, "64,35": 2, "81,5": 23, "84,33": 2, "58,27": 0, "77,32": 2, "86,31": 2, "87,2": 49, "55,28": 2, "71,8": 17, "55,30": 2, "91,3": 2, "40,16": 2, "80,30": 2, "26,29": 2, "73,9": 2, "45,8": 2, "66,8": 2, "73,17": 21, "84,17": 2, "35,36": 2, "61,24": 2, "82,5": 2, "87,8": 79, "36,18": 2, "83,4": 82, "66,4": 2, "22,29": 2, "77,21": 20, "69,11": 2, "95,11": 2, "93,32": 16, "68,4": 2, "85,17": 2, "25,30": 2, "36,10": 2, "54,4": 2, "35,37": 2, "95,10": 2, "88,6": 18, "35,38": 2, "27,33": 2, "25,27": 2, "93,15": 2, "85,29": 2, "19,10": 2, "18,34": 2, "81,8": 21, "50,34": 2, "68,11": 2, "51,4": 2, "26,36": 2, "1,2": 2, "55,27": 2, "39,21": 2, "26,30": 46, "61,10": 54, "50,29": 2, "31,28": 2, "16,7": 2, "97,16": 2, "44,14": 2, "16,14": 2, "66,19": 18, "75,23": 16, "49,12": 2, "64,4": 78, "80,5": 2, "57,4": 2, "97,15": 2, "33,21": 2, "88,15": 23, "29,21": 2, "21,10": 2, "53,35": 2, "77,20": 82, "77,17": 20, "82,8": 2, "87,13": 47, "13,15": 0, "2,2": 2, "20,34": 2, "97,20": 2, "89,29": 2, "70,10": 2, "86,7": 2, "93,22": 2, "4,1": 2, "10,9": 0, "94,19": 21, "84,31": 2, "64,13": 2, "5,1": 2, "66,15": 46, "59,29": 2, "91,33": 2, "56,16": 49, "77,11": 2, "35,21": 2, "87,14": 0, "45,9": 2, "82,6": 19, "58,4": 2, "45,13": 18, "24,22": 2, "68,7": 2, "91,5": 2, "61,27": 2, "55,10": 2, "82,7": 2, "65,17": 18, "61,7": 2, "37,9": 2, "81,31": 79, "85,13": 2, "77,9": 2, "59,26": 2, "85,11": 2, "41,15": 2, "46,30": 2, "96,15": 82, "25,25": 2, "89,2": 2, "76,19": 2, "41,18": 2, "51,20": 2, "62,7": 2, "70,9": 2, "34,33": 63, "95,14": 2, "49,9": 2, "81,21": 17, "57,22": 2, "64,20": 2, "47,31": 2, "68,22": 20, "87,32": 2, "75,2": 2, "90,33": 2, "86,4": 2, "66,10": 2, "29,34": 2, "54,8": 2, "81,19": 74, "90,6": 2, "72,32": 2, "69,9": 54, "18,2": 0, "2,5": 61, "96,14": 2, "57,28": 2, "22,28": 2, "91,2": 46, "48,12": 2, "57,15": 2, "80,6": 2, "94,29": 46, "25,22": 2, "77,15": 75, "9,8": 0, "16,6": 2, "40,9": 2, "71,12": 0, "67,4": 2, "80,4": 2, "17,15": 2, "36,11": 17, "50,7": 2, "49,31": 2, "91,31": 2, "50,6": 2, "61,8": 2, "59,7": 2, "53,22": 2, "23,8": 2, "3,9": 2, "51,15": 2, "66,20": 54, "6,9": 2, "46,33": 2, "9,10": 2, "22,27": 2, "25,29": 2, "80,8": 2, "68,32": 2, "47,30": 54, "55,22": 2, "6,2": 46, "38,21": 2, "45,12": 2, "74,15": 2, "97,14": 2, "57,27": 2, "30,31": 2, "81,7": 16, "4,10": 0, "53,9": 54, "3,10": 0, "78,23": 2, "31,27": 2, "96,20": 2, "69,32": 2, "89,13": 2, "31,24": 2, "95,20": 2, "52,15": 47, "73,16": 2, "61,26": 2, "91,6": 2, "41,16": 2, "28,21": 2, "57,29": 2, "88,31": 20, "94,30": 2, "92,32": 2, "54,35": 2, "50,18": 2, "50,13": 2, "72,10": 2, "33,20": 43, "74,19": 2, "88,14": 0, "97,21": 2, "78,15": 2, "58,15": 2, "30,25": 2, "84,30": 16, "25,28": 2, "85,32": 0, "8,14": 46, "68,31": 2, "69,15": 2, "12,14": 0, "31,26": 2, "35,39": 2, "37,21": 2, "48,34": 2, "47,9": 2, "57,13": 2, "60,26": 2, "22,33": 2, "85,16": 16, "94,27": 82, "96,28": 2, "17,39": 2, "85,4": 0, "82,31": 53, "86,8": 2, "86,13": 2, "52,16": 54, "85,12": 81, "27,30": 2, "36,15": 2, "94,17": 46, "83,5": 2, "42,18": 16, "83,2": 2, "64,22": 19, "14,13": 2, "32,34": 2, "31,34": 2, "10,2": 2, "22,31": 2, "72,4": 2, "18,6": 2, "80,32": 2, "58,34": 2, "68,18": 16, "96,12": 2, "26,21": 2, "4,3": 2, "81,17": 24, "16,9": 2, "87,4": 74, "87,33": 2, "79,32": 46, "68,9": 2, "92,33": 2, "73,4": 2, "54,11": 46, "17,21": 46, "81,4": 21, "57,26": 2, "36,17": 2, "97,10": 2, "65,21": 2, "74,32": 2, "52,17": 49, "45,14": 2, "9,2": 2, "50,30": 2, "27,25": 2, "68,12": 0, "17,14": 2, "81,18": 2, "63,13": 2, "81,15": 48, "89,14": 2, "30,29": 2, "89,15": 2, "78,2": 2, "83,32": 2, "83,6": 18, "53,10": 2, "21,23": 2, "95,27": 2, "25,21": 2, "10,7": 2, "56,22": 2, "28,33": 2, "87,5": 2, "22,25": 2, "73,22": 2, "68,15": 2, "95,13": 23, "85,8": 0, "58,29": 0, "86,15": 2, "73,15": 82, "88,2": 2, "13,13": 0, "46,29": 2, "11,3": 0, "62,4": 82, "5,12": 2, "61,29": 2, "76,32": 2, "11,10": 2, "57,33": 2, "57,34": 79, "50,9": 53, "3,11": 2, "91,32": 2, "22,3": 2, "55,12": 2, "30,33": 2, "87,6": 2, "66,35": 2, "22,4": 2, "62,9": 2, "54,22": 2, "79,19": 19, "56,7": 20, "63,7": 47, "49,29": 2, "61,25": 46, "96,11": 78, "27,22": 2, "20,21": 2, "82,33": 50, "20,10": 2, "77,23": 79, "14,14": 2, "12,3": 2, "50,27": 2, "19,8": 2, "17,37": 2, "17,38": 2, "50,17": 2, "26,34": 2, "51,17": 2, "70,11": 2, "42,15": 0, "96,13": 18, "64,23": 2, "30,34": 2, "67,15": 2, "10,15": 2, "9,7": 0, "36,16": 2, "8,2": 2, "60,27": 49, "12,7": 2, "22,32": 2, "90,31": 21, "80,31": 2, "21,34": 2, "54,9": 2, "48,9": 24, "57,17": 2, "68,10": 2, "22,30": 2, "77,7": 2, "41,17": 2, "93,20": 2, "36,14": 2, "39,19": 46, "82,15": 46, "46,32": 0, "56,28": 2, "54,10": 2, "60,29": 47, "44,15": 2, "3,3": 2, "61,35": 2, "5,14": 2, "14,15": 2, "18,33": 66, "97,12": 2, "63,9": 2, "30,24": 2, "61,30": 2, "3,1": 2, "72,12": 2, "73,7": 2, "4,9": 0, "71,4": 2, "24,34": 2, "59,35": 19, "87,15": 2, "43,18": 2, "14,9": 46, "26,28": 2, "6,14": 2, "27,21": 2, "67,32": 46, "16,8": 2, "50,26": 2, "22,8": 2, "15,2": 2, "61,4": 74, "5,10": 0, "52,18": 2, "77,22": 2, "56,26": 2, "40,14": 2, "11,9": 2, "85,33": 21, "13,2": 2, "56,4": 2, "65,35": 2, "82,29": 2, "12,8": 0, "89,31": 49, "70,30": 2, "56,35": 2, "95,26": 2, "66,18": 2, "77,16": 2, "94,21": 50, "26,26": 2, "56,30": 2, "44,9": 2, "50,33": 2, "60,33": 2, "31,30": 2, "71,11": 0, "8,10": 2, "57,7": 2, "19,7": 0, "57,19": 46, "81,16": 2, "80,29": 2, "48,33": 2, "89,30": 16, "87,11": 17, "90,13": 46, "61,33": 2, "20,2": 2, "85,2": 82, "17,40": 2, "50,5": 2, "77,14": 18, "12,13": 0, "83,8": 82, "47,8": 2, "94,16": 2, "2,1": 2, "88,13": 18, "10,3": 2, "48,30": 2, "72,7": 2, "93,21": 2, "84,8": 2, "21,22": 2, "28,34": 2, "7,9": 2, "61,28": 2, "88,33": 2, "55,8": 2, "97,28": 2, "78,32": 2, "85,7": 24, "68,17": 49, "60,30": 2, "83,17": 2, "26,33": 2, "46,35": 2, "47,29": 2, "4,2": 2, "27,26": 2, "82,32": 74, "59,30": 2, "54,7": 2, "73,18": 2, "12,10": 0, "72,11": 2, "86,14": 23, "94,18": 2, "84,2": 74, "47,32": 0, "51,18": 2, "42,14": 0, "48,31": 2, "95,15": 2, "21,21": 2, "81,23": 47, "10,8": 0, "84,29": 2, "42,16": 0, "21,32": 2, "83,15": 2, "64,17": 48, "71,31": 18, "67,23": 47, "36,9": 2, "74,31": 2, "21,25": 2, "94,26": 2, "22,5": 46, "70,8": 2, "23,22": 2, "17,34": 2, "73,3": 23, "36,19": 2, "60,35": 2, "54,12": 2, "77,6": 2, "12,5": 72, "35,35": 2, "7,14": 2, "69,13": 2, "1,1": 2, "44,17": 73, "86,5": 2, "17,2": 2, "25,33": 2, "26,40": 2, "50,14": 46, "43,15": 2, "30,21": 2, "55,4": 2, "84,5": 2, "21,27": 2, "26,22": 2, "21,2": 2, "23,34": 2, "69,8": 2, "52,26": 2, "70,4": 2, "5,2": 2, "56,33": 2, "61,9": 2, "22,2": 2, "48,29": 2, "55,26": 2, "4,5": 59, "46,12": 2, "47,33": 2, "9,14": 2, "13,8": 0, "10,5": 70, "27,34": 2, "31,33": 2, "58,28": 0, "22,22": 2, "79,5": 2, "64,19": 2, "62,12": 2, "35,40": 2, "48,32": 20, "87,31": 2, "56,29": 81, "15,9": 2, "22,9": 2, "89,33": 2, "18,8": 2, "60,34": 2, "21,29": 2, "57,16": 2, "30,22": 2, "90,2": 2, "43,9": 2, "51,22": 2, "11,2": 0, "88,29": 2, "65,13": 2, "74,4": 2, "85,5": 24, "86,33": 50, "29,33": 2, "84,7": 2, "62,34": 2, "81,33": 2, "89,11": 49, "77,18": 82, "39,16": 2, "83,7": 2, "67,22": 23, "57,20": 2, "73,11": 50, "86,32": 79, "12,2": 2, "27,28": 2, "60,4": 2, "78,6": 46, "22,10": 2, "50,32": 0, "17,36": 2, "67,8": 46, "77,10": 2, "79,8": 47, "29,22": 2, "93,16": 2, "67,20": 2, "77,19": 79, "62,33": 2, "96,25": 19, "36,21": 2, "71,9": 0, "94,31": 2, "97,11": 2, "11,15": 0, "92,31": 2, "55,29": 2, "86,2": 47, "80,33": 2, "49,33": 2, "58,35": 2, "73,23": 54, "67,17": 18, "87,12": 0, "75,19": 23, "62,23": 2, "72,30": 2, "39,9": 2, "46,9": 74, "77,13": 2, "7,3": 44, "7,10": 2, "62,35": 2, "11,7": 2, "26,25": 2, "58,7": 2, "55,7": 2, "62,11": 24, "32,21": 2, "11,13": 0, "26,38": 2, "66,16": 2, "81,2": 2, "52,35": 2, "56,15": 47, "21,28": 2, "94,22": 2, "39,15": 2, "12,15": 0, "90,32": 0, "53,26": 2, "21,33": 2, "66,12": 2, "63,35": 23, "93,28": 2, "22,34": 2, "26,27": 2, "73,10": 2, "66,11": 2, "96,26": 2, "18,3": 0, "70,7": 2, "17,35": 2, "68,23": 73, "70,32": 2, "95,21": 2, "72,9": 2, "52,22": 2, "73,31": 50, "91,13": 2, "63,10": 49, "49,30": 49, "89,12": 23, "93,14": 2, "57,18": 2, "2,3": 2, "21,30": 2, "81,6": 19, "50,31": 2, "17,6": 2, "58,33": 2, "83,31": 0, "59,27": 2, "69,7": 2, "25,26": 2, "40,17": 2, "88,32": 0, "83,29": 2, "34,34": 2, "22,26": 2, "11,5": 71, "85,6": 20, "26,24": 65, "23,6": 2, "93,26": 2, "81,29": 2, "59,28": 2, "46,34": 2, "75,32": 23, "19,9": 46, "3,4": 62, "88,11": 2, "7,2": 2, "49,32": 0, "5,13": 2, "95,16": 2, "53,7": 47, "61,34": 52, "88,12": 0, "26,39": 2, "96,23": 46, "21,31": 2, "19,2": 2, "43,16": 2, "66,34": 2, "5,3": 2, "63,23": 2, "77,12": 2, "31,22": 2, "30,23": 2, "86,11": 2, "82,2": 2, "82,4": 2, "53,4": 2, "40,15": 49, "11,8": 0, "46,8": 2, "13,9": 2, "47,12": 2, "27,27": 2, "50,8": 2, "56,12": 2, "51,19": 19, "74,3": 21, "73,30": 2, "45,18": 2, "59,4": 2, "92,13": 2, "51,26": 2, "13,14": 0, "30,30": 2, "96,24": 2, "17,17": 2, "69,30": 2, "4,11": 0, "39,20": 2, "62,10": 2, "81,32": 0, "81,20": 2, "70,31": 2, "57,21": 2, "36,13": 46, "39,14": 2, "10,10": 0, "69,31": 74, "10,13": 2, "60,7": 46, "45,16": 2, "58,18": 2, "57,30": 2, "58,30": 0, "59,34": 18, "72,8": 2, "94,20": 2, "94,28": 2, "23,21": 2, "60,28": 2, "42,9": 2, "68,20": 2, "19,34": 2, "97,13": 24, "21,26": 2, "43,17": 2, "44,18": 2, "19,21": 2, "66,32": 2, "83,16": 2, "34,21": 2, "56,27": 74, "68,19": 2, "17,19": 2, "77,8": 2, "69,14": 2, "79,15": 24, "62,8": 2, "17,18": 2, "61,23": 2, "73,12": 2, "27,29": 2, "79,7": 2, "95,28": 2, "31,25": 2, "49,35": 2, "95,12": 2, "42,17": 0, "19,6": 2, "50,35": 2, "75,15": 17, "96,27": 49, "57,35": 2, "11,14": 0, "97,27": 2, "18,7": 0, "56,34": 2, "45,17": 2, "50,28": 46, "68,8": 2, "77,2": 2, "96,21": 82, "94,15": 54, "25,34": 2, "69,10": 2, "22,21": 2, "23,33": 2, "13,7": 2, "17,20": 2, "93,27": 2, "80,19": 2, "45,15": 2, "80,15": 2, "51,21": 2, "85,15": 2, "22,6": 2, "79,2": 2, "66,21": 2, "74,23": 2, "86,12": 0, "30,28": 2, "43,14": 2, "91,4": 2, "49,34": 74, "63,8": 2, "1,3": 2, "9,9": 2, "44,16": 2, "69,4": 2, "71,30": 17, "50,15": 2, "66,17": 2, "64,21": 2, "87,29": 2, "89,32": 0, "84,32": 2, "22,23": 2, "46,31": 2, "73,21": 20, "94,32": 2, "31,31": 2, "96,16": 2, "56,17": 54, "5,11": 2, "65,20": 2, "71,10": 18, "30,26": 2, "85,14": 16, "39,18": 2, "80,7": 2, "31,32": 2, "17,3": 2, "28,22": 2, "74,30": 2, "41,14": 2, "66,33": 2, "51,16": 2, "56,18": 2, "36,12": 2, "97,22": 2, "50,12": 2, "55,9": 2, "40,18": 2, "59,33": 23, "89,6": 2, "13,10": 0, "78,19": 2, "30,32": 2, "62,13": 2, "76,15": 2, "50,4": 23, "64,18": 24, "76,23": 2, "86,6": 2, "85,31": 21, "94,14": 2 }, "3": { "10,8": 0, "26,32": 20, "12,8": 0, "11,10": 0, "11,14": 2, "26,30": 2, "13,8": 2, "13,7": 2, "18,8": 2, "12,14": 0, "11,7": 2, "4,9": 0, "11,13": 2, "10,14": 2, "11,2": 68, "26,33": 2, "3,9": 2, "13,14": 2, "10,3": 2, "10,7": 0, "5,10": 0, "10,15": 2, "26,31": 2, "12,15": 0, "13,13": 2, "11,9": 2, "3,11": 2, "12,7": 0, "12,2": 68, "5,11": 2, "13,15": 2, "12,3": 2, "19,8": 68, "14,13": 2, "11,8": 2, "13,9": 2, "10,2": 68, "11,3": 2, "4,10": 0, "19,6": 68, "3,10": 0, "10,13": 2, "10,9": 0, "18,7": 2, "14,14": 2, "11,15": 2, "19,7": 68, "12,10": 0, "13,10": 2, "12,13": 0, "3,5": 2, "12,9": 0, "14,15": 2, "4,11": 0, "10,10": 0, "18,6": 2, "5,9": 2 }, "4": { "4,3": 2, "3,1": 2, "11,15": 2, "11,14": 2, "3,2": 82, "4,1": 2, "3,10": 2, "12,14": 2, "4,2": 2, "4,9": 0, "2,1": 2, "2,2": 2, "4,10": 0, "3,4": 2, "3,9": 2, "2,3": 2, "5,10": 2, "12,13": 2, "3,5": 2, "4,11": 2, "13,13": 2, "5,9": 2, "3,11": 2, "3,3": 2, "5,11": 2 } };
  var tileSize = { "height": 64, "width": 64 };
  var idToName = { "0": "blocking", "2": "normal", "16": "color_block_blue", "17": "color_block_green", "18": "color_block_none", "19": "color_block_orange", "20": "color_block_purple", "21": "color_block_red", "23": "color_block_yellow", "24": "color_block_black", "43": "sign_colors", "44": "sign_layers", "46": "checkpoint", "47": "color_adder_yellow", "48": "color_adder_black", "49": "color_adder_blue", "50": "color_adder_green", "52": "color_adder_orange", "53": "color_adder_purple", "54": "color_adder_red", "57": "controls_down", "58": "controls_up", "59": "controls_d", "60": "controls_s", "61": "controls_a", "62": "controls_w", "63": "sign_sliding", "64": "sign_mirrors", "65": "sign_filters", "66": "sign_blocks", "67": "blocking2", "68": "blocking3", "69": "controls_space1", "70": "controls_space2", "71": "controls_space3", "72": "controls_space4", "73": "color_subtractor_black", "74": "color_subtractor_blue", "75": "color_subtractor_green", "77": "color_subtractor_orange", "78": "color_subtractor_purple", "79": "color_subtractor_red", "81": "color_subtractor_yellow", "82": "color_xor_black" };
  var nameToId = { "color_block_blue": "16", "normal": "2", "color_subtractor_green": "75", "controls_w": "62", "color_adder_blue": "49", "color_block_none": "18", "color_block_orange": "19", "blocking": "0", "controls_d": "59", "color_subtractor_red": "79", "sign_blocks": "66", "blocking2": "67", "blocking3": "68", "controls_s": "60", "color_adder_red": "54", "color_xor_black": "82", "color_subtractor_purple": "78", "color_adder_purple": "53", "controls_space3": "71", "color_block_black": "24", "color_subtractor_orange": "77", "controls_down": "57", "color_subtractor_blue": "74", "color_adder_black": "48", "color_subtractor_yellow": "81", "controls_up": "58", "controls_a": "61", "sign_colors": "43", "color_block_red": "21", "color_adder_orange": "52", "controls_space1": "69", "color_subtractor_black": "73", "sign_mirrors": "64", "checkpoint": "46", "color_block_purple": "20", "color_adder_yellow": "47", "color_block_yellow": "23", "sign_filters": "65", "color_block_green": "17", "controls_space2": "70", "sign_layers": "44", "controls_space4": "72", "sign_sliding": "63", "color_adder_green": "50" };
  var world = {
  	layers: layers,
  	tileSize: tileSize,
  	idToName: idToName,
  	nameToId: nameToId
  };

  /*
  A 2D tilemap with multiple layers.
  Supports viewing the tilemap in a "rotated" side-view.
  */

  var TileMap = function () {
  	function TileMap(stage, gameStage, data) {
  		babelHelpers.classCallCheck(this, TileMap);

  		this.stage = stage;
  		this.gameStage = gameStage;

  		this.root = new PIXI.Container();
  		this.gameStage.addChild(this.root);

  		this.container = null;

  		// Only stores tilemap values, no sprites/textures
  		this.data = {};

  		// View position and type
  		this.view = {
  			pos: {
  				x: 0,
  				y: 0,
  				z: 2
  			},
  			origin: {},
  			rotated: false,
  			layer: 2
  		};

  		// Only contains current sprites being displayed
  		this.sprites = {};

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
  					// Don't include empty layers
  					if (Object.keys(data.layers[layerName]).length > 0) {
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
  						this.setTileValue(layerName, key, layer[key]);
  					}
  				}

  				this.createBackgroundSprites();

  				this.buildLayer();
  			}
  		}
  	}, {
  		key: 'createBackgroundSprites',
  		value: function createBackgroundSprites() {
  			// Setup background sprite containers
  			this.backgroundContainer = new PIXI.Container();
  			this.backgroundContainer.zIndex = 20;
  			this.stage.addChild(this.backgroundContainer);
  			this.stage.updateLayersOrder();

  			this.backgroundLayerContainer = new PIXI.Container();
  			this.backgroundContainer.addChild(this.backgroundLayerContainer);

  			// Setup background tiling sprite (top view)
  			this.backgroundSprite = new PIXI.extras.TilingSprite(this.getBackgroundTexture(this.view.layer), gameSize.width, gameSize.height);
  			this.backgroundContainer.addChild(this.backgroundSprite);

  			// Setup background tiling sprites (side view)
  			this.backgroundLayerSprites = {};
  			for (var layerId in this.layerOrder) {
  				var layerName = this.layerOrder[layerId].toString();

  				// Create new sprite
  				var sprite = new PIXI.extras.TilingSprite(this.getBackgroundTexture(layerName), gameSize.width, this.tileSize.height);

  				// Set sprite position from layer and center of tile
  				sprite.position.y = (0 - parseInt(layerName)) * this.tileSize.height - this.tileSize.height / 2;

  				// Add sprite
  				this.backgroundLayerContainer.addChild(sprite);
  				this.backgroundLayerSprites[layerName] = sprite;
  			}
  		}
  	}, {
  		key: 'getTileTexture',
  		value: function getTileTexture(value) {
  			return PIXI.utils.TextureCache[this.idToName[value] + '.png'];
  		}
  	}, {
  		key: 'getBackgroundTexture',
  		value: function getBackgroundTexture(value) {
  			var textureName = 'data/backgrounds/' + value.toString() + '.png';
  			return PIXI.utils.TextureCache[textureName];
  		}

  		// Get a tile object

  	}, {
  		key: 'getTile',
  		value: function getTile(pos) {
  			// Use current layer if z not specified
  			var layer = 'z' in pos ? pos.z.toString() : this.view.pos.z.toString();

  			if (layer in this.data) {
  				return this.data[layer][this.hash(pos)];
  			}
  			return null;
  		}

  		// Get a tile name

  	}, {
  		key: 'getTileName',
  		value: function getTileName(pos) {
  			var tile = this.getTile(pos);
  			return tile ? this.idToName[tile] : null;
  		}

  		// Gets the 2D perspective-based pixel position of a tile position

  	}, {
  		key: 'getPerspectivePos',
  		value: function getPerspectivePos(tilePosition) {
  			// Calculate position based on view rotation
  			var pos = tilePosition.y - 2;
  			if ('y' in this.view.origin) {
  				if (this.view.rotated) {
  					pos = this.view.origin.y - tilePosition.z;
  				} else {
  					pos = tilePosition.y - this.view.origin.z;
  				}
  			}
  			// Return pixel position
  			return {
  				x: tilePosition.x * this.tileSize.width,
  				y: pos * this.tileSize.height
  			};
  		}
  	}, {
  		key: 'setTileValue',
  		value: function setTileValue(layer, key, value) {
  			// Create a new layer if it doesn't already exist
  			if (!(layer in this.data)) {
  				this.data[layer] = {};
  			}

  			// Set tile value
  			this.data[layer][key] = value;
  		}
  	}, {
  		key: 'updateOrigin',
  		value: function updateOrigin() {
  			this.view.origin.x = this.view.pos.x;
  			this.view.origin.y = this.view.pos.y;
  			this.view.origin.z = this.view.pos.z;
  		}

  		// Sets view position
  		// Note: This does not rebuild any layers

  	}, {
  		key: 'setPos',
  		value: function setPos(pos) {
  			this.view.pos.x = pos.x;
  			this.view.pos.y = pos.y;
  			this.view.pos.z = pos.z;
  		}

  		// Set 2D slice rotation (parallel to Z axis or Y axis)

  	}, {
  		key: 'setRotation',
  		value: function setRotation(rotated) {
  			if (this.view.rotated != rotated) {
  				this.view.rotated = rotated;
  				this.updateOrigin();
  				this.buildLayer();
  			}
  		}

  		// Toggle rotation

  	}, {
  		key: 'rotate',
  		value: function rotate() {
  			this.setRotation(!this.view.rotated);
  		}

  		// This updates the background sprite positions

  	}, {
  		key: 'update',
  		value: function update() {
  			if (this.view.rotated) {
  				this.updateSideBackground(this.view);
  			}
  		}

  		// Creates a new Pixi Sprite with the specified position and texture

  	}, {
  		key: 'createTileSprite',
  		value: function createTileSprite(pos, value) {
  			var sprite = new PIXI.Sprite(this.getTileTexture(value));
  			var pixelPos = this.getPerspectivePos(pos);
  			sprite.position.x = pixelPos.x;
  			sprite.position.y = pixelPos.y;
  			sprite.anchor.x = 0.5;
  			sprite.anchor.y = 0.5;
  			return sprite;
  		}
  	}, {
  		key: 'addSprite',
  		value: function addSprite(tileId, pos, value) {
  			var sprite = this.createTileSprite(pos, value);
  			this.sprites[tileId + ',' + pos.z] = sprite;
  			this.container.addChild(sprite);
  		}
  	}, {
  		key: 'updateLayer',
  		value: function updateLayer() {
  			if (this.view.layer != this.view.pos.z) {
  				this.buildLayer();
  			}
  		}
  	}, {
  		key: 'generateSideTiles',
  		value: function generateSideTiles(view) {
  			// Generate the rotated view
  			for (var layerId in this.layerOrder) {
  				var layerName = this.layerOrder[layerId].toString();
  				var tiles = this.data[layerName];
  				for (var tileId in tiles) {
  					// Only add tiles that would show up in this side view
  					var pos = this.unhash(tileId);
  					pos.z = parseInt(layerName);
  					if (pos.y == view.pos.y) {
  						this.addSprite(tileId, pos, tiles[tileId]);
  					}
  				}
  			}
  		}
  	}, {
  		key: 'generateTopTiles',
  		value: function generateTopTiles(view) {
  			// Simply generate the sprite layer like normal
  			var tiles = this.data[view.pos.z.toString()];
  			for (var tileId in tiles) {
  				var pos = this.unhash(tileId);
  				pos.z = view.pos.z;
  				this.addSprite(tileId, pos, tiles[tileId]);
  			}
  		}
  	}, {
  		key: 'updateSideBackground',
  		value: function updateSideBackground(view) {
  			this.backgroundSprite.visible = false;
  			this.backgroundLayerContainer.visible = true;

  			// Update background container position
  			var pos = gameStage.position.y;
  			if ('y' in view.origin) {
  				pos += view.origin.y * this.tileSize.height;
  			}
  			this.backgroundLayerContainer.position.y = pos;
  		}
  	}, {
  		key: 'updateTopBackground',
  		value: function updateTopBackground(view) {
  			this.backgroundSprite.visible = true;
  			this.backgroundLayerContainer.visible = false;
  			this.backgroundSprite.texture = this.getBackgroundTexture(view.layer);
  		}
  	}, {
  		key: 'buildLayer',
  		value: function buildLayer() {
  			var view = arguments.length <= 0 || arguments[0] === undefined ? this.view : arguments[0];

  			// Remove any previous tiles
  			this.sprites = {};
  			if (this.container) {
  				this.root.removeChild(this.container);
  			}

  			// Setup new container to hold tile sprites
  			this.container = new PIXI.Container();
  			this.root.addChild(this.container);

  			// Update current layer
  			view.layer = view.pos.z;

  			// Generate tiles/background
  			if (view.rotated) {
  				this.generateSideTiles(view);
  				this.updateSideBackground(view);
  			} else {
  				this.generateTopTiles(view);
  				this.updateTopBackground(view);
  			}
  		}

  		// Hash a position
  		// TODO: Use 3D coordinates for the tile IDs

  	}, {
  		key: 'hash',
  		value: function hash(pos) {
  			// if (!pos.z) {
  			// 	pos.z = 0
  			// }
  			return '' + pos.x + ',' + pos.y; // + ',' + pos.z
  		}

  		// Extract position from a hash

  	}, {
  		key: 'unhash',
  		value: function unhash(key) {
  			var values = key.split(',');
  			return { x: parseInt(values[0]), y: parseInt(values[1]) };
  		}
  	}]);
  	return TileMap;
  }();

  var blocking = { "topCollision": true, "sideCollision": true };
  var blocking2 = { "topCollision": true, "sideCollision": true };
  var blocking3 = { "topCollision": true, "sideCollision": true };
  var empty = { "topCollision": true, "sideCollision": true };
  var normal = { "topCollision": false, "sideCollision": false };
  var clearing = { "topCollision": false, "sideCollision": false, "clears": true };
  var checkpoint = { "topCollision": false, "sideCollision": false, "checkpoint": true, "clears": true };
  var controls_w = { "topCollision": false, "sideCollision": false };
  var controls_a = { "topCollision": false, "sideCollision": false };
  var controls_s = { "topCollision": false, "sideCollision": false };
  var controls_d = { "topCollision": false, "sideCollision": false };
  var color_block_none = { "topCollision": false, "sideCollision": false, "color": { "block": true, "name": "none" } };
  var color_block_blue = { "topCollision": false, "sideCollision": false, "color": { "block": true, "name": "blue" } };
  var color_block_yellow = { "topCollision": false, "sideCollision": false, "color": { "block": true, "name": "yellow" } };
  var color_block_red = { "topCollision": false, "sideCollision": false, "color": { "block": true, "name": "red" } };
  var color_block_green = { "topCollision": false, "sideCollision": false, "color": { "block": true, "name": "green" } };
  var color_block_orange = { "topCollision": false, "sideCollision": false, "color": { "block": true, "name": "orange" } };
  var color_block_purple = { "topCollision": false, "sideCollision": false, "color": { "block": true, "name": "purple" } };
  var color_block_white = { "topCollision": false, "sideCollision": false, "color": { "block": true, "name": "white" } };
  var color_block_black = { "topCollision": false, "sideCollision": false, "color": { "block": true, "name": "black" } };
  var color_adder_none = { "topCollision": false, "sideCollision": false, "color": { "action": "add", "name": "none" } };
  var color_adder_blue = { "topCollision": false, "sideCollision": false, "color": { "action": "add", "name": "blue" } };
  var color_adder_yellow = { "topCollision": false, "sideCollision": false, "color": { "action": "add", "name": "yellow" } };
  var color_adder_red = { "topCollision": false, "sideCollision": false, "color": { "action": "add", "name": "red" } };
  var color_adder_green = { "topCollision": false, "sideCollision": false, "color": { "action": "add", "name": "green" } };
  var color_adder_orange = { "topCollision": false, "sideCollision": false, "color": { "action": "add", "name": "orange" } };
  var color_adder_purple = { "topCollision": false, "sideCollision": false, "color": { "action": "add", "name": "purple" } };
  var color_adder_white = { "topCollision": false, "sideCollision": false, "color": { "action": "add", "name": "white" } };
  var color_adder_black = { "topCollision": false, "sideCollision": false, "color": { "action": "add", "name": "black" } };
  var color_subtractor_none = { "topCollision": false, "sideCollision": false, "color": { "action": "subtract", "name": "none" } };
  var color_subtractor_blue = { "topCollision": false, "sideCollision": false, "color": { "action": "subtract", "name": "blue" } };
  var color_subtractor_yellow = { "topCollision": false, "sideCollision": false, "color": { "action": "subtract", "name": "yellow" } };
  var color_subtractor_red = { "topCollision": false, "sideCollision": false, "color": { "action": "subtract", "name": "red" } };
  var color_subtractor_green = { "topCollision": false, "sideCollision": false, "color": { "action": "subtract", "name": "green" } };
  var color_subtractor_orange = { "topCollision": false, "sideCollision": false, "color": { "action": "subtract", "name": "orange" } };
  var color_subtractor_purple = { "topCollision": false, "sideCollision": false, "color": { "action": "subtract", "name": "purple" } };
  var color_subtractor_white = { "topCollision": false, "sideCollision": false, "color": { "action": "subtract", "name": "white" } };
  var color_subtractor_black = { "topCollision": false, "sideCollision": false, "color": { "action": "subtract", "name": "black" } };
  var color_xor_black = { "topCollision": false, "sideCollision": false, "color": { "action": "xor", "name": "black" } };
  var tileInfo = {
  	blocking: blocking,
  	blocking2: blocking2,
  	blocking3: blocking3,
  	empty: empty,
  	normal: normal,
  	clearing: clearing,
  	checkpoint: checkpoint,
  	controls_w: controls_w,
  	controls_a: controls_a,
  	controls_s: controls_s,
  	controls_d: controls_d,
  	color_block_none: color_block_none,
  	color_block_blue: color_block_blue,
  	color_block_yellow: color_block_yellow,
  	color_block_red: color_block_red,
  	color_block_green: color_block_green,
  	color_block_orange: color_block_orange,
  	color_block_purple: color_block_purple,
  	color_block_white: color_block_white,
  	color_block_black: color_block_black,
  	color_adder_none: color_adder_none,
  	color_adder_blue: color_adder_blue,
  	color_adder_yellow: color_adder_yellow,
  	color_adder_red: color_adder_red,
  	color_adder_green: color_adder_green,
  	color_adder_orange: color_adder_orange,
  	color_adder_purple: color_adder_purple,
  	color_adder_white: color_adder_white,
  	color_adder_black: color_adder_black,
  	color_subtractor_none: color_subtractor_none,
  	color_subtractor_blue: color_subtractor_blue,
  	color_subtractor_yellow: color_subtractor_yellow,
  	color_subtractor_red: color_subtractor_red,
  	color_subtractor_green: color_subtractor_green,
  	color_subtractor_orange: color_subtractor_orange,
  	color_subtractor_purple: color_subtractor_purple,
  	color_subtractor_white: color_subtractor_white,
  	color_subtractor_black: color_subtractor_black,
  	color_xor_black: color_xor_black
  };

  // TODO: Either generate most of tile_info or handle special cases somehow
  // The colors are getting very redundant...

  var TileMapUtils = function () {
  	function TileMapUtils(tiles) {
  		babelHelpers.classCallCheck(this, TileMapUtils);

  		this.tiles = tiles;
  	}

  	// Returns entire tile info object from json file


  	babelHelpers.createClass(TileMapUtils, [{
  		key: 'getTileInfo',
  		value: function getTileInfo(pos) {
  			var tileName = this.tiles.getTileName(pos);
  			if (tileName) {
  				return tileInfo[tileName];
  			}
  			return null;
  		}

  		// Returns a single property from the tile info object

  	}, {
  		key: 'getTileProperty',
  		value: function getTileProperty(type, pos, fallback) {
  			var info = this.getTileInfo(pos);
  			if (info && type in info) {
  				return info[type];
  			}
  			return fallback;
  		}
  	}]);
  	return TileMapUtils;
  }();

  // These are ordered in a specific way, so the binary values of
  // the indices can be used for logical color operations.
  var idToColor = ['none', 'red', 'yellow', 'orange', 'blue', 'purple', 'green', 'black'];

  var colorToId = {};
  for (var i in idToColor) {
  	colorToId[idToColor[i]] = i;
  }

  var RED_BIT = 1;
  var YELLOW_BIT = 2;
  var BLUE_BIT = 4;

  var colorFunctions = {
  	add: function add(a, b) {
  		// Example: Blue + Yellow = Green
  		return a || b;
  	},
  	subtract: function subtract(a, b) {
  		// Example: Green - Yellow = Blue
  		return !a && b;
  	},
  	xor: function xor(a, b) {
  		/*
    Toggles the color bits based on XOR logic.
    Examples:
    	Blue ^ Black = Orange
    	Green ^ Blue = Yellow
    	Yellow ^ Blue = Green
    */
  		return a ^ b;
  	}
  };

  // Splits a color into red, yellow, and blue components
  function unpackColor(color) {
  	var id = colorToId[color];
  	return {
  		'r': id & RED_BIT,
  		'y': id & YELLOW_BIT,
  		'b': id & BLUE_BIT
  	};
  }

  // Returns a color based on the red/yellow/blue components
  function packColor(color) {
  	return idToColor[(color.r ? RED_BIT : 0) + (color.y ? YELLOW_BIT : 0) + (color.b ? BLUE_BIT : 0)];
  }

  function mixColors(baseColor, newColor) {
  	var colorFunctionName = arguments.length <= 2 || arguments[2] === undefined ? 'add' : arguments[2];

  	if (baseColor in colorToId && newColor in colorToId && colorFunctionName in colorFunctions) {
  		// Unpack colors into components
  		var extractedNew = unpackColor(baseColor);
  		var extractedCurrent = unpackColor(newColor);

  		// Mix color components together using the specified color function
  		var colorFunction = colorFunctions[colorFunctionName];
  		var result = {
  			'r': colorFunction(extractedCurrent.r, extractedNew.r),
  			'y': colorFunction(extractedCurrent.y, extractedNew.y),
  			'b': colorFunction(extractedCurrent.b, extractedNew.b)
  		};

  		// Pack and return resulting color
  		return packColor(result);
  	}
  	return 'none';
  }

  // Player/level system
  kran.system({
  	components: [components.inputMovement, components.tilePosition],
  	checkpoint: null,
  	createPlayer: function createPlayer() {
  		// Setup player starting position
  		var startPos = {
  			x: 2,
  			y: 2,
  			z: 2
  		};
  		this.tiles.setPos(startPos);
  		var pixelPos = this.tiles.getPerspectivePos(startPos);
  		// Create player entity
  		return kran.entity().add(components.position, pixelPos.x, pixelPos.y).add(components.velocity).add(components.inputMovement).add(components.cameraFollows).add(components.tilePosition, startPos.x, startPos.y, startPos.z).add(components.sprite, gameStage, 'player_none.png').add(components.storage);
  	},
  	returnToCheckpoint: function returnToCheckpoint() {
  		// Move player back to puzzle checkpoint
  		if (this.checkpoint) {
  			this.tiles.setRotation(false);
  			this.tiles.setPos(this.checkpoint.position);
  			this.tiles.updateLayer();
  			this.movePlayer(this.player, this.checkpoint.position, 500);
  			this.setPlayerColor();
  		}
  	},
  	pre: function pre() {
  		// Handle view rotating
  		for (var i in this.tilesInputRotate.actions) {
  			var action = this.tilesInputRotate.actions[i];
  			if (action === 'toggle') {
  				this.tiles.rotate();
  			} else {
  				this.tiles.setRotation(action);
  			}
  			this.updatePlayerSprite();
  		}
  		this.tilesInputRotate.actions.length = 0;
  	},
  	init: function init() {
  		var _this = this;

  		// Create tilemap entity
  		this.tiles = new TileMap(stage, gameStage, world);
  		var tilemap = kran.entity().add(components.tilemap, this.tiles).add(components.inputRotate).add(components.inputCheckpoint, function () {
  			_this.returnToCheckpoint();
  		}, null);
  		this.tu = new TileMapUtils(this.tiles);

  		// Create player entity
  		this.player = this.createPlayer();

  		// Need to store these for view rotating and colors
  		this.tilesInputRotate = tilemap.get(components.inputRotate);
  		this.playerTilePosition = this.player.get(components.tilePosition);
  		this.playerStorage = this.player.get(components.storage);
  		this.playerSprite = this.player.get(components.sprite).s;
  	},
  	every: function every(inputMovement, tilePosition, ent) {
  		// Remove destination component if finished
  		var destination = ent.get(components.destination);
  		if (destination) {
  			this.tiles.update();
  			if (destination.done) {
  				ent.remove(components.destination);
  				destination = null;
  			}
  		}

  		// Move and animate player
  		if (!destination && (inputMovement.delta.x != 0 || inputMovement.delta.y != 0)) {
  			// Movement was requested, so calculate new position
  			var newPosition = {
  				x: tilePosition.x + inputMovement.delta.x,
  				y: tilePosition.y,
  				z: tilePosition.z
  			};

  			// Change movement axis when rotated
  			if (this.tiles.view.rotated) {
  				newPosition.z -= inputMovement.delta.y;
  			} else {
  				newPosition.y += inputMovement.delta.y;
  			}

  			// Check collision on the current tile visible
  			var tile = this.tu.getTileInfo(newPosition);
  			var collisionType = this.tiles.view.rotated ? 'sideCollision' : 'topCollision';
  			if (tile && !(tile[collisionType] || this.colorBlockCollision(tile.color))) {
  				// Trigger exit event
  				this.playerExitedTile(tile, {
  					x: tilePosition.x,
  					y: tilePosition.y,
  					z: tilePosition.z
  				});

  				// Move player if no collision
  				this.movePlayer(ent, newPosition, 200);

  				// Trigger enter event
  				this.playerEnteredTile(tile, {
  					x: newPosition.x,
  					y: newPosition.y,
  					z: newPosition.z
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
  		// Mix colors from color tiles
  		if ('color' in info && 'action' in info.color) {
  			var newColor = mixColors(this.playerStorage.color, info.color.name, info.color.action);
  			this.setPlayerColor(newColor);
  		}
  		if (info.checkpoint) {
  			this.checkpoint = {
  				position: {
  					x: pos.x,
  					y: pos.y,
  					z: pos.z
  				},
  				rotated: this.tiles.view.rotated
  			};
  		}
  	},
  	playerExitedTile: function playerExitedTile(info, pos) {},
  	movePlayer: function movePlayer(ent, target, tweenTime) {
  		// Set tile position
  		var tilePosition = ent.get(components.tilePosition);
  		tilePosition.x = target.x;
  		tilePosition.y = target.y;
  		tilePosition.z = target.z;

  		// Set tilemap position
  		this.tiles.setPos(target);

  		// Get graphical target position
  		var pixelTarget = this.tiles.getPerspectivePos(target);

  		// Remove current tween in case one is already going
  		if (ent.has(components.destination)) {
  			ent.remove(components.destination);
  		}

  		// Set graphical position (start a tween)
  		var position = ent.get(components.position);
  		if (tweenTime > 0) {
  			ent.add(components.destination, position, pixelTarget, tweenTime);
  		} else {
  			position.x = pixelTarget.x;
  			position.y = pixelTarget.y;
  		}
  	},
  	updatePlayerSprite: function updatePlayerSprite() {
  		var textureName = 'player_' + this.playerStorage.color + '.png';
  		this.playerSprite.texture = PIXI.utils.TextureCache[textureName];
  	},
  	setPlayerColor: function setPlayerColor(color) {
  		color = color || 'none';
  		this.playerStorage.color = color;
  		this.updatePlayerSprite();
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
  		gameStage.position.x = -follow.deadzone.x + follow.borderSize;
  		gameStage.position.y = -follow.deadzone.y + follow.borderSize;
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

  function load() {
  	// Load textures
  	var loader = PIXI.loader;
  	loader.add('textures', 'data/textures.json');

  	// Load backgrounds
  	for (var i = 0; i < 5; ++i) {
  		var name = i.toString();
  		loader.add('background_' + name, 'data/backgrounds/' + name + '.png');
  	}

  	// Start when done loading
  	loader.load(start);
  }

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

  load();

}());