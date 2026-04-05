const { padDatePart, toLocalIsoString } = require('../utils/utils');

describe('padDatePart', () => {
  test('pads single digit with leading zero by default', () => {
    expect(padDatePart(5)).toBe('05');
  });

  test('does not pad double digit by default', () => {
    expect(padDatePart(12)).toBe('12');
  });

  test('pads with custom length', () => {
    expect(padDatePart(7, 3)).toBe('007');
  });

  test('does not truncate if value is longer than length', () => {
    expect(padDatePart(1234, 2)).toBe('1234');
  });

  test('handles string input', () => {
    expect(padDatePart('9')).toBe('09');
  });
});

describe('toLocalIsoString', () => {
  let timezoneSpy;

  afterEach(() => {
    if (timezoneSpy) {
      timezoneSpy.mockRestore();
    }
  });

  test('formats date correctly in UTC+0', () => {
    // For UTC+0, local time = UTC time if we mock offset to 0
    // new Date('...Z') creates a date object. getFullYear etc will return values based on system timezone UNLESS we mock them or the system is UTC.
    // However, toLocalIsoString uses getFullYear, getMonth etc which are local.
    // So we should use a date where we know the local components.

    const mockDate = {
      getFullYear: () => 2023,
      getMonth: () => 4, // May
      getDate: () => 15,
      getHours: () => 12,
      getMinutes: () => 34,
      getSeconds: () => 56,
      getMilliseconds: () => 789,
      getTimezoneOffset: () => 0
    };

    expect(toLocalIsoString(mockDate)).toBe('2023-05-15T12:34:56.789+00:00');
  });

  test('formats date correctly with positive offset (UTC+05:30)', () => {
    // UTC+5:30 -> getTimezoneOffset returns -330
    const mockDate = {
      getFullYear: () => 2023,
      getMonth: () => 0, // Jan
      getDate: () => 1,
      getHours: () => 5,
      getMinutes: () => 30,
      getSeconds: () => 0,
      getMilliseconds: () => 0,
      getTimezoneOffset: () => -330
    };

    expect(toLocalIsoString(mockDate)).toBe('2023-01-01T05:30:00.000+05:30');
  });

  test('formats date correctly with negative offset (UTC-08:00)', () => {
    // UTC-8 -> getTimezoneOffset returns 480
    const mockDate = {
      getFullYear: () => 2022,
      getMonth: () => 11, // Dec
      getDate: () => 31,
      getHours: () => 16,
      getMinutes: () => 0,
      getSeconds: () => 0,
      getMilliseconds: () => 0,
      getTimezoneOffset: () => 480
    };

    expect(toLocalIsoString(mockDate)).toBe('2022-12-31T16:00:00.000-08:00');
  });

  test('handles millisecond padding', () => {
    const mockDate = {
      getFullYear: () => 2023,
      getMonth: () => 5,
      getDate: () => 10,
      getHours: () => 10,
      getMinutes: () => 10,
      getSeconds: () => 10,
      getMilliseconds: () => 5,
      getTimezoneOffset: () => 0
    };

    expect(toLocalIsoString(mockDate)).toContain('.005+00:00');
  });
});
