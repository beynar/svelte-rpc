export const load = async (event) => {
	const data = await event.locals.api.test.test2({ test: 'ez', image: 'ez' });
	return { result: data.data };
};
