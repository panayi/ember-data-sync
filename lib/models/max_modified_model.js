/**
  Store (on the client) the maximum modified (created/updated/deleted/) 
  timestamp among all client stored records.
 */
DS._MaxModified = DS.Model.extend({
  timestamp: DS.attr('string', { defaultValue: (new Date(0)).toString() }),
});