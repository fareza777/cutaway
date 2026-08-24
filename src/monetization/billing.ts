import { Platform } from 'react-native';

import type { Product, Purchase } from 'expo-iap';

import { REMOVE_ADS_PRODUCT_ID } from './policy';
import { useMonetization } from '@/state/monetization';

type IapApi = typeof import('expo-iap');

let apiPromise: Promise<IapApi | null> | null = null;
let connectionPromise: Promise<boolean> | null = null;
let purchaseSubscription: { remove: () => void } | null = null;

async function getIapApi() {
  if (Platform.OS !== 'android') return null;
  apiPromise ??= import('expo-iap').catch(() => null);
  return apiPromise;
}

function isCompletedRemoveAdsPurchase(purchase: Purchase) {
  return purchase.productId === REMOVE_ADS_PRODUCT_ID && purchase.purchaseState === 'purchased';
}

async function applyPurchase(purchase: Purchase, api: IapApi) {
  if (!isCompletedRemoveAdsPurchase(purchase)) return;

  // Google Play is the source of truth for the completed one-time purchase.
  // Marking the local entitlement first keeps a successful user purchase from
  // being hidden if the app is backgrounded during transaction finalization.
  useMonetization.getState().markRemoveAds();
  try {
    await api.finishTransaction({ purchase, isConsumable: false });
  } catch (error) {
    // The purchase remains in Play's available queue and will be retried on the
    // next launch. Do not log tokens or other receipt details.
    console.warn('Could not finish the remove-ads transaction yet.', error);
  }
}

export async function initializeBilling() {
  const api = await getIapApi();
  if (!api) return false;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    const connected = await api.initConnection();
    if (!connected) return false;

    purchaseSubscription?.remove();
    purchaseSubscription = api.purchaseUpdatedListener((purchase) => {
      void applyPurchase(purchase, api);
    });

    const available = await api.getAvailablePurchases();
    for (const purchase of available ?? []) await applyPurchase(purchase, api);
    return true;
  })().catch((error) => {
    connectionPromise = null;
    console.warn('Google Play Billing is unavailable right now.', error);
    return false;
  });

  return connectionPromise;
}

export async function loadRemoveAdsProduct(): Promise<Product | undefined> {
  const api = await getIapApi();
  if (!api) return undefined;
  await initializeBilling();
  try {
    const products = (await api.fetchProducts({ skus: [REMOVE_ADS_PRODUCT_ID], type: 'in-app' })) as Product[] | null;
    return products?.find((product) => product.id === REMOVE_ADS_PRODUCT_ID);
  } catch (error) {
    console.warn('Could not load the remove-ads product.', error);
    return undefined;
  }
}

export async function purchaseRemoveAds() {
  const api = await getIapApi();
  if (!api) throw new Error('Purchases are available on Android only.');
  await initializeBilling();
  await api.requestPurchase({
    type: 'in-app',
    request: { google: { skus: [REMOVE_ADS_PRODUCT_ID] } },
  });
}

export async function restoreRemoveAds() {
  const api = await getIapApi();
  if (!api) return false;
  await initializeBilling();
  const available = await api.getAvailablePurchases();
  for (const purchase of available ?? []) await applyPurchase(purchase, api);
  return useMonetization.getState().removeAds;
}

export async function disposeBilling() {
  purchaseSubscription?.remove();
  purchaseSubscription = null;
  const api = await getIapApi();
  if (api && connectionPromise) {
    try {
      await api.endConnection();
    } catch {
      // App teardown should never surface a billing error to the user.
    }
  }
  connectionPromise = null;
}
