const MOCK_FAYDA_RECORDS = new Map([
  [
    '100000000001',
    {
      identifierType: 'fin',
      identifier: '100000000001',
      firstName: 'Abebe',
      middleName: 'Kebede',
      lastName: 'Tesfaye',
      verified: true,
    },
  ],
  [
    '100000000002',
    {
      identifierType: 'fan',
      identifier: '100000000002',
      firstName: 'Sara',
      middleName: 'Dawit',
      lastName: 'Bekele',
      verified: true,
    },
  ],
]);

async function verifyIdentity({
  identifier,
  identifierType,
}) {
  const record = MOCK_FAYDA_RECORDS.get(identifier);

  if (!record) {
    return {
      verified: false,
      reason: 'IDENTITY_NOT_FOUND',
    };
  }

  if (record.identifierType !== identifierType) {
    return {
      verified: false,
      reason: 'IDENTIFIER_TYPE_MISMATCH',
    };
  }

  return {
    verified: record.verified,
    provider: 'fayda',
    providerSubject: record.identifier,
    identifierType: record.identifierType,
    profile: {
      firstName: record.firstName,
      middleName: record.middleName,
      lastName: record.lastName,
    },
  };
}

module.exports = {
  verifyIdentity,
};
