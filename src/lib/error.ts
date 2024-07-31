const httpErrorMap = new Map([
	['BAD_REQUEST', 400],
	['UNAUTHORIZED', 401],
	['FORBIDDEN', 403],
	['NOT_FOUND', 404],
	['METHOD_NOT_SUPPORTED', 405],
	['TIMEOUT', 408],
	['CONFLICT', 409],
	['PRECONDITION_FAILED', 412],
	['PAYLOAD_TOO_LARGE', 413],
	['UNSUPPORTED_MEDIA_TYPE', 415],
	['UNPROCESSABLE_CONTENT', 422],
	['TOO_MANY_REQUESTS', 429],
	['CLIENT_CLOSED_REQUEST', 499],
	['INTERNAL_SERVER_ERROR', 500],
	['NOT_IMPLEMENTED', 501],
	['BAD_GATEWAY', 502],
	['SERVICE_UNAVAILABLE', 503],
	['GATEWAY_TIMEOUT', 504]
]);
interface HttpError {
	code: number;
	description: string;
}

function generateError(code: number): HttpError | null {
	const error = httpErrorMap.get(getErrorCodeName(code));
	if (!error) {
		throw new Error(`Unknown HTTP error code: ${code}`);
	}
	return error;
}

function getErrorCodeName(code: number): string {
	switch (code) {
		case 400:
			return 'BAD_REQUEST';
		case 401:
			return 'UNAUTHORIZED';
		// ... (add more cases for each error code)
		default:
			throw new Error(`Unknown HTTP error code: ${code}`);
	}
}

// Example usage:
const error = generateError(404);
if (error) {
	console.log(`Error ${error.code}: ${error.description}`);
} else {
	console.log('Unknown error');
}
