export type PatchRestore = () => void;

export function patchValue(
  target: any,
  key: string,
  value: unknown
): PatchRestore {
  const hasOwn = Object.prototype.hasOwnProperty.call(target, key);
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, key);

  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: originalDescriptor?.enumerable ?? true,
  });

  return () => {
    try {
      if (originalDescriptor) {
        Object.defineProperty(target, key, originalDescriptor);
      } else if (hasOwn) {
        // Should not happen because originalDescriptor would exist when hasOwn is true.
        // Best-effort cleanup.
        delete target[key];
      } else {
        delete target[key];
      }
    } catch {
      // ignore
    }
  };
}

export function patchGetter(
  target: any,
  key: string,
  getter: () => unknown
): PatchRestore {
  const hasOwn = Object.prototype.hasOwnProperty.call(target, key);
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, key);

  Object.defineProperty(target, key, {
    get: getter,
    configurable: true,
    enumerable: originalDescriptor?.enumerable ?? true,
  });

  return () => {
    try {
      if (originalDescriptor) {
        Object.defineProperty(target, key, originalDescriptor);
      } else if (!hasOwn) {
        delete target[key];
      }
    } catch {
      // ignore
    }
  };
}

