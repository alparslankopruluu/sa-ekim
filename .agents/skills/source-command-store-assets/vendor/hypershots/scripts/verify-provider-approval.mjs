#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const [approvalPath, reviewPath, profile, locale, artifact, prompt, provider, model] = process.argv.slice(2);
const fail = message => { console.error(`ERROR: ${message}`); process.exit(1); };
if (![approvalPath, reviewPath, profile, locale, artifact, prompt, provider, model].every(Boolean)) {
  fail('usage: verify-provider-approval.mjs <approval.json> <clean-review.html> <profile> <locale> <artifact> <prompt> <provider> <model>');
}
if (!fs.existsSync(reviewPath)) fail('clean review gallery is missing; show it before requesting paid provider approval');
if (!fs.existsSync(approvalPath)) fail('provider approval receipt is missing; paid provider work is not authorized');
const mode = fs.statSync(approvalPath).mode & 0o777;
if ((mode & 0o077) !== 0) fail('provider approval receipt must use 0600 permissions');

let approval;
try { approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8')); }
catch { fail('provider approval receipt is not valid JSON'); }
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const approvedArtifacts = approval.artifacts ?? approval.panels;
const valid = approval.schemaVersion === 1
  && approval.approved === true
  && approval.provider === provider
  && approval.model === model
  && approval.profile === profile
  && approval.locale === locale
  && Array.isArray(approvedArtifacts)
  && approvedArtifacts.includes(artifact)
  && approval.cleanReviewSha256 === digest(fs.readFileSync(reviewPath))
  && approval.promptSha256 === digest(prompt)
  && Number.isFinite(approval.estimatedCostUSD)
  && approval.estimatedCostUSD >= 0
  && typeof approval.approvedAt === 'string'
  && approval.approvedAt.length > 0;
if (!valid) fail('provider approval does not match the clean review, artifact, prompt, provider, model, or estimated cost');
console.log('provider approval verified');
