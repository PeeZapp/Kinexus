import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { isShopCart, shopFillScript, type ShopFillLine, type ShopFillResult } from '@/src/features/meals/shopping/shop-fill';

const USER_AGENT =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

export type ShopBrowserHandle = { add: () => void };

export const ShopBrowser = forwardRef<
  ShopBrowserHandle,
  {
    cartUrl: string;
    shopUrl: string;
    lines: ShopFillLine[];
    onResult: (result: ShopFillResult) => void;
    onStart?: () => void;
  }
>(function ShopBrowser({ cartUrl, lines, onResult, onStart }, ref) {
  const webview = useRef<WebView>(null);
  const auto = useRef(false);
  const script = shopFillScript(lines);

  function add() {
    webview.current?.injectJavaScript(script);
  }

  useImperativeHandle(ref, () => ({ add }));

  return (
    <WebView
      ref={webview}
      source={{ uri: cartUrl }}
      style={styles.web}
      userAgent={USER_AGENT}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      domStorageEnabled
      javaScriptEnabled
      setSupportMultipleWindows
      onLoadEnd={(event) => {
        const url = event.nativeEvent.url;
        if (auto.current || !isShopCart(url)) return;
        auto.current = true;
        onStart?.();
        add();
      }}
      onMessage={(event: WebViewMessageEvent) => {
        try {
          const body = JSON.parse(event.nativeEvent.data) as { ok?: boolean; added?: number; error?: string };
          if (body.ok) onResult({ ok: true, added: body.added ?? lines.length });
          else onResult({ ok: false, error: body.error || 'The shop did not take the trolley.' });
        } catch {
          onResult({ ok: false, error: 'The shop did not take the trolley.' });
        }
      }}
      onError={() => onResult({ ok: false, error: 'The shop did not load.' })}
    />
  );
});

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#FFFFFF' },
});
