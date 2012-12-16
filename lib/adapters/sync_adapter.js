require('synchron/config');
require('synchron/models');
require('synchron/adapters/server_adapter');
require('synchron/down_syncer');
require('synchron/up_syncer');

var get = Ember.get, set = Ember.set, getEach = Ember.getEach

DS.SyncAdapter = DS.Adapter.extend({
  // Default options for server communication
  keyForCreatedAt: 'created_at',
  keyForUpdatedAt: 'updated_at',
  keyForDeletedAt: 'deleted_at',

  // ................
  // . FIND RECORDS .
  // .   proxied    .
  // ................

  find: function(store, type, id) {
    this.clientAdapter.find(store, type, id);
  },

  findAll: function(store, type, since) {
    this.clientAdapter.findAll(store, type, since);
  },

  findQuery: function(store, type, query, recordArray) {
    this.clientAdapter.findQuery(store, type, query, recordArray);
  },

  findMany: function(store, type, ids) {
    this.clientAdapter.findMany(store, type, ids);
  },

  // ...................
  // .  WRITE RECORDS  .
  // .     proxied     .
  // ...................

  // CREATE

  createRecord: function(store, type, record) {
    this.upSyncer.savePending(store, type, get(record, 'id'), 'created');

    this.clientAdapter.createRecord(store, type, record);
    this.serverAdapter.createRecord(store, type, record);
  },

  createRecords: function(store, type, records) {
    this.upSyncer.savePending(store, type, getEach(records, 'id'), 'created');

    this.clientAdapter.createRecords(store, type, records);
    this.serverAdapter.createRecords(store, type, records);
  },

  // UPDATE

  updateRecord: function(store, type, record) {
    this.upSyncer.savePending(store, type, get(record, 'id'), 'updated');

    this.clientAdapter.updateRecord(store, type, record);
    this.serverAdapter.updateRecord(store, type, record);
  },

  updateRecords: function(store, type, records) {
    this.upSyncer.savePending(store, type, getEach(records, 'id'), 'updated');

    this.clientAdapter.updateRecords(store, type, records);
    this.serverAdapter.updateRecords(store, type, records);
  },

  // DELETE

  deleteRecord: function(store, type, record) {
    this.upSyncer.savePending(store, type, get(record, 'id'), 'deleted');

    this.clientAdapter.deleteRecord(store, type, record);
    this.serverAdapter.deleteRecord(store, type, record);
  },

  deleteRecords: function(store, type, records) {
    this.upSyncer.savePending(store, type, getEach(records, 'id'), 'deleted');

    this.clientAdapter.deleteRecords(store, type, records);
    this.serverAdapter.deleteRecords(store, type, records);
  },

  // ...................
  // .  SYNC METHODS   .
  // ...................

  sync: function(store) {
    if (get(upSyncer, 'upSyncer.pendings.length') === 0) {
      get(this, 'downSyncer').sync(store);
    } else {
      set(this, 'syncAll', true);
      get(this, 'upSyncer').sync(store);
    }
  },

  didUpSyncAll: function(store) {
    if (get(this, 'syncAll')) {
      get(this, 'downSyncer').sync(store);
      set(this, 'syncAll', false);
    } 
  },

  onUpSyncPendingsChange: function() {
    var pendings = get(this, 'pendings');

    if (pendings && get(pendings, 'length') === 0) {
      this.didUpSyncAll(store);
    }
  }.observes('upSyncer.pendings.length'),

  // Callbacks

  downSyncRecord: function(store, type, hash) {
    this.downSyncer.downSyncRecord(store, type, hash);
  },

  downSyncRecords: function(store, type, array) {
    this.downSyncer.downSyncRecords(store, type, array);
  },

  didUpSyncRecord: function(store, type, record) {
    this.upSyncer.removePending(store, type, get(record, 'id'));
  },

  didUpSyncRecords: function(store, type, records) {
    records.forEach(function(record) {
      this.didUpSyncRecord(store, type, record);
    }, this);
  },

  // ................
  // .    SETUP     .
  // ................

  serverAdapter: DS._ServerAdapter.create(),

  initialize: function(store) {
    this._setupChildAdapters(store);
    this._setupSyncers(store);

    this.sync(store);
  },

  _setupChildAdapters: function(store) {
    Ember.assert("Adapter for client is not an instance of DS.Adapter (clientAdapter)", this.clientAdapter instanceof DS.Adapter);

    ['clientAdapter', 'serverAdapter'].forEach(function(property) {
      get(this, property).reopen({
        parentAdapter: this
      })
    }, this);
  },

  _setupSyncers: function(store) {
    var syncData = store.getSyncData();

    // DownSyncer
    var lastDownSync = syncData.findProperty('type', DS[LASTDOWNSYNC_TYPE]);
    var downSyncer = DS._DownSyncer.create({
      lastDownSync: lastDownSync,
      keyForCreatedAt: this.keyForCreatedAt,
      keyForUpdatedAt: this.keyForUpdatedAt,
      keyForDeletedAt: this.keyForDeletedAt
    });
    set(this, 'downSyncer', downSyncer);

    // UpSyncer
    var pendingUpSync = syncData.findProperty('type', DS[UPSYNC_TYPE]);
    var upSyncer = DS._DownSyncer.create({
      pendings: pendingUpSync
    });
    set(this, 'upSyncer', upSyncer);
  }
});

