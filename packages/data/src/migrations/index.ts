import { migration_0001_init } from "./0001_init";

export interface Migration {
  id: string;
  sql: string;
}

// Ordem de aplicacao. Novas migrations sao sempre adicionadas ao final.
export const MIGRATIONS: Migration[] = [migration_0001_init];
