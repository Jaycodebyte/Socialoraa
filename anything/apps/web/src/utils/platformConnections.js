import supabase from "@/utils/supabase";

const TABLE_NAME = "connected_platforms";

const localKey = (userId) => `socialpilot-platforms:${userId || "guest"}`;

const readLocalConnections = (userId) => {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(window.localStorage.getItem(localKey(userId)) || "[]");
  } catch {
    return [];
  }
};

const writeLocalConnections = (userId, connections) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localKey(userId), JSON.stringify(connections));
};

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function listPlatformConnections(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("user_id", userId)
    .order("verified_at", { ascending: false });

  if (!error) return data;

  return readLocalConnections(userId);
}

export async function savePlatformConnection(userId, input) {
  if (!userId) throw new Error("Please sign in before connecting a platform.");

  const now = new Date().toISOString();
  const connection = {
    user_id: userId,
    platform: input.platform,
    provider: input.provider,
    account_label: input.accountLabel,
    external_account_id: input.externalAccountId || null,
    access_token: input.accessToken || null,
    refresh_token: input.refreshToken || null,
    token_expires_at: input.tokenExpiresAt || null,
    scopes: input.scopes || null,
    account_metadata: input.accountMetadata || null,
    status: "verified",
    verified_at: now,
    updated_at: now,
  };

  let { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(connection, { onConflict: "user_id,platform,external_account_id" })
    .select()
    .single();

  if (!error) return data;

  const { access_token, refresh_token, token_expires_at, scopes, account_metadata, ...baseConnection } =
    connection;

  ({ data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(baseConnection, {
      onConflict: "user_id,platform,external_account_id",
    })
    .select()
    .single());

  if (!error) return data;

  const existing = readLocalConnections(userId).filter(
    (item) =>
      !(
        item.platform === connection.platform &&
        item.external_account_id === connection.external_account_id
      ),
  );
  const localConnection = { ...connection, id: newId() };
  writeLocalConnections(userId, [localConnection, ...existing]);
  return localConnection;
}

export async function removePlatformConnection(userId, connectionId) {
  if (!userId || !connectionId) return;

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("id", connectionId);

  if (!error) return;

  writeLocalConnections(
    userId,
    readLocalConnections(userId).filter((item) => item.id !== connectionId),
  );
}

export async function updatePlatformConnectionTokens(userId, connectionId, tokens) {
  if (!userId || !connectionId || !tokens?.accessToken) return null;

  const updates = {
    access_token: tokens.accessToken,
    token_expires_at: tokens.tokenExpiresAt || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq("id", connectionId)
    .eq("user_id", userId)
    .select()
    .single();

  if (!error) return data;

  const localConnections = readLocalConnections(userId);
  const next = localConnections.map((item) =>
    item.id === connectionId
      ? {
          ...item,
          access_token: updates.access_token,
          token_expires_at: updates.token_expires_at,
          updated_at: updates.updated_at,
        }
      : item,
  );
  writeLocalConnections(userId, next);
  return next.find((item) => item.id === connectionId) || null;
}
