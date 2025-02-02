export const tryParse = <C>(data: unknown) => {
	try {
		return (typeof data !== 'string' ? data : JSON.parse(data)) as C;
	} catch (e) {
		return data as C;
	}
};
