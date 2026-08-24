import { defineConfig } from '@apps-in-toss/web-framework/config';

/**
 * 앱인토스 비게임 미니앱 설정
 * @see https://developers-apps-in-toss.toss.im/checklist/app-nongame
 */
export default defineConfig({
  appName: 'woori-secret-space',
  brand: {
    // 콘솔에 등록한 브랜드 컬러와 동일하게 유지
    primaryColor: '#111111',
  },
  // 비게임 내비게이션 바: 뒤로가기 + 홈 + 브랜드 타이틀
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
    withTitle: true,
    transparentBackground: false,
    theme: 'light',
  },
  permissions: [
    { name: 'clipboard', access: 'write' },
    { name: 'photos', access: 'read' },
  ],
  webView: {
    // 지도 등이 아닌 일반 서비스 → 제스처 확대/축소 비활성에 가깝게
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsBackForwardNavigationGestures: true,
  },
  webBundleDir: 'dist',
});
