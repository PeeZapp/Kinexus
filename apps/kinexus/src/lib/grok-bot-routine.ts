/** Copy-paste skill for Grok Bot Sunday household ops. */

export const GROK_BOT_SUNDAY_OPS_TITLE = 'Sunday meal + shop';

export const GROK_BOT_SUNDAY_OPS_ROUTINE = `Create a weekly routine for Sunday 5:00 PM local time named "Kinexus Sunday ops".

Using the Kinexus MCP tools only:

1. Call get_food_prefs.
2. Call get_meal_plan for next Monday through Sunday.
3. Fill empty dinner slots (and empty lunch slots if any). Prefer get_picks, then search_recipes matching cuisines/allergies. Call plan_meals with overwrite false. Skip slots that are already filled.
4. Call rebuild_shopping_list for that week’s Monday.
5. Call match_shopping_prices for that week.
6. Call prepare_trolley for that week.
7. Open shopUrl in your browser. Sign in to the household Coles or Woolworths account if needed. Add the matched products to the trolley and complete checkout / choose a delivery slot.
8. If login, CAPTCHA, payment, or bot checks block you, stop and message me the reviewUrl plus what blocked you. Do not invent products or pay with a card I have not saved for you.

When finished, send a short summary: meals planned, unmatched shopping items, and whether checkout completed.`;
