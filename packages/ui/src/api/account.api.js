import client from '@/api/client'

const verifyAccountEmail = (body) => client.post('/account/verify', body)
const resendVerificationEmail = (body) => client.post('/account/resend-verification', body)

export default {
    verifyAccountEmail,
    resendVerificationEmail
}
