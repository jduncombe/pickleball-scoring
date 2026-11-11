// Typed client for the pickleball-league API's sign-in and /scoring endpoints.
//
// Uses only the standard fetch API, so it runs unchanged on Android, iOS,
// the web and in Node tests. Platform concerns (where the token is kept,
// what happens on 401) are injected by the caller.

import { ApiError, parseErrorBody } from "./errors";
import type {
  CourtClaim,
  CourtMatch,
  LoginStep,
  Match,
  MatchResult,
  MatchStatus,
  MfaSetup,
  ScoringCourt,
  ScoringLeague,
  ScoringMatches,
  Session,
  User,
} from "./types";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  /** API root, e.g. "https://league.example.com/api" or "http://10.0.2.2:8000". */
  baseUrl: string;
  /** The current access token, if signed in. */
  getToken?: () => string | null;
  /** Called on any 401 from an authenticated request (expired or revoked session). */
  onUnauthorized?: () => void;
  timeoutMs?: number;
  fetch?: FetchLike;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export function normaliseBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly getToken: () => string | null;
  private readonly onUnauthorized?: () => void;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: ApiClientOptions) {
    this.baseUrl = normaliseBaseUrl(options.baseUrl);
    this.getToken = options.getToken ?? (() => null);
    this.onUnauthorized = options.onUnauthorized;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  }

  // --- Sign-in (password, then a TOTP code) ------------------------------------

  login(email: string, password: string): Promise<LoginStep> {
    return this.request("POST", "/auth/login", { email, password, client: "app" }, { auth: false });
  }

  mfaSetup(mfaToken: string): Promise<MfaSetup> {
    return this.request("POST", "/auth/mfa/setup", { mfa_token: mfaToken }, { auth: false });
  }

  mfaVerify(mfaToken: string, code: string): Promise<Session> {
    return this.request(
      "POST",
      "/auth/mfa/verify",
      { mfa_token: mfaToken, code: code.replace(/\s/g, ""), client: "app" },
      { auth: false },
    );
  }

  me(): Promise<User> {
    return this.request("GET", "/auth/me");
  }

  logout(): Promise<void> {
    return this.request("POST", "/auth/logout", undefined, { ignoreUnauthorized: true });
  }

  health(): Promise<{ status: string }> {
    return this.request("GET", "/health", undefined, { auth: false });
  }

  // --- Scoring -------------------------------------------------------------------

  leagues(): Promise<ScoringLeague[]> {
    return this.request("GET", "/scoring/leagues");
  }

  /** Courts no app has claimed. */
  freeCourts(leagueId: number): Promise<ScoringCourt[]> {
    return this.request("GET", `/scoring/leagues/${leagueId}/courts`);
  }

  claimCourt(leagueId: number, court: number, deviceName?: string): Promise<CourtClaim> {
    return this.request("POST", `/scoring/leagues/${leagueId}/courts/${court}/claim`, {
      device_name: deviceName?.trim() || null,
    });
  }

  releaseCourt(leagueId: number, court: number): Promise<void> {
    return this.request("DELETE", `/scoring/leagues/${leagueId}/courts/${court}/claim`);
  }

  courtMatch(leagueId: number, court: number): Promise<CourtMatch> {
    return this.request("GET", `/scoring/leagues/${leagueId}/courts/${court}/match`);
  }

  matches(leagueId: number, params: { week?: number; status?: MatchStatus } = {}): Promise<ScoringMatches> {
    const query = new URLSearchParams();
    if (params.week) query.set("week", String(params.week));
    if (params.status) query.set("status", params.status);
    const qs = query.toString();
    return this.request("GET", `/scoring/leagues/${leagueId}/matches${qs ? `?${qs}` : ""}`);
  }

  recordResult(matchId: number, result: MatchResult): Promise<Match> {
    return this.request("PUT", `/scoring/matches/${matchId}/result`, result);
  }

  // --- Plumbing --------------------------------------------------------------------

  private async request<T>(
    method: Method,
    path: string,
    body?: unknown,
    options: { auth?: boolean; ignoreUnauthorized?: boolean } = {},
  ): Promise<T> {
    if (!this.baseUrl) throw new ApiError(0, "Set the league server address in Settings");
    const auth = options.auth ?? true;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = auth ? this.getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, "Can't reach the league server; check the connection and try again");
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return undefined as T;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = parseErrorBody(response.status, data);
      if (error.isUnauthorized && auth && !options.ignoreUnauthorized) this.onUnauthorized?.();
      throw error;
    }
    return data as T;
  }
}
