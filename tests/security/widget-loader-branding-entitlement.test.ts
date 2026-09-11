import assert from "node:assert/strict";
import test from "node:test";
import {
  loadWidgetById,
  loadWidgetByPublicKey,
  loadAllWidgetsWithAgents,
  isPremiumBrandingPlan,
} from "../../src/lib/widgets/loader.ts";
import type { WidgetAdminSupabase } from "../../src/lib/widgets/server-types.ts";
import type { WidgetRecord } from "../../src/lib/types";

test("isPremiumBrandingPlan accurately checks plan_tier === 'premium'", () => {
  assert.equal(isPremiumBrandingPlan("premium"), true);
  assert.equal(isPremiumBrandingPlan("free"), false);
  assert.equal(isPremiumBrandingPlan("pro"), false);
  assert.equal(isPremiumBrandingPlan(null), false);
  assert.equal(isPremiumBrandingPlan(undefined), false);
});

test("loadWidgetById uses provided canHideBranding and skips workspace_subscriptions fetch", async () => {
  let subscriptionQueried = false;
  const mockWidget = {
    id: "wid-1",
    workspace_id: "ws-1",
    name: "Test Widget",
    description: "",
    status: "deployed",
    show_branding: false,
    widget_public_key: "pub-key-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as WidgetRecord;

  const mockSupabase = {
    from(table: string) {
      if (table === "widgets") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mockWidget, error: null }),
            }),
          }),
        };
      }
      if (table === "widget_agents") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "workspace_subscriptions") {
        subscriptionQueried = true;
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { plan_tier: "free" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table query: ${table}`);
    },
  } as unknown as WidgetAdminSupabase;

  // With canHideBranding = true:
  const resultTrue = await loadWidgetById(mockSupabase, "wid-1", { canHideBranding: true });
  assert.equal(subscriptionQueried, false, "workspace_subscriptions must not be queried when canHideBranding is provided");
  assert.equal(resultTrue?.widget.show_branding, false, "show_branding should remain false when canHideBranding is true");

  // With canHideBranding = false:
  const resultFalse = await loadWidgetById(mockSupabase, "wid-1", { canHideBranding: false });
  assert.equal(subscriptionQueried, false, "workspace_subscriptions must not be queried when canHideBranding is provided");
  assert.equal(resultFalse?.widget.show_branding, true, "show_branding should be normalized to true when canHideBranding is false");

  // Without canHideBranding:
  const resultDefault = await loadWidgetById(mockSupabase, "wid-1");
  assert.equal(subscriptionQueried, true, "workspace_subscriptions should be queried as fallback when canHideBranding is omitted");
  assert.equal(resultDefault?.widget.show_branding, true, "show_branding normalized according to fetched free plan");
});

test("loadAllWidgetsWithAgents uses provided canHideBranding and parallelizes queries", async () => {
  let subscriptionQueried = false;
  const mockWidget = {
    id: "wid-1",
    workspace_id: "ws-1",
    name: "Test Widget",
    description: "",
    status: "deployed",
    show_branding: false,
    widget_public_key: "pub-key-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as WidgetRecord;

  const mockSupabase = {
    from(table: string) {
      if (table === "widgets") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [mockWidget], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "widget_agents") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }
      if (table === "workspace_subscriptions") {
        subscriptionQueried = true;
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { plan_tier: "free" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table query: ${table}`);
    },
  } as unknown as WidgetAdminSupabase;

  const result = await loadAllWidgetsWithAgents(mockSupabase, "ws-1", { canHideBranding: true });
  assert.equal(subscriptionQueried, false, "workspace_subscriptions must not be queried when canHideBranding is provided");
  assert.equal(result.length, 1);
  assert.equal(result[0].widget.show_branding, false);
});

test("loadWidgetByPublicKey loads widget and normalizes branding entitlement", async () => {
  const mockWidget = {
    id: "wid-pub-1",
    workspace_id: "ws-1",
    name: "Public Widget",
    description: "",
    status: "deployed",
    show_branding: false,
    widget_public_key: "pub-key-test",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as WidgetRecord;

  const mockSupabase = {
    from(table: string) {
      if (table === "widgets") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mockWidget, error: null }),
            }),
          }),
        };
      }
      if (table === "widget_agents") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "workspace_subscriptions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { plan_tier: "premium" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table query: ${table}`);
    },
  } as unknown as WidgetAdminSupabase;

  const result = await loadWidgetByPublicKey(mockSupabase, "pub-key-test");
  assert.ok(result);
  assert.equal(result?.widget.id, "wid-pub-1");
  assert.equal(result?.widget.show_branding, false);
});

