/**
 * Test data factories — produce objects matching the Drizzle schema shapes.
 * Every factory returns a plain object with sensible defaults that can be overridden.
 */

let autoId = 1000;
const nextId = () => ++autoId;

export function buildUser(overrides: Record<string, any> = {}) {
  const id = overrides.id ?? nextId();
  return {
    id,
    supabase_uid: `supa-uid-${id}`,
    email: `user${id}@test.com`,
    first_name: "Test",
    last_name: "User",
    role: "user" as const,
    is_affiliate: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export function buildTeam(overrides: Record<string, any> = {}) {
  const id = overrides.id ?? nextId();
  return {
    id,
    name: `Team ${id}`,
    type: "personal" as const,
    teamSubscrptionId: null,
    stripe_customer_id: null,
    plan: "free",
    addon_clips_remaining: 0,
    enterprise_clip_limit: null,
    enterprise_monthly_price: null,
    logo_url: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export function buildTeamMember(overrides: Record<string, any> = {}) {
  const id = overrides.id ?? nextId();
  return {
    id,
    team_id: overrides.team_id ?? 1,
    user_id: overrides.user_id ?? 1,
    role: "member" as const,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export function buildUsageStats(overrides: Record<string, any> = {}) {
  const id = overrides.id ?? nextId();
  return {
    id,
    team_id: overrides.team_id ?? 1,
    date: new Date(),
    clips_created: 0,
    limit: 3,
    resets_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    rollover: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export function buildSubscription(overrides: Record<string, any> = {}) {
  const id = overrides.id ?? nextId();
  return {
    id,
    team_id: overrides.team_id ?? 1,
    stripe_customer_id: `cus_test_${id}`,
    stripe_subscription_id: `sub_test_${id}`,
    status: "active",
    plan: "studio",
    price_id: "price_test_studio",
    current_period_start: new Date(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancel_at_period_end: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/** Reset the auto-increment counter (useful in beforeEach) */
export function resetFactoryIds() {
  autoId = 1000;
}
