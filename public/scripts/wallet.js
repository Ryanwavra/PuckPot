// public/scripts/wallet.js
import { MiniApp } from "@farcaster/miniapp-sdk";

const mini = new MiniApp();

export async function getUserAddress() {
  try {
    if (!mini.isMiniApp()) {
      throw new Error("Not running inside Base Mini App");
    }
    const address = await mini.getAddress();
    return address;
  } catch (err) {
    console.error("Failed to get address:", err);
    return null;
  }
}

export async function signMessage(message) {
  try {
    if (!mini.isMiniApp()) {
      throw new Error("Not running inside Base Mini App");
    }
    const signature = await mini.signMessage(message);
    return signature;
  } catch (err) {
    console.error("Failed to sign message:", err);
    return null;
  }
}