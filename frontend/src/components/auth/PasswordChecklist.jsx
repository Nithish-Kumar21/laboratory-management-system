import React from 'react';

const RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One special character (@#$%^&+=!)', test: (p) => /[@#$%^&+=!]/.test(p) },
];

function PasswordChecklist({ password }) {
  if (!password) return null;

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', fontSize: '0.8rem' }}>
      {RULES.map((rule, i) => {
        const passed = rule.test(password);
        return (
          <li
            key={i}
            style={{
              color: passed ? '#10B981' : '#9CA3AF',
              marginBottom: 2,
              transition: 'color 0.15s',
            }}
          >
            {passed ? '\u2713' : '\u2717'} {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

export default PasswordChecklist;
