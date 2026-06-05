

export const routingRules = {
  users: ['cache', 'audit'],
  orders: ['audit', 'webhook'],
  products: ['cache', 'audit', 'webhook'],
}


export const operationFilters = {
  users: {
    cache: null,             // all operations
    audit: null,
  },
  orders: {
    audit: null,
    webhook: ['INSERT', 'UPDATE'],  // only notify webhook on new/updated orders
  },
  products: {
    cache: null,
    audit: null,
    webhook: ['INSERT'],    // only notify on new products
  },
}