require("system/mixins/modified_records_helpers");
require("serializers/internal_sync_serializer");

var get = Ember.get, set = Ember.set;

DS._ServerStore = DS.Store.extend(DS._ModifiedRecordsHelpers, {
  init: function() {
    this._super();
    set(this, 'internalSerializer', DS._InternalSyncSerializer.create());
  },

  copyAndCommit: function(commitDetails) {
    var transaction = this.defaultTransaction;
    eachModifiedRecord(commitDetails, function(bucketType, serializedRecord) {
      var record = this.createRecord(serializedRecord.type, serializedRecord.data);
      transaction.removeFromBucket('created', record);
      transaction.addToBucket(bucketType, record);
    }, this);

    this.commit();
  },

  downSync: function() {
    this.adapter.downSync(this);
  },

  downSyncRecord: function(type, hash, timestamps, maxModified) {
    get(this, 'clientStore').downSyncRecord(type, hash, timestamps, maxModified, this.simulateLoad);
  },

  simulateLoad: function(type, id, data, modificationKind) {
    var store = this;
    var clientId = this.pushData('loading', id, type);
    var record = this.materializeRecord(type, clientId, id);

    record.setupDidLoad(function() {
      store.alsoCommitToClient(type, id, this, modificationKind);
    });

    this.load(type, id, data);
  },

  alsoCommitToClient: function(type, id, record, modificationKind) {
    var internalSerializedData = this.internalSerializer.serialize(record, { includeId: true });
    get(this, 'clientStore').copyAndCommit(type, id, internalSerializedData, modificationKind);
  },

  didCompleteDownSync: function() {
    var clientStore = get(this, 'clientStore');
    clientStore.didCompleteDownSync();
  },

  maxModified: function() {
    return get(this, 'clientStore.maxModified');
  }.property('clientStore.maxModified')
});
