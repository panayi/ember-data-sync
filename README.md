Client-Server Data Synchronization for Ember-Data
=================================================

Two-way data synchronization of a client-side storage with a server-side REST API.

With Ember-data-sync application data is stored and synchronized to both a client-side storage (such as IndexedDB or localStorage) and a server-side RESTful storage. 

Features:
---------

* Use any adapter for the client-side storage ([localStorage]https://github.com/rpflorence/ember-localstorage-adapter, DS.RESTAdapter, ...)
* Hides away the internal synchronization logic.
* Synchronization is done automatically with each client-side storage commit. Also, the app is able to trigger synchronizations manually.
* Apps can work offline. Any records created/updated/deleted offline are persisted to the client-side storage, and committed on the next app load with online status.
* Ability to synchronize data across multiple clients. New devices are synchronized on first load.


Usage
=====

1. Include `ember-data-sync.js` in your ember/ember-data app.

2. Extend your App.Store from DS.SyncStore. Define the adapter you want to use for client-side storage:

```js
App.Store = DS.SyncStore.extend({
  revision: 10,

  // Define the client-side adapter
  // e.g.
  // adapter: DS.IndexedDB.adapter({ /* ... */ })
});

```

3. Currently you need to define the mappings of JSON keys (e.g, person, persons, contacts) to model types (e.g. App.Person, App.Contact):

```js
App.Store = DS.SyncStore.extend({
  revision: 10,
  adapter: DS.IndexedDB.adapter({
    mappings: {
      person: App.Person,
      persons: App.Person,
      contact: App.Contact,
      contacts: App.Contact
    }
  })
});

```

4. Server configuration

Ember-data-sync expects that your server:

* Stores created/updated/deleted timestamp for each record. With Rails this is done automatically.

* Soft deletion of records (records are never actually deleted, but instead are flagged as deleted). If you are using Rails, have a look at [permanent_records]https://github.com/JackDanger/permanent_records.

* Provides a down-syncing route (default: '/sync') which receives a max-modified timestamp and returns **all** records modified after max-modified.

Customizable server options:

App.Store = DS.SyncStore.extend({

  // Server configuration options
  keyForId: 'id',                   // key for primary id 
  keyForCreated: 'created_at',      // key for created timestamp 
  keyForUpdated: 'updated_at',      // key for updated timestamp
  keyForDeleted: 'deleted_at',      // key for updated timestamp
  keyForMaxModified: 'max_modified',// key for the maxModified timestamp sent to server  
  downSyncPath: 'sync'              // server donw-syncing path

  // ...
  // adapter: DS.IndexedDB.adapter({ /* ... */ })
});

Since ids for records are created on the client, if you are using Rails you probably want to use a different key for records primary ids.... (code soon)


Description
===========

Ember-data-sync allows two-way synchronization of a client-side storage (such as indexedDB or localStorage)
with a RESTful server storage. 

It is based on the use of 2 adapters: The server adapter is a de-facto stripped down RESTadapter, and the client adapter
can be *any* adapter that follows ember-data Adapter API specification. Ember-data-sync does not make any assumptions
on the client adapter, so it can be anything (even a RESTAdapter). Currently it is only tested with DS.IndexedDBAdapter.  

In this synchronization architecture, the server acts as reference point for the data.

The main idea of the sync algorithm is that as soon as a commit is made to the client storage, 
then (if the client is online) the changes are also committed to the server (up-sync). 
Otherwise it is committed the next time the app is opened && the user is online. 
The client persists a maxModified timestamp, which is given by MAX(FOR(I,N) MAX(updated_at, deleted_at)) 
for all N client-side stored records. As soon as an up-sync is completed, a down-sync request 
is sent to the server with data maxModified. The server responds with all the records which were modified  
(created, updated or deleted) after maxModified.

The synchronization algorithm has the following properties:
  (a) In the case where the data of a client is exclusive to that client (i.e., can not be altered by other clients), 
      the algorithm ensures that the client and server are synchronized for all t>0.
  (b) In the case where data is shared and modified by more than one clients, each client is synchronized with 
      the server with every up-sync/down-sync combination. In-between syncs, it is not ensured that a client is in sync with the server.

If data is shared among multiple clients, the app may require more frequent synchronizations. In this case 
the app can manually call DS.ClientStore's downSync() method. For example, the following will synchronize every 30 seconds:


Todo
----

- Tests

- This implementation relies on the fact that the server is able to respond with a list of *all* modified records after a certain DateTime. Can this assumption be relaxed, or provide some better flexibility?

- Record IDs are generated on the client. The probability of duplicated ids is really small but it's still
possible. Ids collisions are not currently addressed.

- Performance issues could arise with initial commits on devices. 
  
- Modification conflicts. Two clients alter a record offline and commit the changes when they go online. Either the server should provide a policy for resolving the conflict, or send the information down to the clients to resolve the conflict themselves (isConflicted flag).

- Implement WebSockets for pushing modified records down to the client.


License & Copyright
-------------------

Copyright (c) 2012 Panagiotis Panagi
MIT Style license. http://opensource.org/licenses/MIT