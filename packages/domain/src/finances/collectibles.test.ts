import { describe, expect, it } from 'vitest';

import {
  collectibleHoldingValue,
  collectiblesTotal,
  convertQuotedMoney,
  looksLikeLegoSetNumber,
  brickOwlSetUrl,
  parseQuotedPrice,
  pickCollectibleValue,
} from './collectibles';
import {
  applyDiscogsStats,
  parseBrickEconomyMinifigSearch,
  parseBrickEconomySearch,
  parseBrickEconomySet,
  parseBricksetMinifigSearch,
  parseBricksetSearch,
  parseBricksetSet,
  parseBrickOwlProduct,
  parsePriceChartingSearch,
} from './collectible-lookup';
import type { FinanceCollectible } from './types';

function item(partial: Partial<FinanceCollectible> & Pick<FinanceCollectible, 'id' | 'name' | 'kind' | 'marketValue'>): FinanceCollectible {
  return {
    householdId: 'h1',
    createdBy: 'u1',
    condition: 'new',
    quantity: 1,
    catalogId: null,
    source: 'manual',
    sourceUrl: null,
    imageUrl: null,
    purchasedValue: null,
    notes: null,
    valuedAt: null,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    ...partial,
  };
}

describe('collectibles', () => {
  it('normalises LEGO set numbers and quoted prices', () => {
    expect(looksLikeLegoSetNumber('75192')).toBe('75192-1');
    expect(looksLikeLegoSetNumber('10236-1')).toBe('10236-1');
    expect(looksLikeLegoSetNumber('charizard')).toBeNull();
    expect(parseQuotedPrice('A$1,296.00')).toEqual({ amount: 1296, currency: 'AUD' });
    expect(parseQuotedPrice('$10,100.00')).toEqual({ amount: 10100, currency: 'USD' });
    expect(convertQuotedMoney(100, 'USD', 'AUD')).toBe(155);
  });

  it('picks new vs used catalog values and sums holdings', () => {
    expect(pickCollectibleValue({ valueNew: 1296, valueUsed: 864, retailValue: 360 }, 'new')).toBe(1296);
    expect(pickCollectibleValue({ valueNew: 1296, valueUsed: 864, retailValue: 360 }, 'used')).toBe(864);
    const items = [
      item({ id: 'a', name: 'Falcon', kind: 'lego', marketValue: 1100, quantity: 1 }),
      item({ id: 'b', name: 'Charizard', kind: 'trading_card', marketValue: 345.2, quantity: 2, condition: 'used' }),
    ];
    expect(collectibleHoldingValue(items[1]!)).toBe(690.4);
    expect(collectiblesTotal(items)).toBe(1790.4);
  });

  it('parses BrickEconomy search rows and set pricing', () => {
    const search = parseBrickEconomySearch(`
      <tr>
        <td class="hidden-xs ctlsets-image"><a href="/set/75192-1/lego-star-wars-millennium-falcon"><img src="/resources/images/sets/lego-75192-1_medium.jpg"></a></td>
        <td class="ctlsets-left">
          <h4><a href="/set/75192-1/lego-star-wars-millennium-falcon">75192 Millennium Falcon</a></h4>
          <div class="mb-2"><small class="text-muted mr-5">Theme / Subtheme</small> Star Wars / Ultimate Collector Series</div>
        </td>
        <td class="ctlsets-right text-right">
          <div><small class="text-muted mr-5">Retail</small> A$1,299.99</div>
        </td>
      </tr>
    `);
    expect(search).toHaveLength(1);
    expect(search[0]?.catalogId).toBe('75192-1');
    expect(search[0]?.retailValue).toBe(1299.99);
    expect(search[0]?.currency).toBe('AUD');

    const set = parseBrickEconomySet(`
      <meta name="og:url" content="https://www.brickeconomy.com/set/10236-1/lego-creator-ewok-village" />
      <h1 class="setheader">10236 LEGO Creator Ewok Village</h1>
      <div class="row rowlist"><div class="col-xs-5 text-muted">Set number</div><div class="col-xs-7">10236-1</div></div>
      <div id="ContentPlaceHolder1_PanelSetPricing" class="side-box mt-30 setpricing">
        <div class="row rowlist"><div class="col-xs-5 text-muted">Retail price</div><div class="col-xs-7">A$359.99</div></div>
        <div class="semibold"><i class="icon-16 icon-new-med-16"></i>New/Sealed</div>
        <div class="row rowlist"><div class="col-xs-5 text-muted">Value</div><div class="col-xs-7"><b>A$1,296.00</b></div></div>
        <div class="semibold"><i class="icon-16 icon-used-med-16"></i>Used</div>
        <div class="row rowlist"><div class="col-xs-5 text-muted">Value</div><div class="col-xs-7">A$863.99</div></div>
      </div>
      <div id="ContentPlaceHolder1_PanelSetBuying"></div>
    `);
    expect(set?.catalogId).toBe('10236-1');
    expect(set?.valueNew).toBe(1296);
    expect(set?.valueUsed).toBe(863.99);
  });

  it('parses PriceCharting search rows', () => {
    const hits = parsePriceChartingSearch(`
      <tr id="product-630417" data-product="630417">
        <td class="image"><a href="https://www.pricecharting.com/game/pokemon-base-set/charizard-4"><img class="photo" src="https://img.example/c.jpg" /></a></td>
        <td class="title">
          <a href="https://www.pricecharting.com/game/pokemon-base-set/charizard-4">Charizard #4</a>
          <div class="console-in-title"><a href="/console/pokemon-base-set">Pokemon Base Set</a></div>
        </td>
        <td class="price numeric used_price"><span class="js-price">$345.20</span></td>
        <td class="price numeric cib_price"><span class="js-price">$732.65</span></td>
        <td class="price numeric new_price"><span class="js-price">$1,405.00</span></td>
      </tr>
    `);
    expect(hits[0]).toMatchObject({
      catalogId: '630417',
      name: 'Charizard #4',
      subtitle: 'Pokemon Base Set',
      valueUsed: 345.2,
      valueNew: 1405,
      source: 'pricecharting',
    });
  });

  it('parses BrickEconomy minifig panels and Discogs marketplace stats', () => {
    const minifigs = parseBrickEconomyMinifigSearch(`
      <a href="/minifig/sw0509/luke-skywalker" title="LEGO Luke Skywalker">
        <div class="setminifigpanel">
          <div class="setminifigpanel-number"><span>sw0509</span></div>
          <div class="setminifigpanel-name">Luke Skywalker</div>
          <div class="setminifigpanel-img"><img src="/resources/images/minifigs/sw0509_thumb.png" /></div>
          <div class="setminifigpanel-value"><small class="text-muted mr-5">Value</small> A$59.17</div>
        </div>
      </a>
    `);
    expect(minifigs[0]).toMatchObject({
      kind: 'minifig',
      catalogId: 'sw0509',
      name: 'Luke Skywalker',
      valueNew: 59.17,
      source: 'brickeconomy',
    });

    const withStats = applyDiscogsStats(
      {
        kind: 'vinyl',
        source: 'discogs',
        catalogId: '367114',
        name: 'Nirvana - Nevermind',
        subtitle: '1991',
        imageUrl: null,
        sourceUrl: 'https://www.discogs.com/release/367114',
        currency: 'USD',
        valueNew: null,
        valueUsed: null,
        retailValue: null,
      },
      { lowest_price: { value: 20, currency: 'USD' } },
      'AUD',
    );
    expect(withStats.valueUsed).toBe(31);
    expect(withStats.currency).toBe('AUD');
  });

  it('parses Brickset set pages, search cards, and minifig values', () => {
    const set = parseBricksetSet(`
      <meta property="og:url" content="https://brickset.com/sets/75192-1" />
      <meta property="og:image" content="https://images.brickset.com/sets/images/75192-1.jpg" />
      <h1>75192 Millennium Falcon</h1>
      <dt>Theme</dt><dd><a href="/sets/theme-Star-Wars">Star Wars</a></dd>
      <dt>Subtheme</dt><dd><a href="/sets/subtheme-Ultimate-Collector-Series">Ultimate Collector Series</a></dd>
      <dt>RRP</dt><dd>£734.99, $849.99, €849.99</dd>
    `);
    expect(set).toMatchObject({
      kind: 'lego',
      source: 'brickset',
      catalogId: '75192-1',
      name: '75192 Millennium Falcon',
      retailValue: 849.99,
      valueNew: 849.99,
      currency: 'USD',
    });

    const search = parseBricksetSearch(`
      <h1><a href="/sets/75192-1/Millennium-Falcon"><span>75192: </span> Millennium Falcon</a></h1>
      <a href="/sets/theme-Star-Wars">Star Wars</a>
      <dt>RRP</dt><dd>$849.99, €849.99 | <a>More</a></dd>
    `);
    expect(search[0]).toMatchObject({ catalogId: '75192-1', retailValue: 849.99, valueNew: 849.99, source: 'brickset' });

    const minifigs = parseBricksetMinifigSearch(`
      <h1><a href="/minifigs/sw0509/luke-skywalker"><span>SW0509: </span> Luke Skywalker</a></h1>
      <dt>Value new</dt><dd><a>~$40.46</a></dd>
      <dt>Value used</dt><dd><a>~$34.05</a></dd>
    `);
    expect(minifigs[0]).toMatchObject({
      kind: 'minifig',
      catalogId: 'sw0509',
      name: 'Luke Skywalker',
      valueNew: 40.46,
      valueUsed: 34.05,
      source: 'brickset',
    });
  });

  it('reads BrickOwl JSON-LD market offers and still picks string amounts', () => {
    expect(brickOwlSetUrl('75192-1', '75192 Millennium Falcon')).toBe(
      'https://www.brickowl.com/catalog/lego-millennium-falcon-set-75192',
    );
    const owl = parseBrickOwlProduct(`
      <script type="application/ld+json">{"@type":"Product","name":"LEGO Millennium Falcon Set 75192","mpn":["75192"],"offers":{"@type":"Offer","price":1046.28,"priceCurrency":"AUD","itemCondition":"https://schema.org/UsedCondition"}}</script>
    `);
    expect(owl).toMatchObject({ catalogId: '75192', valueUsed: 1046.28, currency: 'AUD' });
    expect(pickCollectibleValue({ valueNew: '1317.48', valueUsed: null, retailValue: null }, 'new')).toBe(1317.48);
  });
});
