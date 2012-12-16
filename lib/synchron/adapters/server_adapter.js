var get = Ember.get, set = Ember.set;

DS._ServerAdapter = DS.RESTAdapter.extend({
  init: function() {
    this._super();

    this._setupWriteCallbacks();
    // this._attachMaxModifiedToAjax();
  },

  // If the server request is a write (PUT/POST/DELETE)
  // or the request url matches the GET downSync url
  // attach maxModified timestamp to request data
  // _attachMaxModifiedToAjax: function() {
  //   var keyForMaxModified = this.keyForMaxModified;
  //   var writeTypes = ['POST', 'PUT', 'DELETE'];

  //   var parentAdapter = get(this, 'parentAdapter');

  //   $.ajaxPrefilter(function (options, originalOptions, jqXHR) {
  //     if(writeTypes.indexOf(originalOptions.type) !== -1 || writeTypes.indexOf(options.type) !== -1) {
  //       var maxModified = get(parentAdapter, 'maxModified');
  //       options.data = $.extend(originalOptions.data, { keyForMaxModified: maxModified });
  //     }
  //   });
  // },

  _setupWriteCallbacks: function() {
    ['didCreateRecord', 'didUpdateRecord', 'didDeleteRecord', 
    'didCreateRecords', 'didUpdateRecords', 'didDeleteRecords'].forEach(function(methodName) {
      this[methodName] = this.didSaveRecords;
    });
  },

  didSaveRecords: function(store, type, records, json) {
    if (Ember.isArray(records)) {
      this.parentAdapter.didUpSyncRecords(store, type, records);
    } else {
      this.parentAdapter.didUpSyncRecord(store, type, records);
    }

    // var parentAdapter = this.parentAdapter;

    // var rootForPending = this.keyForPendingDownSync;
    // parentAdapter.savePendingDownSyncRecords(store, json && json[rootForPending]);

    // var rootForDownSyncRecords = this.keyForDownSyncRecords;
    // parentAdapter.downSyncRecords(store, json && json[rootForDownSyncRecords]);
  },

  didFindAll: function(store, type, json) {
    var root = this.pluralize(this.rootForType(type));
    this.parentAdapter.downSyncRecords(store, type, json[root]);
  }
});

