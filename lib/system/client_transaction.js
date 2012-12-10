/**
  The default Transaction class. This class extends the commit method for:
  (a) remembering any modified records (persisted on the client storage)
  (b) passing modified records to the server store to commit (if the user is online)
 */

var get = Ember.get;

DS.ClientTransaction = DS.Transaction.extend({
  // In addition to committing to client storage: 
  // (a) remember modified records and (b) trigger an up-sync.
  commit: function() {
    var store = get(this, 'store');

    var commitDetails = this.copyCommitDetails();
    var pendingUpSyncRecords = store.rememberModifiedRecords(commitDetails);

    store.alsoCommitToServer(pendingUpSyncRecords);

    this._super();
  },

  copyCommitDetails: function() {
    return {
      created: this.bucketForType('created').copy(),
      updated: this.bucketForType('updated').copy(),
      deleted: this.bucketForType('deleted').copy()
    };
  }
});