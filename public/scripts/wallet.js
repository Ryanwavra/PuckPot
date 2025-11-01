// public/scripts/wallet.js

export async function getUserAddress() {
  try {
    if (!window.MiniKit) {
      throw new Error("MiniKit not available. Open in Base app.");
    }
    const address = await window.MiniKit.ethereum.getAddress();
    return address;
  } catch (err) {
    console.error("MiniKit not available. Open in Base app.", err);
    return null;
  }
}

export async function signMessage(message) {
  try {
    if (!window.MiniKit) {
      throw new Error("MiniKit not available. Open in Base app.");
    }
    return await window.MiniKit.ethereum.signMessage(message);
  } catch (err) {
    console.error("Failed to sign message:", err);
    return null;
  }
}