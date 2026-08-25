import { migration_0001_init } from "./0001_init";
import { migration_0002_add_spouse } from "./0002_add_spouse";
import { migration_0003_add_assignment_reasons } from "./0003_add_assignment_reasons";
import { migration_0004_add_recurrences } from "./0004_add_recurrences";

export interface Migration {
  id: string;
  sql: string;
}

// Ordem de aplicacao. Novas migrations sao sempre adicionadas ao final.
export const MIGRATIONS: Migration[] = [
  migration_0001_init,
  migration_0002_add_spouse,
  migration_0003_add_assignment_reasons,
  migration_0004_add_recurrences
];
