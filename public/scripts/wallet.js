const connectBtn = document.getElementById("connect");
const statusEl = document.getElementById("status") || (() => {
  const s = document.createElement("div");
  s.id = "status";
  s.style.marginLeft = "8px";
  document.querySelector(".header")?.appendChild(s);
  return s;
})();

function setStatus(msg) {
  if (typeof statusEl === "function") return;
  statusEl.textContent = msg;
}

async function connectWallet() {
  const provider = window.ethereum;
  if (!provider) {
    setStatus("No wallet found. Install MetaMask or Coinbase Wallet.");
    return;
  }

  // Base Sepolia config
  const baseSepolia = {
    chainId: "0x14A74", // 84532
    chainName: "Base Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"]
  };

  try {
    // Request accounts
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const address = accounts[0];

    // Switch or add Base Sepolia
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: baseSepolia.chainId }]
      });
    } catch (err) {
      if (err?.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [baseSepolia]
        });
      } else {
        throw err;
      }
    }

    setStatus(`Connected: ${address}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
}

connectBtn?.addEventListener("click", connectWallet);