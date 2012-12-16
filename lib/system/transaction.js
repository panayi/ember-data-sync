DS.ServerTransaction = DS.Transaction.extend({
  'store.defaultTransactionBinding': 'store.defaultServerTransaction',
  'store.transactionBinding': 'store.serverTransaction'
  'store._adapterBinding': 'store._serverAdapter',
});

DS.ClientTransaction = DS.Transaction.extend({
  'store.defaultTransactionBinding': 'store.defaultClientTransaction',
  'store.transactionBinding': 'store.clientTransaction',
  'store._adapterBinding': 'store._clientAdapter',
});