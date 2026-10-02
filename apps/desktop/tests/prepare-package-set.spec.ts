import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertDesktopHostPackageFiles,
  selectDesktopPackageClosure,
  type PackedDesktopPackage,
} from '../scripts/prepare-package-set.ts'

function packed(name: string, manifest: Record<string, unknown> = {}): PackedDesktopPackage {
  return { tarball: `${name}.tgz`, manifest: { name, version: '1.0.0', ...manifest } }
}

describe('desktop package-set selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not select a packaging target when imported as a library', async () => {
    vi.stubEnv('DSH_DESKTOP_TARGET_PLATFORM', 'linux')
    vi.stubEnv('DSH_DESKTOP_TARGET_ARCH', 'x64')
    vi.resetModules()
    await expect(import('../scripts/prepare-package-set.ts')).resolves.toHaveProperty('prepareDesktopPackageSet')
  })

  it('includes only the available internal production closure', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@onprem-ai/dsh', packed('@onprem-ai/dsh', {
        dependencies: { '@onprem-ai/dsh-base': '^1.0.0', external: '^2.0.0' },
        optionalDependencies: { '@onprem-ai/platform-package': '1.0.0', '@onprem-ai/missing-platform': '1.0.0' },
      })],
      ['@onprem-ai/dsh-desktop-host', packed('@onprem-ai/dsh-desktop-host', {
        dependencies: { '@onprem-ai/dsh': '^1.0.0' },
      })],
      ['@onprem-ai/dsh-base', packed('@onprem-ai/dsh-base', {
        peerDependencies: { '@onprem-ai/cordis': '^1.0.0' },
      })],
      ['@onprem-ai/cordis', packed('@onprem-ai/cordis')],
      ['@onprem-ai/platform-package', packed('@onprem-ai/platform-package')],
      ['@onprem-ai/unused', packed('@onprem-ai/unused')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@onprem-ai/cordis',
      '@onprem-ai/dsh',
      '@onprem-ai/dsh-base',
      '@onprem-ai/dsh-desktop-host',
      '@onprem-ai/platform-package',
    ])
  })

  it.each([
    '@onprem-ai/dsh-base', '@onprem-ai/cordis', '@onprem-ai/node-addon-system',
  ])('rejects required prepared package %s absent from the packed release inputs', (dependency) => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@onprem-ai/dsh', packed('@onprem-ai/dsh', {
        dependencies: { [dependency]: '^1.0.0' },
      })],
      ['@onprem-ai/dsh-desktop-host', packed('@onprem-ai/dsh-desktop-host', {
        dependencies: { '@onprem-ai/dsh': '^1.0.0' },
      })],
    ])
    expect(() => selectDesktopPackageClosure(available)).toThrow(/unpacked package/u)
    expect(() => selectDesktopPackageClosure(new Map([
      ['@onprem-ai/dsh', packed('@onprem-ai/dsh')],
    ]))).toThrow(/omit @onprem-ai\/dsh-desktop-host/u)
  })

  it('leaves independently published Office packages to npm resolution', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@onprem-ai/dsh', packed('@onprem-ai/dsh', {
        dependencies: {
          '@deepseek-ai/libreoffice-kit': '0.0.1',
          '@deepseek-ai/libreoffice-kit-wasm': '0.0.1',
        },
      })],
      ['@onprem-ai/dsh-desktop-host', packed('@onprem-ai/dsh-desktop-host')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@onprem-ai/dsh', '@onprem-ai/dsh-desktop-host',
    ])
  })

  it('requires both Desktop Host and public CLI entries', () => {
    const files = [
      'package/lib/index.js',
      'package/lib/cli.js',
    ]
    expect(() => {
      assertDesktopHostPackageFiles(files)
    }).not.toThrow()
    expect(() => {
      assertDesktopHostPackageFiles(files.slice(1))
    }).toThrow(/lib\/index\.js/u)
    expect(() => { assertDesktopHostPackageFiles(files.slice(0, 1)) }).toThrow(/lib\/cli\.js/u)
  })
})
