export const load = async ({ locals }) => {
	// const data = await event.locals.api.test.test2({ test: 'ez', image: new Date() });
	// console.log({ data });
	// return { result: data.data };

	console.log('locals', locals);
	const result = await locals.api.test.noPayload();
	return {
		result
	};
};
