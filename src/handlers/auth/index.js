const { success, error } = require('../../shared/response');
const { createUser, getUser } = require('../../utils/db');

exports.handler = async (event) => {
    try {
        const { httpMethod, path, body } = event;
        const requestBody = body ? JSON.parse(body) : {};
        
        if (httpMethod === 'POST' && path === '/auth') {
            const { action, username } = requestBody;
            
            if (action === 'login') {
                if (!username) {
                    return error('Username is required');
                }
                
                let user = await getUser(username);
                if (!user) {
                    user = await createUser({ username });
                }
                
                return success({ user: { userId: user.userId, username: user.username } });
            }
        }
        
        return error('Invalid request', 404);
    } catch (err) {
        console.error('Auth handler error:', err);
        return error('Internal server error', 500);
    }
};