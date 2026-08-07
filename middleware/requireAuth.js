import * as jose from 'jose';

const JWKS = jose.createRemoteJWKSet(new URL('http://localhost:3000/api/auth/jwks'));

export async function requireAuth(req, res, next) {
  try {
    console.log('req', req);
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Unauthorized',
      });
    }

    const token = authHeader.substring(7);

    const { payload } = await jose.jwtVerify(token, JWKS);

    req.user = payload;

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Unauthorized',
    });
  }
}
