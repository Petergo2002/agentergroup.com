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

  return {
    operations,
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
