export const RELEASES_URL = 'https://github.com/tokenmt/tokenhub-desktop/releases';
export const platforms = [
  { id: 'windows', labelKey: 'dl.windows' },
  { id: 'macos', labelKey: 'dl.macos' },
  { id: 'linux', labelKey: 'dl.linux' },
] as const;

// issue#368: build-time, human-maintained release metadata for the homepage
// verify block. Update version/sha256 by hand on each release, then redeploy.
export const RELEASE_META = { version: '0.1.0', date: '2026-09-28' };
export const RELEASES = [
  { edition: 'community', platform: 'linux', arch: 'x86_64', name: 'tokenmate-community-0.1.0-linux-x86_64.tar.gz', sha256: '' },
  { edition: 'community', platform: 'macos', arch: 'aarch64', name: 'tokenmate-community-0.1.0-macos-aarch64.dmg', sha256: '' },
  { edition: 'community', platform: 'windows', arch: 'x86_64', name: 'tokenmate-community_0.1.0_x64-setup.exe', sha256: '' },
  { edition: 'team', platform: 'linux', arch: 'x86_64', name: 'tokenmate-team-0.1.0-linux-x86_64.tar.gz', sha256: '' },
  { edition: 'saas', platform: 'linux', arch: 'x86_64', name: 'tokenmate-saas-0.1.0-linux-x86_64.tar.gz', sha256: '' },
  { edition: 'enterprise', platform: 'linux', arch: 'x86_64', name: 'tokenmate-enterprise-0.1.0-linux-x86_64.tar.gz', sha256: '' },
] as const;
