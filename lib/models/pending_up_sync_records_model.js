/**
  Store information about records that were modified 
  on the client (and not committed to server).
 */
DS._PendingUpSyncRecord = DS.Model.extend({
  recordId: DS.attr('string'),
  recordType: DS.attr('string'),
  pendingReason: DS.attr('string')
});