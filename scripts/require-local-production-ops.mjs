#!/usr/bin/env node

const variable = 'LOCAL_PRODUCTION_OPS';
const description = 'deploy or live production operations';

if (process.env[variable] !== 'yes') {
  console.error('[guard] Refusing to run ' + description + '. Set ' + variable + '=yes only for an explicit local operation.');
  process.exit(1);
}
