import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDoctorSelection, getDoctorOptions } from './doctorOptions.js';

test('normalizeDoctorSelection keeps only valid active doctor IDs', () => {
  const doctors = [
    { _id: '64f2a9d7d1bc2c1c8d9a1234', role: 'doctor', isActive: true, name: 'Dr. Ali' },
    { _id: '64f2a9d7d1bc2c1c8d9a5678', role: 'doctor', isActive: false, name: 'Dr. Inactive' },
    { _id: '64f2a9d7d1bc2c1c8d9a9999', role: 'receptionist', isActive: true, name: 'Reception' },
  ];

  assert.equal(normalizeDoctorSelection(doctors, '64f2a9d7d1bc2c1c8d9a1234'), '64f2a9d7d1bc2c1c8d9a1234');
  assert.equal(normalizeDoctorSelection(doctors, '64f2a9d7d1bc2c1c8d9a5678'), '');
  assert.equal(normalizeDoctorSelection(doctors, 'not-a-valid-id'), '');
});

test('getDoctorOptions returns only active doctors with labels', () => {
  const doctors = [
    { _id: '64f2a9d7d1bc2c1c8d9a1234', role: 'doctor', isActive: true, name: 'Dr. Ali' },
    { _id: '64f2a9d7d1bc2c1c8d9a5678', role: 'doctor', isActive: false, name: 'Dr. Inactive' },
    { _id: '64f2a9d7d1bc2c1c8d9a9999', role: 'doctor', isActive: true, username: 'dr_sara', name: 'Dr. Sara' },
  ];

  const options = getDoctorOptions(doctors);

  assert.deepEqual(options.map((option) => option.value), [
    '64f2a9d7d1bc2c1c8d9a1234',
    '64f2a9d7d1bc2c1c8d9a9999',
  ]);

  assert.equal(options[0].label, 'Dr. Ali');
  assert.equal(options[1].label, 'Dr. Sara');
});
