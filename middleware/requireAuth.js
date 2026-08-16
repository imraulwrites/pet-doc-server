import * as jose from 'jose-cjs';

const JWKS = jose.createRemoteJWKSet(new URL(`${process.env.NEXT_APP_URI}/api/auth/jwks`));

export async function requireAuth(req, res, next) {
  try {
    // console.log('req', req);
    const authHeader = req.headers.authorization;
    // console.log('req. headers. authorization', authHeader);

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Unauthorized',
      });
    }

    const token = authHeader.substring(7);

    // console.log('token test', token);

    const { payload } = await jose.jwtVerify(token, JWKS);

    req.user = payload;

    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({
      message: 'Unauthorized',
    });
  }
}
