declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run(
        input: string,
        options: Record<string, unknown>,
      ): Promise<number[]>;
    };
  };
};
