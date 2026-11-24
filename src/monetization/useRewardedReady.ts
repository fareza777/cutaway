import { useEffect, useState } from 'react';

import { subscribeRewardedReady } from './ads';

/** True while a rewarded ad is preloaded and can play immediately. */
export function useRewardedReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => subscribeRewardedReady(setReady), []);
  return ready;
}
