declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

// Module declarations for Deno imports
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(url: string, key: string): {
    auth: {
      getUser(token: string): Promise<{ data: { user: any } | null; error: any }>;
      admin: {
        listUsers(): Promise<{ data: { users: any[] } | null; error: any }>;
      };
    };
    rpc(name: string, params: any): Promise<{ data: any; error: any }>;
    from(table: string): {
      select(columns?: string): any;
      insert(data: any): any;
      update(data: any): any;
      delete(): any;
    };
  };
}

export {};
