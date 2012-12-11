require("system/mixins/modified_records_helpers");
require("serializers/internal_sync_serializer");
require("system/client_transaction");
/**
  The main store that is exposed to the app. DS.SyncStore is responsible for:
  (a) reading and writing sync meta data on the client storage
  (b) committing records to the client storage passed from the server store
 */

var get = Ember.get, set = Ember.set;

// Options used for communicating with the server, that are passed to the server store.
// Includes: the JSON keys of server records timestamps, 
// the key of server's records primary id,
// the server url path for down-syncing. 
var defaultServerOptions = {
  keyForId: 'id',
  keyForCreated: 'created_at',
  keyForUpdated: 'updated_at',
  keyForDeleted: 'deleted_at',
  keyForMaxModified: 'max_modified',
  downSyncPath: 'sync'
};

var newModifiedRecordsBuckets = function() {
  return {
    created:  Ember.OrderedSet.create(),
    updated:  Ember.OrderedSet.create(),
    deleted:  Ember.OrderedSet.create()
  };
};

DS.SyncStore = DS.Store.extend(DS._ModifiedRecordsHelpers, {
  pendingUpSyncRecords: [],

  /*                */
  /*  Base methods  */

  transaction: function() {
    return DS.ClientTransaction.create({ store: this });
  },

  normalTransaction: function() {
    return DS.Transaction.create({ store: this });
  },

  normalDeleteRecord: function(record) {
    var transaction = this.normalTransaction();
    transaction.add(record);
    this.deleteRecord(record);
    transaction.commit();
  },

  findAndDeleteRecord: function(type, id) {
    var record = this.find(type, id);
    record.setupDidLoad(function() {
      this.normalDeleteRecord(this);
    });
  },

  /*                           */
  /*  Up-sync related methods  */

  alsoCommitToServer: function(pendingUpSyncRecords) {
    var modifiedRecords = newModifiedRecordsBuckets();
    var serverStore = get(this, 'serverStore');
    var actualRecord, data, self = this, unLoadedRecords = 0;

    pendingUpSyncRecords.forEach(function(record) {
      actualRecord = this.find(get(record, 'recordType'), get(record, 'recordId'));

      unLoadedRecords++;

      actualRecord.setupDidLoad(function() {
        data = self.internalSerializer.serialize(this, { includeId: true });
        modifiedRecords[get(record, 'pendingReason')].add({ data: data, type: get(record, 'recordType') });

        unLoadedRecords--;

        if (unLoadedRecords === 0) {
          serverStore.copyAndCommit(modifiedRecords);
        }
      });
    }, this);
  },

  rememberModifiedRecords: function(commitDetails) {
    var pendingUpSyncRecords = [];
    var transaction = this.normalTransaction();

    eachModifiedRecord(commitDetails, function(bucketType, record) {
      pendingUpSyncRecords.pushObject(this.createPendingUpSyncRecord(transaction, bucketType, record));
    }, this);

    get(this, 'pendingUpSyncRecords').pushObjects(pendingUpSyncRecords);

    transaction.commit();
    return pendingUpSyncRecords;
  },

  createPendingUpSyncRecord: function(transaction, kind, record) {
    return transaction.createRecord(DS._PendingUpSyncRecord, {
      recordId: get(record, 'id'),
      recordType: record.constructor,
      pendingReason: kind
    });
  },

  /*                             */
  /*  Down-sync related methods  */

  copyAndCommit: function(type, id, data, modificationKind) {
    var transaction = this.normalTransaction();

    if (modificationKind === 'created') {
      transaction.createRecord(type, data);
      transaction.commit();
    } else {
      var record = this.find(type, id);
      record.setupDidLoad(function() {
        transaction.add(this);
        this.setProperties(data);
        transaction.commit();
      });
    }
  },

  downSync: function() {
    this.serverStore.downSync(this);
  },

  downSyncRecord: function(type, hash, timestamps, maxModified, callback) {
    var serverStore = get(this, 'serverStore');
    var id = hash.id;

    var modificationKind = this.computeModificationKind(timestamps, maxModified);
    var modified = timestamps.updatedAt;

    // First see if there matching pending up-synced records
    var isLocalPendingUpSyncRecord = this.deleteMatchingPendingUpSyncRecords(id, modificationKind);

    // Only create or delete when there is no local pending up-sync record. 
    // Updates can happen in any case (they are harmless anyway)
    if (!isLocalPendingUpSyncRecord && modificationKind === 'deleted') {
      this.findAndDeleteRecord(type, id);
      modified = timestamps.deletedAt;

    } else if ((!isLocalPendingUpSyncRecord && modificationKind === 'created') || (modificationKind === 'updated')) {
      callback.call(serverStore, type, id, hash, modificationKind);
    }

    this.updateMaxModified(modified);
  },

  computeModificationKind: function(timestamps, maxModified) {
    if (!!timestamps.deletedAt) { return 'deleted'; } 
    if (new Date(timestamps.createdAt) > new Date(maxModified)) { return 'created'; } 
    return 'updated';
  },

  // TODO: is it possible to have more than one matching pending up-sync records?
  deleteMatchingPendingUpSyncRecords: function(recordId, pendingReason) {
    var pendingUpSyncRecords = get(this, 'pendingUpSyncRecords')

    var matching = pendingUpSyncRecords.filter(function(record) {
      return get(record, 'recordId') === recordId && get(record, 'pendingReason') === pendingReason;
    }, this);
    
    matching.forEach(function(record) {
      this.normalDeleteRecord(record);
    }, this);

    pendingUpSyncRecords.removeObjects(matching);

    return matching.length > 0;
  },

  updateMaxModified: function(modified) {
    var maxModified = get(this, 'maxModified');
    var maxModifiedRecord = get(this, 'maxModifiedRecord');
    if (new Date(modified) > new Date(maxModified)) {
      this._maxModifiedTransaction.add(maxModifiedRecord);
      set(maxModifiedRecord, 'timestamp', modified);
    }
  },

  maxModified: function() {
    return get(this, 'maxModifiedRecord.timestamp');
  }.property('maxModifiedRecord.timestamp'),

  didCompleteDownSync: function() {
    this._maxModifiedTransaction.commit();
  },

  /*                          */
  /*  Initialization methods  */

  init: function() {
    this._super();
    set(this, 'internalSerializer', DS._InternalSyncSerializer.create());
  },

  _initialize: function() {
    var serverOptions = {};
    for (var key in defaultServerOptions) {
      serverOptions[key] = this[key] || defaultServerOptions[key];
    }
    get(this, 'serverStore.adapter')._setServerOptions(serverOptions);

    set(this, '_pendingUpSyncRecords', this.findQuery(DS._PendingUpSyncRecord, {}));
    set(this, '_maxModifiedRecords', this.findQuery(DS._MaxModified, {}));
  },

  _onLoadMaxModifiedRecords: function() {
    var maxModifiedRecords = get(this, '_maxModifiedRecords');
    if (!get(maxModifiedRecords, 'isLoaded')) { return; }

    this._maxModifiedTransaction = this.normalTransaction();
    
    if (get(maxModifiedRecords, 'content.length') > 0) {
      var maxModifiedRecord = maxModifiedRecords.toArray()[0];
      this._maxModifiedTransaction.add(maxModifiedRecord);
    } else {
      var maxModifiedRecord = this._maxModifiedTransaction.createRecord(DS._MaxModified);
      this._maxModifiedTransaction.commit();
    }

    set(this, 'maxModifiedRecord', maxModifiedRecord);
  
  }.observes('_maxModifiedRecords.isLoaded'),

  _onLoadPendingUpSyncRecords: function() {
    var pendingUpSyncRecords = get(this, '_pendingUpSyncRecords');

    if (!(get(pendingUpSyncRecords, 'isLoaded') && get(this, 'maxModifiedRecord'))) { return; }
    
    if (pendingUpSyncRecords && pendingUpSyncRecords.length > 0) {
      // Send pending up-sync records, that were modified in the previous app session
      this.alsoCommitToServer(pendingUpSyncRecords);
    } else {
      // Force a down sync on application load
      this.downSync();
    }

    get(this, 'pendingUpSyncRecords').pushObjects(pendingUpSyncRecords);

  }.observes('_pendingUpSyncRecords.isLoaded', 'maxModifiedRecord'),
});

