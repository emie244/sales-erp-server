declare global {
  namespace Express {
    interface User {
      userId: string;
      username: string;
      role: string;
      permissions: string[];
      tenantId?: string;
    }
  }
}

export {};
