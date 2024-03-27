/* eslint-disable @typescript-eslint/no-explicit-any */
const isObject = (value: unknown) =>
	value &&
	typeof value === 'object' &&
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

const TYPES_MAP = new Map<string, string>(
	Object.entries({
		string: '0',
		number: '1',
		boolean: '2',
		date: '3',
		object: '4',
		array: '5',
		null: '6',
		undefined: '7',
		blob: '8',
		file: '9'
	})
);

const REVERSE_TYPES_MAP = new Map<string, string>([...TYPES_MAP].map(([a, b]) => [b, a]));

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

	console.log({ type });
	if (type) {
		const typeIndex = TYPES_MAP.get(type);
		if (type === 'string' || type === 'number' || type === 'boolean') {
			formData.append(`${typeIndex}:${processedKey}`, String(value));
		} else if (type === 'object') {
			const entries = Object.entries(value);
			console.log({ entries });
			if (entries.length === 0) {
				formData.append(`${typeIndex}:${processedKey}`, '{}');
			} else {
				entries.forEach(([key, data]) => {
					processFormData(data, formData, parent ? `${parent}.${key}` : key);
				});
			}
		} else if (type === 'array') {
			if (value.length === 0) {
				formData.append(`${typeIndex}:${processedKey}`, '[]');
			} else {
				value.forEach((item: unknown, index: number) => {
					processFormData(item, formData, processedKey + `[${index}]`);
				});
			}
		} else if (type === 'null' || type === 'undefined') {
			formData.append(`${typeIndex}:${processedKey}`, '');
		} else if (type === 'date') {
			formData.append(`${typeIndex}:${processedKey}`, value.toISOString());
		} else if (type === 'blob' || type === 'file') {
			formData.append(`${typeIndex}:${processedKey}`, value);
		}
	}
};

export const objectToFormData = (data: unknown, formData: FormData = new FormData()) => {
	// const isSvelte5State = isSvelteState(data);
	// console.log({ isSvelte5State }, isArray(data[stateSymbol(data)].t), data[stateSymbol(data)].t);
	if (data === undefined) return formData;
	processFormData(!isObject(data) ? { '######ROOT######': data } : data, formData);
	return formData;
};

export const formDataToObject = (formData: FormData | any) => {
	if (!(formData instanceof FormData)) {
		return formData;
	}
	const obj = {};
	formData.forEach((value, key_type) => {
		let transformedValue = value as any;
		const [typeIndex, key] = key_type.split(':');
		const type = REVERSE_TYPES_MAP.get(typeIndex);

		if (type) {
			if (type === 'number') {
				transformedValue = Number(value);
			} else if (type === 'boolean') {
				transformedValue = value === 'true';
			} else if (type === 'date') {
				transformedValue = new Date(value as string);
			} else if (type === 'null') {
				transformedValue = null;
			} else if (type === 'undefined') {
				transformedValue = undefined;
			} else if (type === 'array' && value === '[]') {
				transformedValue = [];
			} else if (type === 'object' && value === '{}') {
				transformedValue = {};
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
		path = path.replace(/\[(\w+)\]/g, '.$1').split('.');
	}
	let current: any = obj;
	for (let i = 0; i < path.length; i++) {
		const key: keyof any = path[i];
		if (i === path.length - 1) {
			current[key] = value;
		} else {
			if (current[key] === undefined) {
				current[key] = /^\d+$/.test(path[i + 1]) ? [] : {};
			}
			current = current[key];
		}
	}

	return obj;
}

export const tryParse = <C>(data: unknown) => {
	try {
		return (typeof data !== 'string' ? data : JSON.parse(data)) as C;
	} catch (e) {
		return data as C;
	}
};
