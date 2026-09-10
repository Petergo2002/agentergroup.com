export function configuredServiceKeys() {
  const keys = [Deno.env.get('SUPABASE_SECRET_KEY'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')];
  try {
    const configured = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    for (const value of Object.values(configured)) {
      if (typeof value === 'string') keys.push(value);
      else if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const key = record.key ?? record.value ?? record.secret ?? record.api_key;
        if (typeof key === 'string') keys.push(key);
      }
    }
  } catch { /* Explicit keys remain available if platform metadata is malformed. */ }
  return new Set(keys.map((key) => key?.trim()).filter((key): key is string => Boolean(key)));
}
