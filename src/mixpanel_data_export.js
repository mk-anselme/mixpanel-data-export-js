var md5 = require("blueimp-md5").md5;
var Q = require("q");
var _ = {
  extend: require('amp-extend'),
};

if (typeof window !== "object" && typeof require === "function") {
  var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
}

var MixpanelExport = (function() {

  function MixpanelExport(opts) {
    this.opts = opts;
    if (!(this.opts.api_key && this.opts.api_secret)) {
      throw "Error: api_key and api_secret must be passed to MixpanelExport constructor.";
    }
    this.api_key = this.opts.api_key;
    this.api_secret = this.opts.api_secret;
    this.timeout_after = this.opts.timeout_after || 10;
    this.isNode = (typeof window !== 'object');
    this._requestNumber = 0;
  }

  MixpanelExport.prototype.export = function(parameters, callback) {
    if (!this.isNode) throw new Error(this._jsonpUnsupported("export"));
    return this.get("export", parameters, callback);
  };

  MixpanelExport.prototype.engage = function(parameters, callback) {
    if (!this.isNode) throw new Error(this._jsonpUnsupported("engage"));
    return this.get(["engage"], parameters, callback);
  };

  MixpanelExport.prototype.annotations = function(parameters, callback) {
    return this.get("annotations", parameters, callback);
  };

  MixpanelExport.prototype.createAnnotation = function(parameters, callback) {
    return this.get(["annotations", "create"], parameters, callback);
  };

  MixpanelExport.prototype.updateAnnotation = function(parameters, callback) {
    return this.get(["annotations", "update"], parameters, callback);
  };

  MixpanelExport.prototype.events = function(parameters, callback) {
    return this.get("events", parameters, callback);
  };

  MixpanelExport.prototype.topEvents = function(parameters, callback) {
    return this.get(["events", "top"], parameters, callback);
  };

  MixpanelExport.prototype.eventNames = function(parameters, callback) {
    return this.get(["events", "names"], parameters, callback);
  };

  MixpanelExport.prototype.eventProperties = function(parameters, callback) {
    return this.get(["events", "properties"], parameters, callback);
  };

  MixpanelExport.prototype.topEventProperties = function(parameters, callback) {
    return this.get(["events", "properties", "top"], parameters, callback);
  };

  MixpanelExport.prototype.eventPropertyValues = function(parameters, callback) {
    return this.get(["events", "properties", "values"], parameters, callback);
  };

  MixpanelExport.prototype.funnels = function(parameters, callback) {
    return this.get(["funnels"], parameters, callback);
  };

  MixpanelExport.prototype.listFunnels = function(parameters, callback) {
    return this.get(["funnels", "list"], parameters, callback);
  };

  MixpanelExport.prototype.segmentation = function(parameters, callback) {
    return this.get(["segmentation"], parameters, callback);
  };

  MixpanelExport.prototype.numericSegmentation = function(parameters, callback) {
    return this.get(["segmentation", "numeric"], parameters, callback);
  };

  MixpanelExport.prototype.sumSegmentation = function(parameters, callback) {
    return this.get(["segmentation", "sum"], parameters, callback);
  };

  MixpanelExport.prototype.averageSegmentation = function(parameters, callback) {
    return this.get(["segmentation", "average"], parameters, callback);
  };

  MixpanelExport.prototype.retention = function(parameters, callback) {
    return this.get(["retention"], parameters, callback);
  };

  MixpanelExport.prototype.addiction = function(parameters, callback) {
    return this.get(["retention", "addiction"], parameters, callback);
  };

  MixpanelExport.prototype.get = function(method, parameters, callback) {
    var deferred = Q.defer();
    var getMethod = ((this.isNode) ? 'node' : 'jsonp');

    this['_'+ getMethod + 'Get'](method, parameters, function(data) {
      if (callback) {
        return callback(data);
      }
      deferred.resolve(data);
    });

    return deferred.promise;
  };

  MixpanelExport.prototype._jsonpGet = function(method, parameters, callback) {
    var self = this;
    var requestNumber = this._requestNumber++ // Allows us to make multiple calls in parallel.
    var requestUrl = this._buildRequestURL(method, parameters) + "&callback=mpSuccess" + requestNumber;
    var script = document.createElement("script");

    window['mpSuccess' + requestNumber] = function(response) {
      callback(self._parseResponse(method, parameters, response));
    };
    script.src = requestUrl;
    document.getElementsByTagName("head")[0].appendChild(script);
  };

  MixpanelExport.prototype._nodeGet = function(method, parameters, callback) {
    var self = this;
    var request = new XMLHttpRequest;

    request.open("get", this._buildRequestURL(method, parameters), true)
    request.onload = function() {
      callback(self._parseResponse(method, parameters, this.responseText));
    };
    request.send();
  };

  var Export_stream_object = function(method, parameters, mixpanel){
    this.method = method;
    this.parameters = parameters;
    this.mixpanel = mixpanel;
    this.readable_stream = (require('request'))(mixpanel._buildRequestURL(method, parameters));
  };
  var EventEmitter = require('events').EventEmitter;
  var util = require('util');
  util.inherits(Export_stream_object, EventEmitter);

  Export_stream_object.prototype.run = function() {
    var self = this;
    var split = require('split');
    this.readable_stream
      .pipe(split())
      .on('data', function(line) {
        if (line === null || line === '') {
          // self.emit('end');
        }
        else {
          var data;
          try {
            data = JSON.parse(line);
            self.emit('data', data);
          }
          catch(err) {
            var msg = 'Error: could not parse line: ' + line;
            console.error(msg);
            console.error(typeof line);
            self.emit('error',msg);
          }
        }
      })
      .on('end', function(line) {
        self.emit('end');
      })
      .on('error', function(err) {
        self.emit('error',err);
      });
  };

  Export_stream_object.prototype.pause = function() {
    this.readable_stream.pause();
  };

  Export_stream_object.prototype.resume = function() {
    this.readable_stream.resume();
  };

  MixpanelExport.prototype.exportStream = function(parameters) {
    return new Export_stream_object('export', parameters, this);
  };

  MixpanelExport.prototype._jsonpUnsupported = function(methodName) {
    return "MixpanelExport: The '" + methodName + "' method does not support jsonp, and so cannot be used in your browser.";
  };

  // Parses Mixpanel's strange formatting for the export endpoint.
  MixpanelExport.prototype._parseResponse = function(method, parameters, result) {
    if (parameters && parameters.format === "csv") {
      return result;
    }

    if (typeof result === "object") {
      return result;
    }

    if (method === "export") {
      var step1 = result.replace(new RegExp('\n', 'g'), ',');
      var step2 = '['+step1+']';
      var result = step2.replace(',]', ']');
      return JSON.parse(result);
    }

    return JSON.parse(result);
  };

  MixpanelExport.prototype._buildRequestURL = function(method, parameters) {
    var apiStub = (method === "export") ? "https://data.mixpanel.com/api/2.0/" : "https://mixpanel.com/api/2.0/";
    return "" + apiStub + ((typeof method.join === "function" ? method.join("/") : void 0) || method) + "/?" + (this._requestParameterString(parameters));
  };

  MixpanelExport.prototype._requestParameterString = function(args) {
    var connection_params = _.extend({
      api_key: this.api_key,
      expire: this._expireAt()
    }, args);
    var keys = Object.keys(connection_params).sort();
    var sig_keys = keys.filter(function(key) {
      return key !== "callback"
    });

    return this._getParameterString(keys, connection_params) + "&sig=" + this._getSignature(sig_keys, connection_params);
  };

  MixpanelExport.prototype._getParameterString = function(keys, connection_params) {
    var self = this;

    return keys.map(function(key) {
      return "" + key + "=" + (self._urlEncode(connection_params[key]));
    }).join("&");
  };

  MixpanelExport.prototype._getSignature = function(keys, connection_params) {
    var self = this;

    var sig = keys.map(function(key) {
      return "" + key + "=" + (self._stringifyIfArray(connection_params[key]));
    }).join("") + this.api_secret;

    return md5(sig);
  };

  MixpanelExport.prototype._urlEncode = function(param) {
    return encodeURIComponent(this._stringifyIfArray(param));
  };

  MixpanelExport.prototype._stringifyIfArray = function(array) {
    if (!Array.isArray(array)) {
      return array;
    }

    return JSON.stringify(array);
  };

  MixpanelExport.prototype._expireAt = function() {
    return Math.round(new Date().getTime() / 1000) + this.timeout_after;
  };

  return MixpanelExport;
})();

module.exports = MixpanelExport;
