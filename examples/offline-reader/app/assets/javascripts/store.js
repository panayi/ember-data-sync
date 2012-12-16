OfflineReader.Store = DS.SyncStore.extend({
  revision: 10,
  adapter: DS.IndexedDBAdapter.create({
  	mappings: {
  		rss: 'OfflineReader.Rss',
  		rsses: 'OfflineReader.Rss',
  		page: 'OfflineReader.Page',
  		pages: 'OfflineReader.Page'
  	}
  })
});


DS._ServerAdapter.reopen({
  plurals: {"rss": "rsses"}
});


