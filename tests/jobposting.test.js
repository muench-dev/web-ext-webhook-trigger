const {
  extractJobpostingKid,
  computeJobpostingStatus,
  computeCurrentJobpostingState,
  ADMIN_JOBPOSTING_PATTERN,
  JOBPOSTING_STORAGE_KEY,
  CURRENT_TAB_JOBPOSTING_STORAGE_KEY,
} = require('../utils/jobposting');

describe('jobposting helpers', () => {
  describe('extractJobpostingKid', () => {
    test('returns null for empty / non-string input', () => {
      expect(extractJobpostingKid(null)).toBeNull();
      expect(extractJobpostingKid(undefined)).toBeNull();
      expect(extractJobpostingKid('')).toBeNull();
      expect(extractJobpostingKid(123)).toBeNull();
    });

    test('returns null for non-jobposting URLs', () => {
      expect(extractJobpostingKid('https://google.com')).toBeNull();
      expect(extractJobpostingKid('https://example.com/jobpostings/abc123def')).toBeNull();
      expect(extractJobpostingKid('http://admin.schnellestelle.de/jobpostings/abc123def')).toBeNull(); // http (not https)
    });

    test('returns null when KID is the wrong length / charset', () => {
      // 8 chars
      expect(extractJobpostingKid('https://admin.schnellestelle.de/jobpostings/abc12345')).toBeNull();
      // uppercase
      expect(extractJobpostingKid('https://admin.schnellestelle.de/jobpostings/ABC123DEF')).toBeNull();
      // hyphen
      expect(extractJobpostingKid('https://admin.schnellestelle.de/jobpostings/abc-123-d')).toBeNull();
    });

    test('extracts a 9-char alphanumeric KID from .de domain', () => {
      expect(extractJobpostingKid('https://admin.schnellestelle.de/jobpostings/abc123def')).toBe('abc123def');
    });

    test('extracts a KID from .club domain', () => {
      expect(extractJobpostingKid('https://admin.schnellestelle.club/jobpostings/xyz789abc')).toBe('xyz789abc');
    });

    test('extracts KID even with trailing path / query / fragment', () => {
      expect(extractJobpostingKid('https://admin.schnellestelle.de/jobpostings/abc123def/edit')).toBe('abc123def');
      expect(extractJobpostingKid('https://admin.schnellestelle.de/jobpostings/abc123def?foo=bar')).toBe('abc123def');
      expect(extractJobpostingKid('https://admin.schnellestelle.de/jobpostings/abc123def#section')).toBe('abc123def');
    });
  });

  describe('computeJobpostingStatus', () => {
    test('returns "none" when nothing is pinned', () => {
      expect(computeJobpostingStatus(null, null)).toBe('none');
      expect(computeJobpostingStatus(null, 'abc123def')).toBe('none');
      expect(computeJobpostingStatus(undefined, 'abc123def')).toBe('none');
    });

    test('returns "match" when pinned KID equals current KID', () => {
      expect(computeJobpostingStatus('abc123def', 'abc123def')).toBe('match');
    });

    test('returns "mismatch" when pinned KID differs from current KID', () => {
      expect(computeJobpostingStatus('abc123def', 'xyz789abc')).toBe('mismatch');
    });

    test('returns "none" when pinned but current is not a jobposting', () => {
      // This is the case that exposes the original popup-header bug:
      // the badge correctly shows nothing, but the popup must still
      // surface the *pinned* KID block — that's handled in popup.js,
      // not here.
      expect(computeJobpostingStatus('abc123def', null)).toBe('none');
    });
  });

  describe('computeCurrentJobpostingState', () => {
    let mockApi;
    let consoleDebug;

    beforeEach(() => {
      mockApi = {
        tabs: {
          query: jest.fn(),
        },
        storage: {
          local: {
            get: jest.fn(),
          },
        },
      };
      consoleDebug = console.debug;
      console.debug = jest.fn();
    });

    afterEach(() => {
      console.debug = consoleDebug;
    });

    test('returns gray "none" state when nothing pinned and not on jobposting', async () => {
      mockApi.tabs.query.mockResolvedValue([{ url: 'https://google.com' }]);
      mockApi.storage.local.get.mockResolvedValue({});

      const state = await computeCurrentJobpostingState(mockApi);

      expect(state).toEqual({
        active: null,
        current: { kid: null, url: 'https://google.com', status: 'none' },
      });
    });

    test('returns "match" when pin equals current tab', async () => {
      mockApi.tabs.query.mockResolvedValue([
        { url: 'https://admin.schnellestelle.de/jobpostings/abc123def' },
      ]);
      mockApi.storage.local.get.mockResolvedValue({
        [JOBPOSTING_STORAGE_KEY]: { kid: 'abc123def', url: 'https://admin.schnellestelle.de/jobpostings/abc123def' },
      });

      const state = await computeCurrentJobpostingState(mockApi);

      expect(state.current.status).toBe('match');
      expect(state.current.kid).toBe('abc123def');
      expect(state.active.kid).toBe('abc123def');
    });

    test('returns "mismatch" when pinned but on a different jobposting', async () => {
      mockApi.tabs.query.mockResolvedValue([
        { url: 'https://admin.schnellestelle.de/jobpostings/xyz789abc' },
      ]);
      mockApi.storage.local.get.mockResolvedValue({
        [JOBPOSTING_STORAGE_KEY]: { kid: 'abc123def' },
      });

      const state = await computeCurrentJobpostingState(mockApi);

      expect(state.current.status).toBe('mismatch');
      expect(state.current.kid).toBe('xyz789abc');
      expect(state.active.kid).toBe('abc123def');
    });

    test('returns "none" status with active set, when current tab is not a jobposting (the original bug case)', async () => {
      // This is the configuration that previously rendered the
      // contradictory "Kein aktives Jobposting" header alongside the
      // visible "Aktiv: <KID>" block. The status is correctly 'none'
      // (drives the badge) but `state.active` is non-null so the popup
      // can still show the pinned-jobposting block.
      mockApi.tabs.query.mockResolvedValue([{ url: 'https://google.com' }]);
      mockApi.storage.local.get.mockResolvedValue({
        [JOBPOSTING_STORAGE_KEY]: { kid: 'abc123def', url: 'https://admin.schnellestelle.de/jobpostings/abc123def' },
      });

      const state = await computeCurrentJobpostingState(mockApi);

      expect(state.current.status).toBe('none');
      expect(state.current.kid).toBeNull();
      expect(state.active).toEqual({
        kid: 'abc123def',
        url: 'https://admin.schnellestelle.de/jobpostings/abc123def',
      });
    });

    test('survives missing tabs / storage APIs', async () => {
      const state = await computeCurrentJobpostingState({});
      expect(state).toEqual({
        active: null,
        current: { kid: null, url: null, status: 'none' },
      });
    });

    test('survives a thrown tabs.query', async () => {
      mockApi.tabs.query.mockRejectedValue(new Error('boom'));
      mockApi.storage.local.get.mockResolvedValue({});
      const state = await computeCurrentJobpostingState(mockApi);
      expect(state.current.status).toBe('none');
      expect(state.active).toBeNull();
    });
  });

  describe('exported constants', () => {
    test('JOBPOSTING_STORAGE_KEY is the storage key historically used', () => {
      // Existing storage written by older versions of the extension
      // used 'active_jobposting'. Changing this breaks upgrade.
      expect(JOBPOSTING_STORAGE_KEY).toBe('active_jobposting');
    });

    test('CURRENT_TAB_JOBPOSTING_STORAGE_KEY matches the legacy key', () => {
      expect(CURRENT_TAB_JOBPOSTING_STORAGE_KEY).toBe('current_tab_jobposting');
    });

    test('ADMIN_JOBPOSTING_PATTERN matches expected URLs', () => {
      expect('https://admin.schnellestelle.de/jobpostings/abcdef123'.match(ADMIN_JOBPOSTING_PATTERN)).not.toBeNull();
    });
  });
});
