export type { Database, HouseholdRole, Json, PersonType } from './types';

export const rpc = {
  createHousehold: 'create_household',
  createInvite: 'create_household_invite',
  peekInvite: 'peek_household_invite',
  acceptInvite: 'accept_household_invite',
  revokeInvite: 'revoke_household_invite',
  leaveHousehold: 'leave_household',
  getOrCreateMealPlan: 'get_or_create_meal_plan',
  ensureNutritionGoals: 'ensure_household_nutrition_goals',
  claimCatalogEditor: 'claim_catalog_editor',
  reviewCatalogImage: 'review_catalog_image',
} as const;
