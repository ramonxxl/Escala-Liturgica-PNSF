import { migration_0001_init } from "./0001_init";
import { migration_0002_add_spouse } from "./0002_add_spouse";

export interface Migration {
  id: string;
  sql: string;
}

// Ordem de aplicacao. Novas migrations sao sempre adicionadas ao final.
export const MIGRATIONS: Migration[] = [migration_0001_init, migration_0002_add_spouse];
