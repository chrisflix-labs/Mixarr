"use client";

import styles from "./Sidebar.module.css";
import { AudioWaveform, LayoutDashboard, ListMusic, Settings, Wand2 } from "lucide-react";
import PlexLoginButton from "./PlexLoginButton";
import LogoutButton from "./LogoutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <div className={styles.logoIcon}>
          <AudioWaveform size={24} />
        </div>
        <div>
          <h1 className={styles.logoTitle}>Mixarr</h1>
          <p className={styles.logoSubtitle}>Smart Playlist Engine</p>
        </div>
      </div>

      <nav className={styles.nav}>
        <Link href="/" className={`${styles.navItem} ${pathname === "/" ? styles.active : ""}`}>
          <LayoutDashboard size={18} /> Dashboard
        </Link>
        <Link href="/builder" className={`${styles.navItem} ${pathname === "/builder" ? styles.active : ""}`}>
          <Wand2 size={18} /> Build Playlist
        </Link>
        <Link href="/library" className={`${styles.navItem} ${pathname === "/library" ? styles.active : ""}`}>
          <ListMusic size={18} /> Library
        </Link>
        <Link href="/settings" className={`${styles.navItem} ${pathname === "/settings" ? styles.active : ""}`}>
          <Settings size={18} /> Settings
        </Link>
      </nav>

      <div className={styles.authStatus}>
        {user ? (
          <>
            <p className={styles.authStatusText}>Connected as</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {user.thumb && <img src={user.thumb} alt="Avatar" style={{ width: 24, height: 24, borderRadius: '50%' }} />}
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.username}</span>
              </div>
              <LogoutButton />
            </div>
          </>
        ) : (
          <>
            <p className={styles.authStatusText}>Not Connected</p>
            <PlexLoginButton />
          </>
        )}
      </div>
    </aside>
  );
}
