import { normalizeReport } from "@/lib/report/factory";
import { deriveStatus } from "@/lib/report/status";
import type { WorkReport } from "@/lib/report/types";

import type { ReportRepository } from "./repository";

const DB_NAME = "mm-arbeitsberichte";
const DB_VERSION = 1;
const STORE = "reports";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Lokale Ablage im Browser (bleibt auch offline und nach Neustart erhalten). */
export class IndexedDbReportRepository implements ReportRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= openDb();
    return this.dbPromise;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.db();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async list(): Promise<WorkReport[]> {
    const store = await this.store("readonly");
    const rows = await promisify(store.getAll() as IDBRequest<WorkReport[]>);
    return rows.map(normalizeReport).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<WorkReport | null> {
    const store = await this.store("readonly");
    const row = await promisify(store.get(id) as IDBRequest<WorkReport | undefined>);
    return row ? normalizeReport(row) : null;
  }

  async save(report: WorkReport): Promise<WorkReport> {
    const toSave: WorkReport = { ...report, status: deriveStatus(report) };
    const store = await this.store("readwrite");
    await promisify(store.put(toSave));
    return toSave;
  }

  async delete(id: string): Promise<void> {
    const store = await this.store("readwrite");
    await promisify(store.delete(id));
  }
}
