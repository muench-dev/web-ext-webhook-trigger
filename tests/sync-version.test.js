const fs = require('fs');
const path = require('path');

describe('sync-version.js', () => {
  let consoleSpy;
  let readFileSyncSpy;
  let writeFileSyncSpy;

  beforeEach(() => {
    jest.resetModules();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
    writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  test('updates manifest.json when versions differ', () => {
    const packageJson = { version: '1.2.3' };
    const manifestContent = '{\n  "version": "1.0.0",\n  "name": "test"\n}';

    readFileSyncSpy.mockImplementation((filePath) => {
      if (filePath.endsWith('package.json')) return JSON.stringify(packageJson);
      if (filePath.endsWith('manifest.json')) return manifestContent;
      return '{}';
    });

    require('../scripts/sync-version');

    expect(writeFileSyncSpy).toHaveBeenCalledWith(
      expect.stringContaining('manifest.json'),
      '{\n  "version": "1.2.3",\n  "name": "test"\n}'
    );
    expect(consoleSpy).toHaveBeenCalledWith('Updated manifest.json version to 1.2.3');
  });

  test('does not update manifest.json when versions match', () => {
    const packageJson = { version: '1.0.0' };
    const manifestContent = '{\n  "version": "1.0.0",\n  "name": "test"\n}';

    readFileSyncSpy.mockImplementation((filePath) => {
      if (filePath.endsWith('package.json')) return JSON.stringify(packageJson);
      if (filePath.endsWith('manifest.json')) return manifestContent;
      return '{}';
    });

    require('../scripts/sync-version');

    expect(writeFileSyncSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('manifest.json already matches version 1.0.0');
  });

  test('throws error if manifest.json does not contain version field', () => {
    const packageJson = { version: '1.2.3' };
    const manifestContent = '{\n  "name": "test"\n}';

    readFileSyncSpy.mockImplementation((filePath) => {
      if (filePath.endsWith('package.json')) return JSON.stringify(packageJson);
      if (filePath.endsWith('manifest.json')) return manifestContent;
      return '{}';
    });

    expect(() => {
      require('../scripts/sync-version');
    }).toThrow('Could not find version field in manifest.json');
  });

  test('handles different formatting in manifest.json', () => {
    const packageJson = { version: '1.2.3' };
    const manifestContent = '{\n"version"  :  "1.0.0",\n"name": "test"\n}';

    readFileSyncSpy.mockImplementation((filePath) => {
      if (filePath.endsWith('package.json')) return JSON.stringify(packageJson);
      if (filePath.endsWith('manifest.json')) return manifestContent;
      return '{}';
    });

    require('../scripts/sync-version');

    expect(writeFileSyncSpy).toHaveBeenCalledWith(
      expect.stringContaining('manifest.json'),
      '{\n"version": "1.2.3",\n"name": "test"\n}'
    );
  });
});
