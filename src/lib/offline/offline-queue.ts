// Energy-Compliance Hub — Offline Queue using IndexedDB
// Stores failed API requests for later synchronization

const DB_NAME = 'ech-offline-db';
const DB_VERSION = 1;
const QUEUE_STORE = 'offline-queue';
const SENSOR_CACHE_STORE = 'sensor-cache';

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  resourceType: 'permit' | 'document' | 'photo' | 'sensor' | 'general';
}

export interface CachedSensorReading {
  id?: number;
  sensorId: string;
  companyId: string;
  value: number;
  unit: string;
  timestamp: number;
  status: string;
}

class OfflineDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Offline queue store
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const queueStore = db.createObjectStore(QUEUE_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
          queueStore.createIndex('resourceType', 'resourceType', { unique: false });
          queueStore.createIndex('url', 'url', { unique: false });
        }

        // Sensor cache store
        if (!db.objectStoreNames.contains(SENSOR_CACHE_STORE)) {
          const sensorStore = db.createObjectStore(SENSOR_CACHE_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          sensorStore.createIndex('sensorId', 'sensorId', { unique: false });
          sensorStore.createIndex('companyId', 'companyId', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  // === Queue Operations ===

  async addToQueue(entry: Omit<QueuedRequest, 'id'>): Promise<number> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const request = store.add(entry);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getQueue(resourceType?: string): Promise<QueuedRequest[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const store = tx.objectStore(QUEUE_STORE);
      
      let request: IDBRequest;
      if (resourceType) {
        const index = store.index('resourceType');
        request = index.getAll(resourceType);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getQueueCount(): Promise<number> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const store = tx.objectStore(QUEUE_STORE);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromQueue(id: number): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async incrementRetry(id: number): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          item.retryCount += 1;
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async clearQueue(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // === Sensor Cache Operations ===

  async cacheSensorReading(reading: Omit<CachedSensorReading, 'id'>): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SENSOR_CACHE_STORE, 'readwrite');
      const store = tx.objectStore(SENSOR_CACHE_STORE);
      // Use put to upsert
      store.put(reading);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSensorReading(sensorId: string): Promise<CachedSensorReading | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SENSOR_CACHE_STORE, 'readonly');
      const store = tx.objectStore(SENSOR_CACHE_STORE);
      const index = store.index('sensorId');
      const request = index.getAll(sensorId);

      request.onsuccess = () => {
        const readings = request.result as CachedSensorReading[];
        // Return the most recent reading
        if (readings.length > 0) {
          const sorted = readings.sort((a, b) => b.timestamp - a.timestamp);
          resolve(sorted[0]);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCachedSensors(companyId: string): Promise<CachedSensorReading[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SENSOR_CACHE_STORE, 'readonly');
      const store = tx.objectStore(SENSOR_CACHE_STORE);
      const index = store.index('companyId');
      const request = index.getAll(companyId);

      request.onsuccess = () => {
        const readings = request.result as CachedSensorReading[];
        // Deduplicate by sensorId, keeping most recent
        const map = new Map<string, CachedSensorReading>();
        for (const r of readings) {
          const existing = map.get(r.sensorId);
          if (!existing || r.timestamp > existing.timestamp) {
            map.set(r.sensorId, r);
          }
        }
        resolve(Array.from(map.values()));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearSensorCache(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SENSOR_CACHE_STORE, 'readwrite');
      const store = tx.objectStore(SENSOR_CACHE_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const offlineDB = new OfflineDB();

// === Helper: Queue an API request for later sync ===

export async function queueApiRequest(
  url: string,
  method: string = 'POST',
  body?: unknown,
  resourceType: QueuedRequest['resourceType'] = 'general'
): Promise<number> {
  const entry: Omit<QueuedRequest, 'id'> = {
    url,
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: 5,
    resourceType,
  };

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ech_token');
    if (token) {
      entry.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return offlineDB.addToQueue(entry);
}

// === Helper: Save sensor readings for offline access ===

export async function cacheSensorData(
  sensorId: string,
  companyId: string,
  value: number,
  unit: string,
  status: string
): Promise<void> {
  return offlineDB.cacheSensorReading({
    sensorId,
    companyId,
    value,
    unit,
    timestamp: Date.now(),
    status,
  });
}
