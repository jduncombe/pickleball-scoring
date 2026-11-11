// Payloads of the pickleball-league API used by the scoring app.
// Mirrors api/app/schemas.py in jduncombe/pickleball-league.

export type UserRole = "admin" | "user" | "umpire";
export type MatchStatus = "scheduled" | "in_progress" | "completed";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  mfa_enabled: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface LoginStep {
  mfa_token: string;
  mfa_setup_required: boolean;
}

export interface MfaSetup {
  secret: string;
  otpauth_uri: string;
  /** The otpauth URI as a QR code: an SVG data: URI. */
  qr_data_uri: string;
}

export interface Session {
  user: User;
  expires_at: string;
  access_token: string | null;
}

export interface ScoringLeague {
  id: number;
  name: string;
  num_courts: number;
  current_week: number;
  points_to_win: number;
}

export interface ScoringCourt {
  court: number;
  /** A match is on this court now (it can still be claimed). */
  in_use: boolean;
}

export interface ClaimHolder {
  id: number;
  name: string;
}

export interface CourtClaim {
  league_id: number;
  court: number;
  device_name: string | null;
  claimed_by: ClaimHolder | null;
  claimed_at: string;
}

export interface TeamRef {
  id: number;
  name: string | null;
  display_name: string;
  dupr_ready: boolean;
}

export interface Match {
  id: number;
  league_id: number;
  week: number;
  round: number;
  status: MatchStatus;
  court: number | null;
  team_a: TeamRef;
  team_b: TeamRef;
  score_a: number | null;
  score_b: number | null;
  started_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
}

export interface CourtMatch {
  league_id: number;
  league_name: string;
  court: number;
  points_to_win: number;
  claim: CourtClaim | null;
  /** Null when nothing is being played on the court. */
  match: Match | null;
}

export interface ScoringMatches {
  league_id: number;
  league_name: string;
  points_to_win: number;
  week: number;
  matches: Match[];
}

export interface MatchResult {
  score_a: number;
  score_b: number;
}
