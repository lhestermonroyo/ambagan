// Runs the actual TypeScript service against in-memory store/storage adapters.
// No native runtime, network calls, store purchases or database writes.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const ROOT = path.resolve(path.dirname(module.filename), "..");
const SKU = "com.ambagan.pro.two-weeks";
const PACKAGE = { identifier: "two_week_v1", product: { identifier: SKU } };
const tx = (id, date = "2026-01-01T00:00:00.000Z", product = SKU) => ({
  transactionIdentifier: id, productIdentifier: product, purchaseDate: date,
  purchaseToken: null, originalJson: null, signature: null
});
const info = (transactions = [], entitlement = null) => ({
  entitlements: { active: entitlement ? { "Ambagan Pro": entitlement } : {} },
  latestExpirationDate: entitlement?.expirationDate ?? null,
  nonSubscriptionTransactions: transactions
});

function fixture() {
  const state = {
    disk: new Map(), userId: "user-a", sdkUserId: "user-a",
    row: { plan: "free", plan_expires_at: null },
    customer: info(), charges: 0, writes: 0, invalidations: 0,
    failWrite: false, loseResponse: false, failStorage: false, failRemove: false,
    purchaseError: null, beforeWrite: null,
    now: Date.parse("2026-01-02T00:00:00.000Z")
  };
  class Clock extends Date { static now() { return state.now; } }
  const storage = {
    getItem: async key => state.disk.get(key) ?? null,
    setItem: async (key, value) => {
      if (state.failStorage) throw new Error("Storage unavailable");
      state.disk.set(key, value);
    },
    removeItem: async key => {
      if (state.failRemove) throw new Error("Storage unavailable");
      state.disk.delete(key);
    }
  };
  const sdk = {
    getAppUserID: async () => state.sdkUserId,
    invalidateCustomerInfoCache: async () => { state.invalidations++; },
    getCustomerInfo: async () => state.customer,
    restorePurchases: async () => state.customer,
    getOfferings: async () => ({
      current: { availablePackages: [PACKAGE] }, all: {}
    }),
    purchasePackage: async pkg => {
      if (state.purchaseError) throw state.purchaseError;
      state.charges++;
      const transaction = tx(`store-${state.charges}`, new Clock(state.now - 86400000).toISOString(), pkg.product.identifier);
      state.customer = pkg.identifier === "two_week_v1"
        ? info([...state.customer.nonSubscriptionTransactions, { ...transaction, transactionIdentifier: `revenuecat-${state.charges}` }])
        : info([], { expirationDate: "2026-02-01T00:00:00.000Z" });
      return { customerInfo: state.customer, transaction };
    }
  };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: state.userId } }, error: null }) },
    from: () => {
      const filters = [];
      let update;
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        is(key, value) { filters.push([key, value]); return query; },
        update(value) { update = value; return query; },
        single: async () => ({ data: { ...state.row }, error: null }),
        then(resolve, reject) {
          return (async () => {
            if (state.failWrite) return { error: new Error("Database unavailable"), count: null };
            if (state.beforeWrite) { const fn = state.beforeWrite; state.beforeWrite = null; fn(); }
            if (!filters.every(([key, value]) => key === "id" ? value === state.userId : state.row[key] === value)) {
              return { error: null, count: 0 };
            }
            state.row = { ...update };
            state.writes++;
            if (state.loseResponse) return { error: new Error("Response lost after commit"), count: null };
            return { error: null, count: 1 };
          })().then(resolve, reject);
        }
      };
      return query;
    }
  };
  function reload() {
    const modules = new Map();
    function load(relative) {
      const absolute = path.resolve(ROOT, relative);
      if (modules.has(absolute)) return modules.get(absolute).exports;
      const module = { exports: {} };
      modules.set(absolute, module);
      const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
      }).outputText;
      vm.runInNewContext(code, {
        module, exports: module.exports, __DEV__: true, Date: Clock,
        process: { env: {} }, console,
        require: id => {
          if (id === "@react-native-async-storage/async-storage") return storage;
          if (id === "@/utils/supabase") return { supabase };
          if (id === "@/utils/constants") return { tables: { USERS_TBL: "users_tbl" } };
          if (id === "react-native-purchases") return {
            __esModule: true, default: sdk, LOG_LEVEL: {}, PACKAGE_TYPE: {},
            PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: "cancelled" }
          };
          if (id.startsWith("@/")) return load(`${id.slice(2)}.ts`);
          if (id.startsWith(".")) return load(path.relative(ROOT, path.resolve(path.dirname(absolute), `${id}.ts`)));
          throw new Error(`Unexpected import: ${id}`);
        }
      }, { filename: relative });
      return module.exports;
    }
    return load("features/user/services/purchase.service.ts");
  }
  return { state, sdk, reload, service: reload() };
}

test("confirmed pass survives database failure and full JS reload without another charge", async () => {
  const f = fixture();
  const customer = await f.service.purchasePackage(PACKAGE);
  f.state.failWrite = true;
  await assert.rejects(f.service.syncPlanToSupabase(customer));
  assert.equal(await f.service.hasPendingPurchase("user-a"), true);
  f.service = f.reload(); // Memory is lost; only the persistent journal survives.
  await assert.rejects(f.service.purchasePackage(PACKAGE), error => f.service.isActivationPending(error));
  assert.equal(f.state.charges, 1);
  f.state.failWrite = false;
  const result = await f.service.syncPlanToSupabase(await f.service.getCustomerInfo());
  assert.equal(result.plan, "pro");
  assert.equal(result.plan_expires_at, "2026-01-15T00:00:00.000Z");
  assert.equal(await f.service.hasPendingPurchase("user-a"), false);
  assert.equal(f.state.charges, 1);
  assert.equal(f.state.invalidations, 2);
});

test("a committed write with a lost response is safe to retry", async () => {
  const f = fixture();
  const customer = await f.service.purchasePackage(PACKAGE);
  f.state.loseResponse = true;
  await assert.rejects(f.service.syncPlanToSupabase(customer));
  const expiry = f.state.row.plan_expires_at;
  f.state.loseResponse = false;
  const result = await f.reload().syncPlanToSupabase(customer);
  assert.equal(result.plan_expires_at, expiry);
  assert.equal(f.state.writes, 2); // Same target is safe even if the first reply was lost.
});

test("store history prevents another charge if confirmation could not be journaled", async () => {
  const f = fixture();
  const purchase = f.sdk.purchasePackage;
  f.sdk.purchasePackage = async pkg => {
    const result = await purchase(pkg);
    f.state.failStorage = true; // Storage fails only AFTER the store confirms.
    return result;
  };
  const customer = await f.service.purchasePackage(PACKAGE);
  f.state.failWrite = true;
  await assert.rejects(f.service.syncPlanToSupabase(customer));
  f.state.failStorage = false;
  f.service = f.reload();
  assert.equal(await f.service.hasPendingPurchase('user-a'), false);
  await assert.rejects(f.service.purchasePackage(PACKAGE), error => f.service.isActivationPending(error));
  assert.equal(f.state.charges, 1);
  f.state.failWrite = false;
  assert.equal((await f.service.syncPlanToSupabase(await f.service.getCustomerInfo())).plan, 'pro');
});

test("fresh-device restore uses real product IDs and deduplicates receipt history", async () => {
  const f = fixture();
  f.state.customer = info([tx("one"), tx("one"), tx("two", "2026-01-05T00:00:00.000Z"), tx("unrelated", undefined, "other-product")]);
  const result = await f.service.syncPlanToSupabase(await f.service.restorePurchases());
  assert.equal(result.plan_expires_at, "2026-01-29T00:00:00.000Z");
  f.state.now += 86400000;
  assert.equal((await f.reload().syncPlanToSupabase(f.state.customer)).plan_expires_at, result.plan_expires_at);
});

test("expired passes are not restarted by restore", async () => {
  const f = fixture();
  f.state.now = Date.parse("2026-03-01T00:00:00.000Z");
  const result = await f.service.syncPlanToSupabase(info([tx("expired")]));
  assert.equal(result.plan, "free");
  assert.equal(result.plan_expires_at, null);
});

test("an expired pending pass is reconciled without blocking future purchases", async () => {
  const f = fixture();
  await f.service.purchasePackage(PACKAGE);
  f.state.now = Date.parse("2026-03-01T00:00:00.000Z");
  assert.equal((await f.reload().syncPlanToSupabase(f.state.customer)).plan, "free");
  assert.equal(await f.reload().hasPendingPurchase("user-a"), false);
  await f.reload().purchasePackage(PACKAGE);
  assert.equal(f.state.charges, 2);
});

test("a free row with a stale future expiry does not grant Pro", async () => {
  const f = fixture();
  f.state.row = { plan: "free", plan_expires_at: "2026-02-01T00:00:00.000Z" };
  assert.equal((await f.service.syncPlanToSupabase(info())).plan, "free");
});

test("a later purchase after a lapse starts on its purchase date", async () => {
  const f = fixture();
  f.state.now = Date.parse("2026-03-02T00:00:00.000Z");
  const result = await f.service.syncPlanToSupabase(info([tx("old"), tx("new", "2026-03-01T00:00:00.000Z")]));
  assert.equal(result.plan_expires_at, "2026-03-15T00:00:00.000Z");
});

test("pending pass receipt bridges a temporarily incomplete CustomerInfo response", async () => {
  const f = fixture();
  await f.service.purchasePackage(PACKAGE);
  assert.equal((await f.reload().syncPlanToSupabase(info())).plan, "pro");
});

test("native and RevenueCat history IDs cannot double-count the same payment", async () => {
  const f = fixture();
  const customer = await f.service.purchasePackage(PACKAGE);
  assert.equal(customer.nonSubscriptionTransactions[0].transactionIdentifier, 'revenuecat-1');
  const result = await f.service.syncPlanToSupabase(customer);
  assert.equal(result.plan_expires_at, '2026-01-15T00:00:00.000Z');
  assert.equal((await f.reload().syncPlanToSupabase(customer)).plan_expires_at, result.plan_expires_at);
});

test("an incomplete purchase response waits for canonical history rather than counting a native ID", async () => {
  const f = fixture();
  const purchase = f.sdk.purchasePackage;
  f.sdk.purchasePackage = async pkg => ({ ...(await purchase(pkg)), customerInfo: info() });
  const customer = await f.service.purchasePackage(PACKAGE);
  await assert.rejects(f.service.syncPlanToSupabase(customer), error => f.service.isActivationPending(error));
  assert.equal((await f.reload().syncPlanToSupabase(await f.service.getCustomerInfo())).plan_expires_at, '2026-01-15T00:00:00.000Z');
});

test("monthly purchases also recover after an access write failure", async () => {
  const f = fixture();
  const customer = await f.service.purchasePackage({ identifier: "$rc_monthly", product: { identifier: "monthly" } });
  f.state.failWrite = true;
  await assert.rejects(f.service.syncPlanToSupabase(customer));
  f.state.failWrite = false;
  assert.equal((await f.reload().syncPlanToSupabase(customer)).plan_expires_at, "2026-02-01T00:00:00.000Z");
});

test("a subscription awaiting entitlement keeps recovery pending", async () => {
  const f = fixture();
  await f.service.purchasePackage({ identifier: "$rc_monthly", product: { identifier: "monthly" } });
  await assert.rejects(f.service.syncPlanToSupabase(info()), error => f.service.isActivationPending(error));
  assert.equal(await f.service.hasPendingPurchase("user-a"), true);
});

test("legacy saved access and concurrent paid extensions are retained", async () => {
  const f = fixture();
  f.state.row = { plan: "pro", plan_expires_at: "2026-02-01T00:00:00.000Z" };
  assert.equal((await f.service.syncPlanToSupabase(info())).plan_expires_at, f.state.row.plan_expires_at);
  f.state.row = { plan: "free", plan_expires_at: null };
  f.state.beforeWrite = () => { f.state.row = { plan: "pro", plan_expires_at: "2026-03-01T00:00:00.000Z" }; };
  const result = await f.service.syncPlanToSupabase(info([tx("one")]));
  assert.equal(result.plan_expires_at, "2026-03-01T00:00:00.000Z");
});

test("cancelled purchases do not create pending activation", async () => {
  const f = fixture();
  f.state.purchaseError = { code: "cancelled" };
  await assert.rejects(f.service.purchasePackage(PACKAGE), error => f.service.isPurchaseCancelled(error));
  assert.equal(await f.service.hasPendingPurchase("user-a"), false);
  assert.equal(f.state.charges, 0);
});

test("storage failure stops the charge before opening the store", async () => {
  const f = fixture();
  f.state.failStorage = true;
  await assert.rejects(f.service.purchasePackage(PACKAGE));
  assert.equal(f.state.charges, 0);
});

test("account changes cannot apply another user's payment", async () => {
  const f = fixture();
  const customer = await f.service.purchasePackage(PACKAGE);
  f.state.userId = "user-b";
  f.state.sdkUserId = "user-b";
  await assert.rejects(f.service.syncPlanToSupabase(customer, { expectedUserId: "user-a" }));
  assert.equal(f.state.writes, 0);
  assert.equal(await f.service.hasPendingPurchase("user-a"), true);
  assert.equal(await f.service.hasPendingPurchase("user-b"), false);
});

test("a RevenueCat identity mismatch cannot charge or write access", async () => {
  const f = fixture();
  f.state.sdkUserId = "another-user";
  await assert.rejects(f.service.purchasePackage(PACKAGE));
  await assert.rejects(f.service.syncPlanToSupabase(info()));
  assert.equal(f.state.charges, 0);
  assert.equal(f.state.writes, 0);
});

test("failed pending cleanup remains retryable after access was saved", async () => {
  const f = fixture();
  const customer = await f.service.purchasePackage(PACKAGE);
  f.state.failRemove = true;
  await assert.rejects(f.service.syncPlanToSupabase(customer));
  const expiry = f.state.row.plan_expires_at;
  f.state.failRemove = false;
  assert.equal((await f.service.syncPlanToSupabase(customer)).plan_expires_at, expiry);
  assert.equal(await f.service.hasPendingPurchase("user-a"), false);
});

// Exercise the real screen handlers and render the JSX as plain objects. This
// verifies Retry activation cannot accidentally call the store purchase API.
function subscriptionScreen(f) {
  const stateValues = [], dependencies = [];
  const effects = [];
  let stateIndex = 0, effectIndex = 0;
  const user = { details: { id: "user-a", plan: "free", plan_expires_at: null }, appearanceMode: "light" };
  const toasts = [], routes = [], cached = [];
  const userHook = () => user;
  userHook.getState = () => user;
  userHook.setState = next => Object.assign(user, typeof next === "function" ? next(user) : next);
  const componentStub = new Proxy({}, { get: (_, property) => property === "__esModule" ? false : property });
  const imports = {
    '@/services': { purchase: f.service }, '@/states': { user: userHook },
    '@/features/user/states/user.state': userHook,
    '@/hooks/use-app-toast': () => toast => toasts.push(toast),
    '@/utils/userCache': { setCachedUserSession: async value => cached.push(value) },
    '@/utils/getColorHex': { getPrimaryHex: () => '#7C3AED' },
    '@/constants/proFeatures': { PRO_FEATURES: [] },
    'nativewind': { useColorScheme: () => ({ colorScheme: 'light' }) },
    'expo-router': { useRouter: () => ({ push: route => routes.push(route), back() {} }), Stack: { Toolbar: { Button: 'ToolbarButton' } } },
    'react-native': { Image: 'Image' },
    'date-fns': { differenceInCalendarDays: () => 1, format: () => 'Jan 15, 2026' },
    'react': {
      useState: initial => {
        const index = stateIndex++;
        if (!(index in stateValues)) stateValues[index] = initial === 'monthly' ? 'two_week' : initial;
        return [stateValues[index], value => { stateValues[index] = typeof value === 'function' ? value(stateValues[index]) : value; }];
      },
      useEffect: (effect, deps) => {
        const index = effectIndex++;
        if (!dependencies[index] || deps.some((dep, i) => dep !== dependencies[index][i])) {
          dependencies[index] = deps;
          effects.push(effect);
        }
      }
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'app/profile/subscription/index.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, __DEV__: true, console: { error() {} },
    require: id => {
      if (id in imports) return imports[id];
      if (id.startsWith('@/assets/')) return id;
      if (id.startsWith('@/components/') || id.startsWith('@/layouts/')) return componentStub;
      if (id === 'react-native-purchases') return {};
      throw Error('Unexpected screen import: ' + id);
    }
  });
  const render = () => { stateIndex = 0; effectIndex = 0; return module.exports.default(); };
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node.props ?? {})) return node;
    return Object.values(node.props ?? {}).flat().map(child => find(child, predicate)).find(Boolean) ?? null;
  };
  return {
    user, toasts, routes, cached, render,
    button: text => find(render(), props => props.text === text || (text instanceof RegExp && text.test(props.text ?? '')))?.props,
    async mount() {
      render();
      effects.splice(0).forEach(effect => effect());
      for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve));
    }
  };
}

test("screen offers Retry activation after payment, then succeeds without charging twice", async () => {
  const f = fixture();
  const screen = subscriptionScreen(f);
  await screen.mount();
  f.state.failWrite = true;
  await screen.button(/^Get Pro/).onPress();
  assert.equal(screen.toasts.at(-1).title, 'Payment received');
  assert.equal(f.state.charges, 1);
  const retry = screen.button('Retry activation');
  assert.ok(retry && !retry.disabled);
  f.state.failWrite = false;
  await retry.onPress();
  assert.equal(f.state.charges, 1);
  assert.equal(screen.user.details.plan, 'pro');
  assert.equal(screen.cached.at(-1).details.plan, 'pro');
  assert.equal(screen.routes.at(-1).pathname, '/subscription-success');
});

test("screen reload loads pending activation before enabling a new purchase", async () => {
  const f = fixture();
  await f.service.purchasePackage(PACKAGE);
  f.service = f.reload();
  const screen = subscriptionScreen(f);
  assert.equal(screen.button(/^Get Pro/).disabled, true);
  await screen.mount();
  const retry = screen.button('Retry activation');
  assert.ok(retry);
  await retry.onPress();
  assert.equal(f.state.charges, 1);
  assert.equal(screen.user.details.plan, 'pro');
});

test("screen cancellation does not show a paid or successful state", async () => {
  const f = fixture();
  const screen = subscriptionScreen(f);
  await screen.mount();
  f.state.purchaseError = { code: 'cancelled' };
  await screen.button(/^Get Pro/).onPress();
  assert.equal(screen.toasts.length, 0);
  assert.equal(screen.routes.length, 0);
  assert.equal(screen.user.details.plan, 'free');
  assert.equal(screen.button('Retry activation'), undefined);
});
