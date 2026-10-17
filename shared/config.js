// Supabase ativo: projeto ORGANIZADOR DE CULTOS (vrqrnecgqysiycksqhpx).
export const CONFIG = Object.freeze({
  endpoint: '/api/culto',
  storageMode: 'auto', // local | remote | auto (localhost usa local)
  provider: 'supabase', // trocar para supabase só após migrations/importação/homologação
  supabaseUrl: 'https://vrqrnecgqysiycksqhpx.supabase.co',
  supabasePublishableKey: 'sb_publishable_w-O7CcIialAhGQbg7HVzsQ_Io3nvvV2', // somente sb_publishable_... ou anon legada; nunca secret/service_role
  localKey: 'iasd-cultos-v2',
  pollInterval: 30000,
  realtimeDebounce: 120,
});
