import { tryParse } from './utils.js';
import { isHttpError } from '@sveltejs/kit';
const httpErrorMap = {
	BAD_REQUEST: { code: 400, message: 'Bad Request' },
	UNAUTHORIZED: { code: 401, message: 'Unauthorized' },
	FORBIDDEN: { code: 403, message: 'Forbidden' },
	NOT_FOUND: { code: 404, message: 'Not Found' },
	METHOD_NOT_SUPPORTED: { code: 405, message: 'Method Not Supported' },
	TIMEOUT: { code: 408, message: 'Timeout' },
	CONFLICT: { code: 409, message: 'Conflict' },
	PRECONDITION_FAILED: { code: 412, message: 'Precondition Failed' },
	PAYLOAD_TOO_LARGE: { code: 413, message: 'Payload Too Large' },
	UNSUPPORTED_MEDIA_TYPE: { code: 415, message: 'Unsupported Media Type' },
	UNPROCESSABLE_CONTENT: { code: 422, message: 'Unprocessable Content' },
	TOO_MANY_REQUESTS: { code: 429, message: 'Too Many Requests' },
	CLIENT_CLOSED_REQUEST: { code: 499, message: 'Client Closed Request' },
	INTERNAL_SERVER_ERROR: { code: 500, message: 'Internal Server Error' },
	NOT_IMPLEMENTED: { code: 501, message: 'Not Implemented' },
	BAD_GATEWAY: { code: 502, message: 'Bad Gateway' },
	SERVICE_UNAVAILABLE: { code: 503, message: 'Service Unavailable' },
	GATEWAY_TIMEOUT: { code: 504, message: 'Gateway Timeout' }
} as const;
type ERROR = keyof typeof httpErrorMap;

export class SRPCERROR extends Error {
	code: ERROR;
	message: string;
	constructor(code: ERROR, message?: string) {
		super(code);
		this.code = code;
		this.message = message || httpErrorMap[code].message;
	}
}

export const error = (code: ERROR, message?: string) => {
	throw new SRPCERROR(code, message);
};

export const getErrorAsJson = (
	error: unknown
): {
	body: string;
	status: number;
	statusText: string;
} => {
	if (error instanceof SRPCERROR) {
		console.log('SRPCERROR');
		return {
			body: JSON.stringify({
				error: error.message
			}),
			status: httpErrorMap[error.code].code,
			statusText: httpErrorMap[error.code].message
		};
	} else if (isHttpError(error)) {
		console.log('isHttpError');
		return {
			body: error.body.message,
			status: error.status,
			statusText: error.body.message
		};
	} else {
		const errorResponse = {
			body: JSON.stringify(error, Object.getOwnPropertyNames(error)),
			// @ts-ignore
			status: 500,
			// @ts-ignore
			statusText: 'Internal Server Error'
		};
		return errorResponse;
	}
};

export const handleError = (error: unknown) => {
	const { body, status, statusText } = getErrorAsJson(error);
	return new Response(body, {
		status,
		statusText
	});
};
