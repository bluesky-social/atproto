import { sealData, unsealData } from "iron-session";

export type SameSite = Lowercase<'Strict' | 'Lax' | 'None'>;

export interface Response {
  cookie(name: string, value: string, options: CookieOptions): Response;
  clearCookie(name: string, options?: CookieOptions): Response;
}

export interface Request {
  cookies?: Record<string, string>;
}

export interface Options {
  secret: string;
  ttl: number;
  cookie: CookieOptions;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: SameSite;
  path: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
}

export class CookieJar {
  private readonly options: Options;

  constructor(
    secret: string | undefined,
    ttl: number,
    devMode: boolean,
  ) {
    if (!secret) {
      throw new Error('Cookie secret is required');
    }

    if (secret.length < 32) {
      throw new Error('Cookie secret must be at least 32 characters long');
    }

    this.options = {
      secret,
      ttl,
      cookie: {
        httpOnly: true,
        secure: !devMode,
        sameSite: "lax" as const,
        path: "/",
        maxAge: ttl * 1000,
      },
    }
  }

  async create<T>(resp: Response, name: string, data: T) {
    const sealed = await sealData(data, {
      password: this.options.secret,
      ttl: this.options.ttl,
    });

    resp.cookie(name, sealed, this.options.cookie);
  }

  async get<T>(req: Request, name: string, onError: (...args: string[]) => void): Promise<T | null> {
    const sealed = req.cookies?.[name];
    if (!sealed) return null;

    try {
      return await unsealData<T>(sealed, {
        password: this.options.secret,
      });
    } catch (error) {
      onError("Session decryption failed:", error instanceof Error ? error.message : "Unknown error");

      return null;
    }
  }

  clear(resp: Response, name: string) {
    resp.clearCookie(name, {
      ...this.options.cookie,
      maxAge: 0,
    });
  }
}
