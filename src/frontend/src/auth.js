import { AuthClient } from "@dfinity/auth-client";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "./bordtennis.did.js";

const CANISTER_ID = import.meta.env.VITE_BACKEND_CANISTER_ID;
const HOST = "https://icp-api.io";

// Internet Identity. The modern II flow also offers "Continue with Google",
// so Gmail login works through the same button.
const II_URL = "https://identity.ic0.app";

let authClient = null;

export async function getAuthClient() {
  if (!authClient) {
    authClient = await AuthClient.create({
      idleOptions: { disableIdle: true, disableDefaultIdleCallback: true },
    });
  }
  return authClient;
}

export function makeActor(identity) {
  const agent = HttpAgent.createSync({ host: HOST, identity });
  return Actor.createActor(idlFactory, { agent, canisterId: CANISTER_ID });
}

export async function login() {
  const client = await getAuthClient();
  await new Promise((resolve, reject) => {
    client.login({
      identityProvider: II_URL,
      maxTimeToLive: BigInt(7) * BigInt(24) * BigInt(3600) * BigInt(1000000000),
      onSuccess: resolve,
      onError: reject,
    });
  });
  return client.getIdentity();
}

export async function logout() {
  const client = await getAuthClient();
  await client.logout();
}
