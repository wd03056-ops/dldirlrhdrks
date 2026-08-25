import { useEffect, useRef, useState } from 'react'
import { BANNER_AD_GROUP_ID } from '../constants/ads'
import { useTossBanner } from '../hooks/useTossBanner'

type BannerAdProps = {
  /** 기본: 라이브 배너 그룹 ID */
  adGroupId?: string
  className?: string
}

/**
 * 앱인토스 인라인 배너 광고 (흰색 테마)
 * @see https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/web-banner
 */
export default function BannerAd({
  adGroupId = BANNER_AD_GROUP_ID,
  className = '',
}: BannerAdProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isInitialized, isSupported, attachBanner } = useTossBanner()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!isSupported || !isInitialized || !containerRef.current) return

    setCollapsed(false)
    const attached = attachBanner(adGroupId, containerRef.current, {
      theme: 'light',
      tone: 'blackAndWhite',
      variant: 'expanded',
      callbacks: {
        onAdRendered: () => setCollapsed(false),
        onNoFill: () => setCollapsed(true),
        onAdFailedToRender: (payload) => {
          console.error('[Ads] 배너 렌더 실패', payload.error)
          setCollapsed(true)
        },
      },
    })

    return () => {
      attached?.destroy()
    }
  }, [adGroupId, attachBanner, isInitialized, isSupported])

  if (!isSupported) return null

  return (
    <div
      className={`w-full overflow-hidden bg-white ${className}`}
      style={{ height: collapsed ? 0 : 96 }}
      aria-hidden={collapsed}
    >
      <div
        ref={containerRef}
        className="w-full bg-white"
        style={{ width: '100%', height: '96px' }}
      />
    </div>
  )
}
