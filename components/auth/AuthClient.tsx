"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn, Sparkles, UserPlus } from "lucide-react";
import clsx from "clsx";
import { apiJson } from "@/components/client-api";
import type { CurrentUser } from "@/lib/types";

type AuthMode = "login" | "register";

interface AuthResponse {
  user: CurrentUser | null;
}

interface SiteSettingsResponse {
  settings: {
    registrationEnabled: boolean;
  };
}

export function AuthClient() {
  const searchParams = useSearchParams();
  const initialMode = useMemo<AuthMode>(
    () => (searchParams.get("mode") === "register" ? "register" : "login"),
    [searchParams],
  );
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(registrationEnabled ? initialMode : "login");
  }, [initialMode, registrationEnabled]);

  useEffect(() => {
    apiJson<SiteSettingsResponse>("/api/site-settings")
      .then((payload) => {
        setRegistrationEnabled(payload.settings.registrationEnabled);
      })
      .catch(() => undefined);

    apiJson<AuthResponse>("/api/auth/me")
      .then((payload) => {
        if (payload.user) {
          window.location.href = "/";
        }
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await apiJson<AuthResponse>(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : {
                email,
                name,
                password,
              },
        ),
      });
      window.location.href = "/";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "认证失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <span className="badge">
          <Sparkles size={13} aria-hidden="true" />
          image-2 workspace
        </span>
        <h1>进入生成工作台</h1>
        <p>
          {registrationEnabled
            ? "首个注册账号会自动成为管理员，后续账号进入默认分组，可在后台调整角色、分组和每月生成额度。"
            : "当前站点未开放自助注册，请使用管理员创建的账号登录。"}
        </p>
      </div>

      <form className="panel auth-card" onSubmit={submit}>
        <div className="panel-header">
          <div>
            <h2>{mode === "login" ? "账号登录" : "账号注册"}</h2>
            <p>{mode === "login" ? "使用邮箱和密码进入系统" : "创建一个新成员账号"}</p>
          </div>
        </div>
        <div className="panel-body form-stack">
          <div className={clsx("segmented auth-tabs", !registrationEnabled && "single")}>
            <button
              type="button"
              className={clsx(mode === "login" && "active")}
              onClick={() => setMode("login")}
            >
              <LogIn size={16} aria-hidden="true" />
              登录
            </button>
            {registrationEnabled ? (
              <button
                type="button"
                className={clsx(mode === "register" && "active")}
                onClick={() => setMode("register")}
              >
                <UserPlus size={16} aria-hidden="true" />
                注册
              </button>
            ) : null}
          </div>

          {mode === "register" ? (
            <div className="field">
              <label htmlFor="name">名称</label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : 1}
              required
            />
          </div>

          <button className="button primary" type="submit" disabled={busy}>
            {mode === "login" ? <LogIn size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
            {busy ? "处理中" : mode === "login" ? "登录" : "注册"}
          </button>

          <div className={clsx("toast-line", error && "error")}>{error}</div>
        </div>
      </form>
    </section>
  );
}
