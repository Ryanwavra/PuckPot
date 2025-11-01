const connectBtn = document.getElementById("connect");

// -----------------------------
// 🔧 Network Config
// -----------------------------
const NETWORKS = {
  baseMainnet: {
    chainId: "0x2105", // 8453
    chainName: "Base Mainnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
  },
  baseSepolia: {
    chainId: "0x14A74", // 84532
    chainName: "Base Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
};

// 👉 Toggle this between "baseSepolia" (dev/test) and "baseMainnet" (production)
const ACTIVE_NETWORK = "baseSepolia";

// -----------------------------
// 🔧 Helpers
// -----------------------------
function shortenAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function updateButton(address) {
  connectBtn.textContent = shortenAddress(address);
  connectBtn.classList.add("connected");
  connectBtn.disabled = true;
}

function resetButton() {
  connectBtn.textContent = "Connect Wallet";
  connectBtn.classList.remove("connected");
  connectBtn.disabled = false;
}

async function ensureCorrectNetwork(provider) {
  const target = NETWORKS[ACTIVE_NETWORK];
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target.chainId }],
    });
  } catch (err) {
    if (err?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [target],
      });
    } else {
      throw err;
    }
  }
}

// -----------------------------
// 🔧 Core Functions
// -----------------------------
async function connectWallet() {
  const provider = window.ethereum;
  if (!provider) {
    alert("No wallet found. Install MetaMask, Coinbase Wallet, or Phantom.");
    return;
  }

  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const address = accounts[0];
    await ensureCorrectNetwork(provider);

    updateButton(address);
    localStorage.setItem("connectedAddress", address);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function checkConnection() {
  const provider = window.ethereum;
  if (!provider) return;

  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      const address = accounts[0];
      updateButton(address);
      localStorage.setItem("connectedAddress", address);
    } else {
      resetButton();
      localStorage.removeItem("connectedAddress");
    }
  } catch (err) {
    console.error("Error checking connection:", err);
  }
}

// -----------------------------
// 🔧 Event listeners
// -----------------------------
if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (accounts.length > 0) {
      updateButton(accounts[0]);
      localStorage.setItem("connectedAddress", accounts[0]);
    } else {
      resetButton();
      localStorage.removeItem("connectedAddress");
    }
  });

  window.ethereum.on("chainChanged", () => {
    // Reload to ensure dapp picks up new network
    window.location.reload();
  });
}

connectBtn?.addEventListener("click", connectWallet);
window.addEventListener("DOMContentLoaded", checkConnection);