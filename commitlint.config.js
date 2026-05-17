/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'chore'],
    ],
    'scope-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
    'subject-full-stop': [1, 'never', '.'],
    'subject-case': [1, 'never', ['upper-case']],
    'body-max-line-length': [2, 'always', 160],
  },
};
