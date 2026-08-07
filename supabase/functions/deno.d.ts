declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
    serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  };
}

// Module declarations for Deno imports
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(
    url: string,
    key: string,
    options?: {
      global?: { headers?: Record<string, string> };
      auth?: { persistSession?: boolean; autoRefreshToken?: boolean };
    },
  ): {
    auth: {
      getUser(token?: string): Promise<{ data: { user: any } | null; error: any }>;
      getClaims(token: string): Promise<{ data: { claims: any } | null; error: any }>;
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

// Additional wildcard declarations for any Deno modules
declare module "https://deno.land/*" {
  const module: any;
  export default module;
}

declare module "https://esm.sh/*" {
  const module: any;
  export default module;
}

// Deno npm: imports used by the Lovable MCP edge function bundle
declare module "npm:@lovable.dev/mcp-js@0.20.0" {
  export const auth: any;
  export const defineMcp: any;
  export const defineTool: any;
  const mod: any;
  export default mod;
}

declare module "npm:@lovable.dev/mcp-js@0.20.0/stacks/supabase" {
  export function createSupabaseHandler(mcp: any, opts: { functionName: string }): (req: Request) => Response | Promise<Response>;
}

declare module "npm:@supabase/supabase-js@^2.108.2" {
  export function createClient(url: string | undefined, key: string | undefined, options?: any): any;
}

declare module "npm:zod@^4.4.3" {
  export const z: any;
  const zod: any;
  export default zod;
}
