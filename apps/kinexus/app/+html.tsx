import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <script dangerouslySetInnerHTML={{ __html: walletInjectGuard }} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: rootCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Phantom / MetaMask / Eternl race to define window.ethereum as non-configurable.
// The second injection throws and Expo's web overlay treats it as an app crash.
const walletInjectGuard = `(function () {
  var keys = { ethereum: 1, solana: 1 };
  var define = Object.defineProperty;
  Object.defineProperty = function (target, key, desc) {
    if (target === window && keys[key]) {
      try {
        return define(target, key, desc);
      } catch (err) {
        return target;
      }
    }
    return define(target, key, desc);
  };
  window.addEventListener('error', function (event) {
    if (event.message && event.message.indexOf('Cannot redefine property: ethereum') !== -1) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();`;

const rootCss = `
html, body, #root {
  height: 100%;
}
body {
  background-color: #0B1016;
}
`;
