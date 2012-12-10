require('serializers/server_serializer');

var get = Ember.get, set = Ember.set;

/**
  A stripped-down version of the RESTAdapter. 
  TODO: Since only 2-3 methods are used from RESTAdapter,
  consider extending from DS.Adapter. 
 */
DS._ServerAdapter = DS.RESTAdapter.extend({
  serializer: DS._ServerSerializer,

  init: function() {
    this._super();

    ['didCreateRecord', 'didCreateRecords', 'didUpdateRecord', 
     'didUpdateRecords', 'didDeleteRecord', 'didDeleteRecords'].forEach(function(name) {
      this[name] = function(store, type, records, json) {
        this.didUpSync(store);
      };
    }, this);
  },

  _setServerOptions: function(options) {
    this.setProperties(options);
    get(this, 'serializer').setProperties(options);
  },

  // On up-sync completed, send a down-sync immediately.
  // This is crucial to ensure that the max-modified timestamp is updated correctly.
  // The response will also include records from the previous up-sync, therefore aknowledging up-sync success. 
  didUpSync: function(store) {
    this.downSync(store);
  },

  // Only send the maxModified timestamp
  // Server should respond with records modified after maxModified.
  downSync: function(store) {
    var url = this.downSyncPath;
    
    var hash = {}; hash.data = {};
    hash.data[this.keyForMaxModified] = get(store, 'maxModified');
    hash.success = function(json) {
      this.didDownSync(store, json);
    };

    this.ajax(url, "POST", hash);
  },

  // Delegate down-syncing to the client store. The client store
  // will handle creating/updating/deleting records in the client storage.
  didDownSync: function(store, json) {
    var type, hashes, timestamps;
    var maxModified = get(store, 'maxModified');

    for (var key in json) {
      type = this.keyToType(key);
      hashes = Ember.isArray(json[key]) ? json[key] : [json[key]];

      hashes.forEach(function(hash) {
        var timestamps = this.getTimestamps(hash);
        store.downSyncRecord(type, hash, timestamps, maxModified);
      }, this);
    }

    store.didCompleteDownSync();
  },

  // Because the server responds with multiple model objects in the down-sync
  // this method is used to map JSON keys to modelTypes. The mappings should be provided by the app.
  // TODO: NEED to find a way to avoid this.
  keyToType: function(key) {
    return Ember.get(this.mappings[key] || this.mappings[this.pluralize(key)]);
  },

  getTimestamps: function(hash) {
    return {
      createdAt: hash[this.keyForCreated],
      updatedAt: hash[this.keyForUpdated],
      deletedAt: hash[this.keyForDeleted]
    };
  }
});