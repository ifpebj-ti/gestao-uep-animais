import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://api.137-131-237-3.sslip.io";

export const options = {
  stages: [
    { duration: "20s", target: 5 },
    { duration: "40s", target: 10 },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

// Login uma vez so: o bcrypt consome CPU e a VM tem 1 vCPU.
export function setup() {
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: __ENV.EMAIL, senha: __ENV.SENHA }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, { "login 200": (r) => r.status === 200 });
  return { token: res.json("token") };
}

export default function (data) {
  const auth = { headers: { Authorization: `Bearer ${data.token}` } };

  const h = http.get(`${BASE}/health`);
  check(h, { "health 200": (r) => r.status === 200 });

  const me = http.get(`${BASE}/api/users/me`, auth);
  check(me, { "me 200": (r) => r.status === 200 });

  const ueps = http.get(`${BASE}/api/ueps`, auth);
  check(ueps, { "ueps 200": (r) => r.status === 200 });

  const animais = http.get(`${BASE}/api/animais`, auth);
  check(animais, { "animais 200": (r) => r.status === 200 });

  const censo = http.get(`${BASE}/api/animais/censo`, auth);
  check(censo, { "censo 200": (r) => r.status === 200 });

  sleep(1);
}
