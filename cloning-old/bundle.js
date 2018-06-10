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
      var comp = this.comps[compId];
      if (comp === undefined) throw new Error("The entity doesn't have the component");

      triggerOnremove(comp);

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
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.comps[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var comp = _step.value;

          if (comp) {
            triggerOnremove(comp);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

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
      throw new TypeError(compId + " is not a component id or an object containing an id");
    }

    var qualifiesForCollection = function qualifiesForCollection(ent, comps) {
      return comps.every(function (compId) {
        if (ent.comps[compId] === undefined) {
          return false;
        }
        return true;
      });
    };

    function triggerOnremove(comp) {
      // Call onremove method before removing a component
      if ('onremove' in comp && isFunc(comp.onremove)) {
        comp.onremove();
      }
    }

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
      return typeof func === 'function';
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

  // Hash a tile position
  function hash(pos) {
  	return '' + (pos.x || 0) + ',' + (pos.y || 0);
  }

  // Extract tile position from a hash
  function unhash(key) {
  	var values = key.split(',');
  	values.length = 2;
  	return {
  		x: parseInt(values[0]) || 0,
  		y: parseInt(values[1]) || 0
  	};
  }

  Math.toRadians = function (degrees) {
  	return degrees * Math.PI / 180.0;
  };

  Math.toDegrees = function (radians) {
  	return radians * 180.0 / Math.PI;
  };

  function deltaToDegrees(delta) {
  	if (delta.x == 0 && delta.y == 1) {
  		return 90;
  	} else if (delta.x == 0 && delta.y == -1) {
  		return 270;
  	} else if (delta.x == 1 && delta.y == 0) {
  		return 0;
  	} else if (delta.x == -1 && delta.y == 0) {
  		return 180;
  	}
  	return 0;
  }

  var SpatialEntityMap = function () {
  	function SpatialEntityMap() {
  		babelHelpers.classCallCheck(this, SpatialEntityMap);

  		// {"1,2": someEntity}
  		this.hashToEntity = {};

  		// When multiple entites overlap, they ALL appear in here
  		// {"1,2": [someEntity, collidingEntity, anotherEntity]}
  		this.collisions = {};
  	}

  	// Sets the tile position of a certain entity for later retrieval


  	babelHelpers.createClass(SpatialEntityMap, [{
  		key: "update",
  		value: function update(tilePosition, ent) {
  			var hashValue = hash(tilePosition);
  			if (hashValue in this.hashToEntity) {
  				// Add original entity to collisions
  				if (!(hashValue in this.collisions)) {
  					this.collisions[hashValue] = [this.hashToEntity[hashValue]];
  				}
  				// Add this to collisions
  				this.collisions[hashValue].push(ent);
  				console.log("Collision detected at " + hashValue);
  			} else {
  				// Only entity so far in this spot
  				this.hashToEntity[hashValue] = ent;
  			}
  		}

  		// Since there is no reverse mapping from entity ID to tile ID

  	}, {
  		key: "clear",
  		value: function clear() {
  			this.hashToEntity = {};
  			this.collisions = {};
  		}

  		// Return an entity or null from a tile position

  	}, {
  		key: "get",
  		value: function get(tilePosition) {
  			var hashValue = hash(tilePosition);
  			return this.hashToEntity[hashValue];
  		}
  	}]);
  	return SpatialEntityMap;
  }();

  var kran = new Kran();
  var dt = {
  	val: 0.0,
  	total: 0.0
  };

  // Get game window size
  var gameSize = {
  	width: window.innerWidth - 4,
  	height: window.innerHeight - 4
  };

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

  var spatialEntityMap = new SpatialEntityMap();

  var active = {
  	player: null
  };

  var components = {
  	// // Current position
  	// position: state.kran.component(function(x, y) {
  	// 	this.x = x || 0
  	// 	this.y = y || 0
  	// }),

  	// // Current velocity
  	// velocity: state.kran.component(function(x, y) {
  	// 	this.x = x || 0
  	// 	this.y = y || 0
  	// }),

  	// Pixi sprite
  	sprite: kran.component(function (stage, texture, base) {
  		var _this = this;

  		this.s = new PIXI.Sprite(PIXI.utils.TextureCache[texture]);
  		this.s.anchor.x = 0.5;
  		this.s.anchor.y = 0.5;
  		stage.addChild(this.s);
  		this.base = base || '';

  		this.onremove = function () {
  			stage.removeChild(_this.s);
  		};
  	}),

  	// Triggers velocity changes from WASD keys or swipe
  	inputMovement: kran.component(function (speed) {
  		// 4 tiles per second
  		var defaultSpeed = 64 * 4;
  		this.speed = speed || defaultSpeed;

  		// For requesting movement
  		this.delta = {};
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
  		this.borderSize = {
  			x: outer * gameSize.width,
  			y: outer * gameSize.height
  		};

  		// The inner rectangle representing the deadzone where the camera should not move
  		this.deadzone = new PIXI.Rectangle(this.borderSize.x, this.borderSize.y, gameSize.width - this.borderSize.x * 2, gameSize.height - this.borderSize.y * 2);

  		this.center = true;
  	}),

  	// Entity will move to this tile position
  	// This eventually causes a destination component to be created
  	tileTarget: kran.component(function (x, y) {
  		this.x = x || 0;
  		this.y = y || 0;
  	}),

  	// Entity will move to this position smoothly (tweening)
  	destination: kran.component(function (source, target, duration) {
  		var _this2 = this;

  		this.done = false;
  		this.tween = new TWEEN.Tween(source).to(target, duration).onComplete(function () {
  			_this2.done = true;
  		}).start();
  	}),

  	// Current tile-based position
  	tilePosition: kran.component(function (x, y) {
  		this.x = x || 0;
  		this.y = y || 0;
  	}),

  	// Stores a color
  	// The string correlates to different textures that can be used
  	color: kran.component(function (name, mutable) {
  		var _this3 = this;

  		this.name = name || 'none';
  		this.mutable = mutable || true;

  		this.change = function (name) {
  			if (_this3.mutable) {
  				_this3.name = name;
  			}
  		};

  		this.clear = function () {
  			_this3.change('none');
  		};
  	}),

  	// Stores a magnetic state
  	// Can be permanent or temporary
  	magnet: kran.component(function () {
  		this.permanent = false;

  		// Polarities: 'N', 'S', ''
  		this.polarity = '';
  	}),

  	// Pushable by manual force
  	pushable: kran.component(function () {}),

  	// Pullable by magnets
  	pullable: kran.component(function () {}),

  	// Keeps track of a key state
  	action: kran.component(function (key) {
  		var _this4 = this;

  		this.key = key;
  		this.pressed = false;
  		Mousetrap.bind(key, function () {
  			_this4.pressed = true;
  		}, 'keydown');
  		Mousetrap.bind(key, function () {
  			_this4.pressed = false;
  		}, 'keyup');
  	}),

  	// This entity has a clone tool (so it will also handle input)
  	cloneTool: kran.component(function (spriteComp) {
  		var _this5 = this;

  		// Direction in degrees
  		this.direction = 0;

  		// Direction as an x/y delta
  		this.directionDelta = { x: 1, y: 0 };

  		// Number of clones
  		this.count = 0;

  		// Attach clone tool sprite to parent entity sprite
  		this.cloneToolSprite = new PIXI.Sprite(PIXI.utils.TextureCache['clone_tool_0.png']);
  		this.cloneToolSprite.anchor.x = 0.5;
  		this.cloneToolSprite.anchor.y = 0.5;
  		spriteComp.s.addChild(this.cloneToolSprite);

  		this.onremove = function () {
  			spriteComp.s.removeChild(_this5.cloneToolSprite);
  		};

  		this.setDirection = function (delta) {
  			if (_this5.directionDelta.x != delta.x || _this5.directionDelta.y != delta.y) {
  				_this5.directionDelta.x = delta.x;
  				_this5.directionDelta.y = delta.y;
  				var degrees = deltaToDegrees(_this5.directionDelta);
  				var radians = Math.toRadians(degrees);
  				_this5.direction = degrees;
  				_this5.cloneToolSprite.rotation = radians;
  			}
  		};

  		this.setClones = function (count) {
  			if (count >= 0 && count <= 5) {
  				_this5.count = count;
  				_this5.cloneToolSprite.texture = PIXI.utils.TextureCache['clone_tool_' + _this5.count + '.png'];
  			}
  		};

  		this.use = function () {
  			if (_this5.count > 0) {
  				_this5.setClones(_this5.count - 1);
  			}
  		};

  		this.add = function () {
  			_this5.setClones(_this5.count + 1);
  		};

  		this.getOptions = function () {
  			return {
  				direction: _this5.directionDelta,
  				count: _this5.count
  			};
  		};

  		this.setOptions = function (options) {
  			_this5.setDirection(options.direction);
  			_this5.setClones(options.count);
  		};
  	}),

  	// If the entity is currently sliding (like on ice)
  	sliding: kran.component(function () {}),

  	// Is an entity able to merge with another entity?
  	// Also stores which entity is the parent, so it knows which entity to keep
  	mergable: kran.component(function (isParent) {
  		this.isParent = isParent || false;
  	}),

  	// For reversing the movement of entities
  	mirror: kran.component(function (axes) {
  		// Which axes are mirrored for movement
  		// -1 will flip an axis, 1 keeps it the same
  		this.axes = axes || {
  			x: -1,
  			y: 1
  		};
  	}),

  	// For use with a MVC pattern (mainly from model -> view)
  	/*
   	(Logical) Positions could be set directly
   	A system that updates the model -> view would detect these changes and start tweens
   	When the tweens are started/stopped, this component is updated
   	That way, the controller can get feedback that the logical position should not change yet
   */
  	animated: kran.component(function () {
  		this.tweening = false;
  	}),

  	// Determines if the entity is a player/clone
  	player: kran.component(function () {})

  	/*
   Need a command system to keep a stack of all commands
   Each command will store the timestamp and action
   */
  };

  var nameToId = { "color_subtractor_black": "73", "portal_unexplored": "85", "puzzle_start": "84", "controls_space3": "71", "sign_sliding": "63", "color_subtractor_green": "75", "puzzle_start_done": "83", "color_adder_green": "50", "color_xor_black": "82", "color_adder_black": "48", "color_subtractor_yellow": "81", "sign_colors": "43", "color_adder_orange": "52", "color_block_green": "17", "normal": "2", "portal_unsolved": "86", "color_block_black": "24", "color_block_none": "18", "blocking2": "67", "controls_down": "57", "color_subtractor_blue": "74", "controls_up": "58", "portal_solved": "87", "controls_a": "61", "color_subtractor_purple": "78", "color_block_orange": "19", "color_adder_red": "54", "color_adder_blue": "49", "sign_blocks": "66", "color_subtractor_red": "79", "color_subtractor_orange": "77", "controls_s": "60", "color_block_purple": "20", "controls_w": "62", "exit": "88", "controls_space1": "69", "controls_space2": "70", "color_adder_purple": "53", "blocking3": "68", "blocking": "0", "sign_layers": "44", "color_adder_yellow": "47", "color_block_blue": "16", "controls_d": "59", "color_block_red": "21", "checkpoint": "46", "color_block_yellow": "23", "sign_filters": "65", "controls_space4": "72", "sign_mirrors": "64" };
  var idToName = { "0": "blocking", "2": "normal", "16": "color_block_blue", "17": "color_block_green", "18": "color_block_none", "19": "color_block_orange", "20": "color_block_purple", "21": "color_block_red", "23": "color_block_yellow", "24": "color_block_black", "43": "sign_colors", "44": "sign_layers", "46": "checkpoint", "47": "color_adder_yellow", "48": "color_adder_black", "49": "color_adder_blue", "50": "color_adder_green", "52": "color_adder_orange", "53": "color_adder_purple", "54": "color_adder_red", "57": "controls_down", "58": "controls_up", "59": "controls_d", "60": "controls_s", "61": "controls_a", "62": "controls_w", "63": "sign_sliding", "64": "sign_mirrors", "65": "sign_filters", "66": "sign_blocks", "67": "blocking2", "68": "blocking3", "69": "controls_space1", "70": "controls_space2", "71": "controls_space3", "72": "controls_space4", "73": "color_subtractor_black", "74": "color_subtractor_blue", "75": "color_subtractor_green", "77": "color_subtractor_orange", "78": "color_subtractor_purple", "79": "color_subtractor_red", "81": "color_subtractor_yellow", "82": "color_xor_black", "83": "puzzle_start_done", "84": "puzzle_start", "85": "portal_unexplored", "86": "portal_unsolved", "87": "portal_solved", "88": "exit" };
  var layers = { "lvl-115,128": { "114,128": 2, "113,128": 2, "114,127": 2, "113,129": 2, "113,127": 2, "114,129": 2, "112,129": 2, "112,128": 2, "115,128": 83, "112,127": 2 }, "lvl-119,126": { "119,123": 2, "118,122": 2, "119,125": 2, "120,124": 2, "117,123": 2, "120,123": 2, "119,124": 2, "116,122": 2, "116,123": 2, "117,122": 2, "119,122": 2, "120,125": 2, "118,121": 2, "117,121": 2, "117,124": 2, "118,123": 2, "119,126": 84, "118,125": 2, "116,121": 2, "118,124": 2 }, "lvl-141,126": { "138,124": 2, "141,121": 2, "138,123": 2, "138,122": 2, "139,124": 2, "141,125": 2, "140,122": 2, "137,124": 2, "141,123": 2, "137,125": 2, "137,123": 2, "140,123": 2, "141,122": 2, "139,122": 2, "137,122": 2, "139,123": 2, "141,124": 2, "140,124": 2, "141,126": 84, "137,121": 2 }, "lvl-134,126": { "135,123": 2, "132,122": 2, "135,125": 2, "134,126": 84, "132,123": 2, "133,122": 2, "134,123": 2, "133,121": 2, "134,121": 2, "133,124": 2, "133,123": 2, "135,122": 2, "132,124": 2, "133,125": 2, "134,122": 2, "135,121": 2, "134,125": 2, "135,124": 2, "134,124": 2, "132,125": 2, "132,121": 2 }, "lvl-123,126": { "123,126": 84, "123,122": 2, "124,122": 2, "122,123": 2, "124,123": 2, "123,121": 2, "123,124": 2, "122,121": 2, "124,124": 2, "123,123": 2, "122,124": 2, "124,125": 2, "124,121": 2, "122,122": 2, "122,125": 2, "123,125": 2 }, "lvl-128,126": { "130,122": 2, "128,126": 84, "127,125": 2, "127,122": 2, "128,125": 2, "127,124": 2, "128,124": 2, "126,123": 2, "130,123": 2, "130,125": 2, "126,122": 2, "129,125": 2, "128,123": 2, "129,122": 2, "129,123": 2, "129,124": 2, "128,122": 2, "127,123": 2, "130,124": 2, "126,125": 2, "126,124": 2 }, "world": { "128,127": 2, "120,129": 2, "134,129": 2, "126,129": 84, "137,128": 2, "123,126": 85, "129,128": 2, "127,128": 2, "140,128": 2, "125,127": 2, "126,127": 2, "118,129": 2, "119,127": 2, "117,128": 2, "135,128": 2, "135,129": 2, "140,127": 2, "133,129": 2, "116,128": 2, "132,130": 85, "124,129": 2, "139,128": 2, "124,128": 2, "141,126": 85, "139,127": 2, "138,128": 2, "141,127": 2, "118,128": 2, "132,127": 2, "130,128": 2, "124,127": 2, "136,127": 2, "125,129": 2, "132,128": 2, "134,127": 2, "120,127": 2, "130,127": 2, "133,127": 2, "135,127": 2, "141,129": 2, "128,126": 85, "134,126": 85, "121,127": 2, "132,129": 2, "122,129": 2, "136,128": 2, "126,128": 88, "121,128": 2, "128,128": 2, "119,128": 2, "128,129": 2, "137,129": 2, "129,127": 2, "115,128": 85, "138,129": 2, "123,128": 2, "123,129": 2, "117,127": 2, "120,128": 2, "140,129": 2, "139,129": 2, "131,127": 2, "119,129": 2, "117,129": 2, "134,128": 2, "137,127": 2, "127,129": 2, "122,127": 2, "131,128": 2, "138,127": 2, "116,127": 2, "123,127": 2, "133,128": 2, "141,128": 2, "119,126": 85, "116,129": 2, "121,129": 2, "122,128": 2, "136,129": 2, "130,129": 2, "131,129": 2, "118,127": 2, "129,129": 2, "127,127": 2, "125,128": 2 }, "lvl-132,130": { "121,132": 2, "122,132": 2, "127,133": 2, "121,131": 2, "130,133": 2, "123,133": 2, "128,132": 2, "132,133": 2, "128,131": 2, "127,131": 2, "129,133": 2, "123,131": 2, "126,133": 2, "130,132": 2, "132,130": 84, "125,132": 2, "132,132": 2, "126,131": 2, "124,133": 2, "122,133": 2, "124,131": 2, "125,133": 2, "131,132": 2, "128,133": 2, "121,133": 2, "129,132": 2, "132,131": 2, "126,132": 2, "124,132": 2, "123,132": 2, "122,131": 2, "125,131": 2, "127,132": 2, "131,133": 2, "130,131": 2, "129,131": 2, "131,131": 2 } };
  var tileSize = { "height": 64, "width": 64 };
  var world = {
  	nameToId: nameToId,
  	idToName: idToName,
  	layers: layers,
  	tileSize: tileSize
  };

  /*
  A 2D tilemap with multiple layers.
  Any combination of layers can be displayed.
  Z-indexing is based on the order layer names are specified.
  */

  var TileMap = function () {
  	function TileMap(gameStage, mapData) {
  		babelHelpers.classCallCheck(this, TileMap);

  		this.root = new PIXI.Container();
  		gameStage.addChild(this.root);

  		// Only stores tilemap values, no sprites/textures
  		// Layer: [Hash: Value, Hash: Value]
  		this.data = {};

  		this.currentLayer = null;

  		// Stores sprites for current layer
  		// {Hash: Sprite, Hash: Sprite}
  		this.sprites = {};

  		// Stores changes for current layer
  		this.changes = {};

  		this.load(mapData);
  	}

  	// Load tilemap data from json


  	babelHelpers.createClass(TileMap, [{
  		key: 'load',
  		value: function load(mapData) {
  			if (mapData) {
  				this.tileSize = mapData.tileSize;
  				this.idToName = mapData.idToName;
  				this.nameToId = mapData.nameToId;

  				// Save layer data (note: should copy if original is needed)
  				this.data = mapData.layers;
  			}
  		}
  	}, {
  		key: 'clear',
  		value: function clear() {
  			this.currentLayer = null;
  			this.root.removeChildren();
  			this.sprites = {};
  			this.changes = {};
  		}

  		// Show all specified layer names (create sprites)

  	}, {
  		key: 'showLayers',
  		value: function showLayers(layers, baseLayer) {
  			if (layers instanceof Array && baseLayer) {
  				this.clear();
  				var _iteratorNormalCompletion = true;
  				var _didIteratorError = false;
  				var _iteratorError = undefined;

  				try {
  					for (var _iterator = layers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
  						var layerName = _step.value;

  						this.addLayer(layerName);
  					}
  				} catch (err) {
  					_didIteratorError = true;
  					_iteratorError = err;
  				} finally {
  					try {
  						if (!_iteratorNormalCompletion && _iterator.return) {
  							_iterator.return();
  						}
  					} finally {
  						if (_didIteratorError) {
  							throw _iteratorError;
  						}
  					}
  				}

  				this.currentLayer = baseLayer;
  			}
  		}

  		// Show just the specified layer

  	}, {
  		key: 'showLayer',
  		value: function showLayer(layerName) {
  			this.clear();
  			this.addLayer(layerName);
  			this.currentLayer = layerName;
  		}
  	}, {
  		key: 'reload',
  		value: function reload() {
  			this.showLayer(this.currentLayer);
  		}
  	}, {
  		key: 'addLayer',
  		value: function addLayer(layerName) {
  			// Generate sprites from logical tilemap
  			var layer = this.data[layerName];
  			for (var tileId in layer) {
  				var position = unhash(tileId);
  				var value = layer[tileId];
  				var sprite = this.createTileSprite(position, value);
  				this.root.addChild(sprite);
  				this.sprites[tileId] = sprite;
  			}
  		}
  	}, {
  		key: 'getTileTexture',
  		value: function getTileTexture(value) {
  			return PIXI.utils.TextureCache[this.idToName[value] + '.png'];
  		}

  		// Get a tile object

  	}, {
  		key: 'getTile',
  		value: function getTile(position) {
  			var tileId = hash(position);
  			if (tileId in this.changes) {
  				return this.changes[tileId];
  			}
  			return this.data[this.currentLayer][tileId];
  		}

  		// Get a tile name

  	}, {
  		key: 'getTileName',
  		value: function getTileName(position) {
  			var tile = this.getTile(position);
  			return tile ? this.idToName[tile] : null;
  		}

  		// Gets the 2D perspective-based pixel position of a tile position

  	}, {
  		key: 'getPerspectivePosition',
  		value: function getPerspectivePosition(tilePosition) {
  			// Return pixel position
  			return {
  				x: tilePosition.x * this.tileSize.width,
  				y: tilePosition.y * this.tileSize.height
  			};
  		}

  		// Creates a new Pixi Sprite with the specified position and texture

  	}, {
  		key: 'createTileSprite',
  		value: function createTileSprite(position, value) {
  			var sprite = new PIXI.Sprite(this.getTileTexture(value));
  			var pixelPosition = this.getPerspectivePosition(position);
  			sprite.position.x = pixelPosition.x;
  			sprite.position.y = pixelPosition.y;
  			sprite.anchor.x = 0.5;
  			sprite.anchor.y = 0.5;
  			return sprite;
  		}
  	}, {
  		key: 'setTile',
  		value: function setTile(position, value) {
  			var tileId = hash(position);
  			this.sprites[tileId].texture = this.getTileTexture(value);
  			this.changes[tileId] = value;

  			// Save changes permanently for the world
  			if (this.currentLayer == 'world') {
  				this.data[this.currentLayer][tileId] = value;
  			}
  		}
  	}, {
  		key: 'setByName',
  		value: function setByName(position, tileName) {
  			this.setTile(position, this.nameToId[tileName]);
  		}
  	}]);
  	return TileMap;
  }();

  var blocking = { "collision": true };
  var blocking2 = { "collision": true };
  var blocking3 = { "collision": true };
  var empty = { "collision": true };
  var normal = { "collision": false };
  var clearing = { "collision": false, "clears": true };
  var checkpoint = { "collision": false, "checkpoint": true, "clears": true };
  var controls_w = { "collision": false };
  var controls_a = { "collision": false };
  var controls_s = { "collision": false };
  var controls_d = { "collision": false };
  var portal_solved = { "collision": false, "portal": true, "clears": true };
  var portal_unsolved = { "collision": false, "portal": true, "clears": true };
  var portal_unexplored = { "collision": false, "portal": true, "clears": true };
  var puzzle_start = { "collision": false, "goal": true, "complete": false };
  var puzzle_start_done = { "collision": false, "goal": true, "complete": true };
  var exit = { "collision": false };
  var color_block_none = { "collision": false, "color": { "block": true, "name": "none" } };
  var color_block_blue = { "collision": false, "color": { "block": true, "name": "blue" } };
  var color_block_yellow = { "collision": false, "color": { "block": true, "name": "yellow" } };
  var color_block_red = { "collision": false, "color": { "block": true, "name": "red" } };
  var color_block_green = { "collision": false, "color": { "block": true, "name": "green" } };
  var color_block_orange = { "collision": false, "color": { "block": true, "name": "orange" } };
  var color_block_purple = { "collision": false, "color": { "block": true, "name": "purple" } };
  var color_block_white = { "collision": false, "color": { "block": true, "name": "white" } };
  var color_block_black = { "collision": false, "color": { "block": true, "name": "black" } };
  var color_adder_none = { "collision": false, "color": { "action": "add", "name": "none" } };
  var color_adder_blue = { "collision": false, "color": { "action": "add", "name": "blue" } };
  var color_adder_yellow = { "collision": false, "color": { "action": "add", "name": "yellow" } };
  var color_adder_red = { "collision": false, "color": { "action": "add", "name": "red" } };
  var color_adder_green = { "collision": false, "color": { "action": "add", "name": "green" } };
  var color_adder_orange = { "collision": false, "color": { "action": "add", "name": "orange" } };
  var color_adder_purple = { "collision": false, "color": { "action": "add", "name": "purple" } };
  var color_adder_white = { "collision": false, "color": { "action": "add", "name": "white" } };
  var color_adder_black = { "collision": false, "color": { "action": "add", "name": "black" } };
  var color_subtractor_none = { "collision": false, "color": { "action": "subtract", "name": "none" } };
  var color_subtractor_blue = { "collision": false, "color": { "action": "subtract", "name": "blue" } };
  var color_subtractor_yellow = { "collision": false, "color": { "action": "subtract", "name": "yellow" } };
  var color_subtractor_red = { "collision": false, "color": { "action": "subtract", "name": "red" } };
  var color_subtractor_green = { "collision": false, "color": { "action": "subtract", "name": "green" } };
  var color_subtractor_orange = { "collision": false, "color": { "action": "subtract", "name": "orange" } };
  var color_subtractor_purple = { "collision": false, "color": { "action": "subtract", "name": "purple" } };
  var color_subtractor_white = { "collision": false, "color": { "action": "subtract", "name": "white" } };
  var color_subtractor_black = { "collision": false, "color": { "action": "subtract", "name": "black" } };
  var color_xor_black = { "collision": false, "color": { "action": "xor", "name": "black" } };
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
  	portal_solved: portal_solved,
  	portal_unsolved: portal_unsolved,
  	portal_unexplored: portal_unexplored,
  	puzzle_start: puzzle_start,
  	puzzle_start_done: puzzle_start_done,
  	exit: exit,
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

  var TileMapUtils = function () {
  	function TileMapUtils(tiles) {
  		babelHelpers.classCallCheck(this, TileMapUtils);

  		this.tiles = tiles;
  	}

  	// Returns entire tile info object from json file


  	babelHelpers.createClass(TileMapUtils, [{
  		key: 'getTileInfo',
  		value: function getTileInfo(position) {
  			var tileName = this.tiles.getTileName(position);
  			if (tileName) {
  				return tileInfo[tileName];
  			}
  			return null;
  		}

  		// Returns a single property from the tile info object

  	}, {
  		key: 'getTileProperty',
  		value: function getTileProperty(type, position, fallback) {
  			var info = this.getTileInfo(position);
  			if (info && type in info) {
  				return info[type];
  			}
  			return fallback;
  		}
  	}, {
  		key: 'movementAllowed',
  		value: function movementAllowed(position, ent) {
  			// Check tilemap
  			var tileInfo = this.getTileInfo(position);
  			var tileCheck = tileInfo && !(tileInfo.collision || this.colorBlockCollision(tileInfo.color, ent));

  			// TODO: Check entities
  			var entityCheck = true;

  			return tileCheck && entityCheck;
  		}
  	}, {
  		key: 'colorBlockCollision',
  		value: function colorBlockCollision(colorInfo, ent) {
  			if (colorInfo && colorInfo.block && ent.has(components.color)) {
  				var colorComp = ent.get(components.color);
  				// Color blocks collide with everything of a different color
  				return colorInfo.name != colorComp.name;
  			}
  			return false;
  		}
  	}]);
  	return TileMapUtils;
  }();

  var tiles = new TileMap(gameStage, world);
  var tilesUtils = new TileMapUtils(tiles);

  // System to initialize everything
  kran.system({
  	init: function init() {
  		// Generate tilemap sprites AFTER the textures are done loading
  		tiles.showLayer('world');
  	}
  });

  /*
  Spatial partitioning system
  Creates a reverse map of tile positions to entities.
  */

  kran.system({
  	components: [components.tilePosition],
  	pre: function pre() {
  		spatialEntityMap.clear();
  	},
  	every: function every(tilePosition, ent) {
  		spatialEntityMap.update(tilePosition, ent);
  	}
  });

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
  /*! Hammer.JS - v2.0.7 - 2016-04-22
   * http://hammerjs.github.io/
   *
   * Copyright (c) 2016 Jorik Tangelder;
   * Licensed under the MIT license */
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
       * @param {Boolean} [merge=false]
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

              // mouse must be down
              if (!this.pressed) {
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

      var DEDUP_TIMEOUT = 2500;
      var DEDUP_DISTANCE = 25;

      function TouchMouseInput() {
          Input.apply(this, arguments);

          var handler = bindFn(this.handler, this);
          this.touch = new TouchInput(this.manager, handler);
          this.mouse = new MouseInput(this.manager, handler);

          this.primaryTouch = null;
          this.lastTouches = [];
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

              if (isMouse && inputData.sourceCapabilities && inputData.sourceCapabilities.firesTouchEvents) {
                  return;
              }

              // when we're in a touch event, record touches to  de-dupe synthetic mouse event
              if (isTouch) {
                  recordTouches.call(this, inputEvent, inputData);
              } else if (isMouse && isSyntheticEvent.call(this, inputData)) {
                  return;
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

      function recordTouches(eventType, eventData) {
          if (eventType & INPUT_START) {
              this.primaryTouch = eventData.changedPointers[0].identifier;
              setLastTouch.call(this, eventData);
          } else if (eventType & (INPUT_END | INPUT_CANCEL)) {
              setLastTouch.call(this, eventData);
          }
      }

      function setLastTouch(eventData) {
          var touch = eventData.changedPointers[0];

          if (touch.identifier === this.primaryTouch) {
              var lastTouch = { x: touch.clientX, y: touch.clientY };
              this.lastTouches.push(lastTouch);
              var lts = this.lastTouches;
              var removeLastTouch = function removeLastTouch() {
                  var i = lts.indexOf(lastTouch);
                  if (i > -1) {
                      lts.splice(i, 1);
                  }
              };
              setTimeout(removeLastTouch, DEDUP_TIMEOUT);
          }
      }

      function isSyntheticEvent(eventData) {
          var x = eventData.srcEvent.clientX,
              y = eventData.srcEvent.clientY;
          for (var i = 0; i < this.lastTouches.length; i++) {
              var t = this.lastTouches[i];
              var dx = Math.abs(x - t.x),
                  dy = Math.abs(y - t.y);
              if (dx <= DEDUP_DISTANCE && dy <= DEDUP_DISTANCE) {
                  return true;
              }
          }
          return false;
      }

      var PREFIXED_TOUCH_ACTION = prefixed(TEST_ELEMENT.style, 'touchAction');
      var NATIVE_TOUCH_ACTION = PREFIXED_TOUCH_ACTION !== undefined;

      // magical touchAction value
      var TOUCH_ACTION_COMPUTE = 'compute';
      var TOUCH_ACTION_AUTO = 'auto';
      var TOUCH_ACTION_MANIPULATION = 'manipulation'; // not implemented
      var TOUCH_ACTION_NONE = 'none';
      var TOUCH_ACTION_PAN_X = 'pan-x';
      var TOUCH_ACTION_PAN_Y = 'pan-y';
      var TOUCH_ACTION_MAP = getTouchActionProps();

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

              if (NATIVE_TOUCH_ACTION && this.manager.element.style && TOUCH_ACTION_MAP[value]) {
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
              var srcEvent = input.srcEvent;
              var direction = input.offsetDirection;

              // if the touch action did prevented once this session
              if (this.manager.session.prevented) {
                  srcEvent.preventDefault();
                  return;
              }

              var actions = this.actions;
              var hasNone = inStr(actions, TOUCH_ACTION_NONE) && !TOUCH_ACTION_MAP[TOUCH_ACTION_NONE];
              var hasPanY = inStr(actions, TOUCH_ACTION_PAN_Y) && !TOUCH_ACTION_MAP[TOUCH_ACTION_PAN_Y];
              var hasPanX = inStr(actions, TOUCH_ACTION_PAN_X) && !TOUCH_ACTION_MAP[TOUCH_ACTION_PAN_X];

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

      function getTouchActionProps() {
          if (!NATIVE_TOUCH_ACTION) {
              return false;
          }
          var touchMap = {};
          var cssSupports = window.CSS && window.CSS.supports;
          ['auto', 'manipulation', 'pan-y', 'pan-x', 'pan-x pan-y', 'none'].forEach(function (val) {

              // If css.supports is not supported but there is native touch-action assume it supports
              // all values. This is the case for IE 10 and 11.
              touchMap[val] = cssSupports ? window.CSS.supports('touch-action', val) : true;
          });
          return touchMap;
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
      Hammer.VERSION = '2.0.7';

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
          this.oldCssProps = {};

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
              if (events === undefined) {
                  return;
              }
              if (handler === undefined) {
                  return;
              }

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
              if (events === undefined) {
                  return;
              }

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
          var prop;
          each(manager.options.cssProps, function (value, name) {
              prop = prefixed(element.style, name);
              if (add) {
                  manager.oldCssProps[prop] = element.style[prop];
                  element.style[prop] = value;
              } else {
                  element.style[prop] = manager.oldCssProps[prop] || '';
              }
          });
          if (!add) {
              manager.oldCssProps = {};
          }
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
  		// this.initTouchInput()
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

  			// Reset keys
  			key.down = false;
  		}
  		// Prevent the ID from overflowing
  		if (maxId == 0) {
  			this.id = 0;
  		}
  	},

  	every: function every(input) {
  		// Copy values so component can be modified safely
  		input.delta.x = this.moveDelta.x;
  		input.delta.y = this.moveDelta.y;
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

  	keyPressed: function keyPressed(key) {
  		// Change key state and increment ID
  		this.keys[key].down = true;
  		this.keys[key].lastId = ++this.id;
  	},

  	// Setup keyboard input
  	bindKey: function bindKey(key) {
  		var _this = this;

  		Mousetrap$1.bind(key, function () {
  			_this.keyPressed(key);
  		});
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
  	}

  });

  // Handles checkpoint restores
  /*	initTouchInput: function() {
  		hammertime.on('panleft panright panup pandown', (ev) => {
  			// Map angle to key/direction based on 90 degree-wide sector
  			let angle = ev.angle
  			this.currentKey = ''
  			if (angle >= -45 && angle < 45) {
  				this.currentKey = 'd'
  			} else if (angle >= 45 && angle < 135) {
  				this.currentKey = 's'
  			} else if (angle >= -135 && angle < -45) {
  				this.currentKey = 'w'
  			} else if (angle >= 135 || angle < -135) {
  				this.currentKey = 'a'
  			}

  			this.resetKeys()
  			this.keyChanged(this.currentKey, true)
  		})
  		hammertime.on('panend', (ev) => {
  			this.currentKey = ''
  			this.resetKeys()
  		})
  	}*/
  kran.system({
  	components: [components.inputCheckpoint],
  	triggered: false,
  	initKeyboardInput: function initKeyboardInput() {
  		var _this2 = this;

  		Mousetrap$1.bind('esc', function () {
  			_this2.triggered = true;
  		});
  	},
  	initTouchInput: function initTouchInput() {
  		var _this3 = this;

  		// Setup pinch input
  		hammertime.get('pinch').set({ enable: true });
  		hammertime.on('pinchin', function (ev) {
  			_this3.triggered = true;
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

  /*
  A simple array-based event system.
  Sending events will push them to a separate array for each event type.
  To receive events, simply iterate through the events of a certain type.
  	Note: Should clear events before sending more (or right after receiving them)
  */

  var Events = function () {
  	function Events() {
  		babelHelpers.classCallCheck(this, Events);

  		this.data = {};
  	}

  	babelHelpers.createClass(Events, [{
  		key: "send",
  		value: function send(type, message) {
  			if (!(type in this.data)) {
  				this.data[type] = [];
  			}
  			this.data[type].push(message);
  		}
  	}, {
  		key: "loop",
  		value: function loop(type, handler) {
  			if (type in this.data) {
  				var messages = this.data[type];
  				var _iteratorNormalCompletion = true;
  				var _didIteratorError = false;
  				var _iteratorError = undefined;

  				try {
  					for (var _iterator = messages[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
  						var message = _step.value;

  						handler(message);
  					}
  				} catch (err) {
  					_didIteratorError = true;
  					_iteratorError = err;
  				} finally {
  					try {
  						if (!_iteratorNormalCompletion && _iterator.return) {
  							_iterator.return();
  						}
  					} finally {
  						if (_didIteratorError) {
  							throw _iteratorError;
  						}
  					}
  				}
  			}
  		}

  		// Clears events of the specified type, or will clear all types

  	}, {
  		key: "clear",
  		value: function clear(type) {
  			if (type) {
  				delete this.data[type];
  			} else {
  				this.data = {};
  			}
  		}
  	}]);
  	return Events;
  }();

  var events = new Events();

  /*
  System for handling the logic of creating/removing/merging/swapping clones.
  */
  kran.system({
  	init: function init() {
  		var _this = this;

  		// Create initial player entity
  		var startPos = {
  			x: 126,
  			y: 129
  		};
  		active.player = this.createPlayer(startPos);

  		// Bind cloning/swapping keys
  		var cloneFunc = function cloneFunc() {
  			_this.clone();
  		};
  		Mousetrap.bind('space', cloneFunc);
  	},
  	clone: function clone() {
  		var results = this.scan();
  		if (results.clone) {
  			this.swapToClone(results);
  		} else if (results.position) {
  			this.addClone(results);
  		} else {
  			console.log('Cannot clone/swap here.');
  		}
  	},
  	scan: function scan() {
  		// Data returned to swapping/cloning function
  		var results = {
  			clone: null,
  			position: null
  		};

  		// Get active player's current position and direction
  		var currentPosition = active.player.get(components.tilePosition);
  		var currentDirection = active.player.get(components.cloneTool).directionDelta;
  		var pos = {
  			x: currentPosition.x,
  			y: currentPosition.y
  		};
  		var done = false;

  		// Scan from current position in current direction
  		while (!done) {
  			pos.x += currentDirection.x;
  			pos.y += currentDirection.y;

  			// Check for an existing clone first
  			var ent = spatialEntityMap.get(pos);
  			if (ent && ent.has(components.player)) {
  				results.clone = ent;
  				done = true;
  			}
  			// Then check for collisions to know where to stop
  			else if (!tilesUtils.movementAllowed(pos, active.player)) {
  					// Use previous position where movement was allowed
  					results.position = {
  						x: pos.x - currentDirection.x,
  						y: pos.y - currentDirection.y
  					};
  					done = true;
  				}
  		}

  		// Make sure this isn't just the tile we are standing on
  		if (results.position != null && results.position.x == currentPosition.x && results.position.y == currentPosition.y) {
  			results.position = null;
  		}

  		return results;
  	},
  	addClone: function addClone(results) {
  		var cloneTool = active.player.get(components.cloneTool);
  		if (cloneTool && cloneTool.count > 0) {
  			console.log('Creating clone at: ' + JSON.stringify(results));
  			cloneTool.use();
  			this.createPlayer(results.position, active.player);
  		} else {
  			console.log('No more clones available.');
  		}
  	},
  	swapToClone: function swapToClone(results) {
  		console.log('Swapping to clone...');
  		// Remove clone gun/camera from active player
  		var options = active.player.get(components.cloneTool).getOptions();
  		active.player.remove(components.cloneTool);
  		active.player.remove(components.cameraFollows);
  		active.player.get(components.mergable).isParent = false;

  		// Set active player
  		active.player = results.clone;

  		// Add clone gun/camera to active player
  		active.player.add(components.cameraFollows);
  		active.player.add(components.cloneTool, active.player.get(components.sprite));
  		active.player.get(components.cloneTool).setOptions(options);
  		active.player.get(components.mergable).isParent = true;
  	},

  	createPlayer: function createPlayer(tilePosition, cloneFrom) {
  		// Create player entity
  		var player = kran.entity().add(components.player).add(components.inputMovement).add(components.tilePosition, tilePosition.x, tilePosition.y).add(components.sprite, gameStage, 'player_none.png', 'player_').add(components.color).add(components.mergable, !cloneFrom);
  		// .add(comps.color, playerState.color)

  		if (cloneFrom) {
  			// Copy color and other states
  			player.get(components.color).change(cloneFrom.get(components.color).name);
  			console.log('createPlayer(): cloning');
  		} else {
  			// Must be original if not cloning from anything
  			player.add(components.cameraFollows);
  			player.add(components.cloneTool, player.get(components.sprite));
  			console.log('createPlayer(): original');
  		}

  		// Make sure events are triggered
  		events.send('move', { entity: player });

  		return player;
  	}
  });

  /*
  System to detect and handle collisions

  	Note: Unsure about handling blocks and other entites with this system...
  		Will need some sort of feedback or recursion. Maybe have callbacks stored
  		inside components that handle special collision cases right away.

  Steps for movement:
  	Input system:
  		Sets delta values of input-controllable entities
  	Collision system:
  		Computes target position from delta values
  		Checks target position for collision
  		If movement is allowed, then send move event
  	Movement system:
  		Handle move events, move entites
  		Send more events for other systems to handle custom game logic
  	Custom systems:
  		Handle movement events --> May need to go back to collision system here
  		Maybe callbacks can replace these systems, so the collision system can
  			handle everything and go back to checking collision
  	View system:
  		Update the sprite positions and everything from the data
  */
  kran.system({
  	components: [components.inputMovement, components.tilePosition],
  	init: function init() {
  		var inputEnt = kran.entity();

  		// Setup checkpoint handler
  		// inputEnt.add(comps.inputCheckpoint, () => { this.returnToCheckpoint() })

  		// Setup locking handler (will remove as soon as proper movement handling is implemented)
  		inputEnt.add(components.action, 'l');
  		this.lockInput = inputEnt.get(components.action);

  		// Testing clones (will remove later - as soon as clone tiles/entities are available)
  		Mousetrap.bind('o', function () {
  			if (active.player) {
  				var cloneTool = active.player.get(components.cloneTool);
  				if (cloneTool) {
  					cloneTool.setClones(cloneTool.count - 1);
  				}
  			}
  		});

  		Mousetrap.bind('p', function () {
  			if (active.player) {
  				var cloneTool = active.player.get(components.cloneTool);
  				if (cloneTool) {
  					cloneTool.setClones(cloneTool.count + 1);
  				}
  			}
  		});
  	},
  	every: function every(inputMovement, tilePosition, ent) {
  		if (inputMovement.delta.x != 0 || inputMovement.delta.y != 0) {

  			// Update clone tool direction
  			var cloneTool = ent.get(components.cloneTool);
  			if (cloneTool) {
  				cloneTool.setDirection(inputMovement.delta);
  			}

  			// Only move if the lock key is not pressed
  			if (!this.lockInput.pressed) {
  				// Move entity if movement is allowed
  				var target = this.computeTarget(inputMovement, tilePosition, ent);

  				// TODO: Also check entities, and handle collision logic based on both entity positions
  				// Just need to use the spatial map...
  				if (tilesUtils.movementAllowed(target, ent)) {
  					events.send('move', {
  						entity: ent,
  						position: target
  					});
  				}
  			}
  		}
  	},
  	computeTarget: function computeTarget(inputMovement, tilePosition, ent) {
  		// Use input offset to determine new target location
  		return {
  			x: tilePosition.x + inputMovement.delta.x,
  			y: tilePosition.y + inputMovement.delta.y
  		};

  		// Note: Could apply mirror component here for mirrored movement
  	}

  	/*************************************************************
   NOTE: LOTS OF GAME LOGIC HERE - Should put this somewhere else
   *************************************************************/

  	/*
   		// Update checkpoint
   		if (info.checkpoint) {
   			this.checkpoint = {
   				position: {
   					x: pos.x,
   					y: pos.y
   				}
   			}
   		}
   
   	// TODO: Move to checkpoint system (and use a trigger)
   	checkpoint: null,
   	returnToCheckpoint: function() {
   		// Move player back to puzzle checkpoint
   		// TODO: Reset to previous game state as well
   			// This includes removing player clones, player state, tile/puzzle states
   		if (this.checkpoint && state.active.player) {
   			this.moveEntity(state.active.player, this.checkpoint.position)
   			state.active.player.get(comps.color).clear()
   		}
   	}
   */
  });

  /*
  Handles moving entities from move events.
  Note: Could trigger a "move" component on entities that need to move, but still unsure how Kran handles ordering events...
  */
  kran.system({
  	// Handle all move events
  	pre: function pre() {
  		var _this = this;

  		events.clear('exitedTile');
  		events.clear('enteredTile');

  		// Move entities and trigger events like normal
  		events.loop('move', function (message) {
  			_this.moveEntity(message.entity, message.position, true);
  		});

  		// Move entities but do not trigger any events
  		events.loop('setPosition', function (message) {
  			_this.moveEntity(message.entity, message.position, false);
  		});

  		events.clear('move');
  		events.clear('setPosition');
  	},

  	// Send a movement event (entered, exited, etc.)
  	sendEvent: function sendEvent(name, ent, pos) {
  		var info = tilesUtils.getTileInfo(pos);
  		events.send(name, {
  			entity: ent,
  			tile: info,
  			position: {
  				x: pos.x,
  				y: pos.y
  			}
  		});
  	},

  	// Send exitedTile/enteredTile events and move an entity
  	moveEntity: function moveEntity(ent, target) {
  		var trigger = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

  		var tilePosition = ent.get(components.tilePosition);

  		// Only change position if target is specified
  		if (target) {
  			// Trigger exit event
  			if (trigger && (tilePosition.x != target.x || tilePosition.y != target.y)) {
  				this.sendEvent('exitedTile', ent, tilePosition);
  			}

  			// Set position of entity
  			tilePosition.x = target.x;
  			tilePosition.y = target.y;
  		}

  		if (trigger) {
  			// Trigger enter event
  			this.sendEvent('enteredTile', ent, tilePosition);
  		}
  	}
  });

  /*
  System for handling clear events, which clear the player's states.
  */
  kran.system({
  	pre: function pre() {
  		events.loop('clearPlayer', function (message) {
  			// Remove clones
  			// Reset color state
  			console.log('clearPlayer event received');
  			var total = 0;
  			var removed = 0;
  			// Kran's getEntityCollection returns no entities with the player component for some reason
  			// This behaivor is not documented, and does not do what is expected...
  			kran.getEntityCollection([components.player]).ents.forEach(function (ent) {
  				++total;
  				// Only remove clones, not the player
  				if (!ent.has(components.cloneTool)) {
  					events.send('cloneDied');
  					ent.delete();
  					++removed;
  				}
  			});
  			console.log(removed + ' removed out of ' + total + ' total');
  		});
  		events.clear('clearPlayer');
  	}
  });

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

  /*
  System for handling color logic, such as stepping on a color tile.
  */
  kran.system({
  	pre: function pre() {
  		var _this = this;

  		events.loop('enteredTile', function (message) {
  			_this.changeColor(message);
  		});
  	},
  	changeColor: function changeColor(message) {
  		var info = message.tile;
  		var colorComp = message.entity.get(components.color);

  		if (info && colorComp) {
  			// Clear entity of any special states
  			if (info.clears) {
  				colorComp.clear();
  			}

  			// Mix colors from color tiles
  			if ('color' in info && 'action' in info.color) {
  				var newColor = mixColors(colorComp.name, info.color.name, info.color.action);
  				colorComp.change(newColor);
  			}
  		}
  	}
  });

  /*
  Handles merging collided entities with each other.
  */
  kran.system({
  	pre: function pre() {
  		// Go through all collisions
  		var collisions = spatialEntityMap.collisions;
  		for (var collisionHash in collisions) {
  			var collisionArray = collisions[collisionHash];

  			// Merge the first entity with the rest
  			var entA = collisionArray[0];
  			for (var i = 1; i < collisionArray.length; ++i) {
  				var entB = collisionArray[i];

  				// Entity A may change if it's a child, and be replaced with B
  				entA = this.merge(entA, entB);
  			}

  			// At this point, all entities have been merged into entity A
  			// Clear the collisions and update the spatial map
  			collisionArray.length = 0;
  			spatialEntityMap.hashToEntity[collisionHash] = entA;
  			// Note: Nothing should be referring to this afterwards, and it should be cleared before anything accesses it
  		}
  	},
  	merge: function merge(entA, entB) {
  		// Determine which entity to merge into the other
  		// Note: Only really matters if one is a parent (to keep the clone tool/camera on the active player for example)
  		var entC = null;
  		var mergableA = entA.get(components.mergable);
  		var mergableB = entB.get(components.mergable);
  		if (mergableA && mergableB) {
  			if (mergableA.isParent) {
  				entC = this.mergeComponents(entA, entB);
  			} else {
  				entC = this.mergeComponents(entB, entA);
  			}
  		} else {
  			console.log("Error: Cannot merge entities.");
  		}
  		if (!entC) {
  			console.log("Warning: Nothing was merged?");
  			entC = entA;
  		}
  		return entC;
  	},
  	mergeComponents: function mergeComponents(entA, entB) {
  		// Merge colors
  		var colorA = entA.get(components.color);
  		var colorB = entB.get(components.color);
  		if (colorA && colorB) {
  			colorA.change(mixColors(colorA.name, colorB.name));
  		}

  		// TODO: Add other merge logic here (magnetism? something else?)

  		// Notify that a clone has died, to update the clone tool count
  		if (entB.has(components.player)) {
  			events.send('cloneDied');
  		}

  		// Delete other entity and return entity which was merged into
  		entB.delete();
  		return entA;
  	}
  });

  /*
  Updates clone tool components from certain events.
  */

  kran.system({
  	components: [components.cloneTool],
  	every: function every(cloneTool) {
  		events.loop('cloneDied', function (message) {
  			cloneTool.add();
  		});
  	},
  	post: function post() {
  		events.clear('cloneDied');
  	}
  });

  /*
  System for handling level logic.
  	Entering levels
  	Exiting levels
  	Restarting levels
  	Finishing levels
  */
  kran.system({
  	inLevel: null,
  	prefix: 'lvl-',
  	init: function init() {
  		var _this = this;

  		Mousetrap.bind('esc', function () {
  			if (_this.inLevel) {
  				_this.exitLevel();
  			}
  		});
  		Mousetrap.bind('r', function () {
  			if (_this.inLevel) {
  				_this.restartLevel();
  			}
  		});
  	},
  	pre: function pre() {
  		var _this2 = this;

  		events.loop('enteredTile', function (message) {
  			if (!_this2.inLevel && message.tile.portal) {
  				_this2.enterLevel(message.position);
  			} else if (_this2.inLevel && message.tile.goal && message.tile.complete) {
  				_this2.completeLevel();
  			}
  		});
  	},
  	getLevelStartPosition: function getLevelStartPosition() {
  		if (this.inLevel) {
  			return unhash(this.inLevel.substr(this.prefix.length));
  		}
  		return null;
  	},
  	resetPlayerPosition: function resetPlayerPosition() {
  		// Reset player position (without triggering new events)
  		var pos = this.getLevelStartPosition();
  		events.send('setPosition', {
  			entity: active.player,
  			position: pos
  		});
  		this.clearAndCenter();
  		return pos;
  	},
  	enterLevel: function enterLevel(position) {
  		// Load level
  		this.inLevel = this.prefix + hash(position);
  		tiles.showLayer(this.inLevel);

  		this.clearAndCenter();
  	},
  	exitLevel: function exitLevel() {
  		var portalState = arguments.length <= 0 || arguments[0] === undefined ? 'portal_unsolved' : arguments[0];

  		var pos = this.resetPlayerPosition();

  		// Show world layer (outside of level)
  		tiles.showLayer('world');

  		// Update portal tile
  		tiles.setByName(pos, portalState);

  		this.inLevel = null;
  	},
  	completeLevel: function completeLevel() {
  		// Mark as completed and exit the level
  		this.exitLevel('portal_solved');
  	},
  	restartLevel: function restartLevel() {
  		// Clear changes to current layer
  		tiles.reload();

  		// Reset player position
  		this.resetPlayerPosition();
  	},
  	clearAndCenter: function clearAndCenter() {
  		// Clear player states
  		events.send('clearPlayer');

  		// Center camera
  		// events.send('centerCamera')
  		active.player.get(components.cameraFollows).center = true;
  	}
  });

  // The 'View' in MVC
  // Updates the view from changes to the model

  // Update positions
  kran.system({
  	components: [components.tilePosition, components.sprite],
  	every: function every(tilePosition, sprite, ent) {
  		// Update sprite position
  		sprite.s.position = tiles.getPerspectivePosition(tilePosition);
  	}
  });

  // Update colors
  kran.system({
  	components: [components.color, components.sprite],
  	every: function every(color, sprite, ent) {
  		// Update sprite texture
  		var textureName = sprite.base + color.name + '.png';
  		sprite.s.texture = PIXI.utils.TextureCache[textureName];
  	}
  });

  // Run update() for tween.js
  // Note: Using a system so it runs in the correct order
  kran.system({
  	pre: function pre() {
  		TWEEN.update(dt.total);
  	}
  });

  // Handles updating camera (stage) position based on followsCamera components
  kran.system({
  	components: [components.sprite, components.cameraFollows],
  	every: function every(sprite, follow) {
  		var position = sprite.s.position;

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
  		gameStage.position.x = -follow.deadzone.x + follow.borderSize.x;
  		gameStage.position.y = -follow.deadzone.y + follow.borderSize.y;
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