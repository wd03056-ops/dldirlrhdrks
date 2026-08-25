import { useCallback, useEffect, useState } from 'react'
import {
  isMinVersionSupported,
  TossAds,
  type TossAdsAttachBannerOptions,
  type TossAdsAttachBannerResult,
} from '@apps-in-toss/web-framework'
import { BANNER_AD_MIN_TOSS_VERSION } from '../constants/ads'

type InitStatus = 'idle' | 'pending' | 'ready' | 'failed'

let initStatus: InitStatus = 'idle'
const initListeners = new Set<(ready: boolean) => void>()

function isBannerAdEnvironmentSupported() {
  try {
    if (!TossAds.initialize.isSupported()) return false
    if (!TossAds.attachBanner.isSupported()) return false

    // 토스앱 5.241.0 미만에서는 빈 화면이 나올 수 있어 예외 처리
    if (
      !isMinVersionSupported({
        android: BANNER_AD_MIN_TOSS_VERSION,
        ios: BANNER_AD_MIN_TOSS_VERSION,
      })
    ) {
      console.warn(
        `[Ads] 배너 광고는 토스앱 ${BANNER_AD_MIN_TOSS_VERSION} 이상에서만 지원해요.`,
      )
      return false
    }
    return true
  } catch {
    return false
  }
}

function ensureTossAdsInitialized(onDone: (ready: boolean) => void) {
  if (initStatus === 'ready') {
    onDone(true)
    return
  }
  if (initStatus === 'failed') {
    onDone(false)
    return
  }

  initListeners.add(onDone)

  if (initStatus === 'pending') return

  initStatus = 'pending'
  TossAds.initialize({
    callbacks: {
      onInitialized: () => {
        initStatus = 'ready'
        initListeners.forEach((listener) => listener(true))
        initListeners.clear()
      },
      onInitializationFailed: (error) => {
        console.error('[Ads] TossAds 초기화 실패', error)
        initStatus = 'failed'
        initListeners.forEach((listener) => listener(false))
        initListeners.clear()
      },
    },
  })
}

/**
 * TossAds SDK 초기화 + attachBanner 헬퍼
 * @see https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/web-banner
 */
export function useTossBanner() {
  const [isInitialized, setIsInitialized] = useState(initStatus === 'ready')
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    if (!isBannerAdEnvironmentSupported()) {
      setIsSupported(false)
      return
    }
    setIsSupported(true)

    ensureTossAdsInitialized((ready) => {
      setIsInitialized(ready)
    })
  }, [])

  const attachBanner = useCallback(
    (
      adGroupId: string,
      element: HTMLElement,
      options?: TossAdsAttachBannerOptions,
    ): TossAdsAttachBannerResult | undefined => {
      if (!isInitialized || !isSupported) return undefined
      return TossAds.attachBanner(adGroupId, element, options)
    },
    [isInitialized, isSupported],
  )

  return { isInitialized, isSupported, attachBanner }
}
