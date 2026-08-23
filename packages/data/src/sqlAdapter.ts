import { writeFileSync } from "fs";
import type { Database as SqlJsDatabase } from "sql.js";

// Camada fina sobre o sql.js (SQLite compilado para WebAssembly) que expoe
// uma API no estilo do better-sqlite3 (exec/prepare/pragma/transaction).
//
// Por que sql.js e nao um driver nativo: descobrimos em campo que o driver
// nativo (better-sqlite3) trava o processo do Electron em certas maquinas
// Windows sem o Visual Studio Build Tools instalado — mesmo usando binarios
// N-API pre-compilados. sql.js roda inteiramente em WASM, entao funciona de
// forma identica em qualquer maquina, sem depender de compilacao nem da ABI
// do Node/Electron. A troca e o driver interno, nao a forma de usar o banco.
//
// Estrategia de persistencia: o banco vive em memoria (Uint8Array) e e
// regravado no arquivo em disco a cada COMMIT (ou a cada exec/run fora de
// uma transacao). Isso evita gravar um estado "no meio" de uma transacao —
// so persistimos snapshots consistentes.

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface PreparedStatement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): any;
  all(...params: unknown[]): any[];
}

export interface AppDatabase {
  exec(sql: string): void;
  pragma(pragma: string): void;
  prepare(sql: string): PreparedStatement;
  transaction<F extends (...args: any[]) => any>(fn: F): F;
  close(): void;
}

function toBindParams(args: unknown[]): unknown {
  if (args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])) {
    const obj = args[0] as Record<string, unknown>;
    const bound: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const boundKey = key.startsWith("@") || key.startsWith(":") || key.startsWith("$") ? key : `@${key}`;
      bound[boundKey] = value;
    }
    return bound;
  }
  return args;
}

function rawPrepare(raw: SqlJsDatabase, sql: string): PreparedStatement {
  return {
    run(...args: unknown[]) {
      const stmt = raw.prepare(sql);
      try {
        stmt.bind(toBindParams(args) as any);
        stmt.step();
      } finally {
        stmt.free();
      }
      const idRow = raw.exec("SELECT last_insert_rowid() AS id;");
      return {
        changes: raw.getRowsModified(),
        lastInsertRowid: idRow.length ? Number(idRow[0].values[0][0]) : 0
      };
    },
    get(...args: unknown[]) {
      const stmt = raw.prepare(sql);
      try {
        stmt.bind(toBindParams(args) as any);
        return stmt.step() ? stmt.getAsObject() : undefined;
      } finally {
        stmt.free();
      }
    },
    all(...args: unknown[]) {
      const stmt = raw.prepare(sql);
      const rows: any[] = [];
      try {
        stmt.bind(toBindParams(args) as any);
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
      } finally {
        stmt.free();
      }
      return rows;
    }
  };
}

export function wrapDatabase(raw: SqlJsDatabase, filePath: string): AppDatabase {
  let inTransaction = false;

  const persist = () => {
    if (inTransaction) return;
    writeFileSync(filePath, Buffer.from(raw.export()));
    // raw.export() tem o efeito colateral de resetar PRAGMAs de conexao
    // (nao sao parte dos bytes do arquivo) — foreign_keys precisa ser
    // reafirmado a cada persistencia, senao a integridade referencial
    // fica silenciosamente desligada apos o primeiro save.
    raw.run("PRAGMA foreign_keys = ON;");
  };

  return {
    exec(sql: string) {
      raw.run(sql);
      persist();
    },
    pragma(pragma: string) {
      raw.run(`PRAGMA ${pragma};`);
    },
    prepare(sql: string) {
      const stmt = rawPrepare(raw, sql);
      return {
        run(...args: unknown[]) {
          const result = stmt.run(...args);
          persist();
          return result;
        },
        get: (...args: unknown[]) => stmt.get(...args),
        all: (...args: unknown[]) => stmt.all(...args)
      };
    },
    transaction<F extends (...args: any[]) => any>(fn: F): F {
      return ((...args: unknown[]) => {
        inTransaction = true;
        raw.run("BEGIN");
        try {
          const result = fn(...args);
          raw.run("COMMIT");
          inTransaction = false;
          persist();
          return result;
        } catch (err) {
          raw.run("ROLLBACK");
          inTransaction = false;
          throw err;
        }
      }) as F;
    },
    close() {
      persist();
      raw.close();
    }
  };
}
