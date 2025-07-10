const createResponse = (statusCode, body, headers = {}) => {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            ...headers
        },
        body: JSON.stringify(body)
    };
};

const success = (data) => createResponse(200, { success: true, data });
const error = (message, statusCode = 400) => createResponse(statusCode, { success: false, error: message });

module.exports = { createResponse, success, error };