// public/scripts/wallet.js
import { MiniKit } from "@farcaster/mini-kit";

const miniKit = new MiniKit();

export async function getUserAddress() {
  try {
    const address = await miniKit.ethereum.getAddress();
    return address;
  } catch (err) {
    console.error("MiniKit not available. Open in Base app.", err);
    return null;
  }
}

export async function signMessage(message) {
  try {
    return await miniKit.ethereum.signMessage(message);
  } catch (err) {
    console.error("Failed to sign message:", err);
    return null;
  }
}