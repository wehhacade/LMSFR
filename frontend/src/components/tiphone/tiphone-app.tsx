"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DamiinListRow,
  StoredAuth,
  SuspectListRow,
  TipPhoneScreen,
} from "@/lib/tiphone/types";
import { so } from "@/lib/tiphone/i18n";
import { canAccessTipScreen } from "@/lib/tiphone/utils";
import { useTipAuth } from "./auth-provider";
import { TipThemeProvider } from "./theme-provider";
import { ScreenShell } from "./screen-shell";
import { NavDrawer } from "./nav-drawer";
import { LoginScreen } from "./screens/login-screen";
import { HomeScreen } from "./screens/home-screen";
import { SuspectsScreen } from "./screens/suspects-screen";
import { ResponsesScreen } from "./screens/responses-screen";
import { ProfileScreen } from "./screens/profile-screen";
import { RegisterScreen } from "./screens/register-screen";
import { ExistingCaseScreen } from "./screens/existing-case-screen";
import { NoticesScreen } from "./screens/notices-screen";
import { DamiinadaScreen } from "./screens/damiinada-screen";
import { DamiinDetailScreen } from "./screens/damiin-detail-screen";
import { WantedScreen } from "./screens/wanted-screen";
import { BaarisScreen } from "./screens/baaris-screen";
import { AqoinsiRegisterScreen } from "./screens/aqoonsi-register-screen";
import { MaareyntaScreen } from "./screens/maareynta-screen";
import { UserManagementScreen } from "./screens/user-management-screen";
import { LeadersScreen } from "./screens/leaders-screen";
import { OfficerProfileModal } from "./officer-profile-modal";
import { PersonSearchShimmer } from "./shimmer";
import { SwipeBackProvider } from "./ios-swipe-back";
import { SecurityLockProvider } from "./security-lock-provider";
import { AppLockScreen } from "./app-lock-screen";
import { ShellOverlays } from "./shell-overlays";
import { TipPhoneCallWatcher } from "./call-watcher";
import { isBaarisRole } from "@/lib/tiphone/utils";

function shellVariant(screen: TipPhoneScreen): "default" | "hero" | "home" {
  if (screen === "home") return "home";
  if (screen === "login" || screen === "maareynta" || screen === "register" || screen === "aqoonsi-register") return "hero";
  return "default";
}

function TipPhoneInner() {
  const { auth, ready, logout } = useTipAuth();
  const [screen, setScreen] = useState<TipPhoneScreen>("login");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<SuspectListRow | null>(null);
  const [selectedDamiin, setSelectedDamiin] = useState<DamiinListRow | null>(null);
  const [registerPhone, setRegisterPhone] = useState<string | undefined>();
  const [existingForCase, setExistingForCase] = useState<SuspectListRow | null>(null);
  const [returnTo, setReturnTo] = useState<TipPhoneScreen>("home");
  const [officerProfileOpen, setOfficerProfileOpen] = useState(false);

  const isAuthed = Boolean(auth);

  useEffect(() => {
    if (!ready) return;
    setScreen(isAuthed ? "home" : "login");
  }, [ready, isAuthed]);

  const goScreen = useCallback(
    (next: TipPhoneScreen) => {
      if (!auth) {
        setScreen("login");
        return;
      }
      if (!canAccessTipScreen(next, auth.roles, auth.permissions)) {
        setScreen("home");
        return;
      }
      setScreen(next);
    },
    [auth],
  );

  // Kick off restricted screens if role refreshed to Agent / Degmo mid-session.
  useEffect(() => {
    if (!auth || screen === "login") return;
    if (!canAccessTipScreen(screen, auth.roles, auth.permissions)) {
      setScreen("home");
    }
  }, [auth?.roles, auth?.permissions, screen, auth]);

  const goTab = useCallback((tab: "home" | "suspects" | "responses") => {
    setScreen(tab);
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  const openProfile = useCallback((s: SuspectListRow) => {
    setSelected(s);
    setReturnTo((prev) => {
      if (screen === "profile") return prev;
      if (screen === "login") return "home";
      return screen;
    });
    setScreen("profile");
  }, [screen]);

  const stackBack = useMemo((): (() => void) | null => {
    if (drawerOpen || officerProfileOpen) return null;
    switch (screen) {
      case "home":
      case "login":
        return null;
      case "suspects":
      case "responses":
        return () => setScreen("home");
      case "profile":
        return () => setScreen(returnTo === "profile" ? "home" : returnTo);
      case "register":
      case "aqoonsi-register":
        return () => setScreen(returnTo);
      case "existing-case":
        return () => setScreen(selected ? "profile" : returnTo);
      case "notices":
      case "wanted":
      case "damiinada":
      case "baaris":
      case "maareynta":
      case "leaders":
        return () => setScreen("home");
      case "damiin-detail":
        return () => setScreen("damiinada");
      case "user-management":
        return () => setScreen("maareynta");
      default:
        return null;
    }
  }, [drawerOpen, officerProfileOpen, screen, returnTo, selected]);

  if (!ready) {
    return (
      <ScreenShell>
        <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-10">
          <div className="space-y-3">
            <div className="h-16 rounded-3xl bg-white/5" />
            <PersonSearchShimmer count={4} />
          </div>
        </div>
      </ScreenShell>
    );
  }

  if (!auth || screen === "login") {
    return <LoginScreen onSuccess={() => setScreen("home")} />;
  }

  const session = auth as StoredAuth;
  const baarisUser = isBaarisRole(session.roles, session.permissions);

  const goRegister = (phone: string | undefined, from: TipPhoneScreen) => {
    setRegisterPhone(phone);
    setExistingForCase(null);
    setReturnTo(from);
    setScreen(baarisUser ? "aqoonsi-register" : "register");
  };

  let body: React.ReactNode = null;

  switch (screen) {
    case "home":
      body = (
        <HomeScreen
          auth={session}
          onOpenDrawer={openDrawer}
          onTab={goTab}
          onOpenProfile={openProfile}
          onRegister={(phone) => goRegister(phone, "home")}
          onExistingCase={(s) => {
            if (baarisUser || s.source === "baaris" || s.source === "wanted") {
              openProfile(s);
              return;
            }
            setExistingForCase(s);
            setRegisterPhone(undefined);
            setReturnTo("home");
            setScreen("existing-case");
          }}
          onNotices={() => setScreen("notices")}
        />
      );
      break;
    case "suspects":
      body = (
        <SuspectsScreen
          auth={session}
          onOpenDrawer={openDrawer}
          onTab={goTab}
          onOpenProfile={openProfile}
          onRegister={() => goRegister(undefined, "suspects")}
          onDamiin={(s) => {
            if (baarisUser || s.source === "baaris" || s.source === "wanted") {
              openProfile(s);
              return;
            }
            setExistingForCase(s);
            setSelected(s);
            setRegisterPhone(undefined);
            setReturnTo("suspects");
            setScreen("existing-case");
          }}
        />
      );
      break;
    case "responses":
      body = (
        <ResponsesScreen
          auth={session}
          onOpenDrawer={openDrawer}
          onTab={goTab}
          onOpenProfile={openProfile}
        />
      );
      break;
    case "profile":
      body = selected ? (
        <ProfileScreen
          auth={session}
          suspect={selected}
          onBack={() => setScreen(returnTo === "profile" ? "home" : returnTo)}
          onMenu={openDrawer}
          onTab={goTab}
          onAddCase={() => {
            if (baarisUser || selected.source === "baaris" || selected.source === "wanted") return;
            setExistingForCase(selected);
            setScreen("existing-case");
          }}
        />
      ) : null;
      break;
    case "register":
      body = (
        <RegisterScreen
          auth={session}
          initialPhone={registerPhone}
          onBack={() => setScreen(returnTo)}
          onMenu={openDrawer}
          onDone={() => setScreen(returnTo)}
        />
      );
      break;
    case "aqoonsi-register":
      body = (
        <AqoinsiRegisterScreen
          auth={session}
          initialPhone={registerPhone}
          onBack={() => setScreen(returnTo)}
          onMenu={openDrawer}
          onDone={(created) => {
            if (created) openProfile(created);
            else setScreen(returnTo);
          }}
        />
      );
      break;
    case "existing-case":
      body = existingForCase ? (
        <ExistingCaseScreen
          auth={session}
          suspect={existingForCase}
          onBack={() => setScreen(selected ? "profile" : returnTo)}
          onMenu={openDrawer}
          onDone={() => setScreen(selected ? "profile" : returnTo)}
        />
      ) : null;
      break;
    case "notices":
      body = <NoticesScreen onBack={() => setScreen("home")} onMenu={openDrawer} />;
      break;
    case "wanted":
      body = (
        <WantedScreen
          auth={session}
          onBack={() => setScreen("home")}
          onMenu={openDrawer}
          onOpenProfile={(wanted) => {
            setSelected(wanted);
            setReturnTo("wanted");
            setScreen("profile");
          }}
        />
      );
      break;
    case "damiinada":
      body = (
        <DamiinadaScreen
          onBack={() => setScreen("home")}
          onMenu={openDrawer}
          onOpenDetail={(damiin) => {
            setSelectedDamiin(damiin);
            setScreen("damiin-detail");
          }}
        />
      );
      break;
    case "damiin-detail":
      body = selectedDamiin ? (
        <DamiinDetailScreen
          damiin={selectedDamiin}
          onBack={() => setScreen("damiinada")}
          onMenu={openDrawer}
          onOpenSuspect={(suspect) => {
            setSelected(suspect);
            setReturnTo("damiin-detail");
            setScreen("profile");
          }}
        />
      ) : null;
      break;
    case "baaris":
      body = (
        <BaarisScreen
          auth={session}
          onBack={() => setScreen("home")}
          onMenu={openDrawer}
          onOpenProfile={openProfile}
        />
      );
      break;
    case "maareynta":
      body = (
        <MaareyntaScreen
          auth={session}
          onBack={() => setScreen("home")}
          onMenu={openDrawer}
          onUserManagement={() => goScreen("user-management")}
        />
      );
      break;
    case "user-management":
      body = (
        <UserManagementScreen
          onBack={() => setScreen("maareynta")}
          onMenu={openDrawer}
        />
      );
      break;
    case "leaders":
      body = (
        <LeadersScreen
          auth={session}
          onBack={() => setScreen("home")}
          onMenu={openDrawer}
        />
      );
      break;
    default:
      body = null;
  }

  return (
    <ScreenShell variant={shellVariant(screen)}>
      <SwipeBackProvider
        enabled={!drawerOpen && !officerProfileOpen}
        onBack={stackBack}
      >
        {body}
      </SwipeBackProvider>
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        auth={session}
        activeScreen={screen}
        onNavigate={(s) => {
          setReturnTo("home");
          goScreen(s);
        }}
        onOpenProfile={() => setOfficerProfileOpen(true)}
        onSignOut={() => {
          if (confirm(`${so.drawerSignOutTitle}\n${so.drawerSignOutMsg}`)) {
            setDrawerOpen(false);
            logout();
            setScreen("login");
          }
        }}
      />
      <OfficerProfileModal
        open={officerProfileOpen}
        onClose={() => setOfficerProfileOpen(false)}
        auth={session}
      />
    </ScreenShell>
  );
}

export function TipPhoneApp() {
  return (
    <TipThemeProvider>
      <SecurityLockProvider>
        <TipPhoneAppChrome />
      </SecurityLockProvider>
    </TipThemeProvider>
  );
}

/** Global watermark + spotlight above all pages (native ScreenShell parity). */
function TipPhoneAppChrome() {
  const { auth } = useTipAuth();
  return (
    <TipPhoneCallWatcher>
      <ShellOverlays email={auth?.user.email} />
      <TipPhoneInner />
      <AppLockScreen />
    </TipPhoneCallWatcher>
  );
}
