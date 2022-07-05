import Helper from './Helper';

describe('Helper.newMongoId', () => {
  // newMongoId
  test('newMongoId should be a string', () => {
    expect(typeof Helper.newMongoId(true))
      .toBe('string');
  });
  // newMongoId
  test('newMongoId should have length', () => {
    expect(Helper.newMongoId(true))
      .toHaveLength(24);
  });
});
