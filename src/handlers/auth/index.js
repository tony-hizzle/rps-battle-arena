const { success, error } = require('../../shared/response');
const { createUser, getUser, saveVerificationCode, getVerificationCode, deleteVerificationCode } = require('../../utils/db');
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.handler = async (event) => {
    try {
        const { httpMethod, path, body } = event;
        const requestBody = body ? JSON.parse(body) : {};
        
        if (httpMethod === 'POST' && path === '/auth') {
            const { action, username, phoneNumber, verificationCode } = requestBody;
            
            if (action === 'register') {
                if (!username || !phoneNumber) {
                    return error('Username and phone number are required');
                }
                
                const code = generateVerificationCode();
                await saveVerificationCode(phoneNumber, code);
                
                try {
                    await sns.publish({
                        PhoneNumber: phoneNumber,
                        Message: `Your RPS Battle Arena verification code is: ${code}`
                    }).promise();
                } catch (snsError) {
                    console.log('SNS Error (using mock code):', snsError.message);
                    console.log(`Mock verification code for ${phoneNumber}: ${code}`);
                }
                
                return success({ message: 'Verification code sent' });
            }
            
            if (action === 'verify_phone') {
                if (!phoneNumber || !verificationCode) {
                    return error('Phone number and verification code are required');
                }
                
                const storedCode = await getVerificationCode(phoneNumber);
                if (!storedCode || storedCode !== verificationCode) {
                    return error('Invalid verification code');
                }
                
                await deleteVerificationCode(phoneNumber);
                const user = await createUser({ username: requestBody.username || 'User', phoneNumber });
                return success({ user: { userId: user.userId, username: user.username } });
            }
            
            if (action === 'login') {
                if (!phoneNumber) {
                    return error('Phone number is required');
                }
                
                const user = await getUser(phoneNumber);
                if (!user) {
                    return error('Phone number not found');
                }
                
                const code = generateVerificationCode();
                await saveVerificationCode(phoneNumber, code);
                
                try {
                    await sns.publish({
                        PhoneNumber: phoneNumber,
                        Message: `Your RPS Battle Arena login code is: ${code}`
                    }).promise();
                } catch (snsError) {
                    console.log('SNS Error (using mock code):', snsError.message);
                    console.log(`Mock login code for ${phoneNumber}: ${code}`);
                }
                
                return success({ message: 'Login code sent' });
            }
            
            if (action === 'verify_login') {
                if (!phoneNumber || !verificationCode) {
                    return error('Phone number and verification code are required');
                }
                
                const storedCode = await getVerificationCode(phoneNumber);
                if (!storedCode || storedCode !== verificationCode) {
                    return error('Invalid verification code');
                }
                
                await deleteVerificationCode(phoneNumber);
                const user = await getUser(phoneNumber);
                return success({ user: { userId: user.userId, username: user.username } });
            }
            
            if (action === 'resend_code') {
                if (!phoneNumber) {
                    return error('Phone number is required');
                }
                
                const code = generateVerificationCode();
                await saveVerificationCode(phoneNumber, code);
                
                try {
                    await sns.publish({
                        PhoneNumber: phoneNumber,
                        Message: `Your RPS Battle Arena verification code is: ${code}`
                    }).promise();
                } catch (snsError) {
                    console.log('SNS Error (using mock code):', snsError.message);
                    console.log(`Mock resend code for ${phoneNumber}: ${code}`);
                }
                
                return success({ message: 'Verification code resent' });
            }
        }
        
        return error('Invalid request', 404);
    } catch (err) {
        console.error('Auth handler error:', err);
        return error('Internal server error', 500);
    }
};