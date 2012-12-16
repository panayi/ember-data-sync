require("synchron/mixins/syncer_mixin");

var get = Ember.get, set = Ember.set;

DS._DownSyncer = Ember.Object.extend(DS._SyncerMixin, {
  sync: function(store) {
    get(this, 'typesToSync').forEach(function(type) {
      this.syncType(store, type);
    }, this);
  },

  syncType: function(store, type) {
    var since = this.lastDownSyncForType(type);
    store.adapter.serverAdapter.findAll(store, type, since);
  },

  downSyncRecord: function(store, type, hash) {
    var modificationKind = this.modificationKindForRecord(hash);
    var id = hash.id;
    var timestamp;

    if (modificationKind === 'created') {
      store._createRecord(type, hash, 'client');
      store.clientCommit();

      timestamp = hash[this.keyForCreatedAt];

    } else {
      var onLoadRecord = function(rec) {
        if (modificationKind === 'updated') {
          // TODO: needs refactoring
          store.load(type, id, hash);
          store.adapter.clientAdapter(store, type, rec);

          timestamp = hash[this.keyForUpdatedAt];

        } else if (modificationKind === 'deleted') {
          // TODO: needs refactoring
          var transaction = store.clientTransaction();
          transaction.add(rec);
          rec.deleteRecord();
          transaction.commit();

          timestamp = hash[this.keyForDeletedAt];
        }
      };

      var record = store.find(type, id);
      record.addObserver('isLoaded', onLoadRecord);
    }

    this.saveLastDownSync(store, type, id, timestamp);
  },

  downSyncRecords: function(store, type, array) {
    array.forEach(function(hash) {
      this.downSyncRecord(store, type, hash);
    });
  },

  saveLastDownSync: function(store, type, id, timestamp) {
    var record = this.lastDownSyncForRecord(type, id);
    if (record) {
      set(record, 'timestamp', timestamp);
    } else {
      record = store._createRecord(type, {recordId: id, recordType: type, timestamp: timestamp}, 'client');
      get(this, 'lastDownSync').pushObject(record);
    }

    store.clientCommit();
  },

  modificationKindForRecord: function(hash) {
    var maxModified = get(this, 'maxModified');

    var createdAt = hash[this.keyForCreatedAt];
    var deletedAt = hash[this.keyForDeletedAt];

    if (!!deletedAt) { return 'deleted'; } 
    if (new Date(createdAt) > new Date(maxModified)) { return 'created'; } 
    return 'updated';
  },

  lastDownSyncForRecord: function(type, id) {
    this.internalDataForRecord(get(this, 'lastDownSync'), type, id);
  },

  lastDownSyncForType: function(type) {
    type = type.toString();
    var ofType = get(this, 'lastDownSync').filter(function(hash) {
      return hash.recordType === type;
    });

    return this.maxDate(ofType.getEach('timestamp'));
  },

  maxDate: function(dates) {
    var max = new Date(0);
    dates.forEach(function(date) {
      if (new Date(date) > max) {
        max = date;
      }
    });

    return max;
  }
});