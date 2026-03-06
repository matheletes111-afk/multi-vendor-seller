import jwt from 'jsonwebtoken';

// Use different secrets for mobile if needed
const MOBILE_JWT_SECRET = process.env.MOBILE_JWT_SECRET_KEY || process.env.JWT_SECRET_KEY!;
const MOBILE_REFRESH_SECRET = process.env.MOBILE_REFRESH_SECRET_KEY || process.env.JWT_REFRESH_SECRET_KEY!;

export interface MobileTokenPayload {
  userId: string;
  email: string;
  role: string;
  deviceId?: string;
  platform?: 'ios' | 'android' | 'web';
}

export interface MobileTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const generateMobileTokens = (
  payload: MobileTokenPayload
): MobileTokens => {
  // Shorter expiry for mobile access tokens (better security)
  const accessToken = jwt.sign(
    { ...payload, type: 'access' },
    MOBILE_JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Longer expiry for mobile refresh tokens
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    MOBILE_REFRESH_SECRET,
    { expiresIn: '30d' } // 30 days for mobile
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600 // 1 hour in seconds
  };
};

export const verifyMobileAccessToken = (token: string): MobileTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, MOBILE_JWT_SECRET) as MobileTokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

export const verifyMobileRefreshToken = (token: string): MobileTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, MOBILE_REFRESH_SECRET) as MobileTokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

export const decodeMobileToken = (token: string): MobileTokenPayload | null => {
  try {
    return jwt.decode(token) as MobileTokenPayload;
  } catch (error) {
    return null;
  }
};