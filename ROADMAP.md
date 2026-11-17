# Kinexus roadmap

Light forward plan. Not a build checklist — direction only. Ship what exists first; expand only when the current suite feels calm and correct.

**Principle:** modules stay optional. Households pick what they use. Prefer composing existing modules over new silos when a job can be done that way.

---

## Now — tighten what we have

### 1. UI / UX cleanup
Polish the live suite before any new major module.

- Today, Calendar, Meals, Lists, Money, Train
- Desktop vs mobile consistency, navigation clarity, empty states, flows that feel finished
- Module opt-in / visibility foundations (so later modules can turn on without clutter)
- Test thoroughly; fix bugs and UX debt end-to-end

---

## Next major module

### 2. Nutrition & Wellbeing
Food log plus light personal wellbeing — closes the loop with Meals and Train.

- Daily food logging (manual / planned-meal handoff from Meals; barcode / photo later if useful)
- Goals that connect to Meals planning and Train output
- Sleep — simple personal tracking, not a separate empire
- Mood / mental wellness — light check-ins; respect private journal already on Today
- Keep it personal-first with optional household-aware pieces (allergies, shared goals) where they help

---

## Go public

### 3. Public product testing
Real households on the tightened app + Nutrition & Wellbeing.

- Invite-only or limited public cohort
- Feedback on daily use, roles, and module load
- Stabilize before marketing surface area grows

### 4. Website
Public home for the product and legal.

- Product story, what’s included, how households work
- Terms, privacy, and other legal pages
- Place people can land before / after install
- Comes after Nutrition; thin legal pages can appear earlier if testing or store submission needs them

---

## Household OS modules

### 5. Documents / Family vault
Shared secure place for household paperwork.

- Passports, insurance, warranties, manuals, school forms
- Expiry / renew reminders
- Role-aware access (kids vs adults)

### 6. Home / Chores
Shared household operations.

- Chores and weekly rhythm (who’s on what)
- Recurring home tasks and light maintenance reminders
- Surfaces on Today / Calendar where useful
- Distinct from personal Today tasks

### 7. Health
Family care layer — not fitness (Train) and not food log (Nutrition).

- Meds, appointments, allergies, “who’s sick”
- Shared notes for kids / parents / caregiving
- Private by default; share only what the household needs

### 8. Kids / School rhythm
Coordination around children’s days.

- Activities, pickups, permissions
- School calendar overlays
- Due / upcoming surfaced for the right roles
- Builds on People, roles, and Calendar

---

## Life-event modules

### 9. Trips
Compose travel as one household object.

- Itinerary + dates on Calendar
- Packing via Lists
- Trip budget via Money
- Shared notes / decisions

### 10. Events / Hosting
Plan gatherings without becoming event SaaS.

- Guest list and date
- Menu via Meals, shopping via Lists, spend via Money
- Host checklist and shared prep notes

---

## Voice surfaces

Compose existing Today / Meals / Lists / tasks / Discuss — not a new module. After the live suite is stable enough that voice writes and a day briefing stay trustworthy.

### 11. Alexa skill
Hands-free capture on Echo speakers (Nest third-party list skills are not available).

- Primary: add to shopping list, standard lists, Today tasks, Discuss
- Secondary (nice): day briefing — calendar, meals, Train plan; weather optional
- Account linking + thin fulfillment over existing APIs / Today overview
- Small intent set first; expand only if households actually use it

### 12. Google phone assistant
App Actions / deep links on Android phones — not Nest speakers.

- Same add destinations as the Alexa skill where App Actions can fulfill them
- Open or confirm via the phone app; no custom Nest conversational skill
- Keep parity of destinations with Alexa; utterance polish can lag

---

## Agent connectors

### 13. Expand Grok Bot capabilities
Sunday meal + shop ops ship first (plan → rebuild list → match prices → trolley / browser checkout). Expand only after that routine is reliable in real households.

- Train: weekly plan fill, missed-session nudges, calendar sync checks
- Today / Calendar: morning briefing, clash fixes, guest-driven meal swaps
- Lists / Discuss: event-triggered capture from Slack/email
- Money: light spend digests (read-only first)
- Hardening: clearer fallback when supermarket login/CAPTCHA blocks Bot checkout; optional human-only handoff mode
- Do not rebuild a full in-app agent scheduler — lean on Grok Bot routines + Kinexus MCP tools

---

## Business

### 14. Monetisation planning & fundraising
Only after the product story and core modules are clear.

- What is free vs paid (likely module packs or household tier — decide later)
- Pricing hypotheses, not implementation first
- Materials for fundraising if pursued

### 15. Release
Broader launch once product, legal, and monetisation direction are set.

- Store / web launch readiness
- Support and onboarding for new households

---

## Out of scope for this roadmap

Not planned: full chat/messaging, smart-home device control (lights, locks, thermostats), deals/coupons, social discovery, pets, vehicles, garden, or generic habit-streak products. Revisit only if real household demand is loud.

Voice list capture is planned above (Alexa skill + Google phone assistant). Nest speaker third-party list skills remain unavailable on Google’s platform.

---

## Sequence (practical)

1. UI / UX cleanup  
2. Nutrition & Wellbeing  
3. Public product testing  
4. Website  
5. Documents / Family vault  
6. Home / Chores  
7. Health  
8. Kids / School rhythm  
9. Trips  
10. Events / Hosting  
11. Alexa skill  
12. Google phone assistant  
13. Expand Grok Bot capabilities  
14. Monetisation planning & fundraising  
15. Release 
