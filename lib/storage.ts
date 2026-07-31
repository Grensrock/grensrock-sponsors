/* ============================================================
   Key/value storage shim
   ============================================================
   Reproduces the exact shape of the sandbox's window.storage API the
   prototype was written against:

     storage.get(key, shared)    -> { value } | null
     storage.set(key, value, shared)
     storage.delete(key, shared)

   Backed by localStorage and guarded for SSR. This is the only module that
   touches localStorage, so a later move to a real backend replaces this file
   without touching component code.

   Known limitation (not a defect): localStorage shares one quota across all
   keys (~5-10MB) where the sandbox allowed 5MB per key. Any overrun surfaces
   through the existing catch { setSaveErr(true) } path.
   ============================================================ */

export interface StoredValue {
  value: string;
}

const PREFIX = "grensrock:kv:";
const SHARED_PREFIX = "grensrock:kv:shared:";

const available = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const fullKey = (key: string, shared?: boolean) => (shared ? SHARED_PREFIX : PREFIX) + key;

export const storage = {
  async get(key: string, shared?: boolean): Promise<StoredValue | null> {
    if (!available()) return null;
    const value = window.localStorage.getItem(fullKey(key, shared));
    return value === null ? null : { value };
  },

  async set(key: string, value: string, shared?: boolean): Promise<void> {
    if (!available()) return;
    window.localStorage.setItem(fullKey(key, shared), value);
  },

  async delete(key: string, shared?: boolean): Promise<void> {
    if (!available()) return;
    window.localStorage.removeItem(fullKey(key, shared));
  },
};
