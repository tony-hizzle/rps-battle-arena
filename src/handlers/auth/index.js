const { success, error } = require('../../shared/response');
const { createUser, getUser } = require('../../utils/db');

exports.handler = async (event) => {
    try {
        const { httpMethod, path, body } = event;
        const requestBody = body ? JSON.parse(body) : {};
        
        if (httpMethod === 'POST' && path === '/auth') {
            const { action, username, email } = requestBody;
            
            if (action === 'register') {
                if (!username || !email) {
                    return error('Username and email are required');
                }
                
                const user = await createUser({ username, email });
                return success({ user: { userId: user.userId, username: user.username } });
            }
            
            if (action === 'login') {
                // Simplified login - in production, integrate with Cognito
                if (!username) {
                    return error('Username is required');
                }
                
                return success({ user: { userId: 'temp-' + Date.now(), username } });
            }
        }
        
        return error('Invalid request', 404);
    } catch (err) {
        console.error('Auth handler error:', err);
        return error('Internal server error', 500);
    }
};