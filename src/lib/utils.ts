/* eslint-disable @typescript-eslint/no-explicit-any */
import { instance, maxSize as ms, mimeType as mt } from 'valibot';
const isObject = (value: unknown) =>
	value &&
	typeof value === 'object' &&
	value.constructor === Object &&
	!Array.isArray(value) &&
	typeof value !== 'function' &&
	!(value instanceof Date);
const isArray = (value: unknown): value is Array<unknown> => Array.isArray(value);
const isBlob = (value: unknown): value is Blob => value instanceof Blob;
const isFile = (value: unknown): value is File => value instanceof File;
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isNull = (value: unknown): value is null => value === null;
const isUndefined = (value: unknown): value is undefined => value === undefined;
const isString = (value: unknown): value is string => typeof value === 'string';
const isDate = (value: unknown): value is Date => value instanceof Date;
const isNumber = (value: unknown): value is number =>
	typeof value === 'number' || !isNaN(Number(value));

const TYPES_MAP = {
	string: 0,
	number: 1,
	boolean: 2,
	date: 3,
	object: 4,
	array: 5,
	null: 6,
	undefined: 7,
	blob: 8,
	file: 9
};

const REVERSE_TYPES_MAP = {
	'0': 'string',
	'1': 'number',
	'2': 'boolean',
	'3': 'date',
	'6': 'null',
	'7': 'undefined',
	'8': 'blob',
	'9': 'file'
};

const processFormData = (value: any, formData: FormData, parent?: string) => {
	const processedKey = parent || '';
	const type = isDate(value)
		? 'date'
		: isObject(value)
			? 'object'
			: isArray(value)
				? 'array'
				: isBlob(value)
					? 'blob'
					: isFile(value)
						? 'file'
						: isBoolean(value)
							? 'boolean'
							: isNull(value)
								? 'null'
								: isUndefined(value)
									? 'undefined'
									: isString(value)
										? 'string'
										: isNumber(value)
											? 'number'
											: undefined;
	if (!type) throw new Error('Invalid type');

	const typeIndex = TYPES_MAP[type];
	switch (type) {
		case 'string': {
			formData.append(`${typeIndex}:${processedKey}`, value);
			break;
		}
		case 'number': {
			formData.append(`${typeIndex}:${processedKey}`, value);
			break;
		}
		case 'boolean': {
			formData.append(`${typeIndex}:${processedKey}`, value ? 'true' : 'false');
			break;
		}
		case 'object': {
			Object.entries(value).forEach(([key, data]) => {
				let computedKey = key;
				if (parent) {
					computedKey = `${parent}.${key}`;
				}
				processFormData(data, formData, computedKey);
			});
			break;
		}
		case 'array': {
			value.forEach((item: unknown, index: number) => {
				const computedKey = processedKey + `[${index}]`;
				processFormData(item, formData, computedKey);
			});
			break;
		}
		case 'null': {
			formData.append(`${typeIndex}:${processedKey}`, '');

			break;
		}
		case 'undefined': {
			formData.append(`${typeIndex}:${processedKey}`, '');

			break;
		}
		case 'blob': {
			formData.append(`${typeIndex}:${processedKey}`, value);
			break;
		}
		case 'date': {
			formData.append(`${typeIndex}:${processedKey}`, value.toISOString());
			break;
		}
		case 'file': {
			formData.append(`${typeIndex}:${processedKey}`, value);
			break;
		}
	}
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const objectToFormData = (payload: any, formData: FormData = new FormData()) => {
	if (payload === undefined) return formData;
	if (!isObject(payload)) {
		processFormData({ '######ROOT######': payload }, formData);
	} else {
		processFormData(payload, formData);
	}
	return formData;
};

export const formDataToObject = (formData: FormData) => {
	const obj = {};
	formData.forEach((value, key_type) => {
		let transformedValue = value as any;
		const [typeIndex, key] = key_type.split(':');
		if (typeIndex in REVERSE_TYPES_MAP) {
			const type = REVERSE_TYPES_MAP[typeIndex as keyof typeof REVERSE_TYPES_MAP];

			switch (type) {
				case 'string': {
					transformedValue = value.toString();
					break;
				}
				case 'number': {
					transformedValue = Number(value);
					break;
				}
				case 'boolean': {
					transformedValue = value === 'true';
					break;
				}
				case 'blob': {
					transformedValue = value as Blob;
					break;
				}
				case 'file': {
					transformedValue = value as File;
					break;
				}
				case 'date': {
					transformedValue = new Date(value as string);
					break;
				}
				case 'null': {
					transformedValue = null;
					break;
				}
				case 'undefined': {
					transformedValue = undefined;
					break;
				}
			}
			const isNested = key.includes('[') || key.includes('.');
			if (isNested) {
				set(obj, key, transformedValue);
			} else {
				Object.assign(obj, { [key]: transformedValue });
			}
		}
	});
	if (Object.keys(obj).length === 1 && '######ROOT######' in obj) {
		return obj['######ROOT######'];
	}
	return obj;
};

export function set<T, V>(obj: T, path: string | string[], value: V): T {
	if (typeof path === 'string') {
		// Split the path by dot and brackets
		path = path.replace(/\[(\w+)\]/g, '.$1').split('.');
	}

	let current: any = obj;

	for (let i = 0; i < path.length; i++) {
		const key: keyof any = path[i];
		if (i === path.length - 1) {
			current[key] = value;
		} else {
			if (current[key] === undefined) {
				// Check if the next path segment is a number (array index)
				const nextKey: keyof any = path[i + 1];
				current[key] = /^\d+$/.test(nextKey) ? [] : {};
			}
			current = current[key];
		}
	}

	return obj;
}

export const file = ({
	mimeType,
	maxSize = 1024 * 1024 * 10
}: {
	mimeType: `${string}/${string}`[];
	maxSize: number;
}) => instance(File, [mt(mimeType), ms(maxSize)]);

export const tryParse = <C>(data: unknown) => {
	if (typeof data !== 'string') {
		return data as C;
	}
	try {
		return JSON.parse(data) as C;
	} catch (e) {
		return data as C;
	}
};
