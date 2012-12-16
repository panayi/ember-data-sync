require('synchron/config');

/**
  Store (on the client) the maximum modified (created/updated/deleted/) 
  timestamp among all client stored records.
 */
DS[LASTDOWNSYNC_TYPE] = DS.Model.extend({
	recordId: DS.attr('string'),
	recordType: DS.attr('string'),
  timestamp: DS.attr('string', { defaultValue: (new Date(0)).toString() }),
});