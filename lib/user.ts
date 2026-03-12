import { createServiceClient } from '@/lib/supabase/server';

let cachedMasterUserId: string | null = null;

export async function getMasterUserId(): Promise<string> {
  if (cachedMasterUserId) return cachedMasterUserId;

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('email', 'gksruf813@daum.net')
    .single();

  if (error || !data) {
    throw new Error('Master user not found');
  }

  cachedMasterUserId = data.id;
  return data.id;
}
