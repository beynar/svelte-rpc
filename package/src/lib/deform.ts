import { stringify, parse } from 'devalue';

export const form = (value: unknown, formData: FormData = new FormData()) => {
	const stringified = stringify(value, {
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
