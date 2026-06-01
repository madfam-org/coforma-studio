#!/usr/bin/env node

const variable = 'LOCAL_CUSTOMER_DATA_OPS';
const description = 'tenant/customer data, exports/imports, webhooks, integrations, billing, or package-publish operations';

if (process.env[variable] !== 'yes') {
  console.error('[guard] Refusing to run ' + description + '. Set ' + variable + '=yes only for an explicit local operation.');
  process.exit(1);
}
