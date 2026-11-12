import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { shopCartUrl } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { stageShopFill } from '@/src/features/meals/shopping/shop-fill';
import { createGroceryHandoff } from '@/src/lib/meals-api';
import { canFillTrolley, getPwaInstallPlatform } from '@/src/lib/pwa';
import { useTrolleyExtension } from '@/src/lib/trolley-extension';
import { colors, radius } from '@/src/features/shell/theme';

function isDesktopWeb(): boolean {
  return Platform.OS === 'web' && getPwaInstallPlatform() === 'other';
}

function extensionsPageUrl(): string {
  if (typeof navigator !== 'undefined' && /Edg\//.test(navigator.userAgent)) return 'edge://extensions';
  return 'chrome://extensions';
}

function downloadExtensionZip() {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = '/kinexus-trolley.zip';
  a.download = 'kinexus-trolley.zip';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ShoppingBot({
  householdId,
  weekStart,
  chains,
  preferredChainId,
  canChooseShop,
  online,
  onPrefer,
}: {
  householdId: string;
  weekStart: string;
  chains: readonly { id: string; name: string }[];
  preferredChainId: string | null;
  canChooseShop: boolean;
  online: boolean;
  onPrefer: (chainId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'shop' | 'trolley' | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const extensionPresent = useTrolleyExtension();
  const desktopWeb = isDesktopWeb();

  if (chains.length === 0) return null;

  async function choose(chainId: string) {
    setError(null);
    setBusy('shop');
    try {
      await onPrefer(chainId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that shop.');
    } finally {
      setBusy(null);
    }
  }

  async function fill() {
    setError(null);
    setBusy('trolley');
    const popup = Platform.OS === 'web' ? window.open('about:blank', 'kinexus-shop') : null;
    try {
      const result = await createGroceryHandoff({ householdId, weekStart });
      const lines = result.order.lines.filter((line) => line.productId && line.packs > 0);
      if (lines.length === 0) throw new Error('No matched products to add for that shop.');
      const chainName = result.order.chainName || chains.find((chain) => chain.id === result.order.chainId)?.name || 'Shop';
      stageShopFill({
        chainId: result.order.chainId,
        chainName,
        lines: lines.map((line) => ({
          productId: line.productId,
          productName: line.productName,
          packs: line.packs,
        })),
        skipped: result.order.skipped.map((row) => row.name),
        shopUrl: result.shopUrl || shopCartUrl(result.order.chainId),
      });
      if (popup) popup.location.replace(result.shopUrl);
      router.push('/shop' as Href);
    } catch (err) {
      popup?.close();
      setError(err instanceof Error ? err.message : 'Could not fill the trolley.');
    } finally {
      setBusy(null);
    }
  }

  const showFill = canFillTrolley() && (!desktopWeb || extensionPresent);
  const showGetExtension = desktopWeb && !extensionPresent;

  return (
    <View style={styles.wrap}>
      <View style={styles.shops}>
        {chains.map((chain) => {
          const selected = chain.id === preferredChainId;
          return (
            <Pressable
              key={chain.id}
              disabled={!online || !canChooseShop || busy != null}
              onPress={() => void choose(chain.id)}
              style={[styles.shop, selected && styles.shopOn]}>
              <Text style={[styles.shopText, selected && styles.shopTextOn]}>{chain.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {showFill ? (
        <Btn
          label="Fill trolley"
          disabled={!online || !preferredChainId || busy != null}
          busy={busy === 'trolley'}
          onPress={() => void fill()}
        />
      ) : null}
      {showGetExtension ? (
        <View style={styles.guide}>
          <Btn label="Get trolley extension" variant="secondary" onPress={() => setGuideOpen((open) => !open)} />
          {guideOpen ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Fill your Coles or Woolworths trolley from this list</Text>
              <Btn label="Download" onPress={downloadExtensionZip} />
              <Text style={styles.step}>1. Right-click the zip → Extract All (opening it is not enough).</Text>
              <Text style={styles.step}>
                2. Open {extensionsPageUrl()}, turn on Developer mode, click Load unpacked, then select the
                extracted folder that contains manifest.json. There is no installer — that folder is the
                extension.
              </Text>
              <Text style={styles.step}>3. Refresh this page.</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <ErrorText message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  shops: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shop: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shopOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  shopText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  shopTextOn: { color: colors.accent },
  guide: { gap: 8 },
  panel: { gap: 8 },
  panelTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  step: { color: colors.text, fontSize: 13, lineHeight: 18 },
});
