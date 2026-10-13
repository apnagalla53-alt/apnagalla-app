import { AsyncLocalStorage } from 'node:async_hooks';
export type DatabaseScope = {
  kind: 'unverified' | 'tenant' | 'system';
  companyId?: string;
};
export const requestDatabaseScope = new AsyncLocalStorage<DatabaseScope>();
