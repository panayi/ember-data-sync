OfflineReader.Store = DS.SyncStore.extend({
  revision: 10,
  adapter: DS.RESTAdapter.create({
  	mappings: {
  		rss: OfflineReader.rss,
  		rsses: OfflineReader.rss,
  		page: OfflineReader.page,
  		pages: OfflineReader.pages,
  		user: OfflineReader.user,
  		users: OfflineReader.users
  	}
  })
});

