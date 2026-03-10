import 'express';

declare module 'express' {
  interface Request {
    user?: {
      userId: string;
      sessionId: string;
      role: string;
    };
  }

  // Override ParamsDictionary to return string for indexed access
  interface ParamsDictionary {
    [key: string]: string;
  }
}
