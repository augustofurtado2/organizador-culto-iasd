// CONFIGURAÇÃO MANUAL NECESSÁRIA antes de ativar o provedor Supabase.
export const CONFIG = Object.freeze({
  endpoint: '/api/culto',
  storageMode: 'auto', // local | remote | auto (localhost usa local)
  provider: 'jsonbin', // trocar para supabase só após migrations/importação/homologação
  supabaseUrl: '',
  supabasePublishableKey: '', // somente sb_publishable_... ou anon legada; nunca secret/service_role
  localKey: 'iasd-cultos-v2',
  pollInterval: 30000,
  realtimeDebounce: 120,
});
