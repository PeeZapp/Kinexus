import { Platform } from 'react-native';

import { recipePrintHtml, type Recipe } from '@kinexus/domain';

export async function printRecipe(recipe: Recipe): Promise<void> {
  const html = recipePrintHtml(recipe);
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('Printing is available in the web app.');
  }
  await printHtml(html);
}

function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    document.querySelectorAll('iframe[data-recipe-print]').forEach((node) => node.remove());

    const frame = document.createElement('iframe');
    frame.setAttribute('data-recipe-print', 'true');
    frame.setAttribute('title', 'Print recipe');
    Object.assign(frame.style, {
      position: 'absolute',
      left: '-10000px',
      top: '0',
      width: '800px',
      height: '1100px',
      border: '0',
    });

    const cleanup = () => {
      frame.remove();
    };

    let printed = false;
    const runPrint = () => {
      if (printed) return;
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      if (!win || !doc?.querySelector('.sheet')) return;
      printed = true;

      void waitForImages(doc)
        .then(() => {
          win.addEventListener('afterprint', cleanup, { once: true });
          win.focus();
          win.print();
          resolve();
        })
        .catch((err) => {
          cleanup();
          reject(err instanceof Error ? err : new Error('Print failed'));
        });
    };

    frame.addEventListener('load', runPrint);
    document.body.appendChild(frame);
    frame.srcdoc = html;
    // Some browsers apply srcdoc synchronously and never fire load.
    runPrint();
    window.setTimeout(() => {
      if (printed) return;
      cleanup();
      reject(new Error('Could not open print preview.'));
    }, 4000);
  });
}

function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();

  return Promise.race([
    Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    ).then(() => undefined),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1500);
    }),
  ]);
}
