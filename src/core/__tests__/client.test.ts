import { ApiClient, normaliseBaseUrl } from "../api/client";
import { ApiError } from "../api/errors";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetch, calls };
}

describe("ApiClient", () => {
  it("signs in as the app client", async () => {
    const { fetch, calls } = fakeFetch(200, { mfa_token: "m", mfa_setup_required: false });
    const api = new ApiClient({ baseUrl: "https://league.test/api/", fetch });
    await api.login("a@b.c", "pw");
    expect(calls[0].url).toBe("https://league.test/api/auth/login");
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ email: "a@b.c", password: "pw", client: "app" });
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("sends the bearer token and the result", async () => {
    const { fetch, calls } = fakeFetch(200, { id: 12 });
    const api = new ApiClient({ baseUrl: "http://x", fetch, getToken: () => "tok" });
    await api.recordResult(12, { score_a: 11, score_b: 7 });
    expect(calls[0].url).toBe("http://x/scoring/matches/12/result");
    expect(calls[0].init!.method).toBe("PUT");
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("builds the claim and matches URLs", async () => {
    const { fetch, calls } = fakeFetch(201, {});
    const api = new ApiClient({ baseUrl: "http://x", fetch });
    await api.claimCourt(3, 2, "  Court 2 tablet ");
    expect(calls[0].url).toBe("http://x/scoring/leagues/3/courts/2/claim");
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ device_name: "Court 2 tablet" });
    await api.matches(3, { week: 2, status: "completed" });
    expect(calls[1].url).toBe("http://x/scoring/leagues/3/matches?week=2&status=completed");
  });

  it("handles 204 responses", async () => {
    const { fetch } = fakeFetch(204, null);
    await expect(new ApiClient({ baseUrl: "http://x", fetch }).releaseCourt(1, 1)).resolves.toBeUndefined();
  });

  it("turns validation errors into readable ApiErrors", async () => {
    const { fetch } = fakeFetch(422, {
      detail: [{ loc: ["body", "score_b"], msg: "11-10 isn't finished", type: "score_rules" }],
    });
    const error = await new ApiClient({ baseUrl: "http://x", fetch })
      .recordResult(1, { score_a: 11, score_b: 10 })
      .catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.message).toBe("11-10 isn't finished");
    expect(error.fields).toEqual(["score_b"]);
  });

  it("reports 401s so the app can sign out", async () => {
    const { fetch } = fakeFetch(401, { detail: "Not signed in" });
    const onUnauthorized = jest.fn();
    const api = new ApiClient({ baseUrl: "http://x", fetch, onUnauthorized });
    await expect(api.leagues()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    // A wrong password isn't an expired session.
    await expect(api.login("a", "b")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("marks network failures as retryable", async () => {
    const api = new ApiClient({
      baseUrl: "http://x",
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
    });
    const error = await api.leagues().catch((e) => e);
    expect(error.isNetworkError).toBe(true);
  });

  it("asks for a server address when there isn't one", async () => {
    await expect(new ApiClient({ baseUrl: "" }).leagues()).rejects.toMatchObject({ status: 0 });
  });
});

describe("normaliseBaseUrl", () => {
  it("adds https and drops trailing slashes", () => {
    expect(normaliseBaseUrl(" league.test/api// ")).toBe("https://league.test/api");
    expect(normaliseBaseUrl("http://10.0.2.2:8000")).toBe("http://10.0.2.2:8000");
  });
});
