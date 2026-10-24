// Isolated, testable Supabase persistence adapter. Never accept user_id from the UI.
export const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;
export function validateSnapshot(kind, value) {
  const formats = {feedback:['bewerbungs-agent-feedback','1.0.0'], workspace:['bewerbungs-agent-workspace','0.3.0']};
  if (!Object.hasOwn(formats, kind)) throw new Error('Unbekannter Datentyp.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON-Objekt erwartet.');
  if (value.type !== formats[kind][0] || value.schema_version !== formats[kind][1]) {
    throw new Error('Inkompatibles Datenformat. Bestand bitte lokal sichern und prüfen.');
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_SNAPSHOT_BYTES) {
    throw new Error('Datei zu gross (maximal 10 MiB).');
  }
  return value;
}
function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}
export function createPrivateStore(client) {
  async function userId() {
    const {data, error} = await client.auth.getUser();
    if (error || !data?.user?.id) throw new Error('Bitte zuerst anmelden.');
    return data.user.id;
  }
  return Object.freeze({
    async loadProfile() {
      const id = await userId();
      return unwrap(await client.from('career_profiles').select('display_name,created_at,updated_at')
        .eq('user_id',id).maybeSingle());
    },
    async saveProfile(displayName) {
      if (typeof displayName !== 'string' || displayName.trim().length > 80) throw new Error('Name: maximal 80 Zeichen.');
      const id = await userId();
      unwrap(await client.from('career_profiles')
        .upsert({user_id:id,display_name:displayName.trim(),updated_at:new Date().toISOString()},{onConflict:'user_id'}));
    },
    async loadSnapshot(kind) {
      if (!['feedback','workspace'].includes(kind)) throw new Error('Ungültiger Datentyp.');
      const id = await userId();
      const data = unwrap(await client.from('career_snapshots').select('payload,revision')
        .eq('user_id',id).eq('kind',kind).maybeSingle());
      return data ?? null;
    },
    async saveSnapshot(kind, value, expectedRevision = null) {
      validateSnapshot(kind,value);
      const id = await userId(), updated_at = new Date().toISOString();
      if (expectedRevision === null) {
        const result = await client.from('career_snapshots').insert({
          user_id:id,kind,payload:value,updated_at,revision:1
        });
        if (result.error?.code === '23505') throw new Error('Cloud-Daten wurden zwischenzeitlich erstellt. Bitte neu laden.');
        unwrap(result);
        return 1;
      }
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error('Ungültige Datenversion.');
      const row = unwrap(await client.from('career_snapshots').update({
        payload:value,updated_at,revision:expectedRevision+1
      }).eq('user_id',id).eq('kind',kind).eq('revision',expectedRevision).select('revision').maybeSingle());
      if (!row) throw new Error('Cloud-Daten wurden auf einem anderen Gerät verändert. Bitte zuerst neu laden und vergleichen.');
      return row.revision;
    },
    async exportData() {
      const id = await userId();
      const profile = unwrap(await client.from('career_profiles')
        .select('display_name,created_at,updated_at').eq('user_id',id).maybeSingle());
      const snapshots = unwrap(await client.from('career_snapshots')
        .select('kind,payload,updated_at,revision').eq('user_id',id));
      const {data:authData, error:authError} = await client.auth.getUser();
      if(authError || !authData?.user || authData.user.id !== id) throw new Error('Sitzung nicht mehr gültig.');
      return {type:'career-agency-user-export',schema_version:'1.0.0',
        exported_at:new Date().toISOString(),
        account:{id, email:authData.user.email ?? null, created_at:authData.user.created_at ?? null},
        profile,snapshots};
    }
  });
}
