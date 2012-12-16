require("synchron/mixins/syncer_mixin");

var get = Ember.get, set = Ember.set;

DS._UpSyncer = Ember.Object.extend(DS._SyncerMixin, {
  sync: function(store, type) {
    var pendingsByReason = this.groupByReason(type);
    for (var reason in pendingsByReason) {
      this.syncByTypeAndReason(store, pendingsByReason[reason], type, reason);
    }
  },

  syncByTypeAndReason: function(store, pendings, type, reason) {
    var totalPendings = pendings.length;
    var method = this.reasonToMethod(reason);

    if (totalPendings > 1) { method = method + 's'; }

    var records = [], totalLoaded = 0;
    var onLoadObserver = function(rec) {
      if (get(rec, 'isLoaded')) {
        totalLoaded++;
        if (totalLoaded === totalPendings) {
          store.adapter.serverAdapter[method](store, type, records);
        }
      }
    };

    var record;
    pendings.forEach(function(pending) {
      record = store.find(type, get(pending, 'id'));
      record.addObserver('isLoaded', onLoadObserver);
      records.addObject(record);
    });
  },

  savePending: function(store, type, id, reason) {
    var pending, hash;

    if (pending = this.pendingForRecord(type, id)) {
      hash = { reason: this.mergePendingReasons(reason, get(pending, 'reason')) };
      pending.setProperties(hash);
    } else {
      hash = { recordId: recordId, recordType: type.toString(), pendingReason: reason };
      newPending = store._createRecord(this.pendingType, hash, 'client');
      get(this, 'pendings').pushObject(newPending);
    }

    store.commitClient();
  },

  removePending: function(store, type, id) {
    var pending = this.pendingForRecord(type, id);
    pending.deleteRecord();
    store.commitClient();

    get(this, 'pendings').removeObject(pending);
  },

  pendingForRecord: function(type, id) {
    this.internalDataForRecord(get(this, 'pendings'), type, id);
  },

  mergePendingReasons: function(newReason, oldReason) {
    if (oldReason === 'created' && newReason === 'updated') { return oldReason; } 
    if (newReason) { return newReason; }
    return oldReason;
  },

  groupByReason: function(type) {
    var pendingsOfType = get(this, 'pendings').filterProperty('recordType', type.toString());
    var groups = {}, type, reason;

    pendingsOfType.forEach(function(pending) {
      reason = pending.reason;
      groups[reason] = groups[reason] || [];
      groups[reason].addObject(pending);
    });

    return groups;
  },

  reasonToMethod: function(reason) {
    if (reason === 'created') return 'createRecord';
    if (reason === 'updated') return 'updateRecord';
    if (reason === 'deleted') return 'deleteRecord';
  }
});
