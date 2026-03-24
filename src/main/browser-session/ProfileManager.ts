export interface BrowserProfile {
  name: string;
  partition: string;
  persistent: boolean;
  createdAt: Date;
}

const DEFAULT_PROFILES: { name: string; persistent: boolean }[] = [
  { name: 'default', persistent: true },
  { name: 'login', persistent: true },
];

/**
 * Manages browser profiles backed by Electron partition-based session isolation.
 * Each profile maps to a unique partition string for use in <webview> tags.
 */
export class ProfileManager {
  private profiles = new Map<string, BrowserProfile>();
  private activeProfileName: string;

  constructor() {
    for (const def of DEFAULT_PROFILES) {
      this.profiles.set(def.name, {
        name: def.name,
        partition: this.buildPartition(def.name, def.persistent),
        persistent: def.persistent,
        createdAt: new Date(),
      });
    }
    this.activeProfileName = 'default';
  }

  createProfile(name: string, persistent = true): BrowserProfile {
    if (this.profiles.has(name)) {
      throw new Error(`Profile "${name}" already exists`);
    }
    const profile: BrowserProfile = {
      name,
      partition: this.buildPartition(name, persistent),
      persistent,
      createdAt: new Date(),
    };
    this.profiles.set(name, profile);
    return profile;
  }

  getProfile(name: string): BrowserProfile | undefined {
    return this.profiles.get(name);
  }

  listProfiles(): BrowserProfile[] {
    return Array.from(this.profiles.values());
  }

  deleteProfile(name: string): boolean {
    if (DEFAULT_PROFILES.some((d) => d.name === name)) {
      return false;
    }
    return this.profiles.delete(name);
  }

  setActiveProfile(name: string): void {
    if (!this.profiles.has(name)) {
      throw new Error(`Profile "${name}" does not exist`);
    }
    this.activeProfileName = name;
  }

  getActiveProfile(): BrowserProfile {
    return this.profiles.get(this.activeProfileName)!;
  }

  getPartition(name?: string): string {
    const target = name ?? this.activeProfileName;
    const profile = this.profiles.get(target);
    if (!profile) {
      throw new Error(`Profile "${target}" does not exist`);
    }
    return profile.partition;
  }

  private buildPartition(name: string, persistent: boolean): string {
    return persistent ? `persist:wmux-${name}` : `wmux-${name}`;
  }
}
