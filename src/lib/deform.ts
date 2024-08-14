import {DEV} from "esm-env"
import { stringify, parse } from 'devalue';

type Snapshot<T> = T extends object ? { [K in keyof T]: Snapshot<T[K]> } : T;

const clone = <T>(
  value: T,
  cloned: Map<T, Snapshot<T>>,
  path: string,
  paths: string[]
): Snapshot<T> => {
  if (typeof value === 'object' && value !== null) {
    const unwrapped = cloned.get(value);
    if (unwrapped !== undefined) return unwrapped;

    if (Array.isArray(value)) {
      const copy: Snapshot<T>[] = [];
      cloned.set(value, copy as Snapshot<T>);

      for (let i = 0; i < value.length; i += 1) {
        copy.push(clone(value[i], cloned, DEV ? `${path}[${i}]` : path, paths));
      }

      return copy as Snapshot<T>;
    }

    if (Object.getPrototypeOf(value) === Object.prototype) {
      const copy: Snapshot<T> = {} as Snapshot<T>;
      cloned.set(value, copy);

      for (const key in value) {
        // @ts-ignore
        copy[key as keyof T] = clone(value[key as keyof T], cloned, DEV ? `${path}.${key}` : path, paths);
      }

      return copy;
    }

    if (value instanceof Date) {
      return structuredClone(value) as Snapshot<T>;
    }

    if (typeof (value as T & { toJSON?: unknown }).toJSON === 'function') {
      return clone(
        (value as T & { toJSON(): unknown }).toJSON(),
        cloned,
        DEV ? `${path}.toJSON()` : path,
        paths
      ) as Snapshot<T>;
    }
  }

  if (value instanceof EventTarget) {
    // can't be cloned
    return value as Snapshot<T>;
  }

  try {
    return structuredClone(value) as Snapshot<T>;
  } catch (e) {
    return value as Snapshot<T>;
  }
};

export const  snapshot = <T>(value:T)=> {
	return clone(value, new Map(), '', []);
}

export const form = (value: unknown, formData: FormData = new FormData()) => {
	const isSvelteState = value && Object.getOwnPropertySymbols(value).some(
		(symbol) => String(symbol)==='Symbol($state)')
  // Devalue can't handle object with symbolic keys. And we need to handle $state in a svelte 5 codebase.
  // We also do not want developers to have to use $state.snapshot everywhere
  // So we use a custom snapshot function that will do the same as $state.snapshot
	const stringified = stringify(isSvelteState ? snapshot(value) : value, {
		File: (value: any) => {
			if (value instanceof File) {
				formData.append(value.name, value);
				return value.name;
			}
		},
		URL: (value) => {
			if (value instanceof URL) {
				return value.toString();
			}
		}
	});
	formData.append('value', stringified);
	return formData;
};

export const deform = (formData: FormData) => {
	const stringified = formData.get('value') as string;
	const value = parse(stringified, {
		File: (value: any) => {
			return formData.get(value) as File;
		},
		URL: (value: any) => {
			return new URL(value);
		}
	});

	return value;
};
