export const exceptionRuleContracts = [
  'directadmin-cpanel-pricing-toggle',
  'wordpress-hosting-template-switch',
  'ssl-cloudbric-viewport',
  'whois-realtime',
  'data-submit-or-post-form',
  'pa-home-tin-tuc-two-source-fallback',
  'landing-heuristic',
  'precart-service-mapping',
] as const;
export type ExceptionRuleContract = (typeof exceptionRuleContracts)[number];
