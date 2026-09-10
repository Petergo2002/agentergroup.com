import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import {
  profileNeedsSync,
  syncUserProfile,
} from "../../src/lib/app/profile-sync.ts";
import type { ProfileRecord } from "../../src/lib/types.ts";

function buildUser(overrides?: Partial<User>): User {
  return {
    id: "user-1",
    email: "user@example.com",
    user_metadata: {
      full_name: "User One",
      avatar_url: "https://example.com/avatar.png",
    },
    ...overrides,
  } as User;
}

function buildProfile(overrides?: Partial<ProfileRecord>): ProfileRecord {
  return {
    id: "user-1",
    email: "user@example.com",
    full_name: "User One",
    avatar_url: "https://example.com/avatar.png",
    ...overrides,
  };
}

function createProfileClient(initialProfile: ProfileRecord | null) {
  let storedProfile = initialProfile;
  const operations: string[] = [];
  const writePayloads: Array<Record<string, unknown>> = [];

  return {
    operations,
    writePayloads,
    client: {
      from(table: string) {
        assert.equal(table, "profiles");

        return {
          select() {
            operations.push("select");
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: storedProfile, error: null };
                  },
                };
              },
            };
          },
          update(payload: Partial<ProfileRecord>) {
            operations.push("update");
            writePayloads.push({ ...payload });
            return {
              eq() {
                return {
                  select() {
                    return {
                      async single() {
                        storedProfile = {
                          ...(storedProfile ?? buildProfile()),
                          ...payload,
                        };
                        return { data: storedProfile, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
          insert(payload: ProfileRecord) {
            operations.push("insert");
            writePayloads.push({ ...payload });
            return {
              select() {
                return {
                  async single() {
                    storedProfile = payload;
                    return { data: storedProfile, error: null };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

test("profile sync skips writes when profile data is unchanged", async () => {
  const { client, operations } = createProfileClient(buildProfile());

  const profile = await syncUserProfile(client as never, buildUser());

  assert.deepEqual(profile, buildProfile());
  assert.deepEqual(operations, ["select"]);
});

test("profile sync updates only when profile data changed", async () => {
  const { client, operations } = createProfileClient(
    buildProfile({ full_name: "Old Name" }),
  );

  const profile = await syncUserProfile(client as never, buildUser());

  assert.equal(profile.full_name, "User One");
  assert.deepEqual(operations, ["select", "update"]);
});

test("profile sync inserts missing profiles", async () => {
  const { client, operations } = createProfileClient(null);

  const profile = await syncUserProfile(client as never, buildUser());

  assert.deepEqual(profile, buildProfile());
  assert.deepEqual(operations, ["select", "insert"]);
});

test("profile sync never copies authorization fields from user metadata", async () => {
  const { client, writePayloads } = createProfileClient(null);
  const user = buildUser({
    user_metadata: {
      full_name: "User One",
      avatar_url: "https://example.com/avatar.png",
      is_admin: true,
    },
  });

  await syncUserProfile(client as never, user);

  assert.equal(writePayloads.length, 1);
  assert.deepEqual(Object.keys(writePayloads[0]).sort(), [
    "avatar_url",
    "email",
    "full_name",
    "id",
  ]);
  assert.equal("is_admin" in writePayloads[0], false);
});

test("profile comparison ignores unchanged nullable fields", () => {
  const profile = buildProfile({ email: null, avatar_url: null });

  assert.equal(
    profileNeedsSync(profile, buildProfile({ email: null, avatar_url: null })),
    false,
  );
  assert.equal(
    profileNeedsSync(
      profile,
      buildProfile({ email: "new@example.com", avatar_url: null }),
    ),
    true,
  );
});

test("profile sync preserves existing database full_name when user metadata lacks full_name", async () => {
  const { client, operations } = createProfileClient(
    buildProfile({ full_name: "Saved Database Name" }),
  );
  const user = buildUser({
    email: "user@example.com",
    user_metadata: {},
  });

  const profile = await syncUserProfile(client as never, user);

  assert.equal(profile.full_name, "Saved Database Name");
  assert.deepEqual(operations, ["select"]);
});
